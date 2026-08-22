import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { generateDedupeKey } from "../lib/ingestion/dedupe";
import { normalizeSource } from "../lib/utils/source";

export interface ParsedJobData {
  company: string;
  title: string;
  source: string;
  location: string;
  remoteStatus: string;
  status: string;
  appStatus: string | null;
  score: number;
  recommendation: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  appliedAt: Date | null;
  discoveredAt: Date;
  url: string;
  rawCompensation: string;
}

export function cleanCompany(rawCompany: string): string {
  if (!rawCompany) return "Unknown Company";
  let cleaned = rawCompany.trim().replace(/^["'\s]+|["'\s]+$/g, "");

  // If company is a URL (e.g. https://wellfound.com/company/brainsightai-1)
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      const urlObj = new URL(cleaned);
      const parts = urlObj.pathname.split("/").filter(Boolean);
      const rawSlug = parts.length > 0 ? parts[parts.length - 1] : urlObj.hostname.replace(/^www\./, "").replace(/\.(com|io|ai|co|org|net|dev|tech)$/i, "");
      const slug = rawSlug;
      // Convert slug like 'brainsightai-1' or 'tagleaf-1' to title
      cleaned = slug
        .replace(/[-_]/g, " ")
        .replace(/\b\d+\b/g, "")
        .replace(/ai\b/gi, " AI")
        .replace(/\s+/g, " ")
        .trim();
      cleaned = cleaned
        .split(" ")
        .map((w) => (w.toUpperCase() === "AI" ? "AI" : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");
    } catch {
      // Fallback
    }
  }

  // Remove batch suffixes like (S26) or (YC Backed) if desired, or keep neat
  cleaned = cleaned.replace(/\s*\((S\d+|W\d+|YC Backed|YC backed)\)/gi, "").trim();

  return cleaned || "Unknown Company";
}

export function cleanRoleTitle(rawRole: string, _company?: string): string {
  if (!rawRole) return "Software Engineer";
  let cleaned = rawRole.trim().replace(/^["'\s]+|["'\s]+$/g, "");

  // Strip Notion export prefixes and tab characters
  cleaned = cleaned.replace(/^https:\/\/app\.notion\.com[\s\t]*/i, "");
  cleaned = cleaned.replace(/^\t+/, "").trim();

  // If role is an Oracle Cloud / ATS URL
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    const jobMatch = cleaned.match(/job\/(\d+)/i);
    if (jobMatch) {
      return `Software Engineer (Job ${jobMatch[1]})`;
    }
    return "Software Engineer";
  }

  return cleaned || "Software Engineer";
}

export function cleanLocationAndRemote(rawLocation: string): { location: string; remoteStatus: string } {
  if (!rawLocation) return { location: "", remoteStatus: "UNKNOWN" };

  let loc = rawLocation.trim().replace(/^["'\s]+|["'\s]+$/g, "");

  // Clean Wellfound URLs like https://wellfound.com/location/bangalore-urban
  loc = loc.replace(/https:\/\/wellfound\.com\/location\/([a-z0-9-]+)/gi, (_, slug) => {
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  });
  loc = loc.replace(/https:\/\/wellfound\.com\/remote/gi, "Remote");

  let remoteStatus = "UNKNOWN";
  const lower = loc.toLowerCase();

  if (lower.includes("remote")) {
    remoteStatus = "REMOTE";
  } else if (lower.includes("hybrid") || lower.includes("wfh flexibility")) {
    remoteStatus = "HYBRID";
  } else if (lower.includes("in office") || lower.includes("on-site") || lower.includes("onsite")) {
    remoteStatus = "ONSITE";
  } else if (loc.trim().length > 0) {
    remoteStatus = "ONSITE";
  }

  // Clean leftover keywords from location string
  let displayLoc = loc
    .replace(/Remote\s*\(([^)]+)\)/gi, "$1")
    .replace(/\s*\/\s*Remote/gi, "")
    .replace(/\s*\/\s*Hybrid/gi, "")
    .replace(/\s*\|\s*\(In Office\)/gi, "")
    .replace(/\|\s*/g, "")
    .replace(/•\s*https:\/\/[^\s]+/g, "")
    .replace(/•/g, ",")
    .trim();

  if (displayLoc.toLowerCase() === "remote") {
    displayLoc = "Remote";
  }

  return { location: displayLoc, remoteStatus };
}

export function parseCompensationString(rawComp: string): {
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
} {
  if (!rawComp || !rawComp.trim()) {
    return { salaryMin: null, salaryMax: null, currency: "INR" };
  }

  const comp = rawComp.trim();
  let currency = "INR";

  if (comp.includes("$")) currency = "USD";
  else if (comp.includes("£")) currency = "GBP";
  else if (comp.includes("€")) currency = "EUR";
  else if (comp.includes("₹") || /LPA|Lakh|L/i.test(comp)) currency = "INR";

  // Check for annual USD $80k – $100k or $120k–$160k
  const usdKMatch = comp.match(/\$(\d+(?:\.\d+)?)\s*k?\s*[–\-—]\s*\$?(\d+(?:\.\d+)?)\s*k/i);
  if (usdKMatch) {
    let min = parseFloat(usdKMatch[1]);
    let max = parseFloat(usdKMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { salaryMin: Math.round(min), salaryMax: Math.round(max), currency: "USD" };
  }

  // Check for INR LPA ranges like ₹5L – ₹15L or ₹12–14 LPA or 5L
  const inrLMatch = comp.match(/[₹]?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh)?\s*[–\-—]\s*[₹]?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh)/i);
  if (inrLMatch && (comp.includes("L") || comp.includes("lakh") || comp.includes("₹"))) {
    const min = parseFloat(inrLMatch[1]) * 100000;
    const max = parseFloat(inrLMatch[2]) * 100000;
    return { salaryMin: Math.round(min), salaryMax: Math.round(max), currency: "INR" };
  }

  // Single value LPA like "5L" or "₹20L"
  const singleLMatch = comp.match(/[₹]?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh)/i);
  if (singleLMatch) {
    const val = parseFloat(singleLMatch[1]) * 100000;
    return { salaryMin: Math.round(val), salaryMax: Math.round(val), currency: "INR" };
  }

  // Monthly USD like $2,000 – $4,000 / mo ($24k–$48k)
  const usdAnnualParen = comp.match(/\$(\d+)k[–\-]\$?(\d+)k/i);
  if (usdAnnualParen) {
    return {
      salaryMin: parseInt(usdAnnualParen[1], 10) * 1000,
      salaryMax: parseInt(usdAnnualParen[2], 10) * 1000,
      currency: "USD",
    };
  }

  // GBP £9k – £16.8k
  const gbpMatch = comp.match(/£(\d+(?:\.\d+)?)\s*k?\s*[–\-—]\s*£?(\d+(?:\.\d+)?)\s*k/i);
  if (gbpMatch) {
    let min = parseFloat(gbpMatch[1]);
    let max = parseFloat(gbpMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { salaryMin: Math.round(min), salaryMax: Math.round(max), currency: "GBP" };
  }

  // Monthly INR like ₹20,000 – ₹50,000
  const inrNumMatch = comp.match(/₹?([\d,]+)\s*[–\-—]\s*₹?([\d,]+)/);
  if (inrNumMatch) {
    const min = parseInt(inrNumMatch[1].replace(/,/g, ""), 10);
    const max = parseInt(inrNumMatch[2].replace(/,/g, ""), 10);
    // If < 100,000, assume monthly and annualize (x12)
    const multiplier = max <= 100000 ? 12 : 1;
    return { salaryMin: min * multiplier, salaryMax: max * multiplier, currency: "INR" };
  }

  return { salaryMin: null, salaryMax: null, currency };
}

export function mapLegacyStatus(rawStatus: string): { jobStatus: string; appStatus: string | null } {
  const s = (rawStatus || "").trim().toLowerCase();

  if (s === "applied") {
    return { jobStatus: "APPLIED", appStatus: "APPLIED" };
  }
  if (s === "take-home / oa" || s === "take home" || s === "oa" || s === "assessment") {
    return { jobStatus: "ASSESSMENT", appStatus: "ASSESSMENT" };
  }
  if (s === "interview" || s === "interviewing") {
    return { jobStatus: "INTERVIEW", appStatus: "INTERVIEW" };
  }
  if (s === "offer") {
    return { jobStatus: "OFFER", appStatus: "OFFER" };
  }
  if (s === "rejected") {
    return { jobStatus: "REJECTED", appStatus: "REJECTED" };
  }
  if (s === "withdrew" || s === "withdrawn") {
    return { jobStatus: "WITHDRAWN", appStatus: "WITHDRAWN" };
  }
  if (s === "archived") {
    return { jobStatus: "ARCHIVED", appStatus: null };
  }

  return { jobStatus: "DISCOVERED", appStatus: null };
}

export function mapLegacyPriorityToScore(priority: string): { score: number; recommendation: string } {
  const p = (priority || "").trim().toLowerCase();
  if (p === "high") {
    return { score: 85, recommendation: "APPLY" };
  }
  if (p === "med" || p === "medium") {
    return { score: 70, recommendation: "REVIEW" };
  }
  return { score: 55, recommendation: "REVIEW" };
}

export function parseLegacyCsvRow(columns: string[]): ParsedJobData | null {
  // Columns: Company, Role, Source, Location / Mode, Status, Priority, Compensation, Applied Date, URL
  if (!columns || columns.length < 2) return null;

  const rawCompany = columns[0] || "";
  const rawRole = columns[1] || "";
  const rawSource = columns[2] || "";
  const rawLocation = columns[3] || "";
  const rawStatus = columns[4] || "";
  const rawPriority = columns[5] || "";
  const rawCompensation = columns[6] || "";
  const rawAppliedDate = columns[7] || "";
  const rawUrl = columns[8] || "";

  // Skip completely empty or header rows
  if (!rawCompany.trim() && !rawRole.trim()) {
    return null;
  }
  if (rawCompany.trim() === "Company" && rawRole.trim() === "Role") {
    return null;
  }

  const company = cleanCompany(rawCompany);
  const title = cleanRoleTitle(rawRole, company);
  const url = (rawUrl || "").trim();
  const source = normalizeSource(rawSource, url);
  const { location, remoteStatus } = cleanLocationAndRemote(rawLocation);
  const { jobStatus, appStatus } = mapLegacyStatus(rawStatus);
  const { score, recommendation } = mapLegacyPriorityToScore(rawPriority);
  const { salaryMin, salaryMax, currency } = parseCompensationString(rawCompensation);

  let appliedAt: Date | null = null;
  if (rawAppliedDate && rawAppliedDate.trim()) {
    const parsedDate = new Date(rawAppliedDate.trim());
    if (!isNaN(parsedDate.getTime())) {
      appliedAt = parsedDate;
    }
  }

  const discoveredAt = appliedAt || new Date("2026-08-10T00:00:00.000Z");

  return {
    company,
    title,
    source,
    location,
    remoteStatus,
    status: jobStatus,
    appStatus,
    score,
    recommendation,
    salaryMin,
    salaryMax,
    currency,
    appliedAt,
    discoveredAt,
    url,
    rawCompensation,
  };
}

/**
 * Parses CSV lines respecting quoted fields with commas.
 */
export function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentField = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        row.push(currentField);
        currentField = "";
      } else {
        currentField += char;
      }
    }
    row.push(currentField);
    rows.push(row);
  }

  return rows;
}

export async function importLegacyCsv(filePath: string) {
  console.log(`Reading legacy CSV from: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf-8");
  const rawRows = parseCsvContent(content);

  console.log(`Found ${rawRows.length} rows (including header). Processing...`);

  let importedCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const parsed = parseLegacyCsvRow(row);

    if (!parsed || !parsed.company || !parsed.title) {
      skippedCount++;
      continue;
    }

    const dedupeKey = generateDedupeKey({
      company: parsed.company,
      title: parsed.title,
      url: parsed.url,
    });

    const description = `Legacy imported opportunity from ${parsed.source}.\nRole: ${parsed.title}\nCompany: ${parsed.company}\nOriginal Comp: ${parsed.rawCompensation || "N/A"}`;

    const job = await db.job.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        remoteStatus: parsed.remoteStatus,
        salaryMin: parsed.salaryMin,
        salaryMax: parsed.salaryMax,
        currency: parsed.currency,
        url: parsed.url,
        source: parsed.source,
        status: parsed.status,
        description,
        discoveredAt: parsed.discoveredAt,
      },
      update: {
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        remoteStatus: parsed.remoteStatus,
        salaryMin: parsed.salaryMin,
        salaryMax: parsed.salaryMax,
        currency: parsed.currency,
        url: parsed.url,
        source: parsed.source,
        status: parsed.status,
        discoveredAt: parsed.discoveredAt,
      },
    });

    // Create or update FitScore
    await db.fitScore.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        score: parsed.score,
        recommendation: parsed.recommendation,
        skillsFit: parsed.score,
        experienceFit: parsed.score,
        domainFit: parsed.score,
        trajectoryFit: parsed.score,
        strengths: JSON.stringify(["Legacy tracking record", `Imported from ${parsed.source}`]),
        gaps: JSON.stringify([]),
        risks: JSON.stringify([]),
        reasoning: `Imported from legacy tracker with priority rating. Source: ${parsed.source}.`,
      },
      update: {
        score: parsed.score,
        recommendation: parsed.recommendation,
      },
    });

    // Create or update Application if applicable
    if (parsed.appStatus) {
      await db.application.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          status: parsed.appStatus,
          appliedAt: parsed.appliedAt,
          rejectionStage: parsed.appStatus === "REJECTED" ? "RESUME_SCREEN" : null,
          rejectionReason: parsed.appStatus === "REJECTED" ? "UNKNOWN" : null,
          resumeVersion: "v1",
          tailoredNotes: `Imported application record. Originally applied on ${parsed.appliedAt ? parsed.appliedAt.toISOString().slice(0, 10) : "N/A"}.`,
        },
        update: {
          status: parsed.appStatus,
          appliedAt: parsed.appliedAt,
        },
      });
    }

    importedCount++;
  }

  console.log(`Import completed: ${importedCount} jobs imported/updated, ${skippedCount} rows skipped.`);
  return { importedCount, skippedCount };
}

// Auto-run if executed directly via node / tsx
if (process.argv[1] && process.argv[1].endsWith("import-legacy-csv.ts")) {
  const defaultPath = path.resolve(
    process.cwd(),
    ".scratch/ExportBlock-a99a73c9-e63a-44d3-8cd2-fa45e2f7120a-Part-1/Job Tracker 2f53767c6b0d811e9fd5d704e54ac1a7.csv"
  );
  importLegacyCsv(defaultPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}
