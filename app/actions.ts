"use server";

import { revalidatePath } from "next/cache";
import { addJob } from "@/lib/data";
import { generateText } from "ai";
import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { ingestJobPipeline, type IngestionInput } from "@/lib/ingestion";

// ---------------------------------------------------------
// 1. AI EMAIL DRAFTER (Called by the "Draft Follow-up" button)
// ---------------------------------------------------------
export async function generateDraft(jobRole: string, companyName: string) {
  try {
    // A. Fetch Resume Context from DB
    const profile = await db.candidate.findFirst({
      where: { id: "candidate-default" },
    });
    const resumeContext = profile?.resumeText || "No resume provided.";

    // B. Construct Prompt
    const prompt = `
      You are a career coach acting on behalf of a candidate.
      
      CANDIDATE RESUME CONTEXT:
      ${resumeContext.slice(0, 3000)}
      
      TASK:
      Draft a concise, high-impact follow-up email for a "${jobRole}" position at "${companyName}".
      
      INSTRUCTIONS:
      - Highlight 1-2 specific skills from the resume that match the job title.
      - Keep it under 150 words.
      - Tone: Confident, professional, builder-mindset.
    `;

    // C. Generate
    const { text } = await generateText({
      model: getModel(),
      prompt: prompt,
      temperature: 0.7,
    });

    return { success: true, message: text };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, message: "Failed to connect to Agent." };
  }
}

// ---------------------------------------------------------
// 2. SYNCHRONOUS INGESTION ACTION
// ---------------------------------------------------------
export async function ingestJob(input: IngestionInput) {
  const result = await ingestJobPipeline(input);
  revalidatePath("/");
  return result;
}

// ---------------------------------------------------------
// 4. STATUS TRANSITION ACTIONS
// ---------------------------------------------------------
export async function updateJobStatusAction(
  jobId: string,
  newStatus: string,
  payload?: Record<string, unknown>
) {
  const { updateJobStatus } = await import("@/lib/data");
  const updated = await updateJobStatus(jobId, newStatus, payload);
  try {
    revalidatePath("/");
  } catch {}
  return { success: true, job: updated };
}

export async function shortlistJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "SHORTLISTED");
}

export async function overrideJobFilterAction(
  jobId: string,
  targetStatus: string = "SHORTLISTED",
  reason?: string
) {
  const { overrideJobFilter } = await import("@/lib/data");
  const updated = await overrideJobFilter(jobId, targetStatus, reason);
  try {
    revalidatePath("/");
  } catch {}
  return { success: true, job: updated };
}

export async function prepareJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "PREPARED");
}

export async function applyJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "APPLIED");
}

export async function recordRejectionAction(
  jobId: string,
  options: {
    rejectionStage: string;
    rejectionReason: string;
    note?: string;
  }
) {
  return await updateJobStatusAction(jobId, "REJECTED", {
    rejectionStage: options.rejectionStage,
    rejectionReason: options.rejectionReason,
    note: options.note,
  });
}

export async function screenJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "SCREENING");
}

export async function interviewJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "INTERVIEW");
}

export async function offerJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "OFFER");
}

export async function ghostJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "GHOSTED");
}

export async function autoGhostStaleApplicationsAction(thresholdDays?: number) {
  const { autoGhostStaleApplications } = await import("@/lib/lifecycle/auto-ghost");
  const result = await autoGhostStaleApplications({ thresholdDays });
  try {
    revalidatePath("/");
  } catch {}
  return { success: true, ...result };
}

export async function updateJobDetailsAction(
  jobId: string,
  input: {
    title?: string;
    company?: string;
    location?: string;
    remoteStatus?: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency?: string;
    employmentType?: string;
    description?: string;
    url?: string;
    source?: string;
  },
  options?: { rescore?: boolean }
) {
  const { updateJob } = await import("@/lib/data");
  const updated = await updateJob(jobId, input);

  let rescoreResult = null;
  if (options?.rescore) {
    const { rescoreJob } = await import("@/lib/scoring/rescore");
    rescoreResult = await rescoreJob(jobId);
  }

  try {
    revalidatePath("/");
  } catch {}
  return { success: true, job: updated, rescore: rescoreResult };
}

export async function rescoreJobAction(jobId: string) {
  const { rescoreJob } = await import("@/lib/scoring/rescore");
  const result = await rescoreJob(jobId);
  try {
    revalidatePath("/");
  } catch {}
  return { success: true, ...result };
}

export async function withdrawJobAction(jobId: string) {
  return await updateJobStatusAction(jobId, "WITHDRAWN");
}

export async function deleteJobAction(jobId: string) {
  const { deleteJob } = await import("@/lib/data");
  await deleteJob(jobId);
  try {
    revalidatePath("/");
  } catch {}
  return { success: true };
}




