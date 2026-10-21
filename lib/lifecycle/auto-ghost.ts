import { db } from "@/lib/db";
import { transitionApplicationStatus } from "./service";
import {
  DEFAULT_GHOST_THRESHOLD_DAYS,
  calculateDaysSinceApplied,
  isApplicationGhostable,
} from "./staleness";

export {
  DEFAULT_GHOST_THRESHOLD_DAYS,
  STALE_THRESHOLD_DAYS,
  calculateDaysSinceApplied,
  isApplicationStale,
  isApplicationGhostable,
  identifyGhostableJobs,
  type MinimalJobApplication,
} from "./staleness";

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
