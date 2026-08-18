import { z } from "zod";
import { generateObject, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  computeCompositeFitScore,
  deriveRecommendation,
  DEFAULT_FIT_SCORE_WEIGHTS,
  type FitScoreWeights,
} from "../scoring/fit-score";

export const FitScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(["APPLY", "REVIEW", "IGNORE"]),
  skillsFit: z.number().int().min(0).max(100),
  experienceFit: z.number().int().min(0).max(100),
  domainFit: z.number().int().min(0).max(100),
  trajectoryFit: z.number().int().min(0).max(100),
  dimensionRationale: z
    .object({
      skills: z.string().optional(),
      experience: z.string().optional(),
      domain: z.string().optional(),
      trajectory: z.string().optional(),
    })
    .optional(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risks: z.array(z.string()),
  reasoning: z.string(),
});

export type FitScore = z.infer<typeof FitScoreSchema>;

export const JobDetailsSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().default(""),
  remoteStatus: z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]).default("UNKNOWN"),
  salaryMin: z.number().int().nullable().optional(),
  salaryMax: z.number().int().nullable().optional(),
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "OTHER"])
    .default("FULL_TIME"),
  description: z.string(),
  requiredExperienceYears: z.number().int().nullable().optional(),
  skills: z.array(z.string()).default([]),
});

export type JobDetails = z.infer<typeof JobDetailsSchema>;

export const TailoredSummarySchema = z.object({
  summary: z.string(),
  matchingPoints: z.array(z.string()),
  highlightedProjects: z.array(z.string()),
});

export type TailoredSummary = z.infer<typeof TailoredSummarySchema>;

export interface CandidateContext {
  name?: string;
  targetRole?: string;
  minSalary?: number;
  yearsOfExperience?: number;
  remotePreference?: string;
  preferredLocations?: string[] | string;
  skills?: string[] | string | unknown;
  projects?: string[] | string | unknown;
  experiences?: string[] | string | unknown;
  resumeText?: string;
}

export interface JobContext {
  title: string;
  company: string;
  location?: string;
  remoteStatus?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string;
  description: string;
  requiredExperienceYears?: number | null;
}

export interface AIRouterOptions {
  primaryModel?: LanguageModel;
  fallbackModel?: LanguageModel;
  models?: LanguageModel[];
  weights?: FitScoreWeights;
  conversionInsights?: string;
}

export interface ConfiguredModelCandidate {
  providerName: string;
  modelName: string;
  model: LanguageModel;
  keyMask: string;
}

export function parseApiKeys(envValue?: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export function maskKey(key: string): string {
  if (!key) return "***";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function getGroqModel(apiKey?: string, modelName?: string): LanguageModel {
  const resolvedKey = apiKey || parseApiKeys(process.env.GROQ_API_KEY)[0] || "";
  const resolvedModel = modelName || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const baseURL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

  const client = createOpenAI({
    apiKey: resolvedKey,
    baseURL,
  });

  return client(resolvedModel);
}

export function getOpenRouterModel(apiKey?: string, modelName?: string): LanguageModel {
  const resolvedKey =
    apiKey ||
    parseApiKeys(process.env.OPENROUTER_API_KEY)[0] ||
    "";
  const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const resolvedModel =
    modelName || process.env.OPENROUTER_MODEL || "openrouter/free";

  const client = createOpenAI({
    apiKey: resolvedKey,
    baseURL,
  });

  return client(resolvedModel);
}

export function getGeminiModel(apiKey?: string, modelName?: string): LanguageModel {
  const resolvedKey =
    apiKey ||
    parseApiKeys(process.env.GEMINI_API_KEY)[0] ||
    parseApiKeys(process.env.GOOGLE_API_KEY)[0] ||
    parseApiKeys(process.env.GOOGLE_GENERATIVE_AI_API_KEY)[0] ||
    "";
  const resolvedModel = modelName || process.env.GEMINI_MODEL || "gemini-3.7-flash";

  const client = createGoogleGenerativeAI({
    apiKey: resolvedKey,
  });

  return client(resolvedModel);
}

let rotationCursor = 0;

export function resetRotationCursor(): void {
  rotationCursor = 0;
}

export function getAllConfiguredModels(): ConfiguredModelCandidate[] {
  const candidates: ConfiguredModelCandidate[] = [];

  // 1. Groq keys
  const groqKeys = parseApiKeys(process.env.GROQ_API_KEY);
  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  for (const key of groqKeys) {
    candidates.push({
      providerName: "Groq",
      modelName: groqModel,
      model: getGroqModel(key, groqModel),
      keyMask: maskKey(key),
    });
  }

  // 2. Google Gemini keys
  const geminiKeys = [
    ...parseApiKeys(process.env.GEMINI_API_KEY),
    ...parseApiKeys(process.env.GOOGLE_API_KEY),
    ...parseApiKeys(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  ];
  const uniqueGeminiKeys = Array.from(new Set(geminiKeys));
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.7-flash";
  for (const key of uniqueGeminiKeys) {
    candidates.push({
      providerName: "Google Gemini",
      modelName: geminiModel,
      model: getGeminiModel(key, geminiModel),
      keyMask: maskKey(key),
    });
  }

  // 3. OpenRouter keys
  const openRouterKeys = parseApiKeys(process.env.OPENROUTER_API_KEY);
  const uniqueOpenRouterKeys = Array.from(new Set(openRouterKeys));
  const openRouterModel =
    process.env.OPENROUTER_MODEL || "openrouter/free";
  for (const key of uniqueOpenRouterKeys) {
    candidates.push({
      providerName: "OpenRouter",
      modelName: openRouterModel,
      model: getOpenRouterModel(key, openRouterModel),
      keyMask: maskKey(key),
    });
  }

  if (candidates.length === 0) {
    return [
      {
        providerName: "OpenRouter",
        modelName: openRouterModel,
        model: getOpenRouterModel(),
        keyMask: "***",
      },
      {
        providerName: "Google Gemini",
        modelName: geminiModel,
        model: getGeminiModel(),
        keyMask: "***",
      },
    ];
  }

  const cursor = rotationCursor % candidates.length;
  const rotated = [...candidates.slice(cursor), ...candidates.slice(0, cursor)];
  rotationCursor = (rotationCursor + 1) % candidates.length;
  return rotated;
}

export async function generateStructuredWithFallback<T>({
  schema,
  prompt,
  system,
  options,
}: {
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  options?: AIRouterOptions;
}): Promise<T> {
  let modelCandidates: Array<{ name: string; model: LanguageModel }>;

  if (options?.models && options.models.length > 0) {
    modelCandidates = options.models.map((m, idx) => ({
      name: `Explicit Option Model #${idx + 1}`,
      model: m,
    }));
  } else if (options?.primaryModel || options?.fallbackModel) {
    modelCandidates = [];
    if (options.primaryModel) {
      modelCandidates.push({ name: "Primary Model", model: options.primaryModel });
    }
    if (options.fallbackModel) {
      modelCandidates.push({ name: "Fallback Model", model: options.fallbackModel });
    }
  } else {
    modelCandidates = getAllConfiguredModels().map((c) => ({
      name: `${c.providerName} (${c.modelName} [${c.keyMask}])`,
      model: c.model,
    }));
  }

  const errors: string[] = [];

  for (let i = 0; i < modelCandidates.length; i++) {
    const candidate = modelCandidates[i];
    try {
      const result = await generateObject({
        model: candidate.model,
        schema,
        system,
        prompt,
      });
      return result.object;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${candidate.name}: ${errMsg}`);
      console.warn(
        `AI provider ${candidate.name} failed (${i + 1}/${modelCandidates.length}), attempting next provider in pool:`,
        errMsg
      );
    }
  }

  throw new Error(`All AI providers failed. Errors:\n- ${errors.join("\n- ")}`);
}

export function buildCandidateFactSheet(candidate: CandidateContext): string {
  const formatList = (val: string[] | string | unknown): string => {
    if (!val) return "Not specified";
    if (Array.isArray(val)) {
      if (val.length === 0) return "None";
      if (typeof val[0] === "string") return val.join(", ");
      return JSON.stringify(val, null, 2);
    }
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return "None";
          if (typeof parsed[0] === "string") return parsed.join(", ");
          return JSON.stringify(parsed, null, 2);
        }
      } catch {
        return val;
      }
      return val;
    }
    return JSON.stringify(val, null, 2);
  };

  const lines = [
    `Target Role: ${candidate.targetRole || "Software Engineer"}`,
    `Years of Experience: ${candidate.yearsOfExperience ?? "Not specified"}`,
    `Skills: ${formatList(candidate.skills)}`,
    `Remote Preference: ${candidate.remotePreference || "ANY"}`,
    `Preferred Locations: ${formatList(candidate.preferredLocations)}`,
    `Experience Records: ${formatList(candidate.experiences)}`,
    `Projects: ${formatList(candidate.projects)}`,
    `Resume Text: ${candidate.resumeText || "None provided"}`,
  ];

  if (candidate.name) {
    lines.unshift(`Candidate Name: ${candidate.name}`);
  }

  return lines.join("\n");
}

export async function scoreJobFit(
  candidate: CandidateContext,
  job: JobContext,
  options?: AIRouterOptions
): Promise<FitScore> {
  let system = `You are a precise, objective career matching assistant for Pulse.
Your task is to evaluate whether a job posting is a viable match for a candidate based strictly on candidate facts.
CRITICAL INVARIANTS:
1. Ground your evaluation strictly in the provided candidate facts and job requirements.
2. Never invent, hallucinate, or assume any skills, credentials, metrics, or experiences not explicitly present in the candidate profile.
3. If a job requirement is not evidenced in the candidate facts, record it as a gap.
4. Evaluate four orthogonal sub-dimensions (0–100):
   - skillsFit: Alignment between verified candidate technical/soft skills and mandatory job requirements.
   - experienceFit: Alignment of seniority, years of relevant experience, and scope of past responsibilities.
   - domainFit: Industry vertical alignment (e.g. Fintech, Healthcare, Developer Tools, B2B SaaS).
   - trajectoryFit: Growth suitability (natural career step vs lateral vs overqualified).
5. Provide a clear reasoning string and optional dimension rationale.
6. Score ranges:
   - APPLY (80-100): High alignment across critical requirements, minimal gaps.
   - REVIEW (60-79): Moderate alignment, viable potential with notable gaps or uncertainties.
   - IGNORE (0-59): Major disqualifying gaps, misaligned experience level, or incompatible domain.`;

  if (options?.conversionInsights) {
    system += `\n\n${options.conversionInsights}`;
  }

  const prompt = `CANDIDATE FACTS:
${buildCandidateFactSheet(candidate)}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Remote Status: ${job.remoteStatus || "UNKNOWN"}
Salary Range: ${job.salaryMin ?? "N/A"} - ${job.salaryMax ?? "N/A"}
Employment Type: ${job.employmentType || "FULL_TIME"}
Description:
${job.description}

Evaluate the candidate's fit across all four sub-dimensions (skillsFit, experienceFit, domainFit, trajectoryFit) and return a structured FitScore.`;

  const result = await generateStructuredWithFallback({
    schema: FitScoreSchema,
    system,
    prompt,
    options,
  });

  const weights = options?.weights || DEFAULT_FIT_SCORE_WEIGHTS;
  const computedScore = computeCompositeFitScore(
    {
      skillsFit: result.skillsFit,
      experienceFit: result.experienceFit,
      domainFit: result.domainFit,
      trajectoryFit: result.trajectoryFit,
    },
    weights
  );

  return {
    ...result,
    score: computedScore,
    recommendation: deriveRecommendation(computedScore),
  };
}

export async function extractJobDetails(
  rawText: string,
  options?: AIRouterOptions
): Promise<JobDetails> {
  const system = `You are an expert job posting analyzer.
Extract structured metadata from the provided raw job description text.
Accurately identify role title, company name, location, remote work status (REMOTE, HYBRID, ONSITE, or UNKNOWN), salary ranges (if present), employment type (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, OTHER), estimated minimum required years of experience (if mentioned), and key required technical/domain skills.
Never hallucinate salary numbers or requirements not present in the text.`;

  const prompt = `RAW JOB TEXT:
${rawText}

Extract structured job details adhering to the schema.`;

  return generateStructuredWithFallback({
    schema: JobDetailsSchema,
    system,
    prompt,
    options,
  });
}

export async function tailorApplicationSummary(
  candidate: CandidateContext,
  job: JobContext,
  options?: AIRouterOptions
): Promise<TailoredSummary> {
  const system = `You are a career preparation assistant.
Draft a factual, high-signal application summary and list matching strengths based strictly on verified candidate facts.
Do not invent any achievements or skills not present in the candidate profile.`;

  const prompt = `CANDIDATE FACTS:
${buildCandidateFactSheet(candidate)}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Description:
${job.description}

Generate a concise tailored summary, key matching points, and relevant projects.`;

  return generateStructuredWithFallback({
    schema: TailoredSummarySchema,
    system,
    prompt,
    options,
  });
}

export {
  TailoredResumeSchema,
  type TailoredResume,
  SelectedProjectSchema,
  type SelectedProject,
  ExperienceHighlightSchema,
  type ExperienceHighlight,
  ApplicationAnswerSchema,
  type ApplicationAnswer,
  ApplicationAnswersBatchSchema,
  type ApplicationAnswersBatch,
} from "../../types/tailoring";
export { tailorResume } from "../tailoring/resume";
export {
  generateApplicationAnswers,
  generateApplicationAnswers as generateAnswers,
  answerCustomQuestion,
  answerCustomQuestion as answerQuestion,
  STANDARD_APPLICATION_QUESTIONS,
} from "../tailoring/answers";

export const scoreJob = scoreJobFit;
export const extractJob = extractJobDetails;
export const tailorSummary = tailorApplicationSummary;



