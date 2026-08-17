import { db } from "@/lib/db";
import { generateDedupeKey } from "./dedupe";
import {
  evaluateDeterministicFilters,
  type CandidateFilterCriteria,
  type JobFilterInput,
  type DeterministicFilterOptions,
  type DeterministicFilterResult,
} from "@/lib/filters/deterministic";
import {
  extractJobDetails,
  scoreJobFit,
  type AIRouterOptions,
  type CandidateContext,
  type JobContext,
  type FitScore,
} from "@/lib/ai/router";

export interface IngestionInput {
  rawText?: string;
  url?: string;
  title?: string;
  company?: string;
  location?: string;
  remoteStatus?: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string;
  description?: string;
  requiredExperienceYears?: number | null;
  source?: "MANUAL" | "URL" | "PASTE" | string;
}

export interface IngestionOptions {
  candidateId?: string;
  prismaClient?: typeof db;
  aiOptions?: AIRouterOptions;
  filterOptions?: DeterministicFilterOptions;
  fetchFn?: typeof fetch;
}

export interface IngestedJobRecord {
  id: string;
  dedupeKey: string;
  title: string;
  company: string;
  location: string;
  remoteStatus: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType: string;
  description: string;
  url: string;
  source: string;
  status: string;
  discoveredAt?: Date;
  postedAt?: Date | null;
}

export interface IngestionResult {
  job: IngestedJobRecord;
  isDuplicate: boolean;
  status: string;
  fitScore: FitScore | null;
  filterResult: DeterministicFilterResult | null;
}

/**
 * Extracts plain text from raw HTML content by removing scripts, styles, and tags.
 */
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches and extracts text content from a remote URL.
 */
export async function fetchJobPageContent(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const response = await fetchFn(url, {
    headers: {
      "User-Agent": "PulseCareerBot/1.0 (+https://pulse-career.internal)",
      Accept: "text/html,application/xhtml+xml,text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch job posting from URL (${response.status} ${response.statusText})`);
  }

  const body = await response.text();
  return extractTextFromHtml(body);
}

/**
 * Synchronous End-to-End Ingestion Pipeline:
 * 1. Extraction: Parse raw text or fetch from URL if structured fields are missing.
 * 2. Deduplication: Compute SHA-256 dedupeKey and check existing record in SQLite.
 * 3. Deterministic Filtering: Evaluate hard constraints (salary, remote, experience delta, blacklists) with 0 AI calls.
 * 4. AI Fit Scoring: If passed, evaluate candidate fit via provider-agnostic AI router.
 * 5. Persistence & Auditing: Persist Job, FitScore, and audit Events in SQLite.
 */
export async function ingestJobPipeline(
  input: IngestionInput,
  options?: IngestionOptions
): Promise<IngestionResult> {
  const prisma = options?.prismaClient || db;
  const customFetch = options?.fetchFn || fetch;

  let rawContent = input.rawText || input.description || "";
  let source = input.source || (input.url ? "URL" : "MANUAL");

  // Step 1: Handle URL ingestion if no raw text was directly provided
  if (input.url && !rawContent) {
    try {
      rawContent = await fetchJobPageContent(input.url, customFetch);
      source = "URL";
    } catch (fetchError) {
      console.warn("Could not fetch remote URL content, continuing with available metadata:", fetchError);
    }
  }

  let title = input.title;
  let company = input.company;
  let location = input.location || "";
  let remoteStatus = input.remoteStatus || "UNKNOWN";
  let salaryMin = input.salaryMin ?? null;
  let salaryMax = input.salaryMax ?? null;
  let employmentType = input.employmentType || "FULL_TIME";
  let description = input.description || rawContent;
  let requiredExperienceYears = input.requiredExperienceYears ?? null;

  // Step 2: If title or company is missing, extract structured metadata using AI
  if ((!title || !company) && rawContent) {
    const extracted = await extractJobDetails(rawContent, options?.aiOptions);
    title = title || extracted.title;
    company = company || extracted.company;
    location = location || extracted.location;
    remoteStatus = remoteStatus === "UNKNOWN" ? extracted.remoteStatus : remoteStatus;
    salaryMin = salaryMin ?? extracted.salaryMin ?? null;
    salaryMax = salaryMax ?? extracted.salaryMax ?? null;
    employmentType = employmentType === "FULL_TIME" ? extracted.employmentType : employmentType;
    description = description || extracted.description;
    requiredExperienceYears = requiredExperienceYears ?? extracted.requiredExperienceYears ?? null;
  }

  if (!title || !company) {
    throw new Error("Job title and company name are required for ingestion");
  }

  // Step 3: Compute deterministic dedupeKey
  const dedupeKey = generateDedupeKey({
    company,
    title,
    url: input.url,
  });

  // Step 4: Check if job already exists in SQLite
  const existingJob = await prisma.job.findUnique({
    where: { dedupeKey },
    include: {
      fitScore: true,
      application: true,
    },
  });

  if (existingJob) {
    // If already processed (has fitScore or is filtered out / shortlisted / review)
    if (existingJob.fitScore || existingJob.status === "FILTERED_OUT" || existingJob.status === "SHORTLISTED" || existingJob.status === "REVIEW") {
      let parsedFitScore: FitScore | null = null;
      if (existingJob.fitScore) {
        let strengths: string[] = [];
        let gaps: string[] = [];
        let risks: string[] = [];
        try {
          strengths = JSON.parse(existingJob.fitScore.strengths || "[]");
          gaps = JSON.parse(existingJob.fitScore.gaps || "[]");
          risks = JSON.parse(existingJob.fitScore.risks || "[]");
        } catch {
          // fallback
        }

        parsedFitScore = {
          score: existingJob.fitScore.score,
          recommendation: existingJob.fitScore.recommendation as "APPLY" | "REVIEW" | "IGNORE",
          strengths,
          gaps,
          risks,
          reasoning: existingJob.fitScore.reasoning || "",
        };
      }

      return {
        job: existingJob,
        isDuplicate: true,
        status: existingJob.status,
        fitScore: parsedFitScore,
        filterResult: null,
      };
    }
  }

  // Step 5: Fetch Candidate Profile
  const candidateId = options?.candidateId || "candidate-default";
  let candidateRecord = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidateRecord) {
    candidateRecord = await prisma.candidate.findFirst();
  }

  const candidateCriteria: CandidateFilterCriteria = {
    minSalary: candidateRecord?.minSalary ?? 0,
    yearsOfExperience: candidateRecord?.yearsOfExperience ?? 0,
    remotePreference: candidateRecord?.remotePreference ?? "ANY",
    preferredLocations: candidateRecord?.preferredLocations,
  };

  const jobFilterInput: JobFilterInput = {
    title,
    company,
    location,
    remoteStatus,
    salaryMin,
    salaryMax,
    employmentType,
    description,
    requiredExperienceYears,
  };

  // Step 6: Evaluate Deterministic Filters (Zero AI)
  const filterResult = evaluateDeterministicFilters(
    candidateCriteria,
    jobFilterInput,
    options?.filterOptions
  );

  // If rejected by deterministic filters
  if (!filterResult.passed) {
    const job = await prisma.job.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        title,
        company,
        location,
        remoteStatus,
        salaryMin,
        salaryMax,
        employmentType,
        description,
        url: input.url || "",
        source,
        status: "FILTERED_OUT",
      },
      update: {
        title,
        company,
        location,
        remoteStatus,
        salaryMin,
        salaryMax,
        employmentType,
        description,
        url: input.url || "",
        status: "FILTERED_OUT",
      },
    });

    await prisma.event.create({
      data: {
        entityType: "Job",
        entityId: job.id,
        eventType: "FILTERED_OUT",
        payload: JSON.stringify({
          reasons: filterResult.reasons,
          dedupeKey,
        }),
      },
    });

    return {
      job,
      isDuplicate: false,
      status: "FILTERED_OUT",
      fitScore: null,
      filterResult,
    };
  }

  // Step 7: Passed filters -> Evaluate Fit Score using AI Router
  const candidateContext: CandidateContext = {
    targetRole: candidateRecord?.targetRole,
    minSalary: candidateRecord?.minSalary,
    yearsOfExperience: candidateRecord?.yearsOfExperience,
    remotePreference: candidateRecord?.remotePreference,
    preferredLocations: candidateRecord?.preferredLocations,
    skills: candidateRecord?.skills,
    projects: candidateRecord?.projects,
    experiences: candidateRecord?.experiences,
    resumeText: candidateRecord?.resumeText,
  };

  const jobContext: JobContext = {
    title,
    company,
    location,
    remoteStatus,
    salaryMin,
    salaryMax,
    employmentType,
    description,
    requiredExperienceYears,
  };

  const fitScore = await scoreJobFit(candidateContext, jobContext, options?.aiOptions);

  // Determine initial status based on score
  let finalStatus = "REVIEW";
  if (fitScore.score >= 80 || fitScore.recommendation === "APPLY") {
    finalStatus = "SHORTLISTED";
  } else if (fitScore.score < 60 || fitScore.recommendation === "IGNORE") {
    finalStatus = "IGNORED";
  }

  const job = await prisma.job.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      title,
      company,
      location,
      remoteStatus,
      salaryMin,
      salaryMax,
      employmentType,
      description,
      url: input.url || "",
      source,
      status: finalStatus,
    },
    update: {
      title,
      company,
      location,
      remoteStatus,
      salaryMin,
      salaryMax,
      employmentType,
      description,
      url: input.url || "",
      status: finalStatus,
    },
  });

  await prisma.fitScore.upsert({
    where: { jobId: job.id },
    create: {
      jobId: job.id,
      score: fitScore.score,
      recommendation: fitScore.recommendation,
      strengths: JSON.stringify(fitScore.strengths),
      gaps: JSON.stringify(fitScore.gaps),
      risks: JSON.stringify(fitScore.risks),
      reasoning: fitScore.reasoning,
    },
    update: {
      score: fitScore.score,
      recommendation: fitScore.recommendation,
      strengths: JSON.stringify(fitScore.strengths),
      gaps: JSON.stringify(fitScore.gaps),
      risks: JSON.stringify(fitScore.risks),
      reasoning: fitScore.reasoning,
    },
  });

  // Log Discovery and Scored audit events
  await prisma.event.create({
    data: {
      entityType: "Job",
      entityId: job.id,
      eventType: "DISCOVERED",
      payload: JSON.stringify({
        source,
        url: input.url || "",
        dedupeKey,
      }),
    },
  });

  await prisma.event.create({
    data: {
      entityType: "Job",
      entityId: job.id,
      eventType: "SCORED",
      payload: JSON.stringify({
        score: fitScore.score,
        recommendation: fitScore.recommendation,
        status: finalStatus,
      }),
    },
  });

  return {
    job,
    isDuplicate: false,
    status: finalStatus,
    fitScore,
    filterResult,
  };
}
