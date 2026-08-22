import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ingestStagedJobs } from "@/lib/discovery";

const IngestRequestSchema = z.object({
  jobIds: z.array(z.string()).optional(),
  jobId: z.string().optional(),
  all: z.boolean().optional(),
  candidateId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = IngestRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid ingest request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { jobIds, jobId, all, candidateId } = parseResult.data;

    let targetJobIds: string[] = [];

    if (all) {
      const stagedJobs = await db.job.findMany({
        where: {
          isStaged: true,
          status: { notIn: ["IGNORED", "ARCHIVED", "REJECTED"] },
        },
        select: { id: true },
      });
      targetJobIds = stagedJobs.map((j) => j.id);
    } else if (jobIds && jobIds.length > 0) {
      targetJobIds = jobIds;
    } else if (jobId) {
      targetJobIds = [jobId];
    }

    if (targetJobIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No staged job IDs specified for ingestion",
        },
        { status: 400 }
      );
    }

    const result = await ingestStagedJobs(targetJobIds, {
      candidateId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("POST /api/discovery/ingest error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to ingest discovery jobs",
      },
      { status: 500 }
    );
  }
}
