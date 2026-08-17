import { db } from "@/lib/db";

export interface FullBackupSnapshot {
  version: "1.0";
  exportedAt: string;
  database: "pulse.db";
  counts: {
    candidates: number;
    jobs: number;
    fitScores: number;
    applications: number;
    events: number;
  };
  data: {
    candidates: unknown[];
    jobs: unknown[];
    fitScores: unknown[];
    applications: unknown[];
    events: unknown[];
  };
}

/**
 * Escapes a single value according to RFC 4180 CSV specifications.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  let str: string;
  if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // If contains delimiter, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates a full CSV string with headers and data rows.
 */
export function generateCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map((h) => escapeCsvValue(h)).join(",");
  if (rows.length === 0) {
    return headerLine;
  }
  const rowLines = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\r\n");
  return `${headerLine}\r\n${rowLines}`;
}

/**
 * Formats a Date object as an ISO string, or returns empty string if null/undefined.
 */
function formatDate(date?: Date | null): string {
  return date ? date.toISOString() : "";
}

/**
 * Formats a JSON-encoded array string into a semicolon-separated string, or returns the raw string.
 */
function formatJsonArray(jsonStr?: string | null): string {
  if (!jsonStr) return "";
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.join("; ");
    }
    return jsonStr;
  } catch {
    return jsonStr;
  }
}

/**
 * Generates a complete JSON snapshot containing all database entities.
 */
export async function exportFullJsonSnapshot(prisma: typeof db = db): Promise<FullBackupSnapshot> {
  const [candidates, jobs, fitScores, applications, events] = await Promise.all([
    prisma.candidate.findMany(),
    prisma.job.findMany(),
    prisma.fitScore.findMany(),
    prisma.application.findMany(),
    prisma.event.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    database: "pulse.db",
    counts: {
      candidates: candidates.length,
      jobs: jobs.length,
      fitScores: fitScores.length,
      applications: applications.length,
      events: events.length,
    },
    data: {
      candidates,
      jobs,
      fitScores,
      applications,
      events,
    },
  };
}

/**
 * Generates a serialized JSON string snapshot.
 */
export async function generateFullJsonSnapshotString(prisma: typeof db = db): Promise<string> {
  const snapshot = await exportFullJsonSnapshot(prisma);
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Generates an RFC 4180 compliant CSV of tracked applications.
 */
export async function exportApplicationsCsv(prisma: typeof db = db): Promise<string> {
  const applications = await prisma.application.findMany({
    include: {
      job: {
        include: {
          fitScore: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const headers = [
    "Application ID",
    "Job ID",
    "Company",
    "Title",
    "Status",
    "Applied Date",
    "Resume Version",
    "Follow Up Date",
    "Tailored Notes",
    "Salary Min",
    "Salary Max",
    "Remote Status",
    "Location",
    "Job URL",
    "Fit Score",
    "Recommendation",
    "Created Date",
    "Updated Date",
  ];

  const rows = applications.map((app) => [
    app.id,
    app.jobId,
    app.job?.company || "",
    app.job?.title || "",
    app.status,
    formatDate(app.appliedAt),
    app.resumeVersion,
    formatDate(app.followUpAt),
    app.tailoredNotes,
    app.job?.salaryMin ?? "",
    app.job?.salaryMax ?? "",
    app.job?.remoteStatus || "",
    app.job?.location || "",
    app.job?.url || "",
    app.job?.fitScore?.score ?? "",
    app.job?.fitScore?.recommendation || "",
    formatDate(app.createdAt),
    formatDate(app.updatedAt),
  ]);

  return generateCsv(headers, rows);
}

/**
 * Generates an RFC 4180 compliant CSV of all discovered/scored jobs.
 */
export async function exportJobsCsv(prisma: typeof db = db): Promise<string> {
  const jobs = await prisma.job.findMany({
    include: {
      fitScore: true,
      application: true,
    },
    orderBy: {
      discoveredAt: "desc",
    },
  });

  const headers = [
    "Job ID",
    "Dedupe Key",
    "Company",
    "Title",
    "Location",
    "Remote Status",
    "Salary Min",
    "Salary Max",
    "Employment Type",
    "Status",
    "Source",
    "Fit Score",
    "Recommendation",
    "Strengths",
    "Gaps",
    "Risks",
    "Fit Reasoning",
    "Application Status",
    "Applied Date",
    "Discovered Date",
    "Posted Date",
    "Job URL",
    "Description",
  ];

  const rows = jobs.map((job) => [
    job.id,
    job.dedupeKey,
    job.company,
    job.title,
    job.location,
    job.remoteStatus,
    job.salaryMin ?? "",
    job.salaryMax ?? "",
    job.employmentType,
    job.status,
    job.source,
    job.fitScore?.score ?? "",
    job.fitScore?.recommendation || "",
    formatJsonArray(job.fitScore?.strengths),
    formatJsonArray(job.fitScore?.gaps),
    formatJsonArray(job.fitScore?.risks),
    job.fitScore?.reasoning || "",
    job.application?.status || "",
    formatDate(job.application?.appliedAt),
    formatDate(job.discoveredAt),
    formatDate(job.postedAt),
    job.url,
    job.description,
  ]);

  return generateCsv(headers, rows);
}
