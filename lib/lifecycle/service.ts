import { db } from "@/lib/db";
import {
  APPLICATION_STATUSES,
  type TransitionOptions,
  type TransitionResult,
} from "./types";

export * from "./types";

export function calculateResponseTimeDays(appliedAt: Date, responseAt: Date): number {
  const diffMs = responseAt.getTime() - appliedAt.getTime();
  return Math.max(0, Math.round((diffMs / (1000 * 60 * 60 * 24)) * 100) / 100);
}

export function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "INTERVIEWING") return "INTERVIEW";
  if (s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA") return "ASSESSMENT";
  return s;
}

const POST_APPLIED_STATUSES = new Set([
  "SCREENING",
  "ASSESSMENT",
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
  SHORTLISTED: ["DRAFT", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "WITHDRAWN", "ARCHIVED", "IGNORED", "REJECTED", "GHOSTED"],
  PREPARED: ["DRAFT", "SHORTLISTED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "WITHDRAWN", "ARCHIVED", "IGNORED", "REJECTED", "GHOSTED"],
  APPLIED: ["DRAFT", "SHORTLISTED", "PREPARED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  SCREENING: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  ASSESSMENT: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  INTERVIEW: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  INTERVIEWING: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  OFFER: ["DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "REJECTED", "WITHDRAWN", "GHOSTED", "ARCHIVED"],
  REJECTED: ["ARCHIVED", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "GHOSTED"],
  WITHDRAWN: ["ARCHIVED", "SHORTLISTED", "PREPARED", "APPLIED"],
  GHOSTED: ["ARCHIVED", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED"],
  ARCHIVED: ["DISCOVERED", "DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED", "IGNORED"],
  IGNORED: ["DISCOVERED", "DRAFT", "SHORTLISTED", "PREPARED", "APPLIED", "ARCHIVED"],
};

export function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);

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

  const normalizedTarget = normalizeStatus(targetStatus);
  const previousStatus = normalizeStatus(currentJob.status);

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
  if (
    normalizedTarget === "APPLIED" ||
    (POST_APPLIED_STATUSES.has(normalizedTarget) && !appliedAt && normalizedTarget !== "REJECTED" && normalizedTarget !== "WITHDRAWN")
  ) {
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
  const isAppStatus = (APPLICATION_STATUSES as readonly string[]).includes(normalizedTarget);

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
