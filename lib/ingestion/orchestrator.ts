import { db } from "../db";
import { getFeedAdapter } from "./adapters";
import { generateClusterKey, generateDedupeKey } from "./dedupe";
import {
  evaluateDeterministicFilters,
  type CandidateFilterCriteria,
  type DeterministicFilterOptions,
  type JobFilterInput,
} from "../filters/deterministic";
import { deserializeCandidateProfile } from "../../types/candidate";
import type { FeedSource, RawFeedJob, FeedPollResult } from "../../types/feed-source";

export interface SyncOptions {
  prismaClient?: typeof db;
  candidateId?: string;
  fetchFn?: typeof fetch;
  filterOptions?: DeterministicFilterOptions;
  limit?: number;
  abortSignal?: AbortSignal;
  forceSync?: boolean;
}

export interface SyncResult {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  status: "SUCCESS" | "ERROR" | "SKIPPED";
  jobsDiscovered: number;
  jobsPassed: number;
  jobsDuplicates: number;
  jobsStaged: number;
  error?: string;
  nextCursor?: string;
  durationMs: number;
}

export interface SyncAllOptions extends SyncOptions {
  onlyEnabled?: boolean;
  sourceTypes?: string[];
  sourceIds?: string[];
}

export interface SyncAllResult {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  skippedSources: number;
  totalDiscovered: number;
  totalPassed: number;
  totalDuplicates: number;
  totalStaged: number;
  results: SyncResult[];
  durationMs: number;
}

/**
 * In-process Ingestion Orchestrator that manages feed polling,
 * two-tier deduplication, zero-token deterministic filtering,
 * discovery buffer staging, cursor management, and audit logging.
 */
export class IngestionOrchestrator {
  private prismaClient: typeof db;
  private syncQueue: Promise<unknown> = Promise.resolve();

  constructor(prismaClient: typeof db = db) {
    this.prismaClient = prismaClient;
  }

  /**
   * Enqueues an async task to ensure sequential execution against SQLite WAL,
   * eliminating database write lock contention.
   */
  private runSequentially<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.syncQueue.then(fn, fn);
    this.syncQueue = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  /**
   * Synchronizes a single feed source on-demand.
   */
  public async syncSource(
    sourceOrId: string | FeedSource,
    options?: SyncOptions
  ): Promise<SyncResult> {
    return this.runSequentially(async () => {
      const startTime = Date.now();
      const prisma = options?.prismaClient || this.prismaClient;

      let sourceRecord: FeedSource | null = null;
      if (typeof sourceOrId === "string") {
        sourceRecord = (await prisma.feedSource.findUnique({
          where: { id: sourceOrId },
        })) as FeedSource | null;
      } else {
        sourceRecord = sourceOrId;
      }

      if (!sourceRecord) {
        const missingId = typeof sourceOrId === "string" ? sourceOrId : "unknown";
        return {
          sourceId: missingId,
          sourceType: "UNKNOWN",
          sourceName: "Unknown Source",
          status: "ERROR",
          jobsDiscovered: 0,
          jobsPassed: 0,
          jobsDuplicates: 0,
          jobsStaged: 0,
          error: `Feed source '${missingId}' not found`,
          durationMs: Date.now() - startTime,
        };
      }

      if (!sourceRecord.enabled && !options?.forceSync) {
        return {
          sourceId: sourceRecord.id,
          sourceType: sourceRecord.type,
          sourceName: sourceRecord.name,
          status: "SKIPPED",
          jobsDiscovered: 0,
          jobsPassed: 0,
          jobsDuplicates: 0,
          jobsStaged: 0,
          durationMs: Date.now() - startTime,
        };
      }

      try {
        // Step 1: Resolve Candidate Filter Criteria
        const candidateCriteria = await this.resolveCandidateCriteria(
          options?.candidateId,
          prisma
        );

        // Step 2: Get Adapter & Poll Feed
        const adapter = getFeedAdapter(sourceRecord.type);
        const pollResult: FeedPollResult = await adapter.poll(
          sourceRecord,
          candidateCriteria,
          {
            fetchFn: options?.fetchFn,
            limit: options?.limit,
            abortSignal: options?.abortSignal,
          }
        );

        const rawJobs = pollResult.jobs || [];

        // Step 3: Two-Tier Deduplication (Batch dedupe + SQLite lookup)
        const { uniqueJobs, duplicateCount } = await this.deduplicateJobs(
          rawJobs,
          prisma
        );

        // Step 4: Deterministic Filtering (0 AI token overhead)
        const filterPassingJobs = this.filterJobsDeterministically(
          uniqueJobs,
          candidateCriteria,
          options?.filterOptions
        );

        // Step 5: Stage Surviving Jobs into Discovery Buffer
        const stagedJobsCount = await this.stageJobs(
          filterPassingJobs,
          sourceRecord,
          prisma
        );

        // Step 6: Update Source Metrics & Incremental Cursor
        const nextCursor = pollResult.nextCursor !== undefined ? pollResult.nextCursor : sourceRecord.lastCursor;
        const consecutiveEmpty =
          rawJobs.length === 0 ? (sourceRecord.consecutiveEmpty || 0) + 1 : 0;

        await prisma.feedSource.update({
          where: { id: sourceRecord.id },
          data: {
            lastCursor: nextCursor,
            lastPolledAt: new Date(),
            jobsDiscovered: { increment: rawJobs.length },
            jobsPassed: { increment: stagedJobsCount },
            consecutiveEmpty,
            errorCount: 0,
            lastError: "",
          },
        });

        // Step 7: Record Audit Event
        await prisma.event.create({
          data: {
            entityType: "FeedSource",
            entityId: sourceRecord.id,
            eventType: "FEED_SYNC_SUCCESS",
            payload: JSON.stringify({
              sourceType: sourceRecord.type,
              sourceName: sourceRecord.name,
              discovered: rawJobs.length,
              passed: stagedJobsCount,
              duplicates: duplicateCount,
              staged: stagedJobsCount,
              cursor: nextCursor,
            }),
          },
        });

        return {
          sourceId: sourceRecord.id,
          sourceType: sourceRecord.type,
          sourceName: sourceRecord.name,
          status: "SUCCESS",
          jobsDiscovered: rawJobs.length,
          jobsPassed: stagedJobsCount,
          jobsDuplicates: duplicateCount,
          jobsStaged: stagedJobsCount,
          nextCursor,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Update error state on FeedSource record
        try {
          await prisma.feedSource.update({
            where: { id: sourceRecord.id },
            data: {
              lastPolledAt: new Date(),
              lastError: errorMessage,
              errorCount: { increment: 1 },
            },
          });

          await prisma.event.create({
            data: {
              entityType: "FeedSource",
              entityId: sourceRecord.id,
              eventType: "FEED_SYNC_ERROR",
              payload: JSON.stringify({
                sourceType: sourceRecord.type,
                sourceName: sourceRecord.name,
                error: errorMessage,
              }),
            },
          });
        } catch {
          // Ignore secondary DB error during error handling
        }

        return {
          sourceId: sourceRecord.id,
          sourceType: sourceRecord.type,
          sourceName: sourceRecord.name,
          status: "ERROR",
          jobsDiscovered: 0,
          jobsPassed: 0,
          jobsDuplicates: 0,
          jobsStaged: 0,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Synchronizes all enabled feed sources sequentially.
   */
  public async syncAllSources(
    options?: SyncAllOptions
  ): Promise<SyncAllResult> {
    const startTime = Date.now();
    const prisma = options?.prismaClient || this.prismaClient;
    const onlyEnabled = options?.onlyEnabled ?? true;

    const sources = (await prisma.feedSource.findMany({
      where: {
        ...(onlyEnabled ? { enabled: true } : {}),
        ...(options?.sourceTypes && options.sourceTypes.length > 0
          ? { type: { in: options.sourceTypes } }
          : {}),
        ...(options?.sourceIds && options.sourceIds.length > 0
          ? { id: { in: options.sourceIds } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    })) as FeedSource[];

    const results: SyncResult[] = [];
    let totalDiscovered = 0;
    let totalPassed = 0;
    let totalDuplicates = 0;
    let totalStaged = 0;
    let successfulSources = 0;
    let failedSources = 0;
    let skippedSources = 0;

    for (const source of sources) {
      const result = await this.syncSource(source, options);
      results.push(result);

      totalDiscovered += result.jobsDiscovered;
      totalPassed += result.jobsPassed;
      totalDuplicates += result.jobsDuplicates;
      totalStaged += result.jobsStaged;

      if (result.status === "SUCCESS") {
        successfulSources++;
      } else if (result.status === "ERROR") {
        failedSources++;
      } else if (result.status === "SKIPPED") {
        skippedSources++;
      }
    }

    return {
      totalSources: sources.length,
      successfulSources,
      failedSources,
      skippedSources,
      totalDiscovered,
      totalPassed,
      totalDuplicates,
      totalStaged,
      results,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Performs two-tier deduplication: intra-batch and bulk SQLite lookup.
   */
  private async deduplicateJobs(
    rawJobs: RawFeedJob[],
    prisma: typeof db
  ): Promise<{
    uniqueJobs: Array<RawFeedJob & { dedupeKey: string }>;
    duplicateCount: number;
  }> {
    if (rawJobs.length === 0) {
      return { uniqueJobs: [], duplicateCount: 0 };
    }

    // Tier 1: Intra-batch deduplication
    const seenBatchKeys = new Set<string>();
    const seenBatchExternalIds = new Set<string>();
    const intraBatchUnique: Array<RawFeedJob & { dedupeKey: string }> = [];

    for (const job of rawJobs) {
      const dedupeKey = generateDedupeKey({
        company: job.company,
        title: job.title,
        url: job.url,
      });

      const extId = (job.sourceExternalId || "").trim();

      if (seenBatchKeys.has(dedupeKey)) {
        continue;
      }
      if (extId && seenBatchExternalIds.has(extId)) {
        continue;
      }

      seenBatchKeys.add(dedupeKey);
      if (extId) {
        seenBatchExternalIds.add(extId);
      }

      intraBatchUnique.push({
        ...job,
        dedupeKey,
      });
    }

    if (intraBatchUnique.length === 0) {
      return { uniqueJobs: [], duplicateCount: rawJobs.length };
    }

    // Tier 2: Bulk SQLite lookup
    const dedupeKeysToLookup = intraBatchUnique.map((j) => j.dedupeKey);
    const externalIdsToLookup = intraBatchUnique
      .map((j) => (j.sourceExternalId || "").trim())
      .filter(Boolean);

    const orClauses: Array<{ dedupeKey?: { in: string[] }; sourceExternalId?: { in: string[] } }> = [
      { dedupeKey: { in: dedupeKeysToLookup } },
    ];

    if (externalIdsToLookup.length > 0) {
      orClauses.push({ sourceExternalId: { in: externalIdsToLookup } });
    }

    const existingJobs = await prisma.job.findMany({
      where: {
        OR: orClauses,
      },
      select: {
        dedupeKey: true,
        sourceExternalId: true,
      },
    });

    const existingDedupeKeys = new Set(existingJobs.map((j) => j.dedupeKey));
    const existingExternalIds = new Set(
      existingJobs
        .map((j) => (j.sourceExternalId || "").trim())
        .filter(Boolean)
    );

    const survivingJobs = intraBatchUnique.filter((job) => {
      if (existingDedupeKeys.has(job.dedupeKey)) {
        return false;
      }
      const extId = (job.sourceExternalId || "").trim();
      if (extId && existingExternalIds.has(extId)) {
        return false;
      }
      return true;
    });

    const duplicateCount = rawJobs.length - survivingJobs.length;

    return {
      uniqueJobs: survivingJobs,
      duplicateCount,
    };
  }

  /**
   * Applies deterministic zero-token candidate filters.
   */
  private filterJobsDeterministically(
    jobs: Array<RawFeedJob & { dedupeKey: string }>,
    candidateCriteria: CandidateFilterCriteria,
    filterOptions?: DeterministicFilterOptions
  ): Array<RawFeedJob & { dedupeKey: string }> {
    return jobs.filter((job) => {
      const jobInput: JobFilterInput = {
        title: job.title,
        company: job.company,
        location: job.location || "",
        remoteStatus: job.remoteStatus || "UNKNOWN",
        salaryMin: job.salaryMin ?? null,
        salaryMax: job.salaryMax ?? null,
        currency: job.salaryCurrency || undefined,
        description: job.description || job.rawText || "",
      };

      const result = evaluateDeterministicFilters(
        candidateCriteria,
        jobInput,
        filterOptions
      );

      return result.passed;
    });
  }

  /**
   * Staging persistence layer: Saves surviving jobs into the discovery buffer (isStaged = true).
   */
  private async stageJobs(
    jobs: Array<RawFeedJob & { dedupeKey: string }>,
    source: FeedSource,
    prisma: typeof db
  ): Promise<number> {
    if (jobs.length === 0) {
      return 0;
    }

    const stagedRecords = jobs.map((job) => {
      const clusterKey = generateClusterKey(job.company, job.title);

      return {
        dedupeKey: job.dedupeKey,
        clusterKey,
        sourceExternalId: job.sourceExternalId || "",
        title: job.title,
        company: job.company,
        location: job.location || "",
        remoteStatus: job.remoteStatus || "UNKNOWN",
        salaryMin: job.salaryMin ?? null,
        salaryMax: job.salaryMax ?? null,
        currency: job.salaryCurrency || "INR",
        employmentType: "FULL_TIME",
        description: job.description || job.rawText || "",
        url: job.url || "",
        source: source.type,
        feedSourceId: source.id,
        isStaged: true,
        status: "DISCOVERED",
        postedAt: job.postedAt ?? null,
        discoveredAt: new Date(),
      };
    });

    if (typeof prisma.job.createMany === "function") {
      await prisma.job.createMany({
        data: stagedRecords,
      });
    } else {
      for (const record of stagedRecords) {
        await prisma.job.create({
          data: record,
        });
      }
    }

    return stagedRecords.length;
  }

  /**
   * Helper to resolve candidate filter criteria from the database.
   */
  private async resolveCandidateCriteria(
    candidateId?: string,
    prisma: typeof db = this.prismaClient
  ): Promise<CandidateFilterCriteria> {
    let candidateRecord = null;

    if (candidateId) {
      candidateRecord = await prisma.candidate.findUnique({
        where: { id: candidateId },
      });
    }

    if (!candidateRecord) {
      candidateRecord = await prisma.candidate.findFirst();
    }

    if (!candidateRecord) {
      return {
        minSalary: 0,
        currency: "INR",
        yearsOfExperience: 0,
        remotePreference: "ANY",
        preferredLocations: [],
      };
    }

    const profile = deserializeCandidateProfile(candidateRecord as never);

    return {
      minSalary: profile.minSalary,
      currency: profile.currency,
      yearsOfExperience: profile.yearsOfExperience,
      remotePreference: profile.remotePreference,
      preferredLocations: profile.preferredLocations,
      blacklistedCompanies: profile.companyStageBlacklist,
      blacklistedKeywords: profile.companyStageBlacklist,
    };
  }
}

/**
 * Singleton orchestrator instance for convenient module usage.
 */
export const ingestionOrchestrator = new IngestionOrchestrator();

/**
 * Convenience function for syncing a single feed source.
 */
export async function syncFeedSource(
  sourceOrId: string | FeedSource,
  options?: SyncOptions
): Promise<SyncResult> {
  return ingestionOrchestrator.syncSource(sourceOrId, options);
}

/**
 * Convenience function for syncing all feed sources.
 */
export async function syncAllFeedSources(
  options?: SyncAllOptions
): Promise<SyncAllResult> {
  return ingestionOrchestrator.syncAllSources(options);
}
