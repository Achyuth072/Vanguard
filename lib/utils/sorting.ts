import type { EnrichedJob } from "@/lib/data";

/**
 * Returns a numerical sort priority rank for a given job status.
 * Lower numbers rank higher in presentation priority.
 *
 * Status Order:
 * 1. DISCOVERED (highest priority: fresh, unhandled opportunities)
 * 2. SHORTLISTED / PREPARED / DRAFT (in-progress candidate evaluation)
 * 3. APPLIED / Active stages (APPLIED, SCREENING, ASSESSMENT, INTERVIEW, OFFER)
 * 4. Terminal / Inactive states (REJECTED, GHOSTED, WITHDRAWN)
 * 5. Other / Archived (ARCHIVED, FILTERED_OUT, IGNORED)
 */
export function getStatusSortPriority(status?: string | null): number {
  if (!status) return 99;
  const s = status.toUpperCase().trim();

  switch (s) {
    case "DISCOVERED":
      return 0;
    case "SHORTLISTED":
      return 1;
    case "PREPARED":
      return 2;
    case "DRAFT":
      return 3;
    case "APPLIED":
      return 10;
    case "SCREENING":
      return 11;
    case "ASSESSMENT":
    case "TAKE_HOME":
    case "TAKE_HOME_OA":
    case "OA":
      return 12;
    case "INTERVIEW":
    case "INTERVIEWING":
      return 13;
    case "OFFER":
      return 14;
    case "REJECTED":
      return 20;
    case "GHOSTED":
      return 21;
    case "WITHDRAWN":
      return 22;
    case "ARCHIVED":
      return 30;
    case "FILTERED_OUT":
      return 31;
    case "IGNORED":
      return 32;
    default:
      return 99;
  }
}

/**
 * Comparator for ordering jobs by Relevance:
 * 1. Status group order (DISCOVERED first, then SHORTLISTED/PREPARED, then APPLIED/active stages, then terminal/archived).
 * 2. Fit Score descending within the same status group.
 * 3. Date descending (appliedAt or discoveredAt) as tiebreaker.
 */
export function compareJobsForInbox(a: EnrichedJob, b: EnrichedJob): number {
  const priorityA = getStatusSortPriority(a.status);
  const priorityB = getStatusSortPriority(b.status);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  // Within the same status priority, sort by Fit Score descending
  const scoreA = a.fitScore?.score ?? -1;
  const scoreB = b.fitScore?.score ?? -1;

  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  // Score tie-breaker: most recent date descending
  const dateA = a.application?.appliedAt
    ? new Date(a.application.appliedAt).getTime()
    : new Date(a.discoveredAt).getTime();
  const dateB = b.application?.appliedAt
    ? new Date(b.application.appliedAt).getTime()
    : new Date(b.discoveredAt).getTime();

  return dateB - dateA;
}

/**
 * Alias for compareJobsForInbox - sorts by Relevance (Status priority + Fit Score descending).
 */
export function compareJobsByRelevance(a: EnrichedJob, b: EnrichedJob): number {
  return compareJobsForInbox(a, b);
}

/**
 * Comparator for ordering jobs purely by Fit Score descending, regardless of status.
 */
export function compareJobsByScore(a: EnrichedJob, b: EnrichedJob): number {
  const scoreA = a.fitScore?.score ?? -1;
  const scoreB = b.fitScore?.score ?? -1;

  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  const dateA = a.application?.appliedAt
    ? new Date(a.application.appliedAt).getTime()
    : new Date(a.discoveredAt).getTime();
  const dateB = b.application?.appliedAt
    ? new Date(b.application.appliedAt).getTime()
    : new Date(b.discoveredAt).getTime();

  return dateB - dateA;
}

/**
 * Comparator for ordering jobs purely by Recency (most recent date descending).
 */
export function compareJobsByRecent(a: EnrichedJob, b: EnrichedJob): number {
  const dateA = a.application?.appliedAt
    ? new Date(a.application.appliedAt).getTime()
    : new Date(a.discoveredAt).getTime();
  const dateB = b.application?.appliedAt
    ? new Date(b.application.appliedAt).getTime()
    : new Date(b.discoveredAt).getTime();

  return dateB - dateA;
}

/**
 * Returns a new sorted array of jobs ordered for Inbox / Review display by Relevance.
 */
export function sortJobsForInbox(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort(compareJobsForInbox);
}

/**
 * Returns a new sorted array of jobs ordered by Relevance (Status + Score).
 */
export function sortJobsByRelevance(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort(compareJobsByRelevance);
}

/**
 * Returns a new sorted array of jobs ordered purely by Fit Score descending.
 */
export function sortJobsByScore(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort(compareJobsByScore);
}

/**
 * Returns a new sorted array of jobs ordered purely by Recency descending.
 */
export function sortJobsByRecent(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort(compareJobsByRecent);
}

