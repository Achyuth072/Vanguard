import { db } from "@/lib/db";
import {
  DEFAULT_FIT_SCORE_WEIGHTS,
  MIN_WEIGHT,
  MAX_WEIGHT,
  validateWeights,
  type FitScoreWeights,
} from "./fit-score";

export const MAX_STEP_CHANGE = 0.03;

export type CalibrationPhase = "COLD_START" | "SUGGESTED" | "AUTOMATED";

export interface ApplicationOutcomeRecord {
  id: string;
  status: string;
  rejectionStage?: string | null;
  rejectionReason?: string | null;
  skillsFit: number;
  experienceFit: number;
  domainFit: number;
  trajectoryFit: number;
  title?: string;
  company?: string;
  skills?: string[];
  strengths?: string[];
  gaps?: string[];
}

export interface DimensionDeltas {
  skills: number;
  experience: number;
  domain: number;
  trajectory: number;
}

export interface FeedbackLoopConfig {
  currentWeights?: FitScoreWeights;
  applications: ApplicationOutcomeRecord[];
  locked?: Partial<Record<keyof FitScoreWeights, boolean>>;
}

export interface CalibrationResult {
  phase: CalibrationPhase;
  sampleSize: number;
  positiveCount: number;
  negativeCount: number;
  currentWeights: FitScoreWeights;
  calibratedWeights: FitScoreWeights;
  deltas: DimensionDeltas;
  dimensionConversionDeltas: DimensionDeltas;
  insights: string;
  hasChanges: boolean;
}

export interface WeightHistoryEntry {
  id: string;
  timestamp: string;
  eventType: string;
  weights: FitScoreWeights;
  locked?: Partial<Record<keyof FitScoreWeights, boolean>>;
  reason?: string;
}

/**
 * Determines calibration phase based on sample size of terminal outcomes:
 * - Phase 0 (N < 10): COLD_START (static baseline)
 * - Phase 1 (10 <= N < 25): SUGGESTED (damping factor 0.2 with user confirmation)
 * - Phase 2 (N >= 25): AUTOMATED (automated bounded drift)
 */
export function determineCalibrationPhase(sampleSize: number): CalibrationPhase {
  if (sampleSize < 10) return "COLD_START";
  if (sampleSize < 25) return "SUGGESTED";
  return "AUTOMATED";
}

export const POSITIVE_STATUSES = new Set(["INTERVIEW", "INTERVIEWING", "OFFER"]);
export const TERMINAL_STATUSES = new Set([
  "INTERVIEW",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
]);

export function isPositiveOutcome(app: ApplicationOutcomeRecord): boolean {
  return POSITIVE_STATUSES.has(app.status.toUpperCase());
}

export function isNegativeOutcome(app: ApplicationOutcomeRecord): boolean {
  const status = app.status.toUpperCase();
  if (status === "REJECTED") return true;
  return false;
}

/**
 * Computes average dimension conversion deltas between positive and negative outcomes.
 * Delta_i = (MeanPositiveScore_i - MeanNegativeScore_i) / 100
 */
export function calculateDimensionDeltas(
  applications: ApplicationOutcomeRecord[]
): DimensionDeltas {
  const positives = applications.filter(isPositiveOutcome);
  const negatives = applications.filter(isNegativeOutcome);

  if (positives.length === 0 && negatives.length === 0) {
    return { skills: 0, experience: 0, domain: 0, trajectory: 0 };
  }

  const calcMean = (apps: ApplicationOutcomeRecord[], dim: keyof DimensionDeltas) => {
    if (apps.length === 0) return 50;
    const prop = `${dim}Fit` as keyof ApplicationOutcomeRecord;
    const sum = apps.reduce((acc, curr) => acc + (Number(curr[prop]) || 0), 0);
    return sum / apps.length;
  };

  const posMeans = {
    skills: calcMean(positives, "skills"),
    experience: calcMean(positives, "experience"),
    domain: calcMean(positives, "domain"),
    trajectory: calcMean(positives, "trajectory"),
  };

  const negMeans = {
    skills: calcMean(negatives, "skills"),
    experience: calcMean(negatives, "experience"),
    domain: calcMean(negatives, "domain"),
    trajectory: calcMean(negatives, "trajectory"),
  };

  return {
    skills: Number(((posMeans.skills - negMeans.skills) / 100).toFixed(4)),
    experience: Number(((posMeans.experience - negMeans.experience) / 100).toFixed(4)),
    domain: Number(((posMeans.domain - negMeans.domain) / 100).toFixed(4)),
    trajectory: Number(((posMeans.trajectory - negMeans.trajectory) / 100).toFixed(4)),
  };
}

/**
 * Projects, clamps, and normalizes candidate weights so that:
 * 1. All weights are within [MIN_WEIGHT (0.10), MAX_WEIGHT (0.50)]
 * 2. Sum of weights strictly equals 1.000
 * 3. Locked dimensions remain unchanged if possible
 */
export function normalizeAndClampWeights(
  rawWeights: FitScoreWeights,
  locked: Partial<Record<keyof FitScoreWeights, boolean>> = {}
): FitScoreWeights {
  const dimensions: (keyof FitScoreWeights)[] = ["skills", "experience", "domain", "trajectory"];
  const clamped: FitScoreWeights = { ...rawWeights };

  // Step 1: Initial clamp to [MIN_WEIGHT, MAX_WEIGHT]
  for (const dim of dimensions) {
    clamped[dim] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, clamped[dim]));
  }

  // Step 2: Iterative redistribution over unlocked dimensions
  for (let iteration = 0; iteration < 20; iteration++) {
    const currentSum = dimensions.reduce((acc, d) => acc + clamped[d], 0);
    const diff = 1.0 - currentSum;

    if (Math.abs(diff) < 0.0001) break;

    const unlockedDims = dimensions.filter((d) => {
      if (locked[d]) return false;
      if (diff > 0 && clamped[d] >= MAX_WEIGHT) return false;
      if (diff < 0 && clamped[d] <= MIN_WEIGHT) return false;
      return true;
    });

    if (unlockedDims.length === 0) {
      // If no unlocked dimensions can accept the diff, relax to all non-locked dims
      const fallbackDims = dimensions.filter((d) => !locked[d]);
      if (fallbackDims.length > 0) {
        const share = diff / fallbackDims.length;
        for (const d of fallbackDims) {
          clamped[d] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, clamped[d] + share));
        }
      }
      break;
    }

    const share = diff / unlockedDims.length;
    for (const d of unlockedDims) {
      clamped[d] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, clamped[d] + share));
    }
  }

  // Step 3: Clean rounding to 3 decimals & ensure sum = 1.000 exactly
  const rounded: FitScoreWeights = {
    skills: Math.round(clamped.skills * 1000) / 1000,
    experience: Math.round(clamped.experience * 1000) / 1000,
    domain: Math.round(clamped.domain * 1000) / 1000,
    trajectory: Math.round(clamped.trajectory * 1000) / 1000,
  };

  const roundedSum = Number((rounded.skills + rounded.experience + rounded.domain + rounded.trajectory).toFixed(3));
  const residual = Number((1.0 - roundedSum).toFixed(3));

  if (Math.abs(residual) > 0) {
    const targetDim = dimensions.find((d) => {
      if (locked[d]) return false;
      const val = rounded[d] + residual;
      return val >= MIN_WEIGHT && val <= MAX_WEIGHT;
    }) || "skills";

    rounded[targetDim] = Math.round((rounded[targetDim] + residual) * 1000) / 1000;
  }

  validateWeights(rounded);
  return rounded;
}

/**
 * Executes regularized Bayesian drift calculation on sub-dimension weights.
 */
export function calibrateWeights(config: FeedbackLoopConfig): CalibrationResult {
  const current = config.currentWeights || DEFAULT_FIT_SCORE_WEIGHTS;
  const locked = config.locked || {};
  const terminalApps = config.applications.filter(
    (a) => isPositiveOutcome(a) || isNegativeOutcome(a)
  );

  const sampleSize = terminalApps.length;
  const positiveCount = terminalApps.filter(isPositiveOutcome).length;
  const negativeCount = terminalApps.filter(isNegativeOutcome).length;
  const phase = determineCalibrationPhase(sampleSize);
  const rawDeltas = calculateDimensionDeltas(terminalApps);

  const emptyDeltas: DimensionDeltas = { skills: 0, experience: 0, domain: 0, trajectory: 0 };
  const insights = generateConversionInsights(config.applications);

  if (phase === "COLD_START") {
    return {
      phase,
      sampleSize,
      positiveCount,
      negativeCount,
      currentWeights: current,
      calibratedWeights: { ...current },
      deltas: emptyDeltas,
      dimensionConversionDeltas: rawDeltas,
      insights,
      hasChanges: false,
    };
  }

  // Damping factor: 0.2 for Phase 1 (SUGGESTED), 0.5 for Phase 2 (AUTOMATED)
  const lambda = phase === "SUGGESTED" ? 0.2 : 0.5;

  const meanDelta = (rawDeltas.skills + rawDeltas.experience + rawDeltas.domain + rawDeltas.trajectory) / 4;
  const dimensions: (keyof FitScoreWeights)[] = ["skills", "experience", "domain", "trajectory"];
  
  const stepChanges: Record<keyof FitScoreWeights, number> = {
    skills: 0,
    experience: 0,
    domain: 0,
    trajectory: 0,
  };

  const rawCandidate: FitScoreWeights = { ...current };

  for (const dim of dimensions) {
    if (locked[dim]) {
      stepChanges[dim] = 0;
      continue;
    }

    const relativeDelta = rawDeltas[dim] - meanDelta;
    // Scale step change and enforce strict per-batch max step clamp of +/- 0.03
    const step = lambda * relativeDelta * 0.15;
    const clampedStep = Math.max(-MAX_STEP_CHANGE, Math.min(MAX_STEP_CHANGE, step));
    stepChanges[dim] = Number(clampedStep.toFixed(4));
    rawCandidate[dim] = current[dim] + clampedStep;
  }

  const calibratedWeights = normalizeAndClampWeights(rawCandidate, locked);

  const hasChanges = dimensions.some(
    (dim) => Math.abs(calibratedWeights[dim] - current[dim]) > 0.001
  );

  return {
    phase,
    sampleSize,
    positiveCount,
    negativeCount,
    currentWeights: current,
    calibratedWeights,
    deltas: stepChanges,
    dimensionConversionDeltas: rawDeltas,
    insights,
    hasChanges,
  };
}

/**
 * Generates compact 2-line "Calibrated Conversion Insights" when statistical clustering
 * is observed across >= 15 applications. Returns empty string if sample size is < 15.
 */
export function generateConversionInsights(
  applications: ApplicationOutcomeRecord[]
): string {
  const terminalApps = applications.filter(
    (a) => isPositiveOutcome(a) || isNegativeOutcome(a)
  );

  if (terminalApps.length < 15) {
    return "";
  }

  const positiveApps = terminalApps.filter(isPositiveOutcome);
  const negativeApps = terminalApps.filter(isNegativeOutcome);

  // Extract high-frequency positive skills & domains
  const positiveSkillCounts: Record<string, number> = {};
  for (const app of positiveApps) {
    for (const skill of app.skills || []) {
      const clean = skill.trim();
      if (clean) positiveSkillCounts[clean] = (positiveSkillCounts[clean] || 0) + 1;
    }
  }

  const negativeSkillCounts: Record<string, number> = {};
  for (const app of negativeApps) {
    for (const skill of app.skills || []) {
      const clean = skill.trim();
      if (clean) negativeSkillCounts[clean] = (negativeSkillCounts[clean] || 0) + 1;
    }
  }

  const sortedPositives = Object.entries(positiveSkillCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);

  const sortedNegatives = Object.entries(negativeSkillCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);

  const topPositiveSignals = sortedPositives.slice(0, 3).join(", ");
  const topNegativeSignals = sortedNegatives.slice(0, 3).join(", ");

  const posLine = topPositiveSignals
    ? `- Candidate demonstrates strong market conversion in: ${topPositiveSignals}.`
    : `- Candidate demonstrates strong market conversion in high-domain-alignment roles.`;

  const negLine = topNegativeSignals
    ? `- Low conversion / recurring resume screen drop-off in: ${topNegativeSignals}.`
    : `- Low conversion / recurring resume screen drop-off in low domain and trajectory alignment postings.`;

  return `CALIBRATED CONVERSION INSIGHTS:\n${posLine}\n${negLine}`;
}

export class FeedbackLoopService {
  /**
   * Loads all tracked applications with their FitScore sub-dimensions from SQLite.
   */
  static async loadOutcomeRecords(prisma: typeof db = db): Promise<ApplicationOutcomeRecord[]> {
    const jobs = await prisma.job.findMany({
      include: {
        fitScore: true,
        application: true,
      },
    });

    const records: ApplicationOutcomeRecord[] = [];

    for (const job of jobs) {
      if (!job.fitScore) continue;
      const status = job.application?.status || job.status;

      let strengths: string[] = [];
      let gaps: string[] = [];
      try {
        strengths = JSON.parse(job.fitScore.strengths || "[]");
        gaps = JSON.parse(job.fitScore.gaps || "[]");
      } catch {
        // fallback
      }

      records.push({
        id: job.id,
        status,
        rejectionStage: job.application?.rejectionStage,
        rejectionReason: job.application?.rejectionReason,
        skillsFit: job.fitScore.skillsFit ?? job.fitScore.score,
        experienceFit: job.fitScore.experienceFit ?? job.fitScore.score,
        domainFit: job.fitScore.domainFit ?? job.fitScore.score,
        trajectoryFit: job.fitScore.trajectoryFit ?? job.fitScore.score,
        title: job.title,
        company: job.company,
        strengths,
        gaps,
      });
    }

    return records;
  }

  /**
   * Retrieves the latest active scoring weights and lock state from the audit Event log.
   */
  static async getActiveWeights(prisma: typeof db = db): Promise<{
    weights: FitScoreWeights;
    locked: Partial<Record<keyof FitScoreWeights, boolean>>;
    lastCalibratedAt?: string;
  }> {
    const latestEvent = await prisma.event.findFirst({
      where: {
        entityType: "ScoringWeights",
        eventType: { in: ["WEIGHTS_UPDATED", "WEIGHTS_CALIBRATED", "WEIGHTS_RESET"] },
      },
      orderBy: { timestamp: "desc" },
    });

    if (!latestEvent) {
      return {
        weights: DEFAULT_FIT_SCORE_WEIGHTS,
        locked: {},
      };
    }

    try {
      const payload = JSON.parse(latestEvent.payload);
      const weights = payload.weights as FitScoreWeights;
      validateWeights(weights);
      return {
        weights,
        locked: payload.locked || {},
        lastCalibratedAt: latestEvent.timestamp.toISOString(),
      };
    } catch {
      return {
        weights: DEFAULT_FIT_SCORE_WEIGHTS,
        locked: {},
      };
    }
  }

  /**
   * Computes the current feedback loop state, phase, deltas, and suggestions.
   */
  static async getFeedbackLoopState(prisma: typeof db = db): Promise<CalibrationResult> {
    const active = await this.getActiveWeights(prisma);
    const outcomes = await this.loadOutcomeRecords(prisma);

    return calibrateWeights({
      currentWeights: active.weights,
      applications: outcomes,
      locked: active.locked,
    });
  }

  /**
   * Persists updated weights into the audit log.
   */
  static async persistWeights(
    weights: FitScoreWeights,
    options: {
      eventType?: "WEIGHTS_UPDATED" | "WEIGHTS_CALIBRATED" | "WEIGHTS_RESET";
      locked?: Partial<Record<keyof FitScoreWeights, boolean>>;
      reason?: string;
    } = {},
    prisma: typeof db = db
  ): Promise<FitScoreWeights> {
    validateWeights(weights);

    await prisma.event.create({
      data: {
        entityType: "ScoringWeights",
        entityId: "default",
        eventType: options.eventType || "WEIGHTS_UPDATED",
        payload: JSON.stringify({
          weights,
          locked: options.locked || {},
          reason: options.reason || "Manual update",
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return weights;
  }

  /**
   * Retrieves full historical audit log of weight calibrations and changes.
   */
  static async getWeightHistory(prisma: typeof db = db): Promise<WeightHistoryEntry[]> {
    const events = await prisma.event.findMany({
      where: { entityType: "ScoringWeights" },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    return events.map((event) => {
      let weights = DEFAULT_FIT_SCORE_WEIGHTS;
      let locked: Partial<Record<keyof FitScoreWeights, boolean>> = {};
      let reason = "Weight updated";

      try {
        const payload = JSON.parse(event.payload);
        if (payload.weights) weights = payload.weights;
        if (payload.locked) locked = payload.locked;
        if (payload.reason) reason = payload.reason;
      } catch {
        // fallback
      }

      return {
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        eventType: event.eventType,
        weights,
        locked,
        reason,
      };
    });
  }

  /**
   * Returns conversion insights for LLM prompt injection.
   */
  static async getConversionInsights(prisma: typeof db = db): Promise<string> {
    const outcomes = await this.loadOutcomeRecords(prisma);
    return generateConversionInsights(outcomes);
  }
}
