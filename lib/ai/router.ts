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
  currency: z.string().default("INR"),
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
  currency?: string;
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
  currency?: string;
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
  temperature?: number;
}

export interface ConfiguredModelCandidate {
  id: string;
  providerName: string;
  modelName: string;
  model: LanguageModel;
  keyMask: string;
}

export interface CooldownRecord {
  expiresAt: number;
  reason: string;
  consecutiveFailures: number;
}

export const candidateCooldownMap = new Map<string, CooldownRecord>();

export function calculateCooldownDuration(errorOrReason?: string | Error | unknown): number {
  if (!errorOrReason) return 60_000;
  const msg = errorOrReason instanceof Error ? errorOrReason.message : String(errorOrReason);

  // 1. Detect retry-in / retry after with seconds or ms
  const retryMatch = msg.match(
    /retry(?:-|\s+)(?:in|after)[:\s]+(\d+(?:\.\d+)?)\s*(s|sec|seconds|ms|milliseconds)?/i
  );
  if (retryMatch) {
    const val = parseFloat(retryMatch[1]);
    const unit = retryMatch[2]?.toLowerCase();
    const baseMs = unit === "ms" || unit === "milliseconds" ? val : val * 1000;
    // Add 1-2s jitter
    const jitter = 1000 + Math.random() * 1000;
    return Math.round(baseMs + jitter);
  }

  // 2. Default quota exhaustion cooldown: 300 seconds (5 minutes)
  if (/quota|resource.*exhausted|daily limit|rate-limit-quota|quota exceeded/i.test(msg)) {
    return 300_000;
  }

  // 3. Default 503 / overload cooldown: 30 seconds
  if (
    /503|overload|service unavailable|connection refused|econnrefused|econnreset|fetch failed/i.test(
      msg
    )
  ) {
    return 30_000;
  }

  // 4. Default 429 / rate-limit cooldown: 60 seconds
  if (/429|rate[- ]limit|too many requests/i.test(msg)) {
    return 60_000;
  }

  // 5. General fallback duration: 60 seconds
  return 60_000;
}

export function recordCandidateCooldown(
  candidateId: string,
  durationMs?: number,
  reason?: string
): void {
  if (!candidateId) return;
  const calculatedDuration =
    durationMs !== undefined ? durationMs : calculateCooldownDuration(reason);
  const existing = candidateCooldownMap.get(candidateId);
  const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
  const expiresAt = Date.now() + calculatedDuration;
  candidateCooldownMap.set(candidateId, {
    expiresAt,
    reason: reason || "Rate limit or provider failure",
    consecutiveFailures,
  });
}

export function isCandidateInCooldown(candidateId: string): boolean {
  if (!candidateId) return false;
  const record = candidateCooldownMap.get(candidateId);
  if (!record) return false;
  if (Date.now() >= record.expiresAt) {
    candidateCooldownMap.delete(candidateId);
    return false;
  }
  return true;
}

export function clearCandidateCooldown(candidateId: string): void {
  if (!candidateId) return;
  candidateCooldownMap.delete(candidateId);
}

export function resetAllCooldowns(): void {
  candidateCooldownMap.clear();
}

export function getCandidateCooldown(candidateId: string): CooldownRecord | undefined {
  if (!candidateId) return undefined;
  if (!isCandidateInCooldown(candidateId)) return undefined;
  return candidateCooldownMap.get(candidateId);
}

export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

export function parseCommaSeparatedList(value?: string, defaultList: string[] = []): string[] {
  if (!value) return defaultList;
  const parsed = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parsed.length > 0 ? parsed : defaultList;
}

export function parseApiKeys(envValue?: string): string[] {
  return parseCommaSeparatedList(envValue, []);
}

export function maskKey(key: string): string {
  if (!key) return "***";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function getGroqModel(apiKey?: string, modelName?: string): LanguageModel {
  const resolvedKey = apiKey || parseCommaSeparatedList(process.env.GROQ_API_KEY)[0] || "";
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
    parseCommaSeparatedList(process.env.OPENROUTER_API_KEY)[0] ||
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
    parseCommaSeparatedList(process.env.GEMINI_API_KEY)[0] ||
    parseCommaSeparatedList(process.env.GOOGLE_API_KEY)[0] ||
    parseCommaSeparatedList(process.env.GOOGLE_GENERATIVE_AI_API_KEY)[0] ||
    "";
  const resolvedModel =
    modelName || parseCommaSeparatedList(process.env.GEMINI_MODEL, DEFAULT_GEMINI_MODELS)[0];

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

  // Prioritized Provider Order:
  // 1. Google Gemini (primary: fast, generous free tier, highly consistent structured output)
  const geminiKeys = [
    ...parseCommaSeparatedList(process.env.GEMINI_API_KEY),
    ...parseCommaSeparatedList(process.env.GOOGLE_API_KEY),
    ...parseCommaSeparatedList(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  ];
  const uniqueGeminiKeys = Array.from(new Set(geminiKeys));
  const geminiModels = parseCommaSeparatedList(process.env.GEMINI_MODEL, DEFAULT_GEMINI_MODELS);
  for (const key of uniqueGeminiKeys) {
    const keyMask = maskKey(key);
    for (const model of geminiModels) {
      candidates.push({
        id: `Google Gemini:${keyMask}:${model}`,
        providerName: "Google Gemini",
        modelName: model,
        model: getGeminiModel(key, model),
        keyMask,
      });
    }
  }

  // 2. Groq (fast fallback)
  const groqKeys = Array.from(new Set(parseCommaSeparatedList(process.env.GROQ_API_KEY)));
  const groqModels = parseCommaSeparatedList(process.env.GROQ_MODEL, ["llama-3.3-70b-versatile"]);
  for (const key of groqKeys) {
    const keyMask = maskKey(key);
    for (const model of groqModels) {
      candidates.push({
        id: `Groq:${keyMask}:${model}`,
        providerName: "Groq",
        modelName: model,
        model: getGroqModel(key, model),
        keyMask,
      });
    }
  }

  // 3. OpenRouter (general fallback pool)
  const openRouterKeys = Array.from(new Set(parseCommaSeparatedList(process.env.OPENROUTER_API_KEY)));
  const openRouterModels = parseCommaSeparatedList(
    process.env.OPENROUTER_MODEL,
    ["openrouter/free"]
  );
  for (const key of openRouterKeys) {
    const keyMask = maskKey(key);
    for (const model of openRouterModels) {
      candidates.push({
        id: `OpenRouter:${keyMask}:${model}`,
        providerName: "OpenRouter",
        modelName: model,
        model: getOpenRouterModel(key, model),
        keyMask,
      });
    }
  }

  if (candidates.length === 0) {
    const defaults: ConfiguredModelCandidate[] = [
      {
        id: `Google Gemini:***:${geminiModels[0]}`,
        providerName: "Google Gemini",
        modelName: geminiModels[0],
        model: getGeminiModel(undefined, geminiModels[0]),
        keyMask: "***",
      },
      {
        id: `OpenRouter:***:${openRouterModels[0]}`,
        providerName: "OpenRouter",
        modelName: openRouterModels[0],
        model: getOpenRouterModel(undefined, openRouterModels[0]),
        keyMask: "***",
      },
    ];
    return defaults.filter((c) => !isCandidateInCooldown(c.id));
  }

  return candidates.filter((c) => !isCandidateInCooldown(c.id));
}

let anonModelCounter = 0;
const anonymousModelIdMap = new WeakMap<object, string>();

function getOrAssignModelId(model: LanguageModel, fallbackPrefix: string): string {
  const explicitId = (model as { id?: string }).id;
  if (explicitId) return explicitId;
  if (typeof model === "object" && model !== null) {
    let id = anonymousModelIdMap.get(model);
    if (!id) {
      id = `${fallbackPrefix}-${++anonModelCounter}`;
      anonymousModelIdMap.set(model, id);
    }
    return id;
  }
  return `${fallbackPrefix}-${++anonModelCounter}`;
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
  let modelCandidates: Array<{ id: string; name: string; model: LanguageModel }>;

  if (options?.models && options.models.length > 0) {
    modelCandidates = options.models.map((m, idx) => {
      const id = getOrAssignModelId(m, `explicit-option-model-${idx + 1}`);
      return {
        id,
        name: `Explicit Option Model #${idx + 1}`,
        model: m,
      };
    });
  } else if (options?.primaryModel || options?.fallbackModel) {
    modelCandidates = [];
    if (options.primaryModel) {
      const id = getOrAssignModelId(options.primaryModel, "primary-model");
      modelCandidates.push({
        id,
        name: "Primary Model",
        model: options.primaryModel,
      });
    }
    if (options.fallbackModel) {
      const id = getOrAssignModelId(options.fallbackModel, "fallback-model");
      modelCandidates.push({
        id,
        name: "Fallback Model",
        model: options.fallbackModel,
      });
    }
  } else {
    modelCandidates = getAllConfiguredModels().map((c) => ({
      id: c.id,
      name: `${c.providerName} (${c.modelName} [${c.keyMask}])`,
      model: c.model,
    }));
  }

  const availableCandidates = modelCandidates.filter((c) => !isCandidateInCooldown(c.id));
  const errors: string[] = [];

  if (availableCandidates.length === 0) {
    if (modelCandidates.length > 0) {
      errors.push(
        "All configured AI models are currently in cooldown due to previous rate limits or failures."
      );
    } else {
      errors.push("No active AI providers available (all candidates are in cooldown or unconfigured).");
    }
  }

  for (let i = 0; i < availableCandidates.length; i++) {
    const candidate = availableCandidates[i];
    try {
      const result = await generateObject({
        model: candidate.model,
        schema,
        system,
        prompt,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      });
      clearCandidateCooldown(candidate.id);
      return result.object;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${candidate.name}: ${errMsg}`);
      recordCandidateCooldown(candidate.id, undefined, errMsg);
      console.warn(
        `AI provider ${candidate.name} failed (${i + 1}/${availableCandidates.length}), attempting next provider in pool:`,
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
4. CALIBRATION & SCORING RUBRIC:
   - skillsFit (0–100):
     * If the candidate matches the primary programming languages and core frameworks requested for the role, start from a baseline of 80–90.
     * Deduct 10–15 points only for missing MANDATORY core languages or architectural requirements.
     * Deduct at most 3–5 points total for missing secondary libraries, unmentioned testing frameworks (e.g. Jest/Vitest), or explicitly marked "nice-to-have" / preferred tools.
   - experienceFit (0–100):
     * Directly compare years of experience and seniority level. If candidate meets or exceeds the required years, score 80–95.
   - domainFit (0–100):
     * Assess transferable domain knowledge. If candidate built complex full-stack web applications, baseline is 70–80 even if specific niche domain (e.g., fleet management or specialized data grids) is unlisted. Cap domain deduction to at most 15 points unless the role strictly requires a licensed/regulated vertical (e.g. healthcare compliance, high-frequency trading).
   - trajectoryFit (0–100):
     * Score natural career progression (e.g., mid-level engineer advancing into senior or specialist frontend).
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
Extract structured metadata from the provided raw job description text with high precision.

EXTRACTION GUIDELINES:
1. ROLE TITLE & COMPANY:
   - Identify the exact job title and the actual hiring company or organization.
   - Do NOT use applicant tracking system or board provider names (e.g., Greenhouse, Lever, Ashby, Workday, BambooHR, LinkedIn, Indeed) as the company name unless the posting is explicitly by and for that company.
2. LOCATION:
   - Extract city, state/province, and country if present (e.g. "San Francisco, CA", "Bengaluru, India", "London, UK", "Austin, TX").
   - If only a broad region or country is stated (e.g. "United States", "EMEA", "India"), extract that.
   - If no location is mentioned, return an empty string "".
3. REMOTE WORK STATUS:
   - "REMOTE": Fully remote, 100% remote, work from home, distributed team, remote-first.
   - "HYBRID": Explicit mention of hybrid, partial in-office days (e.g., "2-3 days in office", "hybrid policy", "flexible office model").
   - "ONSITE": Explicit mention of in-person, on-site, in-office daily, or required relocation to physical office.
   - "UNKNOWN": If neither remote, hybrid, nor onsite status is discernible.
4. SALARY RANGE & CURRENCY:
   - Currency: Map currency symbols, abbreviations, and spelled-out words to ISO-4217 code:
     * "INR": ₹, Rs, Rs., INR, "Rupee", "Rupees", "Lakh", "Lakhs", "LPA", "L", "Cr", "Crore".
     * "USD": $, USD, "Dollar", "Dollars", "US$", "USD$".
     * "EUR": €, EUR, "Euro", "Euros".
     * "GBP": £, GBP, "Pound", "Pounds", "Sterling".
     * "CAD": CA$, CAD, "Canadian Dollar".
     * "AUD": A$, AUD, "Australian Dollar".
     * "SGD": S$, SGD, "Singapore Dollar".
     * "AED": AED, "Dirham", "Dirhams", "DH", "Dhs".
     * "CHF": CHF, "Swiss Franc", "Franc", "Francs".
     * "JPY": ¥, JPY, "Yen", "Japanese Yen".
     * "SEK": kr, SEK, "Krona", "Kronor", "Swedish Krona".
     * "NZD": NZ$, NZD, "New Zealand Dollar".
     * "HKD": HK$, HKD, "Hong Kong Dollar".
     * "BRL": R$, BRL, "Real", "Reais", "Brazilian Real".
     * "PLN": zł, PLN, "Złoty", "Zloty", "Polish Zloty".
     * "ZAR": R, ZAR, "Rand", "South African Rand".
   - CRITICAL CURRENCY INVARIANT: Never convert ₹, Rs, L, Lakhs, or LPA to USD! "₹12L – ₹35L" is strictly INR (salaryMin: 1200000, salaryMax: 3500000, currency: "INR").
   - Indian Number Suffixes:
     * "L", "Lac", "Lakh", "Lakhs", "LPA" = multiply by 100,000 (e.g. ₹12L -> 1,200,000, ₹35L -> 3,500,000, 15 LPA -> 1,500,000).
     * "Cr", "Crore", "Crores" = multiply by 10,000,000 (e.g. 1.2 Cr -> 12,000,000).
   - Global Number Suffixes:
     * "k", "K" = multiply by 1,000 (e.g. $20k -> 20000, $120k -> 120000).
     * "M", "m" = multiply by 1,000,000.
   - Base Cash Salary Isolation: Extract the base cash salary range and ignore ancillary equity, bonus, or benefits clauses (e.g. "₹12L – ₹35L • No equity" -> salaryMin: 1200000, salaryMax: 3500000, currency: "INR"; "$20k – $30k • No equity" -> salaryMin: 20000, salaryMax: 30000, currency: "USD").
   - Dash & Range Variants: Handle hyphens (-), en-dashes (–), em-dashes (—), and "to" (e.g. "₹12L – ₹35L", "$20k – $30k", "15 to 25 LPA").
   - Hourly / Monthly: If only hourly rate is given (e.g. "$50 - $70/hr"), annualize assuming 2000 hours/yr (e.g. 100000 - 140000).
   - If no salary is stated or implied in the text, set salaryMin and salaryMax to null. Never hallucinate numbers.
5. EMPLOYMENT TYPE:
   - FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, or OTHER.
6. REQUIRED EXPERIENCE & SKILLS:
   - requiredExperienceYears: Minimum integer years of experience required (e.g. 5 for "5+ years"). Null if unspecified.
   - skills: Array of key technical and domain skills listed in the posting.`;

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



