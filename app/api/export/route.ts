import { NextRequest, NextResponse } from "next/server";
import {
  generateFullJsonSnapshotString,
  exportApplicationsCsv,
  exportJobsCsv,
} from "@/lib/backup/export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || searchParams.get("type") || "json").toLowerCase();
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    if (format === "json" || format === "snapshot" || format === "full") {
      const jsonContent = await generateFullJsonSnapshotString();
      return new NextResponse(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="pulse-backup-${dateStr}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "applications" || format === "applications_csv" || format === "apps") {
      const csvContent = await exportApplicationsCsv();
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pulse-applications-${dateStr}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "jobs" || format === "jobs_csv") {
      const csvContent = await exportJobsCsv();
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pulse-jobs-${dateStr}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      {
        error: `Unsupported export format: '${format}'. Valid formats are: 'json', 'applications', 'jobs'.`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Export generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate export file.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
