import { z } from "zod";

export interface FitScoreWeights {
  skills: number;
  experience: number;
  domain: number;
  trajectory: number;
}

export const DEFAULT_FIT_SCORE_WEIGHTS: FitScoreWeights = {
  skills: 0.35,
  experience: 0.30,
  domain: 0.20,
  trajectory: 0.15,
};

export const MIN_WEIGHT = 0.10;
export const MAX_WEIGHT = 0.50;

export interface FitScoreSubDimensions {
  skillsFit: number;
  experienceFit: number;
  domainFit: number;
  trajectoryFit: number;
}

export const SubDimensionsSchema = z.object({
  skillsFit: z.number().int().min(0).max(100),
  experienceFit: z.number().int().min(0).max(100),
  domainFit: z.number().int().min(0).max(100),
  trajectoryFit: z.number().int().min(0).max(100),
});

export const DimensionRationaleSchema = z.object({
  skills: z.string().optional(),
  experience: z.string().optional(),
  domain: z.string().optional(),
  trajectory: z.string().optional(),
}).optional();

export function validateWeights(weights: FitScoreWeights): void {
  const sum = weights.skills + weights.experience + weights.domain + weights.trajectory;
  if (Math.abs(sum - 1.0) > 0.005) {
    throw new Error(`Scoring weights must sum to 1.0 (got ${sum.toFixed(4)})`);
  }

  const entries: [string, number][] = [
    ["skills", weights.skills],
    ["experience", weights.experience],
    ["domain", weights.domain],
    ["trajectory", weights.trajectory],
  ];

  for (const [key, val] of entries) {
    if (val < MIN_WEIGHT || val > MAX_WEIGHT) {
      throw new Error(`Weight for ${key} (${val}) must be within [${MIN_WEIGHT}, ${MAX_WEIGHT}]`);
    }
  }
}

export function computeCompositeFitScore(
  subScores: FitScoreSubDimensions,
  weights: FitScoreWeights = DEFAULT_FIT_SCORE_WEIGHTS
): number {
  validateWeights(weights);

  const rawScore =
    subScores.skillsFit * weights.skills +
    subScores.experienceFit * weights.experience +
    subScores.domainFit * weights.domain +
    subScores.trajectoryFit * weights.trajectory;

  const rounded = Math.round(rawScore);
  return Math.min(100, Math.max(0, rounded));
}

export function deriveRecommendation(score: number): "APPLY" | "REVIEW" | "IGNORE" {
  if (score >= 80) return "APPLY";
  if (score >= 60) return "REVIEW";
  return "IGNORE";
}

export function normalizeSubDimensions(
  subScores?: Partial<FitScoreSubDimensions> | null,
  fallbackScore?: number | null
): FitScoreSubDimensions {
  const defaultVal = typeof fallbackScore === "number" && !isNaN(fallbackScore)
    ? Math.min(100, Math.max(0, Math.round(fallbackScore)))
    : 0;

  return {
    skillsFit: typeof subScores?.skillsFit === "number" ? subScores.skillsFit : defaultVal,
    experienceFit: typeof subScores?.experienceFit === "number" ? subScores.experienceFit : defaultVal,
    domainFit: typeof subScores?.domainFit === "number" ? subScores.domainFit : defaultVal,
    trajectoryFit: typeof subScores?.trajectoryFit === "number" ? subScores.trajectoryFit : defaultVal,
  };
}
