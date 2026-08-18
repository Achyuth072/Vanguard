"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  FeedbackLoopService,
  type CalibrationResult,
  type WeightHistoryEntry,
} from "@/lib/scoring/feedback-loop";
import {
  DEFAULT_FIT_SCORE_WEIGHTS,
  type FitScoreWeights,
} from "@/lib/scoring/fit-score";

function safeRevalidate() {
  try {
    revalidatePath("/settings");
    revalidatePath("/");
  } catch {
    // Ignored in non-request contexts
  }
}

export async function saveResumeContext(formData: FormData) {
  const text = formData.get("resumeText") as string;

  if (!text) {
    throw new Error("No text provided");
  }

  await db.candidate.upsert({
    where: { id: "candidate-default" },
    update: { resumeText: text },
    create: {
      id: "candidate-default",
      resumeText: text,
      name: "Default Candidate",
    },
  });

  safeRevalidate();
  return { success: true };
}

export async function getScoringFeedbackLoopState(): Promise<CalibrationResult> {
  return await FeedbackLoopService.getFeedbackLoopState(db);
}

export async function getScoringWeightHistory(): Promise<WeightHistoryEntry[]> {
  return await FeedbackLoopService.getWeightHistory(db);
}

export async function updateScoringWeights(
  weights: FitScoreWeights,
  locked: Partial<Record<keyof FitScoreWeights, boolean>> = {}
): Promise<{ success: boolean; weights: FitScoreWeights }> {
  const persisted = await FeedbackLoopService.persistWeights(
    weights,
    {
      eventType: "WEIGHTS_UPDATED",
      locked,
      reason: "Manual adjustment",
    },
    db
  );

  safeRevalidate();
  return { success: true, weights: persisted };
}

export async function applySuggestedWeights(
  weights: FitScoreWeights,
  locked: Partial<Record<keyof FitScoreWeights, boolean>> = {}
): Promise<{ success: boolean; weights: FitScoreWeights }> {
  const persisted = await FeedbackLoopService.persistWeights(
    weights,
    {
      eventType: "WEIGHTS_CALIBRATED",
      locked,
      reason: "Applied feedback loop calibration",
    },
    db
  );

  safeRevalidate();
  return { success: true, weights: persisted };
}

export async function resetScoringWeights(): Promise<{
  success: boolean;
  weights: FitScoreWeights;
}> {
  const persisted = await FeedbackLoopService.persistWeights(
    DEFAULT_FIT_SCORE_WEIGHTS,
    {
      eventType: "WEIGHTS_RESET",
      locked: {},
      reason: "Reset to default baseline",
    },
    db
  );

  safeRevalidate();
  return { success: true, weights: persisted };
}
