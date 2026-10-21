import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_BASELINE_FEED_SOURCES, FeedSourceTypeSchema, type FeedSource } from "@/types/feed-source";
import { probeFeedSource } from "@/lib/ingestion/probe";

const ProbeRequestSchema = z.object({
  sourceId: z.string().optional(),
  type: FeedSourceTypeSchema.optional(),
  boardSlug: z.string().optional(),
  sampleLimit: z.number().int().positive().optional().default(2),
  timeoutMs: z.number().int().positive().optional().default(10000),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const parseResult = ProbeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid probe payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { sourceId, type, boardSlug, sampleLimit, timeoutMs } = parseResult.data;

    if (!sourceId && !type) {
      return NextResponse.json(
        {
          success: false,
          error: "sourceId or type is required to probe feed source",
        },
        { status: 400 }
      );
    }

    let sourceToProbe: FeedSource | null = null;

    if (sourceId) {
      sourceToProbe = (await db.feedSource.findUnique({
        where: { id: sourceId },
      })) as FeedSource | null;
    }

    if (!sourceToProbe && type) {
      const baseline = DEFAULT_BASELINE_FEED_SOURCES.find((b) => b.type === type);
      if (baseline) {
        sourceToProbe = {
          id: baseline.id,
          name: baseline.name,
          type: baseline.type,
          url: baseline.url,
          config: JSON.stringify(baseline.config),
          enabled: baseline.enabled,
          autoPoll: baseline.autoPoll,
          lastCursor: "",
          pollIntervalMs: baseline.pollIntervalMs,
          consecutiveEmpty: 0,
          jobsDiscovered: 0,
          jobsPassed: 0,
          errorCount: 0,
          lastError: "",
        };
      }
    }

    if (!sourceToProbe) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not find feed source configuration for sourceId='${sourceId}' or type='${type}'`,
        },
        { status: 404 }
      );
    }

    const probeResult = await probeFeedSource(sourceToProbe, {
      sampleLimit,
      timeoutMs,
      boardSlugOverride: boardSlug,
    });

    return NextResponse.json(
      {
        success: probeResult.status !== "UNREACHABLE",
        probe: probeResult,
      },
      { status: probeResult.status === "UNREACHABLE" ? 502 : 200 }
    );
  } catch (error) {
    console.error("POST /api/feeds/probe error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error while probing source",
      },
      { status: 500 }
    );
  }
}
