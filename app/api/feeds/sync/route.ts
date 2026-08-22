import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestionOrchestrator } from "@/lib/ingestion/orchestrator";

const SyncFeedRequestSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().optional(),
  forceSync: z.boolean().optional(),
  candidateId: z.string().optional(),
  limit: z.number().int().positive().optional(),
  onlyEnabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid (triggers sync on all enabled sources)
      body = {};
    }

    const parseResult = SyncFeedRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid sync request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, sourceId, forceSync, candidateId, limit, onlyEnabled } =
      parseResult.data;

    const targetId = id || sourceId;

    if (targetId) {
      // Sync single feed source
      const result = await ingestionOrchestrator.syncSource(targetId, {
        forceSync: forceSync ?? true, // If explicitly called with targetId, forceSync defaults to true
        candidateId,
        limit,
      });

      const isSuccess = result.status !== "ERROR";

      return NextResponse.json(
        {
          success: isSuccess,
          data: result,
        },
        { status: isSuccess ? 200 : 500 }
      );
    } else {
      // Sync all active feeds
      const result = await ingestionOrchestrator.syncAllSources({
        onlyEnabled: onlyEnabled ?? (forceSync ? false : true),
        forceSync,
        candidateId,
        limit,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error("POST /api/feeds/sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to execute feed sync",
      },
      { status: 500 }
    );
  }
}
