import { db } from "@/lib/db";
import { transitionApplicationStatus } from "./service";
import type { EnrichedJob } from "@/lib/data";

export const DEFAULT_GHOST_THRESHOLD_DAYS = 21; // 3 weeks
export const STALE_THRESHOLD_DAYS = 14; // 2 weeks

/**
 * Calculates elapsed calendar days since an application was submitted.
 */
export function calculateDaysSinceApplied(
  appliedAt?: Date | string | null,
  relativeTo: Date = new Date()
): number | null {
  if (!appliedAt) return null;
  const appliedDate = typeof appliedAt === "string" ? new Date(appliedAt) : appliedAt;
  if (isNaN(appliedDate.getTime())) return null;

  const diffMs = relativeTo.getTime() - appliedDate.getTime();
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export interface MinimalJobApplication {
  status: string;
  application?: {
    appliedAt?: Date | string | null;
    firstResponseAt?: Date | string | null;
  } | null;
}

/**
 * Checks whether an application is considered stale (pending without response beyond stale threshold).
 */
export function isApplicationStale(
  job: MinimalJobApplication,
  thresholdDays: number = STALE_THRESHOLD_DAYS,
  relativeTo: Date = new Date()
): boolean {
  const status = job.status.toUpperCase();
  if (status === "REJECTED" || status === "GHOSTED" || status === "OFFER" || status === "WITHDRAWN" || status === "ARCHIVED" || status === "IGNORED") {
    return false;
  }

  // If company has already responded, it's actively in pipeline
  if (job.application?.firstResponseAt) {
    return false;
  }

  const days = calculateDaysSinceApplied(job.application?.appliedAt, relativeTo);
  if (days === null) return false;

  return days >= thresholdDays;
}

/**
 * Checks whether an application is eligible for auto-ghosting (exceeds ghost threshold with no response).
 */
export function isApplicationGhostable(
  job: MinimalJobApplication,
  thresholdDays: number = DEFAULT_GHOST_THRESHOLD_DAYS,
  relativeTo: Date = new Date()
): boolean {
  return isApplicationStale(job, thresholdDays, relativeTo);
}

/**
 * Filters a list of enriched jobs to find all jobs eligible for auto-ghosting.
 */
export function identifyGhostableJobs(
  jobs: EnrichedJob[],
  thresholdDays: number = DEFAULT_GHOST_THRESHOLD_DAYS,
  relativeTo: Date = new Date()
): { job: EnrichedJob; daysPending: number }[] {
  const results: { job: EnrichedJob; daysPending: number }[] = [];

  for (const job of jobs) {
    if (isApplicationGhostable(job, thresholdDays, relativeTo)) {
      const days = calculateDaysSinceApplied(job.application?.appliedAt, relativeTo) ?? 0;
      results.push({ job, daysPending: days });
    }
  }

  return results;
}

export interface AutoGhostResult {
  count: number;
  affectedJobIds: string[];
}

/**
 * Automatically transitions all stale applications beyond threshold days to GHOSTED status in the database.
 */
export async function autoGhostStaleApplications(options?: {
  thresholdDays?: number;
  prisma?: typeof db;
  relativeTo?: Date;
}): Promise<AutoGhostResult> {
  const thresholdDays = options?.thresholdDays ?? DEFAULT_GHOST_THRESHOLD_DAYS;
  const prisma = options?.prisma ?? db;
  const relativeTo = options?.relativeTo ?? new Date();

  // Find all active applications in APPLIED state or without firstResponseAt
  const candidateJobs = await prisma.job.findMany({
    where: {
      status: {
        in: ["APPLIED", "PREPARED", "SHORTLISTED"],
      },
      application: {
        isNot: null,
      },
    },
    include: {
      application: true,
    },
  });

  const affectedJobIds: string[] = [];

  for (const job of candidateJobs) {
    if (isApplicationGhostable(job, thresholdDays, relativeTo)) {
      const daysPending = calculateDaysSinceApplied(job.application?.appliedAt, relativeTo) ?? thresholdDays;

      try {
        await transitionApplicationStatus(
          job.id,
          "GHOSTED",
          {
            note: `Auto-transitioned to Ghosted after ${daysPending} days without recruiter response (threshold: ${thresholdDays}d)`,
            force: true,
          },
          prisma
        );

        await prisma.event.create({
          data: {
            entityType: "APPLICATION",
            entityId: job.id,
            eventType: "LIFECYCLE_AUTO_GHOSTED",
            payload: JSON.stringify({
              daysPending,
              thresholdDays,
              appliedAt: job.application?.appliedAt,
            }),
          },
        });

        affectedJobIds.push(job.id);
      } catch (err) {
        console.error(`Failed to auto-ghost job ${job.id}:`, err);
      }
    }
  }

  return {
    count: affectedJobIds.length,
    affectedJobIds,
  };
}
