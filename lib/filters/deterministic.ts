import { convertCurrency, formatSalary } from "../utils/currency";
import { evaluateLocationPolicy } from "./location-policy";

export interface CandidateFilterCriteria {
  minSalary?: number;
  currency?: string;
  yearsOfExperience?: number;
  remotePreference?: "REMOTE_ONLY" | "HYBRID" | "ONSITE" | "ANY" | string;
  preferredLocations?: string[] | string;
  candidateLocation?: string;
  blacklistedCompanies?: string[] | string;
  blacklistedKeywords?: string[] | string;
}

export interface JobFilterInput {
  title: string;
  company: string;
  location?: string;
  remoteStatus?: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  employmentType?: string;
  description?: string;
  requiredExperienceYears?: number | null;
}

export interface DeterministicFilterOptions {
  experienceDeltaTolerance?: number;
  blacklistedCompanies?: string[];
  blacklistedKeywords?: string[];
}

export interface DeterministicFilterResult {
  passed: boolean;
  reasons: string[];
}

export interface ExperienceBounds {
  minYears: number | null;
  maxYears: number | null;
}

/**
 * Extracts required years of experience range/bounds from job text using common regex patterns.
 */
export function extractExperienceBounds(text?: string | null): ExperienceBounds {
  if (!text) return { minYears: null, maxYears: null };

  // Pattern 1: Range like "3-5 years" or "1 to 7 yrs"
  const rangeMatch = text.match(/(?:^|\b)(\d+)\s*(?:-|to)\s*(\d+)\+?\s*(?:years?|yrs?)/i);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    return {
      minYears: parseInt(rangeMatch[1], 10),
      maxYears: parseInt(rangeMatch[2], 10),
    };
  }

  // Pattern 2: "Minimum of 4 years", "At least 5 years", "5+ years"
  const minMatch =
    text.match(/(?:minimum|at least|min\.?)\s+(?:of\s+)?(\d+)\+?\s*(?:years?|yrs?)/i) ||
    text.match(/(?:^|\b)(\d+)\+\s*(?:years?|yrs?)/i);
  if (minMatch && minMatch[1]) {
    return {
      minYears: parseInt(minMatch[1], 10),
      maxYears: null,
    };
  }

  // Pattern 3: "5 years of experience", "5 yrs"
  const standardMatch = text.match(/(?:^|\b)(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience)?/i);
  if (standardMatch && standardMatch[1]) {
    const val = parseInt(standardMatch[1], 10);
    return {
      minYears: val,
      maxYears: text.includes("+") ? null : val,
    };
  }

  return { minYears: null, maxYears: null };
}

/**
 * Extracts required years of experience from job text.
 */
export function extractRequiredExperience(text?: string | null): number | null {
  return extractExperienceBounds(text).minYears;
}

/**
 * Auto-rejects senior/lead/staff title keywords when candidate has <= 3 YOE.
 */
export function isSeniorityExcluded(title?: string | null, candidateYears?: number): boolean {
  if (!title) return false;
  if (candidateYears === undefined || candidateYears === null) return false;
  if (candidateYears > 3) return false;

  const seniorRegex = /\b(?:senior|sr\.?|staff|principal|director|head\s+of|architect|lead|vp)\b/i;
  return seniorRegex.test(title);
}

function normalizeStringArray(input?: string[] | string): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((s) => s.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    // Treat as comma-separated or single string if not JSON
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Pure evaluation function executing fast, zero-AI deterministic filtering rules
 * before any LLM inference requests are triggered.
 */
export function evaluateDeterministicFilters(
  candidate: CandidateFilterCriteria,
  job: JobFilterInput,
  options?: DeterministicFilterOptions
): DeterministicFilterResult {
  const reasons: string[] = [];

  // 1. Seniority Guard (<= 3 YOE)
  const candidateExperience = candidate.yearsOfExperience;
  if (isSeniorityExcluded(job.title, candidateExperience)) {
    reasons.push(`Seniority title in '${job.title}' is excluded for candidate with <= 3 YOE`);
  }

  // 2. Salary Filter
  if (
    typeof candidate.minSalary === "number" &&
    candidate.minSalary > 0 &&
    typeof job.salaryMax === "number" &&
    job.salaryMax > 0
  ) {
    const candidateCurrency = (candidate.currency || "INR").toUpperCase();
    const jobCurrency = (job.currency || "INR").toUpperCase();

    if (candidateCurrency === jobCurrency) {
      if (job.salaryMax < candidate.minSalary) {
        const formattedMax = formatSalary(job.salaryMax, jobCurrency);
        const formattedMin = formatSalary(candidate.minSalary, candidateCurrency);
        reasons.push(`Salary ceiling ${formattedMax} is below candidate minimum ${formattedMin}`);
      }
    } else {
      const convertedJobMax = convertCurrency(job.salaryMax, jobCurrency, candidateCurrency);
      if (convertedJobMax !== null && convertedJobMax < candidate.minSalary) {
        const formattedJobMax = formatSalary(job.salaryMax, jobCurrency);
        const formattedConverted = formatSalary(convertedJobMax, candidateCurrency);
        const formattedCandidateMin = formatSalary(candidate.minSalary, candidateCurrency);
        reasons.push(
          `Salary ceiling ${formattedJobMax} (~${formattedConverted}) is below candidate minimum ${formattedCandidateMin}`
        );
      }
    }
  }

  // 3. Remote & Location Policy Engine Filter
  const candidateRemote = (candidate.remotePreference || "").toUpperCase().trim();
  const jobRemote = (job.remoteStatus || "").toUpperCase().trim();

  if (candidateRemote === "REMOTE_ONLY") {
    if (jobRemote === "ONSITE" || jobRemote === "HYBRID") {
      reasons.push(`Job is ${jobRemote} but candidate preference is REMOTE_ONLY`);
    }
  } else if (candidateRemote === "ONSITE_ONLY" && jobRemote === "REMOTE") {
    reasons.push(`Job is REMOTE but candidate preference is ONSITE_ONLY`);
  }

  const locPolicy = evaluateLocationPolicy({
    candidateLocation: candidate.candidateLocation,
    preferredLocations: candidate.preferredLocations,
    jobLocation: job.location,
    jobRemoteStatus: job.remoteStatus,
    jobText: `${job.title} ${job.description || ""}`,
  });
  if (!locPolicy.passed && locPolicy.reason) {
    reasons.push(locPolicy.reason);
  }

  // 4. Experience Delta Filter
  const tolerance = options?.experienceDeltaTolerance ?? 2;
  const bounds = extractExperienceBounds(job.description) || extractExperienceBounds(job.title);

  let requiredExperience = job.requiredExperienceYears;
  if (requiredExperience === null || requiredExperience === undefined) {
    requiredExperience = bounds.minYears;
  }

  if (
    typeof candidateExperience === "number" &&
    typeof requiredExperience === "number" &&
    requiredExperience > candidateExperience + tolerance
  ) {
    reasons.push(
      `Required experience (${requiredExperience} years) exceeds candidate experience (${candidateExperience} years) by more than tolerance (${tolerance} years)`
    );
  }

  // 5. Blacklisted Companies Filter
  const candidateCompanyBlacklist = normalizeStringArray(candidate.blacklistedCompanies);
  const optionsCompanyBlacklist = options?.blacklistedCompanies ?? [];
  const combinedCompanyBlacklist = Array.from(
    new Set([...candidateCompanyBlacklist, ...optionsCompanyBlacklist].map((c) => c.toLowerCase()))
  );

  const jobCompanyNormalized = (job.company || "").trim().toLowerCase();
  if (jobCompanyNormalized && combinedCompanyBlacklist.includes(jobCompanyNormalized)) {
    reasons.push(`Company '${job.company}' is in blacklisted companies`);
  }

  // 6. Blacklisted Keywords Filter
  const candidateKeywordBlacklist = normalizeStringArray(candidate.blacklistedKeywords);
  const optionsKeywordBlacklist = options?.blacklistedKeywords ?? [];
  const combinedKeywordBlacklist = Array.from(
    new Set([...candidateKeywordBlacklist, ...optionsKeywordBlacklist].map((k) => k.toLowerCase()))
  );

  const titleLower = (job.title || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();

  for (const keyword of combinedKeywordBlacklist) {
    if (!keyword) continue;
    if (titleLower.includes(keyword)) {
      reasons.push(`Blacklisted keyword '${keyword}' found in title`);
    } else if (descLower.includes(keyword)) {
      reasons.push(`Blacklisted keyword '${keyword}' found in description`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

