import { db } from "./db";
import {
  DEFAULT_BASELINE_FEED_SOURCES,
  FeedSourceConfigSchema,
  type BaselineFeedSourceDefinition,
  type FeedSourceConfig,
} from "../types/feed-source";

export function parseFeedSourceConfig(configStr: string): FeedSourceConfig {
  if (!configStr || typeof configStr !== "string") {
    return {};
  }
  try {
    const raw = JSON.parse(configStr);
    const parsed = FeedSourceConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function serializeFeedSourceConfig(config: FeedSourceConfig): string {
  return JSON.stringify(config);
}

export async function seedDefaultFeedSources(
  prismaClient = db
): Promise<Array<{ id: string; name: string; type: string }>> {
  const seeded = [];

  for (const source of DEFAULT_BASELINE_FEED_SOURCES) {
    const serializedConfig = serializeFeedSourceConfig(source.config);

    const record = await prismaClient.feedSource.upsert({
      where: { id: source.id },
      update: {
        name: source.name,
        type: source.type,
        url: source.url,
        config: serializedConfig,
        pollIntervalMs: source.pollIntervalMs,
      },
      create: {
        id: source.id,
        name: source.name,
        type: source.type,
        url: source.url,
        config: serializedConfig,
        enabled: source.enabled,
        autoPoll: source.autoPoll,
        pollIntervalMs: source.pollIntervalMs,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
        lastCursor: "",
      },
    });

    seeded.push({
      id: record.id,
      name: record.name,
      type: record.type,
    });
  }

  return seeded;
}

export function getDefaultBaselineFeedSources(): BaselineFeedSourceDefinition[] {
  return DEFAULT_BASELINE_FEED_SOURCES;
}
