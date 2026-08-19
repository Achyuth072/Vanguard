import { convertCurrency, formatSalary } from "../utils/currency";

export interface CandidateFilterCriteria {
  minSalary?: number;
  currency?: string;
  yearsOfExperience?: number;
  remotePreference?: "REMOTE_ONLY" | "HYBRID" | "ONSITE" | "ANY" | string;
  preferredLocations?: string[] | string;
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

/**
 * Extracts required years of experience from job text using common regex patterns.
 * Handles patterns such as:
 * - "5+ years of experience"
 * - "3-5 years" -> returns upper bound 5
 * - "at least 7 years"
 * - "minimum of 4 years"
 * - "10+ yrs"
 */
export function extractRequiredExperience(text?: string | null): number | null {
  if (!text) return null;

  // Pattern 1: Range like "3-5 years" or "3 - 5 yrs" -> pick max
  const rangeMatch = text.match(/(?:^|\b)(\d+)\s*(?:-|to)\s*(\d+)\+?\s*(?:years?|yrs?)/i);
  if (rangeMatch && rangeMatch[2]) {
    return parseInt(rangeMatch[2], 10);
  }

  // Pattern 2: "Minimum of 4 years", "At least 5 years"
  const minMatch = text.match(/(?:minimum|at least|min\.?)\s+(?:of\s+)?(\d+)\+?\s*(?:years?|yrs?)/i);
  if (minMatch && minMatch[1]) {
    return parseInt(minMatch[1], 10);
  }

  // Pattern 3: "5+ years of experience", "5 years of experience", "5+ yrs"
  const standardMatch = text.match(/(?:^|\b)(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience)?/i);
  if (standardMatch && standardMatch[1]) {
    return parseInt(standardMatch[1], 10);
  }

  return null;
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

  // 1. Salary Filter
  // Reject if job specifies a salary ceiling that falls below candidate's minimum requirement
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

  // 2. Remote / Work Model Filter
  const candidateRemote = (candidate.remotePreference || "").toUpperCase().trim();
  const jobRemote = (job.remoteStatus || "").toUpperCase().trim();

  if (candidateRemote === "REMOTE_ONLY") {
    if (jobRemote === "ONSITE" || jobRemote === "HYBRID") {
      reasons.push(`Job is ${jobRemote} but candidate preference is REMOTE_ONLY`);
    }
  } else if (candidateRemote === "ONSITE_ONLY" && jobRemote === "REMOTE") {
    reasons.push(`Job is REMOTE but candidate preference is ONSITE_ONLY`);
  }

  // 3. Experience Delta Filter
  const candidateExperience = candidate.yearsOfExperience ?? 0;
  const tolerance = options?.experienceDeltaTolerance ?? 2;

  let requiredExperience = job.requiredExperienceYears;
  if (requiredExperience === null || requiredExperience === undefined) {
    requiredExperience = extractRequiredExperience(job.description) ?? extractRequiredExperience(job.title);
  }

  if (
    typeof requiredExperience === "number" &&
    requiredExperience > candidateExperience + tolerance
  ) {
    reasons.push(
      `Required experience (${requiredExperience} years) exceeds candidate experience (${candidateExperience} years) by more than tolerance (${tolerance} years)`
    );
  }

  // 4. Blacklisted Companies Filter
  const candidateCompanyBlacklist = normalizeStringArray(candidate.blacklistedCompanies);
  const optionsCompanyBlacklist = options?.blacklistedCompanies ?? [];
  const combinedCompanyBlacklist = Array.from(
    new Set([...candidateCompanyBlacklist, ...optionsCompanyBlacklist].map((c) => c.toLowerCase()))
  );

  const jobCompanyNormalized = (job.company || "").trim().toLowerCase();
  if (jobCompanyNormalized && combinedCompanyBlacklist.includes(jobCompanyNormalized)) {
    reasons.push(`Company '${job.company}' is in blacklisted companies`);
  }

  // 5. Blacklisted Keywords Filter
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
