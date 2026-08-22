import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseFeedSourceConfig,
  serializeFeedSourceConfig,
  seedDefaultFeedSources,
} from "@/lib/feed-sources";
import {
  FeedSourceTypeSchema,
  FeedSourceConfigSchema,
} from "@/types/feed-source";

const CreateFeedSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: FeedSourceTypeSchema,
  url: z.string().default(""),
  config: z.union([FeedSourceConfigSchema, z.string()]).optional(),
  enabled: z.boolean().default(true),
  autoPoll: z.boolean().default(false),
  pollIntervalMs: z.number().int().positive().default(14400000),
});

export async function GET() {
  try {
    let feedSources = await db.feedSource.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (feedSources.length === 0) {
      await seedDefaultFeedSources(db);
      feedSources = await db.feedSource.findMany({
        orderBy: { createdAt: "asc" },
      });
    }

    const formattedSources = feedSources.map((source) => ({
      ...source,
      parsedConfig: parseFeedSourceConfig(source.config),
    }));

    return NextResponse.json({
      success: true,
      data: formattedSources,
      count: formattedSources.length,
    });
  } catch (error) {
    console.error("GET /api/feeds error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed sources",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = CreateFeedSourceSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid feed source payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, name, type, url, config, enabled, autoPoll, pollIntervalMs } =
      parseResult.data;

    let serializedConfig = "{}";
    if (typeof config === "string") {
      serializedConfig = config;
    } else if (config && typeof config === "object") {
      serializedConfig = serializeFeedSourceConfig(config);
    }

    let record;
    if (id) {
      // Upsert by id
      record = await db.feedSource.upsert({
        where: { id },
        create: {
          id,
          name,
          type,
          url: url || "",
          config: serializedConfig,
          enabled: enabled ?? true,
          autoPoll: autoPoll ?? false,
          pollIntervalMs: pollIntervalMs ?? 14400000,
        },
        update: {
          name,
          type,
          url: url || "",
          config: serializedConfig,
          ...(enabled !== undefined ? { enabled } : {}),
          ...(autoPoll !== undefined ? { autoPoll } : {}),
          ...(pollIntervalMs !== undefined ? { pollIntervalMs } : {}),
        },
      });
    } else {
      // Create new
      record = await db.feedSource.create({
        data: {
          name,
          type,
          url: url || "",
          config: serializedConfig,
          enabled: enabled ?? true,
          autoPoll: autoPoll ?? false,
          pollIntervalMs: pollIntervalMs ?? 14400000,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...record,
          parsedConfig: parseFeedSourceConfig(record.config),
        },
      },
      { status: id ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/feeds error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create or update feed source",
      },
      { status: 500 }
    );
  }
}
