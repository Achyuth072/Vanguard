import { db } from "@/lib/db";
import {
  APPLICATION_STATUSES,
  type TransitionOptions,
  type TransitionResult,
} from "./types";

export * from "./types";

export function calculateResponseTimeDays(appliedAt: Date, responseAt: Date): number {
  const diffMs = responseAt.getTime() - appliedAt.getTime();
  return Math.max(0, Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(2)));
}

const POST_APPLIED_STATUSES = new Set([
  "SCREENING",
  "INTERVIEW",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "GHOSTED",
]);

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DISCOVERED: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "FILTERED_OUT", "ARCHIVED", "IGNORED"],
  FILTERED_OUT: ["DISCOVERED", "SHORTLISTED", "ARCHIVED", "IGNORED"],
  DRAFT: ["SHORTLISTED", "PREPARED", "APPLIED", "WITHDRAWN", "ARCHIVED", "IGNORED", "REJECTED"],
  SHORTLISTED: ["DRAFT", "PREPARED", "APPLIED", "WITHDRAWN", "ARCHIVED", "IGNORED", "REJECTED"],
  PREPARED: ["DRAFT", "SHORTLISTED", "APPLIED", "WITHDRAWN", "ARCHIVED", "IGNORED", "REJECTED"],
  APPLIED: ["SCREENING", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  SCREENING: ["INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  INTERVIEW: ["SCREENING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  INTERVIEWING: ["SCREENING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  OFFER: ["APPLIED", "SCREENING", "INTERVIEW", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  REJECTED: ["ARCHIVED", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER"],
  WITHDRAWN: ["ARCHIVED", "SHORTLISTED", "PREPARED", "APPLIED"],
  GHOSTED: ["ARCHIVED", "SHORTLISTED", "APPLIED", "SCREENING", "INTERVIEW", "REJECTED"],
  ARCHIVED: ["DISCOVERED", "SHORTLISTED", "PREPARED", "APPLIED"],
  IGNORED: ["DISCOVERED", "SHORTLISTED", "ARCHIVED"],
};

export function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const from = fromStatus.toUpperCase();
  const to = toStatus.toUpperCase();

  if (from === to) return true;

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    // If unknown previous status, permit transition
    return true;
  }

  return allowed.includes(to);
}

export async function transitionApplicationStatus(
  jobId: string,
  targetStatus: string,
  options: TransitionOptions = {},
  prisma: typeof db = db
): Promise<TransitionResult> {
  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: { application: true },
  });

  if (!currentJob) {
    throw new Error(`Job not found with id: ${jobId}`);
  }

  const normalizedTarget = targetStatus.toUpperCase() === "INTERVIEWING" ? "INTERVIEW" : targetStatus.toUpperCase();
  const previousStatus = currentJob.status.toUpperCase();

  if (!options.force && !isValidTransition(previousStatus, normalizedTarget)) {
    throw new Error(
      `Invalid lifecycle transition from ${previousStatus} to ${normalizedTarget}`
    );
  }

  const existingApp = currentJob.application;
  let appliedAt: Date | null = existingApp?.appliedAt || null;
  let firstResponseAt: Date | null = existingApp?.firstResponseAt || null;
  let responseTimeDays: number | null = existingApp?.responseTimeDays || null;
  let rejectionStage: string | null = existingApp?.rejectionStage || null;
  let rejectionReason: string | null = existingApp?.rejectionReason || null;

  // Handle appliedAt timestamp
  if (normalizedTarget === "APPLIED") {
    if (!appliedAt || options.appliedAt) {
      appliedAt = options.appliedAt || new Date();
    }
  }

  // Handle first response and response latency calculation
  if (POST_APPLIED_STATUSES.has(normalizedTarget)) {
    if (appliedAt && !firstResponseAt) {
      firstResponseAt = options.firstResponseAt || new Date();
      responseTimeDays = calculateResponseTimeDays(appliedAt, firstResponseAt);
    }
  }

  // Handle rejection fields
  if (normalizedTarget === "REJECTED") {
    if (options.rejectionStage) {
      rejectionStage = options.rejectionStage;
    }
    if (options.rejectionReason) {
      rejectionReason = options.rejectionReason;
    }
  }

  // Update Job status
  await prisma.job.update({
    where: { id: jobId },
    data: { status: normalizedTarget },
  });

  // Check if target is an Application status
  const isAppStatus = (APPLICATION_STATUSES as readonly string[]).includes(normalizedTarget) || normalizedTarget === "PREPARED";

  if (isAppStatus) {
    await prisma.application.upsert({
      where: { jobId },
      create: {
        jobId,
        status: normalizedTarget,
        appliedAt,
        firstResponseAt,
        responseTimeDays,
        rejectionStage,
        rejectionReason,
        tailoredNotes: options.note || "",
      },
      update: {
        status: normalizedTarget,
        appliedAt,
        firstResponseAt,
        responseTimeDays,
        rejectionStage,
        rejectionReason,
        ...(options.note ? { tailoredNotes: options.note } : {}),
      },
    });
  }

  // Record audit Event
  const auditPayload = {
    previousStatus,
    newStatus: normalizedTarget,
    appliedAt: appliedAt ? appliedAt.toISOString() : null,
    firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : null,
    responseTimeDays,
    rejectionStage,
    rejectionReason,
    note: options.note || null,
    ...(options.metadata || {}),
  };

  await prisma.event.create({
    data: {
      entityType: "Job",
      entityId: jobId,
      eventType: "STATUS_TRANSITION",
      payload: JSON.stringify(auditPayload),
    },
  });

  return {
    jobId,
    previousStatus,
    newStatus: normalizedTarget,
    appliedAt,
    firstResponseAt,
    responseTimeDays,
    rejectionStage,
    rejectionReason,
  };
}
