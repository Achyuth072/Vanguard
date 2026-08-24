import { db } from "./db";
import {
  evaluateDeterministicFilters,
  type CandidateFilterCriteria,
  type JobFilterInput,
} from "./filters/deterministic";
import {
  scoreJobFit,
  scoreJobHybrid,
  type AIRouterOptions,
  type CandidateContext,
  type JobContext,
  type FitScore,
} from "./ai/router";
import { FeedbackLoopService } from "./scoring/feedback-loop";
import { deserializeCandidateProfile } from "../types/candidate";

export interface GetDiscoveryJobsOptions {
  page?: number;
  limit?: number;
  source?: string;
  feedSourceId?: string;
  search?: string;
  sort?: string;
  candidateId?: string;
  prismaClient?: typeof db;
}

export interface MatchBadge {
  label: string;
  type: "salary" | "remote" | "location" | "experience" | "source";
  matched: boolean;
}

export interface DiscoveryJobItem {
  id: string;
  dedupeKey: string;
  clusterKey: string;
  sourceExternalId: string;
  title: string;
  company: string;
  location: string;
  remoteStatus: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  employmentType: string;
  description: string;
  url: string;
  source: string;
  feedSourceId: string | null;
  feedSource?: {
    id: string;
    name: string;
    type: string;
  } | null;
  isStaged: boolean;
  status: string;
  postedAt: Date | null;
  discoveredAt: Date;
  matchBadges: MatchBadge[];
}

export interface DiscoveryJobsResult {
  jobs: DiscoveryJobItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface IngestStagedJobsOptions {
  candidateId?: string;
  prismaClient?: typeof db;
  aiOptions?: AIRouterOptions;
}

export interface IngestedJobDetail {
  id: string;
  title: string;
  company: string;
  score: number;
  recommendation: string;
  fitScore: FitScore;
}

export interface IngestStagedJobsResult {
  ingestedCount: number;
  failedCount: number;
  ingestedJobs: IngestedJobDetail[];
  errors: Array<{ id: string; error: string }>;
}

export interface DismissStagedJobsOptions {
  reason?: string;
  prismaClient?: typeof db;
}

export interface DismissStagedJobsResult {
  dismissedCount: number;
  dismissedJobIds: string[];
}

/**
 * Retrieves staged discovery jobs with pagination, filtering, search, and calculated match badges.
 */
export async function getDiscoveryJobs(
  options?: GetDiscoveryJobsOptions
): Promise<DiscoveryJobsResult> {
  const prisma = options?.prismaClient || db;
  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 20));
  const skip = (page - 1) * limit;

  // Resolve candidate for match badge evaluation
  const candidateRecord = options?.candidateId
    ? await prisma.candidate.findUnique({ where: { id: options.candidateId } })
    : await prisma.candidate.findFirst();

  let candidateCriteria: CandidateFilterCriteria | null = null;
  if (candidateRecord) {
    const profile = deserializeCandidateProfile(candidateRecord as never);
    candidateCriteria = {
      minSalary: profile.minSalary,
      currency: profile.currency,
      yearsOfExperience: profile.yearsOfExperience,
      remotePreference: profile.remotePreference,
      preferredLocations: profile.preferredLocations,
      blacklistedCompanies: profile.companyStageBlacklist,
      blacklistedKeywords: profile.companyStageBlacklist,
    };
  }

  // Build where conditions
  const where: Record<string, unknown> = {
    isStaged: true,
    status: { notIn: ["IGNORED", "ARCHIVED", "REJECTED"] },
  };

  if (options?.source) {
    where.source = options.source;
  }

  if (options?.feedSourceId) {
    where.feedSourceId = options.feedSourceId;
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { title: { contains: q } },
      { company: { contains: q } },
      { location: { contains: q } },
      { description: { contains: q } },
    ];
  }

  // Parse sorting
  let orderBy: Record<string, "asc" | "desc"> = { discoveredAt: "desc" };
  if (options?.sort) {
    const [field, direction] = options.sort.split(":");
    const dir = direction === "asc" ? "asc" : "desc";
    if (field === "discoveredAt" || field === "postedAt" || field === "company" || field === "title") {
      orderBy = { [field]: dir };
    }
  }

  const [total, rawJobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: {
        feedSource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const jobs: DiscoveryJobItem[] = rawJobs.map((job) => {
    const matchBadges: MatchBadge[] = [];

    // Source badge
    matchBadges.push({
      label: job.source,
      type: "source",
      matched: true,
    });

    if (candidateCriteria) {
      const jobInput: JobFilterInput = {
        title: job.title,
        company: job.company,
        location: job.location,
        remoteStatus: job.remoteStatus,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        description: job.description,
      };

      const filterResult = evaluateDeterministicFilters(candidateCriteria, jobInput);

      // Remote badge
      if (job.remoteStatus && job.remoteStatus !== "UNKNOWN") {
        matchBadges.push({
          label: job.remoteStatus,
          type: "remote",
          matched: !filterResult.reasons.some((r) => r.startsWith("REMOTE_MISMATCH")),
        });
      }

      // Salary badge
      if (job.salaryMin !== null && job.salaryMin !== undefined) {
        matchBadges.push({
          label: `${job.currency} ${job.salaryMin.toLocaleString()}${job.salaryMax ? ` - ${job.salaryMax.toLocaleString()}` : "+"}`,
          type: "salary",
          matched: !filterResult.reasons.some((r) => r.startsWith("SALARY_BELOW_MINIMUM")),
        });
      }

      // Location badge
      if (job.location) {
        matchBadges.push({
          label: job.location,
          type: "location",
          matched: !filterResult.reasons.some((r) => r.startsWith("LOCATION_UNMATCHED")),
        });
      }
    }

    return {
      id: job.id,
      dedupeKey: job.dedupeKey,
      clusterKey: job.clusterKey,
      sourceExternalId: job.sourceExternalId,
      title: job.title,
      company: job.company,
      location: job.location,
      remoteStatus: job.remoteStatus,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      employmentType: job.employmentType,
      description: job.description,
      url: job.url,
      source: job.source,
      feedSourceId: job.feedSourceId,
      feedSource: job.feedSource,
      isStaged: job.isStaged,
      status: job.status,
      postedAt: job.postedAt,
      discoveredAt: job.discoveredAt,
      matchBadges,
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    jobs,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Triggers AI Fit Scoring for selected staged jobs, persists FitScores,
 * and transitions them to isStaged: false (Priority Inbox).
 */
export async function ingestStagedJobs(
  jobIds: string[],
  options?: IngestStagedJobsOptions
): Promise<IngestStagedJobsResult> {
  const prisma = options?.prismaClient || db;
  const ingestedJobs: IngestedJobDetail[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  if (!jobIds || jobIds.length === 0) {
    return {
      ingestedCount: 0,
      failedCount: 0,
      ingestedJobs: [],
      errors: [],
    };
  }

  // Fetch candidate
  const candidateRecord = options?.candidateId
    ? await prisma.candidate.findUnique({ where: { id: options.candidateId } })
    : await prisma.candidate.findFirst();

  const candidateContext: CandidateContext = {
    name: candidateRecord?.name || "Candidate",
    location: candidateRecord?.location || "",
    targetRole: candidateRecord?.targetRole || "Software Engineer",
    minSalary: candidateRecord?.minSalary || 0,
    yearsOfExperience: candidateRecord?.yearsOfExperience || 0,
    remotePreference: candidateRecord?.remotePreference || "ANY",
    preferredLocations: candidateRecord?.preferredLocations || "[]",
    skills: candidateRecord?.skills || "[]",
    projects: candidateRecord?.projects || "[]",
    experiences: candidateRecord?.experiences || "[]",
    resumeText: candidateRecord?.resumeText || "",
  };

  const aiOptions: AIRouterOptions = { ...(options?.aiOptions || {}) };
  if (!aiOptions.weights || !aiOptions.conversionInsights) {
    try {
      const activeWeights = await FeedbackLoopService.getActiveWeights(prisma);
      aiOptions.weights = aiOptions.weights || activeWeights.weights;
      const insights = await FeedbackLoopService.getConversionInsights(prisma);
      aiOptions.conversionInsights = aiOptions.conversionInsights || insights;
    } catch {
      // Fallback gracefully
    }
  }

  // Pre-fetch all requested jobs in a single database query
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
  });
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  // Process jobs in concurrent chunks of 5 for optimal throughput and zero-token speed
  const CHUNK_SIZE = 5;
  for (let i = 0; i < jobIds.length; i += CHUNK_SIZE) {
    const chunk = jobIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (jobId) => {
        try {
          const job = jobMap.get(jobId);

          if (!job) {
            errors.push({ id: jobId, error: `Job ${jobId} not found` });
            return;
          }

          if (!job.isStaged) {
            errors.push({ id: jobId, error: `Job ${jobId} is already ingested (not in staged buffer)` });
            return;
          }

          const jobContext: JobContext = {
            title: job.title,
            company: job.company,
            location: job.location,
            remoteStatus: job.remoteStatus,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            employmentType: job.employmentType,
            description: job.description,
          };

          // Run AI Fit Scoring with intelligent local hybrid fallback
          let fitScore: FitScore;
          try {
            fitScore = await scoreJobFit(candidateContext, jobContext, aiOptions);
          } catch {
            fitScore = await scoreJobHybrid(candidateContext, jobContext, {
              weights: aiOptions.weights,
            });
          }

          // Persist FitScore
          await prisma.fitScore.upsert({
            where: { jobId: job.id },
            create: {
              jobId: job.id,
              score: fitScore.score,
              recommendation: fitScore.recommendation,
              skillsFit: fitScore.skillsFit,
              experienceFit: fitScore.experienceFit,
              domainFit: fitScore.domainFit,
              trajectoryFit: fitScore.trajectoryFit,
              strengths: JSON.stringify(fitScore.strengths || []),
              gaps: JSON.stringify(fitScore.gaps || []),
              risks: JSON.stringify(fitScore.risks || []),
              reasoning: fitScore.reasoning || "",
            },
            update: {
              score: fitScore.score,
              recommendation: fitScore.recommendation,
              skillsFit: fitScore.skillsFit,
              experienceFit: fitScore.experienceFit,
              domainFit: fitScore.domainFit,
              trajectoryFit: fitScore.trajectoryFit,
              strengths: JSON.stringify(fitScore.strengths || []),
              gaps: JSON.stringify(fitScore.gaps || []),
              risks: JSON.stringify(fitScore.risks || []),
              reasoning: fitScore.reasoning || "",
            },
          });

          // Transition job to Priority Inbox (isStaged: false)
          await prisma.job.update({
            where: { id: job.id },
            data: {
              isStaged: false,
              status: "DISCOVERED",
            },
          });

          // Log audit event
          await prisma.event.create({
            data: {
              entityType: "Job",
              entityId: job.id,
              eventType: "JOB_INGESTED_FROM_DISCOVERY",
              payload: JSON.stringify({
                score: fitScore.score,
                recommendation: fitScore.recommendation,
                company: job.company,
                title: job.title,
              }),
            },
          });

          ingestedJobs.push({
            id: job.id,
            title: job.title,
            company: job.company,
            score: fitScore.score,
            recommendation: fitScore.recommendation,
            fitScore,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ id: jobId, error: msg });
        }
      })
    );
  }

  return {
    ingestedCount: ingestedJobs.length,
    failedCount: errors.length,
    ingestedJobs,
    errors,
  };
}

/**
 * Dismisses unwanted staged jobs from the buffer by updating status to IGNORED and isStaged to false.
 */
export async function dismissStagedJobs(
  jobIds: string[],
  options?: DismissStagedJobsOptions
): Promise<DismissStagedJobsResult> {
  const prisma = options?.prismaClient || db;

  if (!jobIds || jobIds.length === 0) {
    return {
      dismissedCount: 0,
      dismissedJobIds: [],
    };
  }

  const existingStagedJobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      isStaged: true,
    },
    select: { id: true, company: true, title: true },
  });

  const matchingIds = existingStagedJobs.map((j) => j.id);

  if (matchingIds.length === 0) {
    return {
      dismissedCount: 0,
      dismissedJobIds: [],
    };
  }

  await prisma.job.updateMany({
    where: { id: { in: matchingIds } },
    data: {
      isStaged: false,
      status: "IGNORED",
    },
  });

  // Log audit events
  for (const job of existingStagedJobs) {
    await prisma.event.create({
      data: {
        entityType: "Job",
        entityId: job.id,
        eventType: "JOB_DISMISSED_FROM_DISCOVERY",
        payload: JSON.stringify({
          reason: options?.reason || "User dismissed from discovery staging buffer",
          company: job.company,
          title: job.title,
        }),
      },
    });
  }

  return {
    dismissedCount: matchingIds.length,
    dismissedJobIds: matchingIds,
  };
}
