import { z } from "zod";
import { generateObject, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const FitScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(["APPLY", "REVIEW", "IGNORE"]),
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
}

export function getOpenRouterModel(): LanguageModel {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";
  const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const modelName = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

  const client = createOpenAI({
    apiKey,
    baseURL,
  });

  return client(modelName);
}

export function getGeminiModel(): LanguageModel {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const client = createGoogleGenerativeAI({
    apiKey,
  });

  return client(modelName);
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
  const primary = options?.primaryModel || getOpenRouterModel();
  const fallback = options?.fallbackModel || getGeminiModel();

  try {
    const result = await generateObject({
      model: primary,
      schema,
      system,
      prompt,
    });
    return result.object;
  } catch (primaryError) {
    console.warn("Primary AI provider failed, attempting fallback:", primaryError);
    try {
      const fallbackResult = await generateObject({
        model: fallback,
        schema,
        system,
        prompt,
      });
      return fallbackResult.object;
    } catch (fallbackError) {
      throw new Error(
        `All AI providers failed. Primary error: ${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }. Fallback error: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`
      );
    }
  }
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
  const system = `You are a precise, objective career matching assistant for Pulse.
Your task is to evaluate whether a job posting is a viable match for a candidate based strictly on candidate facts.
CRITICAL INVARIANTS:
1. Ground your evaluation strictly in the provided candidate facts and job requirements.
2. Never invent, hallucinate, or assume any skills, credentials, metrics, or experiences not explicitly present in the candidate profile.
3. If a job requirement is not evidenced in the candidate facts, record it as a gap.
4. Score ranges:
   - APPLY (80-100): High alignment across critical requirements, minimal gaps.
   - REVIEW (60-79): Moderate alignment, viable potential with notable gaps or uncertainties.
   - IGNORE (0-59): Major disqualifying gaps, misaligned experience level, or incompatible domain.`;

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

Evaluate the candidate's fit for this role and return a structured FitScore.`;

  return generateStructuredWithFallback({
    schema: FitScoreSchema,
    system,
    prompt,
    options,
  });
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
} from "../../types/tailoring";
export { tailorResume } from "../tailoring/resume";

export const scoreJob = scoreJobFit;
export const extractJob = extractJobDetails;
export const tailorSummary = tailorApplicationSummary;

