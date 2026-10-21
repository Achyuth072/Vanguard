/**
 * 3-Tier Local Hybrid Scoring Engine & 4-Dimensional Fit Decomposition.
 * Blends Okapi BM25 lexical precision with Edge ONNX dense embeddings (Xenova/bge-small-en-v1.5)
 * to evaluate candidate-job fit in <25ms at 0 API token cost.
 */
import { BM25Scorer } from "./bm25";
import { edgeEmbedder } from "./edge-embeddings";
import {
  computeCompositeFitScore,
  deriveRecommendation,
  DEFAULT_FIT_SCORE_WEIGHTS,
  type FitScoreWeights,
  type FitScoreSubDimensions,
} from "./fit-score";
import type { CandidateContext, JobContext, FitScore } from "../ai/router";
import { parseMasterSkills } from "../../types/candidate";

export interface HybridScoringOptions {
  weights?: FitScoreWeights;
  alpha?: number; // Dense vs lexical weighting for skills fit (default 0.40 dense, 0.60 lexical)
}

export type FunnelAction =
  | "AUTO_IGNORE"
  | "AUTO_STAGE_HIGH_MATCH"
  | "SELECTIVE_LLM_DEEP_INSPECTION";

export interface HybridFunnelResult {
  jobId?: string;
  score: number;
  recommendation: "APPLY" | "REVIEW" | "IGNORE";
  subScores: FitScoreSubDimensions;
  funnelAction: FunnelAction;
  fitScore: FitScore;
}

const SENIORITY_LEVELS: Array<{ keywords: string[]; level: number; label: string }> = [
  { keywords: ["intern", "trainee", "fresher", "graduate", "junior", "associate", "entry"], level: 1, label: "Junior" },
  { keywords: ["software engineer", "frontend developer", "backend developer", "fullstack", "developer", "engineer", "sde 1", "sde 2", "mid", "sde-1", "sde-2"], level: 2, label: "Mid" },
  { keywords: ["senior", "sr.", "sr ", "lead", "staff", "sde 3", "sde-3", "principal", "tech lead"], level: 3, label: "Senior/Staff" },
  { keywords: ["director", "head of", "vp", "vice president", "chief", "architect", "engineering manager", "em"], level: 4, label: "Executive/Architect" },
];

function detectSeniorityLevel(text: string): { level: number; label: string } {
  if (!text) return { level: 2, label: "Mid" };
  const lower = text.toLowerCase();

  for (const item of SENIORITY_LEVELS) {
    for (const kw of item.keywords) {
      if (lower.includes(kw)) {
        return { level: item.level, label: item.label };
      }
    }
  }

  return { level: 2, label: "Mid" };
}

function calculateTrajectoryScore(candidateTitle: string, jobTitle: string): { score: number; rationale: string } {
  const cand = detectSeniorityLevel(candidateTitle);
  const job = detectSeniorityLevel(jobTitle);

  const delta = job.level - cand.level;

  if (delta === 0) {
    return {
      score: 90,
      rationale: `Target title matches candidate seniority level (${cand.label} -> ${job.label}).`,
    };
  }

  if (delta === 1) {
    // Normal progression step (e.g. Mid -> Senior)
    return {
      score: cand.level === 1 ? 95 : 90,
      rationale: `Natural upward career progression (${cand.label} -> ${job.label}).`,
    };
  }

  if (delta === 2) {
    // 2-level jump (e.g. Junior -> Staff)
    return {
      score: 65,
      rationale: `Significant seniority leap from ${cand.label} to ${job.label}.`,
    };
  }

  if (delta > 2) {
    return {
      score: 35,
      rationale: `Extreme seniority disparity (${cand.label} to ${job.label}).`,
    };
  }

  if (delta === -1) {
    // Downward 1 step (e.g. Senior -> Mid)
    return {
      score: 75,
      rationale: `Candidate slightly overqualified for ${job.label} role.`,
    };
  }

  // Delta <= -2 (Lead / Director -> Junior)
  return {
    score: 40,
    rationale: `Candidate significantly overqualified (${cand.label} -> ${job.label}).`,
  };
}

function extractRequiredExperienceYears(job: JobContext): number | null {
  if (typeof job.requiredExperienceYears === "number" && !isNaN(job.requiredExperienceYears)) {
    return job.requiredExperienceYears;
  }

  const combined = `${job.title} ${job.description}`.toLowerCase();

  // Look for patterns like "5+ years", "3-5 years", "min 4 yrs"
  const match = combined.match(/(?:(?:min|minimum|at least)\s+)?(\d+)(?:\s*-\s*\d+)?\+?\s*(?:years|yrs|year)/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 30) {
      return parsed;
    }
  }

  // Check seniority keywords in title
  const titleLower = job.title.toLowerCase();
  if (titleLower.includes("staff") || titleLower.includes("principal")) return 8;
  if (titleLower.includes("senior") || titleLower.includes("sr.")) return 5;
  if (titleLower.includes("junior") || titleLower.includes("entry") || titleLower.includes("intern")) return 0;
  if (titleLower.includes("lead")) return 6;

  return null;
}

function calculateExperienceScore(candidateYOE: number, requiredYears: number | null): { score: number; rationale: string } {
  if (requiredYears === null || requiredYears === undefined) {
    // No explicit requirement; assume solid baseline
    return {
      score: 90,
      rationale: `Candidate has ${candidateYOE} years of experience; no restrictive minimum specified.`,
    };
  }

  if (candidateYOE >= requiredYears) {
    const surplus = candidateYOE - requiredYears;
    const score = Math.min(100, 95 + Math.min(5, surplus * 2));
    return {
      score,
      rationale: `Candidate meets required experience (${candidateYOE} YOE vs ${requiredYears} required).`,
    };
  }

  const shortfall = requiredYears - candidateYOE;
  const score = Math.max(0, 100 - shortfall * 15);
  return {
    score,
    rationale: `Candidate has ${candidateYOE} YOE, falling short of ${requiredYears} years required.`,
  };
}

function extractCandidateSkills(candidate: CandidateContext): string[] {
  if (Array.isArray(candidate.skills)) {
    return candidate.skills.map((s) => (typeof s === "string" ? s : (s as { name?: string }).name || "")).filter(Boolean);
  }
  if (typeof candidate.skills === "string") {
    try {
      const parsed = parseMasterSkills(candidate.skills);
      return parsed.map((s) => s.name);
    } catch {
      return candidate.skills.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

const HARD_NON_TECH_PATTERNS = [
  /\b(?:nurse|nursing|physician|surgeon|pharmacist|clinical|cardiology|radiology)\b/i,
  /\b(?:real estate agent|realtor|property manager)\b/i,
  /\b(?:truck driver|courier|forklift|warehouse associate)\b/i,
  /\b(?:flight attendant|pilot|cabin crew)\b/i,
];

function checkDomainMismatch(title: string): boolean {
  for (const pattern of HARD_NON_TECH_PATTERNS) {
    if (pattern.test(title)) {
      return true;
    }
  }
  return false;
}

/**
 * Scales raw cosine similarity (typically 0.30 - 0.80 for BGE models) to a 0-100 score.
 */
function normalizeDenseScore(sim: number, floor = 0.30, ceiling = 0.78): number {
  if (sim <= floor) return 0;
  if (sim >= ceiling) return 100;
  return Math.round(((sim - floor) / (ceiling - floor)) * 100);
}

/**
 * Evaluates candidate-job fit using 0-token hybrid scoring (BM25 + Edge Embeddings).
 */
export async function scoreJobHybrid(
  candidate: CandidateContext,
  job: JobContext,
  options?: HybridScoringOptions
): Promise<FitScore> {
  const weights = options?.weights || DEFAULT_FIT_SCORE_WEIGHTS;
  const alpha = options?.alpha ?? 0.40; // 40% dense, 60% lexical for skills

  const candidateSkills = extractCandidateSkills(candidate);
  const candidateTargetRole = candidate.targetRole || "Software Engineer";
  const candidateYOE = candidate.yearsOfExperience || 0;

  // 1. Skills Fit (35%)
  const bm25 = new BM25Scorer();
  const jobFullText = `${job.title} ${job.company} ${job.description}`;
  
  // Combine all skill terms and target role terms
  const queryTerms: string[] = [];
  for (const s of candidateSkills) {
    queryTerms.push(...bm25.tokenize(s));
  }
  queryTerms.push(...bm25.tokenize(candidateTargetRole));

  const bm25Normalized = bm25.scoreNormalized(queryTerms, jobFullText);
  const matchedSkills = bm25.getMatchedKeywords(queryTerms, jobFullText);

  // Dense embedding cosine for skills/role
  const candidateSkillsQuery = `Skills: ${candidateSkills.join(", ")}. Target Role: ${candidateTargetRole}.`;
  const candidateSkillVec = await edgeEmbedder.embed(candidateSkillsQuery, true);
  const jobDescVec = await edgeEmbedder.embed(jobFullText, false);
  const denseSim = edgeEmbedder.cosineSimilarity(candidateSkillVec, jobDescVec);
  const denseSkillsScore = normalizeDenseScore(denseSim, 0.30, 0.75);

  const skillsFit = Math.min(
    100,
    Math.max(0, Math.round((1 - alpha) * bm25Normalized + alpha * denseSkillsScore))
  );

  // 2. Experience Fit (30%)
  const requiredYOE = extractRequiredExperienceYears(job);
  const expResult = calculateExperienceScore(candidateYOE, requiredYOE);
  const experienceFit = expResult.score;

  // 3. Domain Fit (20%)
  const candidateExpText =
    typeof candidate.experiences === "string"
      ? candidate.experiences
      : JSON.stringify(candidate.experiences || candidate.projects || []);
  const candidateDomainQuery = `${candidateTargetRole} ${candidateExpText}`;
  const candidateDomainVec = await edgeEmbedder.embed(candidateDomainQuery, true);
  const domainSim = edgeEmbedder.cosineSimilarity(candidateDomainVec, jobDescVec);
  let domainFit = normalizeDenseScore(domainSim, 0.30, 0.75);

  // 4. Trajectory Fit (15%)
  const trajectoryResult = calculateTrajectoryScore(candidateTargetRole, job.title);
  let trajectoryFit = trajectoryResult.score;

  const isHardMismatch = checkDomainMismatch(job.title);
  if (isHardMismatch) {
    domainFit = 0;
    trajectoryFit = Math.min(30, trajectoryFit);
  }

  // Sub-scores
  const subScores: FitScoreSubDimensions = {
    skillsFit,
    experienceFit,
    domainFit,
    trajectoryFit,
  };

  // Composite Score
  const score = computeCompositeFitScore(subScores, weights);
  const recommendation = deriveRecommendation(score);

  // Extract strengths, gaps, risks
  const strengths: string[] = [];
  const gaps: string[] = [];
  const risks: string[] = [];

  if (matchedSkills.length > 0) {
    strengths.push(`Direct skill overlap on: ${matchedSkills.slice(0, 5).join(", ")}`);
  }
  if (experienceFit >= 85) {
    strengths.push(expResult.rationale);
  }
  if (trajectoryFit >= 85) {
    strengths.push(trajectoryResult.rationale);
  }

  if (candidateSkills.length > 0) {
    const missingSkills = candidateSkills.filter((s) => !matchedSkills.includes(s.toLowerCase()));
    if (missingSkills.length > 0 && skillsFit < 75) {
      gaps.push(`Key candidate skills not explicitly highlighted in job post: ${missingSkills.slice(0, 4).join(", ")}`);
    }
  }

  if (experienceFit < 70) {
    gaps.push(expResult.rationale);
  }

  if (isHardMismatch) {
    risks.push("Job appears outside candidate core engineering domain");
  }
  if (trajectoryFit < 60) {
    risks.push(trajectoryResult.rationale);
  }

  const reasoning = `Local hybrid evaluation: Skills (${skillsFit}/100), Experience (${experienceFit}/100), Domain (${domainFit}/100), Trajectory (${trajectoryFit}/100). ${
    matchedSkills.length > 0 ? `Matched ${matchedSkills.length} key technical terms.` : "Limited direct keyword matches."
  } ${expResult.rationale}`;

  return {
    score,
    recommendation,
    skillsFit,
    experienceFit,
    domainFit,
    trajectoryFit,
    dimensionRationale: {
      skills: `BM25 lexical overlap: ${bm25Normalized}%, Dense semantic similarity: ${denseSkillsScore}%`,
      experience: expResult.rationale,
      domain: `Semantic domain alignment: ${domainFit}%`,
      trajectory: trajectoryResult.rationale,
    },
    strengths: strengths.length > 0 ? strengths : ["Matches standard baseline profile criteria"],
    gaps,
    risks,
    reasoning,
  };
}

/**
 * Classifies a job into the 3-Tier funnel based on its hybrid score.
 */
export function classifyFunnelAction(score: number): FunnelAction {
  if (score < 55) {
    return "AUTO_IGNORE";
  }
  if (score >= 82) {
    return "AUTO_STAGE_HIGH_MATCH";
  }
  return "SELECTIVE_LLM_DEEP_INSPECTION";
}

/**
 * Batch evaluates a list of jobs through the 3-tier hybrid scoring funnel.
 */
export async function evaluateHybridFunnel(
  candidate: CandidateContext,
  jobs: Array<JobContext & { id?: string }>,
  options?: HybridScoringOptions
): Promise<HybridFunnelResult[]> {
  const results: HybridFunnelResult[] = [];

  for (const job of jobs) {
    const fitScore = await scoreJobHybrid(candidate, job, options);
    const funnelAction = classifyFunnelAction(fitScore.score);

    results.push({
      jobId: job.id,
      score: fitScore.score,
      recommendation: fitScore.recommendation,
      subScores: {
        skillsFit: fitScore.skillsFit,
        experienceFit: fitScore.experienceFit,
        domainFit: fitScore.domainFit,
        trajectoryFit: fitScore.trajectoryFit,
      },
      funnelAction,
      fitScore,
    });
  }

  return results;
}
