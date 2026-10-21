import type { EnrichedJob } from "@/lib/data";

export const DEFAULT_GHOST_THRESHOLD_DAYS = 21;
export const STALE_THRESHOLD_DAYS = 14;

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

export function isApplicationStale(
  job: MinimalJobApplication,
  thresholdDays: number = STALE_THRESHOLD_DAYS,
  relativeTo: Date = new Date()
): boolean {
  const status = job.status.toUpperCase();
  if (status === "REJECTED" || status === "GHOSTED" || status === "OFFER" || status === "WITHDRAWN" || status === "ARCHIVED" || status === "IGNORED") {
    return false;
  }

  if (job.application?.firstResponseAt) {
    return false;
  }

  const days = calculateDaysSinceApplied(job.application?.appliedAt, relativeTo);
  if (days === null) return false;

  return days >= thresholdDays;
}

export function isApplicationGhostable(
  job: MinimalJobApplication,
  thresholdDays: number = DEFAULT_GHOST_THRESHOLD_DAYS,
  relativeTo: Date = new Date()
): boolean {
  return isApplicationStale(job, thresholdDays, relativeTo);
}

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

