import { getFeedAdapter } from "./adapters";
import type { FeedSource, FeedSourceType, RawFeedJob } from "../../types/feed-source";

export interface ProbeOptions {
  sampleLimit?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  boardSlugOverride?: string;
  abortSignal?: AbortSignal;
}

export interface SampleJobSummary {
  title: string;
  company: string;
  url: string;
  location?: string;
}

export interface FeedSourceProbeResult {
  sourceId?: string;
  sourceType: FeedSourceType;
  sourceName: string;
  status: "HEALTHY" | "DEGRADED" | "UNREACHABLE";
  latencyMs: number;
  jobsSampleCount: number;
  sampleJob?: SampleJobSummary;
  schemaErrors: string[];
  error?: string;
  notes?: string;
}

export interface ProbeSummary {
  totalSources: number;
  healthyCount: number;
  degradedCount: number;
  unreachableCount: number;
  avgLatencyMs: number;
  results: FeedSourceProbeResult[];
}

/**
 * Validates whether a RawFeedJob conforms to critical required attributes.
 */
function validateRawFeedJob(job: RawFeedJob, index: number): string[] {
  if (!job) {
    return [`Job at index ${index} is null or undefined`];
  }
  const errors: string[] = [];
  if (typeof job.title !== "string" || !job.title.trim()) {
    errors.push(`Job at index ${index} missing non-empty 'title'`);
  }
  if (typeof job.url !== "string" || !job.url.trim()) {
    errors.push(`Job at index ${index} missing non-empty 'url'`);
  } else if (!/^https?:\/\//i.test(job.url)) {
    errors.push(`Job at index ${index} has invalid url format: '${job.url}'`);
  }
  return errors;
}

/**
 * Probes a single feed source in dry-run mode without modifying the database or invoking AI scoring.
 */
export async function probeFeedSource(
  source: FeedSource,
  options?: ProbeOptions
): Promise<FeedSourceProbeResult> {
  const startTime = Date.now();
  const sampleLimit = options?.sampleLimit ?? 2;
  const timeoutMs = options?.timeoutMs ?? 10_000;

  // Clone source if overriding boardSlug
  let targetSource = source;
  if (options?.boardSlugOverride) {
    try {
      const parsedConfig = JSON.parse(source.config || "{}");
      parsedConfig.boardSlugs = [options.boardSlugOverride];
      targetSource = {
        ...source,
        config: JSON.stringify(parsedConfig),
      };
    } catch {
      targetSource = {
        ...source,
        config: JSON.stringify({ boardSlugs: [options.boardSlugOverride] }),
      };
    }
  }

  // Setup abort controller with timeout
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const adapter = getFeedAdapter(targetSource.type);
    const pollResult = await adapter.poll(targetSource, undefined, {
      limit: sampleLimit,
      fetchFn: options?.fetchFn,
      abortSignal: options?.abortSignal || timeoutController.signal,
    });

    const latencyMs = Math.max(0, Date.now() - startTime);
    const jobs = pollResult?.jobs || [];
    const schemaErrors = jobs.flatMap(validateRawFeedJob);

    const firstJob = jobs[0];
    const sampleJob = firstJob
      ? {
          title: firstJob.title || "",
          company: firstJob.company || "",
          url: firstJob.url || "",
          location: firstJob.location,
        }
      : undefined;

    const baseResult = {
      sourceId: source.id,
      sourceType: source.type,
      sourceName: source.name,
      latencyMs,
      jobsSampleCount: jobs.length,
      sampleJob,
    };

    if (schemaErrors.length > 0) {
      return {
        ...baseResult,
        status: "DEGRADED",
        schemaErrors,
        notes: `Schema validation failed on ${schemaErrors.length} property check(s)`,
      };
    }

    if (jobs.length === 0) {
      return {
        ...baseResult,
        status: "DEGRADED",
        schemaErrors: [],
        notes: "0 jobs discovered from source",
      };
    }

    return {
      ...baseResult,
      status: "HEALTHY",
      schemaErrors: [],
      notes: `Successfully parsed ${jobs.length} sample job(s)`,
    };
  } catch (error) {
    const latencyMs = Math.max(0, Date.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sourceId: source.id,
      sourceType: source.type,
      sourceName: source.name,
      status: "UNREACHABLE",
      latencyMs,
      jobsSampleCount: 0,
      schemaErrors: [],
      error: errorMessage,
      notes: `Probe failed: ${errorMessage}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes multiple feed sources concurrently and aggregates summary telemetry.
 */
export async function probeAllSources(
  sources: FeedSource[],
  options?: ProbeOptions
): Promise<ProbeSummary> {
  const results = await Promise.all(
    sources.map((source) => probeFeedSource(source, options))
  );

  let healthyCount = 0;
  let degradedCount = 0;
  let unreachableCount = 0;
  let totalLatency = 0;

  for (const r of results) {
    totalLatency += r.latencyMs;
    if (r.status === "HEALTHY") healthyCount++;
    else if (r.status === "DEGRADED") degradedCount++;
    else unreachableCount++;
  }

  const avgLatencyMs = results.length > 0 ? Math.round(totalLatency / results.length) : 0;

  return {
    totalSources: sources.length,
    healthyCount,
    degradedCount,
    unreachableCount,
    avgLatencyMs,
    results,
  };
}
