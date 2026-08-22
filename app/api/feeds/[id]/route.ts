import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseFeedSourceConfig,
  serializeFeedSourceConfig,
} from "@/lib/feed-sources";
import { FeedSourceConfigSchema } from "@/types/feed-source";

const PatchFeedSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().optional(),
  enabled: z.boolean().optional(),
  autoPoll: z.boolean().optional(),
  pollIntervalMs: z.number().int().positive().optional(),
  lastCursor: z.string().optional(),
  config: z.union([FeedSourceConfigSchema, z.string()]).optional(),
  boardSlugs: z.array(z.string()).optional(),
});

type RouteParams = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Feed source ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.feedSource.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Feed source '${id}' not found` },
        { status: 404 }
      );
    }

    const rawBody = await request.json();
    const parseResult = PatchFeedSourceSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid patch payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      name,
      url,
      enabled,
      autoPoll,
      pollIntervalMs,
      lastCursor,
      config,
      boardSlugs,
    } = parseResult.data;

    const dataToUpdate: Record<string, unknown> = {};

    if (name !== undefined) dataToUpdate.name = name;
    if (url !== undefined) dataToUpdate.url = url;
    if (enabled !== undefined) dataToUpdate.enabled = enabled;
    if (autoPoll !== undefined) dataToUpdate.autoPoll = autoPoll;
    if (pollIntervalMs !== undefined) dataToUpdate.pollIntervalMs = pollIntervalMs;
    if (lastCursor !== undefined) dataToUpdate.lastCursor = lastCursor;

    if (config !== undefined) {
      if (typeof config === "string") {
        dataToUpdate.config = config;
      } else {
        dataToUpdate.config = serializeFeedSourceConfig(config);
      }
    } else if (boardSlugs !== undefined) {
      const currentConfig = parseFeedSourceConfig(existing.config);
      const updatedConfig = {
        ...currentConfig,
        boardSlugs,
      };
      dataToUpdate.config = serializeFeedSourceConfig(updatedConfig);
    }

    const updated = await db.feedSource.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        parsedConfig: parseFeedSourceConfig(updated.config),
      },
    });
  } catch (error) {
    console.error("PATCH /api/feeds/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update feed source",
      },
      { status: 500 }
    );
  }
}
