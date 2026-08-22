import { NextResponse } from "next/server";
import { z } from "zod";
import { dismissStagedJobs } from "@/lib/discovery";

const DismissRequestSchema = z.object({
  jobIds: z.array(z.string()).optional(),
  jobId: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = DismissRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid dismiss request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { jobIds, jobId, reason } = parseResult.data;

    let targetJobIds: string[] = [];
    if (jobIds && jobIds.length > 0) {
      targetJobIds = jobIds;
    } else if (jobId) {
      targetJobIds = [jobId];
    }

    if (targetJobIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No job IDs specified for dismissal",
        },
        { status: 400 }
      );
    }

    const result = await dismissStagedJobs(targetJobIds, { reason });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("POST /api/discovery/dismiss error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to dismiss discovery jobs",
      },
      { status: 500 }
    );
  }
}
