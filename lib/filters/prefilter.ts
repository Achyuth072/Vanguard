import { convertCurrency, formatSalary } from "../utils/currency";
import { extractRequiredExperience } from "./deterministic";
import type { MasterSkill } from "../../types/candidate";

export interface PreFilterCandidateCriteria {
  targetRole?: string;
  targetRoleKeywords?: string[] | string;
  techStack?: string[] | string;
  skills?: string[] | MasterSkill[] | string;
  minSalary?: number;
  currency?: string;
  yearsOfExperience?: number;
  remotePreference?: "REMOTE_ONLY" | "HYBRID" | "ONSITE" | "ANY" | "ONSITE_ONLY" | string;
  preferredLocations?: string[] | string;
  companyStageBlacklist?: string[] | string;
  blacklistedCompanies?: string[] | string;
  blacklistedKeywords?: string[] | string;
}

export interface PreFilterOptions {
  experienceDeltaTolerance?: number;
  minTechStackMatches?: number;
  requireRoleKeywordMatch?: boolean;
  requireTechStackMatch?: boolean;
  blockAgenciesByDefault?: boolean;
}

export interface ExtractedSalary {
  min: number | null;
  max: number | null;
  currency: string;
  raw: string;
}

export interface ExtractedRemoteLocation {
  remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  detectedLocations: string[];
}

export interface PreFilterResult {
  passed: boolean;
  reasons: string[];
  matchedDimensions: {
    roleKeywords: boolean;
    techStack: boolean;
    salary: boolean;
    location: boolean;
    experience: boolean;
    companyStage: boolean;
  };
  extractedMetadata: {
    detectedRoles: string[];
    detectedSkills: string[];
    detectedSalary: ExtractedSalary | null;
    detectedRemote: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
    detectedLocations: string[];
    detectedExperienceYears: number | null;
    detectedBlacklistMatches: string[];
  };
}

/**
 * Escapes characters with special meaning in RegExp.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalizes an unknown list input (array, JSON string, comma-separated string, or MasterSkill array)
 * into a clean array of non-empty strings.
 */
export function normalizeStringList(input?: unknown): string[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && "name" in item && typeof item.name === "string") {
          return item.name.trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeStringList(parsed);
      }
    } catch {
      // Treat as comma/newline separated
      return trimmed
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return [];
}

/**
 * Builds a word-boundary safe regex for technical terms, languages, and phrases.
 * Correctly handles symbols in C++, C#, .NET, Node.js, Next.js, CI/CD, and hyphenated roles.
 */
export function buildKeywordRegex(keyword: string): RegExp {
  const trimmed = keyword.trim();
  if (!trimmed) return /(?!)/;

  // Handle common tech symbols that break standard \b
  const upper = trimmed.toUpperCase();

  if (upper === "C++") {
    return /(?:^|[^a-zA-Z0-9_#+])c\+\+(?:[^a-zA-Z0-9_#+]|$)/i;
  }
  if (upper === "C#") {
    return /(?:^|[^a-zA-Z0-9_#+])c#(?:[^a-zA-Z0-9_#+]|$)/i;
  }
  if (upper === ".NET") {
    return /(?:^|[\s,;:(])\.net(?:\b|[\s,;:)]|$)/i;
  }
  if (upper === "CI/CD") {
    return /(?:^|[\s,;:(])ci\/cd(?:\b|[\s,;:)]|$)/i;
  }

  // Handle dot notation like Node.js, Next.js, Vue.js, React.js
  if (/\.js$/i.test(trimmed)) {
    const base = trimmed.replace(/\.js$/i, "");
    const escaped = escapeRegExp(base);
    return new RegExp(`(?:\\b|\\s|^)${escaped}(?:\\.js)?(?:\\b|\\s|$)`, "i");
  }

  // If phrase has space or hyphen (e.g. "Full Stack", "full-stack")
  if (/[\s-]/.test(trimmed)) {
    const parts = trimmed.split(/[\s-]+/).map(escapeRegExp);
    return new RegExp(`\\b${parts.join("[- ]?")}\\b`, "i");
  }

  const escaped = escapeRegExp(trimmed);
  const startIsWord = /^\w/.test(trimmed);
  const endIsWord = /\w$/.test(trimmed);

  const startPattern = startIsWord ? "\\b" : "(?:^|\\s)";
  const endPattern = endIsWord ? "\\b" : "(?:$|\\s)";

  return new RegExp(`${startPattern}${escaped}${endPattern}`, "i");
}

/**
 * Extracts compensation figures, ranges, and currencies from unstructured text.
 * Supports USD ($Xk, $X,000), INR (₹X LPA, X-Y LPA, ₹X Lakhs), EUR (€Xk), and GBP (£Xk).
 */
export function extractSalaryFromRawText(text: string): ExtractedSalary | null {
  if (!text || !text.trim()) return null;

  // 1. INR LPA formats (e.g. ₹25 LPA - ₹35 LPA, 25-35 LPA, ₹25L - 35L, ₹25 Lakhs, 25LPA)
  const inrLpaRangeMatch = text.match(
    /(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh|lakhs)?\s*(?:-|–|—|to)\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh|lakhs)/i
  );
  if (
    inrLpaRangeMatch &&
    (text.includes("₹") || /LPA|Lakh|lakhs|\bL\b/i.test(inrLpaRangeMatch[0]) || /INR|Rs/i.test(text))
  ) {
    const min = Math.round(parseFloat(inrLpaRangeMatch[1]) * 100000);
    const max = Math.round(parseFloat(inrLpaRangeMatch[2]) * 100000);
    return { min, max, currency: "INR", raw: inrLpaRangeMatch[0].trim() };
  }

  const inrSingleLpaMatch = text.match(/(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh|lakhs|\+)?/i) ||
    text.match(/\b(\d+(?:\.\d+)?)\s*(?:LPA|lakhs?)\b/i);
  if (inrSingleLpaMatch) {
    const val = Math.round(parseFloat(inrSingleLpaMatch[1]) * 100000);
    return { min: val, max: val, currency: "INR", raw: inrSingleLpaMatch[0].trim() };
  }

  // 2. USD $Xk - $Yk or $X,000 - $Y,000 formats
  const usdKRangeMatch = text.match(
    /\$(\d+(?:\.\d+)?)\s*k?\s*(?:-|–|—|to)\s*\$?(\d+(?:\.\d+)?)\s*k(?:\s*USD)?/i
  );
  if (usdKRangeMatch) {
    let min = parseFloat(usdKRangeMatch[1]);
    let max = parseFloat(usdKRangeMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min: Math.round(min), max: Math.round(max), currency: "USD", raw: usdKRangeMatch[0].trim() };
  }

  const usdFullRangeMatch = text.match(
    /\$([\d,]{5,8})\s*(?:-|–|—|to)\s*\$?([\d,]{5,8})(?:\s*(?:per year|\/yr|\/year|USD))?/i
  );
  if (usdFullRangeMatch) {
    const min = parseInt(usdFullRangeMatch[1].replace(/,/g, ""), 10);
    const max = parseInt(usdFullRangeMatch[2].replace(/,/g, ""), 10);
    return { min, max, currency: "USD", raw: usdFullRangeMatch[0].trim() };
  }

  const usdSingleKMatch = text.match(/\$(\d+(?:\.\d+)?)\s*k(?:\s*\+)?(?:\s*USD)?/i);
  if (usdSingleKMatch) {
    let val = parseFloat(usdSingleKMatch[1]);
    if (val < 1000) val *= 1000;
    return { min: Math.round(val), max: Math.round(val), currency: "USD", raw: usdSingleKMatch[0].trim() };
  }

  // 3. EUR €Xk - €Yk or €X.000 / €X,000 formats
  const eurKRangeMatch = text.match(
    /€\s*(\d+(?:\.\d+)?)\s*k?\s*(?:-|–|—|to)\s*€?\s*(\d+(?:\.\d+)?)\s*k(?:\s*EUR)?/i
  );
  if (eurKRangeMatch) {
    let min = parseFloat(eurKRangeMatch[1]);
    let max = parseFloat(eurKRangeMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min: Math.round(min), max: Math.round(max), currency: "EUR", raw: eurKRangeMatch[0].trim() };
  }

  const eurFullRangeMatch = text.match(
    /€\s*([\d,.]{5,8})\s*(?:-|–|—|to)\s*€?\s*([\d,.]{5,8})/i
  );
  if (eurFullRangeMatch) {
    const min = parseInt(eurFullRangeMatch[1].replace(/[,.]/g, ""), 10);
    const max = parseInt(eurFullRangeMatch[2].replace(/[,.]/g, ""), 10);
    return { min, max, currency: "EUR", raw: eurFullRangeMatch[0].trim() };
  }

  const eurSingleKMatch = text.match(/€\s*(\d+(?:\.\d+)?)\s*k(?:\s*\+)?/i) ||
    text.match(/\b(\d+(?:\.\d+)?)\s*k\s*EUR\b/i);
  if (eurSingleKMatch) {
    let val = parseFloat(eurSingleKMatch[1]);
    if (val < 1000) val *= 1000;
    return { min: Math.round(val), max: Math.round(val), currency: "EUR", raw: eurSingleKMatch[0].trim() };
  }

  // 4. GBP £Xk - £Yk formats
  const gbpKRangeMatch = text.match(
    /£\s*(\d+(?:\.\d+)?)\s*k?\s*(?:-|–|—|to)\s*£?\s*(\d+(?:\.\d+)?)\s*k(?:\s*GBP)?/i
  );
  if (gbpKRangeMatch) {
    let min = parseFloat(gbpKRangeMatch[1]);
    let max = parseFloat(gbpKRangeMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min: Math.round(min), max: Math.round(max), currency: "GBP", raw: gbpKRangeMatch[0].trim() };
  }

  const gbpFullRangeMatch = text.match(
    /£\s*([\d,]{5,8})\s*(?:-|–|—|to)\s*£?\s*([\d,]{5,8})/i
  );
  if (gbpFullRangeMatch) {
    const min = parseInt(gbpFullRangeMatch[1].replace(/,/g, ""), 10);
    const max = parseInt(gbpFullRangeMatch[2].replace(/,/g, ""), 10);
    return { min, max, currency: "GBP", raw: gbpFullRangeMatch[0].trim() };
  }

  return null;
}

/**
 * Classifies remote status and extracts location tokens from raw text.
 */
export function classifyRemoteAndLocation(text: string): ExtractedRemoteLocation {
  const detectedLocations: string[] = [];

  const strictOnsiteRegex = /\b(?:onsite\s*only|on-site\s*only|strictly\s*onsite|in-office\s*only|no\s*remote|not\s*remote|in\s*person\s*only|relocation\s*required)\b/i;
  const hybridRegex = /\b(?:hybrid|\d\s*days\s*in\s*office|\d\s*days\s*onsite|partially\s*remote|wfh\s*flexibility)\b/i;
  const remoteRegex = /\b(?:100%\s*remote|fully\s*remote|remote\s*(?:first|only|friendly|ok|available|position|role|option|\(worldwide\)|\(us\)|\(europe\))?|work\s*from\s*(?:home|anywhere)|wfh|distributed\s*team|anywhere)\b/i;

  let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "UNKNOWN";

  if (strictOnsiteRegex.test(text)) {
    remoteStatus = "ONSITE";
  } else if (hybridRegex.test(text)) {
    remoteStatus = "HYBRID";
  } else if (remoteRegex.test(text)) {
    remoteStatus = "REMOTE";
  } else if (/\bonsite\b|\bin-office\b/i.test(text)) {
    remoteStatus = "ONSITE";
  }

  return {
    remoteStatus,
    detectedLocations,
  };
}

const COMMON_STAFFING_PATTERNS: RegExp[] = [
  /\b(?:recruitment\s*agency|staffing\s*agency|third\s*party\s*recruiter|placement\s*consultanc(?:y|ies)|body\s*shop|c2c\s*only|corp\s*to\s*corp|headhunter|executive\s*search\s*firm|hiring\s*on\s*behalf\s*of)\b/i,
  /\b(?:talentbridge\s*staffing|apex\s*systems|cybercoders|robert\s*half|teksystems)\b/i,
];

/**
 * Evaluates unstructured raw job text across 6 zero-AI dimensions.
 * Executes on pure CPU with 0 AI API tokens.
 */
export function preFilterRawText(
  text: string,
  candidate: PreFilterCandidateCriteria,
  options?: PreFilterOptions
): PreFilterResult {
  const reasons: string[] = [];
  const matchedDimensions = {
    roleKeywords: true,
    techStack: true,
    salary: true,
    location: true,
    experience: true,
    companyStage: true,
  };

  // Dimension 1: Target Role Keywords
  const targetRoleKeywords = normalizeStringList(candidate.targetRoleKeywords);
  if (targetRoleKeywords.length === 0 && candidate.targetRole) {
    targetRoleKeywords.push(candidate.targetRole);
  }

  const detectedRoles: string[] = [];
  if (targetRoleKeywords.length > 0) {
    for (const roleKw of targetRoleKeywords) {
      const rx = buildKeywordRegex(roleKw);
      if (rx.test(text)) {
        detectedRoles.push(roleKw);
      }
    }

    if (detectedRoles.length === 0) {
      matchedDimensions.roleKeywords = false;
      reasons.push("No matching target role keywords found in raw text");
    }
  }

  // Dimension 2: Tech Stack & Skills Detection
  const techStack = Array.from(
    new Set([
      ...normalizeStringList(candidate.techStack),
      ...normalizeStringList(candidate.skills),
    ])
  );

  const detectedSkills: string[] = [];
  if (techStack.length > 0) {
    for (const skill of techStack) {
      const rx = buildKeywordRegex(skill);
      if (rx.test(text)) {
        detectedSkills.push(skill);
      }
    }

    const minMatches = options?.minTechStackMatches ?? 1;
    if (detectedSkills.length < minMatches) {
      matchedDimensions.techStack = false;
      reasons.push("No matching tech stack or skills found in raw text");
    }
  }

  // Dimension 3: Salary Floor Parser & Converter
  const detectedSalary = extractSalaryFromRawText(text);
  if (
    detectedSalary &&
    typeof candidate.minSalary === "number" &&
    candidate.minSalary > 0
  ) {
    const candidateCurrency = (candidate.currency || "INR").toUpperCase();
    const jobCurrency = detectedSalary.currency.toUpperCase();
    const jobSalaryCeiling = detectedSalary.max ?? detectedSalary.min;

    if (jobSalaryCeiling !== null) {
      if (candidateCurrency === jobCurrency) {
        if (jobSalaryCeiling < candidate.minSalary) {
          matchedDimensions.salary = false;
          const formattedCeil = formatSalary(jobSalaryCeiling, jobCurrency);
          const formattedMin = formatSalary(candidate.minSalary, candidateCurrency);
          reasons.push(
            `Salary ceiling ${formattedCeil} is below candidate minimum ${formattedMin}`
          );
        }
      } else {
        const convertedCeiling = convertCurrency(
          jobSalaryCeiling,
          jobCurrency,
          candidateCurrency
        );
        if (convertedCeiling !== null && convertedCeiling < candidate.minSalary) {
          matchedDimensions.salary = false;
          const formattedJobCeil = formatSalary(jobSalaryCeiling, jobCurrency);
          const formattedConv = formatSalary(convertedCeiling, candidateCurrency);
          const formattedCandidateMin = formatSalary(
            candidate.minSalary,
            candidateCurrency
          );
          reasons.push(
            `Salary ceiling ${formattedJobCeil} (~${formattedConv}) is below candidate minimum ${formattedCandidateMin}`
          );
        }
      }
    }
  }

  // Dimension 4: Remote vs Location Classification
  const { remoteStatus, detectedLocations } = classifyRemoteAndLocation(text);
  const candidateRemote = (candidate.remotePreference || "ANY").toUpperCase().trim();

  if (candidateRemote === "REMOTE_ONLY") {
    if (remoteStatus === "ONSITE" || remoteStatus === "HYBRID") {
      matchedDimensions.location = false;
      reasons.push(
        `Job requires onsite/hybrid presence (${remoteStatus}) but candidate preference is REMOTE_ONLY`
      );
    }
  } else if (candidateRemote === "ONSITE_ONLY" && remoteStatus === "REMOTE") {
    matchedDimensions.location = false;
    reasons.push("Job is REMOTE but candidate preference is ONSITE_ONLY");
  }

  // Dimension 5: Experience Requirement Parser
  const detectedExperienceYears = extractRequiredExperience(text);
  const candidateExperience = candidate.yearsOfExperience ?? 0;
  const tolerance = options?.experienceDeltaTolerance ?? 2;

  if (
    typeof detectedExperienceYears === "number" &&
    detectedExperienceYears > candidateExperience + tolerance
  ) {
    matchedDimensions.experience = false;
    reasons.push(
      `Required experience (${detectedExperienceYears} years) exceeds candidate experience (${candidateExperience} years) by more than tolerance (${tolerance} years)`
    );
  }

  // Dimension 6: Company Stage & Blacklist Filtering
  const detectedBlacklistMatches: string[] = [];

  // 6a: Blacklisted Companies
  const companyBlacklist = normalizeStringList(candidate.blacklistedCompanies);
  for (const company of companyBlacklist) {
    const rx = buildKeywordRegex(company);
    if (rx.test(text)) {
      detectedBlacklistMatches.push(`Company: ${company}`);
      matchedDimensions.companyStage = false;
      reasons.push(`Job matches blacklisted company '${company}'`);
    }
  }

  // 6b: Blacklisted Keywords
  const keywordBlacklist = normalizeStringList(candidate.blacklistedKeywords);
  for (const kw of keywordBlacklist) {
    const rx = buildKeywordRegex(kw);
    if (rx.test(text)) {
      detectedBlacklistMatches.push(`Keyword: ${kw}`);
      matchedDimensions.companyStage = false;
      reasons.push(`Blacklisted keyword '${kw}' found in raw text`);
    }
  }

  // 6c: Company Stage Blacklist & Staffing / Agency detection
  const stageBlacklist = normalizeStringList(candidate.companyStageBlacklist).map((s) =>
    s.toLowerCase()
  );

  for (const stage of stageBlacklist) {
    const rx = buildKeywordRegex(stage);
    if (rx.test(text)) {
      detectedBlacklistMatches.push(`Stage: ${stage}`);
      matchedDimensions.companyStage = false;
      reasons.push(`Blacklisted company stage/type '${stage}' found in raw text`);
    }
  }

  const shouldBlockAgencies =
    options?.blockAgenciesByDefault ||
    stageBlacklist.includes("agency") ||
    stageBlacklist.includes("staffing");

  if (shouldBlockAgencies) {
    for (const pattern of COMMON_STAFFING_PATTERNS) {
      if (pattern.test(text)) {
        detectedBlacklistMatches.push("Staffing/Agency Pattern");
        matchedDimensions.companyStage = false;
        reasons.push("Staffing agency, recruiter, or C2C pattern detected in text");
        break;
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    matchedDimensions,
    extractedMetadata: {
      detectedRoles,
      detectedSkills,
      detectedSalary,
      detectedRemote: remoteStatus,
      detectedLocations,
      detectedExperienceYears,
      detectedBlacklistMatches,
    },
  };
}
