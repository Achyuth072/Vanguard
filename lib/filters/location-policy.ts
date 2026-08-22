/**
 * Zero-AI Location & Work-Model Policy Engine
 *
 * Rules:
 * - Domestic Jobs (Candidate Country / Location or unconstrained location): Accepts REMOTE, HYBRID, and ONSITE.
 * - Foreign Jobs (Different Country):
 *   - ONSITE and HYBRID are strictly REJECTED.
 *   - REMOTE is accepted ONLY if it indicates global/worldwide eligibility ("Worldwide", "Anywhere", "Global").
 *   - REMOTE is REJECTED if geo-restricted indicators are present ("US Only", "EMEA", "North America only", etc.).
 */

export interface LocationPolicyResult {
  passed: boolean;
  reason?: string;
  isDomestic: boolean;
  isWorldwideRemote: boolean;
}

export interface LocationPolicyInput {
  candidateLocation?: string;
  preferredLocations?: string[] | string;
  jobLocation?: string;
  jobRemoteStatus?: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" | string;
  jobText?: string;
}

const WORLDWIDE_REMOTE_REGEX =
  /\b(?:worldwide|global|anywhere|work\s+from\s+anywhere|remote\s*\(\s*worldwide\s*\)|remote\s*-\s*worldwide|remote\s*\(\s*anywhere\s*\)|distributed\s+worldwide)\b/i;

const GEO_RESTRICTED_REGEX =
  /\b(?:us\s*only|usa\s*only|emea\s*only|\bemea\b|north\s*america\s*only|eu\s*only|europe\s*only|latam\s*only|uk\s*only|canada\s*only|must\s*reside\s*in|us\/canada|us-based|us\s*citizens?|authorized\s*to\s*work\s*in\s*the\s*us|united\s*states\s*only)\b/i;

/**
 * Normalizes preferred locations array / JSON string / string into clean tokens.
 */
function normalizeLocations(input?: string[] | string): string {
  if (!input) return "";
  if (Array.isArray(input)) return input.join(" ");
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed.join(" ");
  } catch {
    // String as-is
  }
  return String(input);
}

/**
 * Extracts normalized country code/name from a location string.
 * Avoids matching common English words like preposition "in".
 */
function extractCountry(loc?: string): string | null {
  if (!loc) return null;
  const lower = loc.toLowerCase().trim();

  // Match India markers (avoiding plain "in" preposition)
  if (/\b(?:india|bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|gurgaon|noida)\b/i.test(lower) || /\b(?:remote\s*\(\s*in\s*\)|in\s*-\s*remote|remote\s*in)\b/i.test(lower)) {
    return "india";
  }
  // Match US markers
  if (/\b(?:united\s+states|usa?\b|san\s+francisco|new\s+york|seattle|austin|california|ny|wa|tx)\b/i.test(lower)) {
    return "us";
  }
  // Match UK markers
  if (/\b(?:united\s+kingdom|uk\b|london|england|gb)\b/i.test(lower)) {
    return "uk";
  }
  // Match Canada markers
  if (/\b(?:canada|toronto|vancouver|montreal)\b/i.test(lower)) {
    return "canada";
  }
  // Match Germany markers
  if (/\b(?:germany|berlin|munich)\b/i.test(lower)) {
    return "germany";
  }

  return null;
}

/**
 * Evaluates job location and remote status against candidate location rules.
 */
export function evaluateLocationPolicy(input: LocationPolicyInput): LocationPolicyResult {
  const jobText = (input.jobText || "").trim();
  const jobLocation = (input.jobLocation || "").trim();
  const fullText = `${jobLocation} ${jobText}`.trim();

  // Normalize remote status
  let remoteStatus = (input.jobRemoteStatus || "").toUpperCase().trim();
  if (!remoteStatus || remoteStatus === "UNKNOWN") {
    if (/\b(?:onsite\s*only|on-site\s*only|strictly\s*onsite|in-office\s*only|no\s*remote|in\s*person\s*only)\b/i.test(fullText)) {
      remoteStatus = "ONSITE";
    } else if (/\b(?:hybrid|\d\s*days\s*in\s*office|\d\s*days\s*onsite)\b/i.test(fullText)) {
      remoteStatus = "HYBRID";
    } else if (/\b(?:remote|wfh|work\s+from\s+home|anywhere)\b/i.test(fullText)) {
      remoteStatus = "REMOTE";
    } else if (/\bonsite\b|\bin-office\b/i.test(fullText)) {
      remoteStatus = "ONSITE";
    } else {
      remoteStatus = "UNKNOWN";
    }
  }

  // Extract candidate country & check if candidate location is unconstrained
  const candLoc = (input.candidateLocation || "").trim();
  const prefLocs = normalizeLocations(input.preferredLocations);

  const candCountry = extractCountry(candLoc) || extractCountry(prefLocs);
  const isUnconstrainedCandidateLoc = !candLoc && !prefLocs.trim();

  // Extract job country from jobLocation first, then fallback to jobText if explicit country token exists
  const jobCountry = extractCountry(jobLocation) || extractCountry(jobText);

  // Check domestic status
  let isDomestic = false;
  if (isUnconstrainedCandidateLoc || !jobCountry) {
    isDomestic = true;
  } else if (candCountry && jobCountry === candCountry) {
    isDomestic = true;
  }

  // Check worldwide remote markers
  const isWorldwideRemote = WORLDWIDE_REMOTE_REGEX.test(fullText);
  const isGeoRestricted = GEO_RESTRICTED_REGEX.test(fullText);

  // 1. Domestic Jobs
  if (isDomestic) {
    return {
      passed: true,
      isDomestic: true,
      isWorldwideRemote,
    };
  }

  // 2. Foreign Jobs
  if (remoteStatus === "ONSITE" || remoteStatus === "HYBRID") {
    return {
      passed: false,
      reason: `Job is ${remoteStatus} in foreign location '${jobLocation || jobCountry}'`,
      isDomestic: false,
      isWorldwideRemote,
    };
  }

  // If Foreign Remote
  if (remoteStatus === "REMOTE" || remoteStatus === "UNKNOWN") {
    if (isGeoRestricted && !isWorldwideRemote) {
      const match = fullText.match(GEO_RESTRICTED_REGEX);
      const matchedTerm = match ? match[0] : "geo-restricted";
      return {
        passed: false,
        reason: `Foreign remote job is geo-restricted ('${matchedTerm}') and not open worldwide`,
        isDomestic: false,
        isWorldwideRemote: false,
      };
    }

    if (isWorldwideRemote) {
      return {
        passed: true,
        isDomestic: false,
        isWorldwideRemote: true,
      };
    }

    // If job country is foreign and explicitly specified without worldwide indicator
    if (jobCountry && candCountry && jobCountry !== candCountry && !isWorldwideRemote) {
      return {
        passed: false,
        reason: `Foreign remote job in '${jobLocation || jobCountry}' does not indicate worldwide/anywhere eligibility`,
        isDomestic: false,
        isWorldwideRemote: false,
      };
    }
  }

  return {
    passed: true,
    isDomestic: false,
    isWorldwideRemote,
  };
}
