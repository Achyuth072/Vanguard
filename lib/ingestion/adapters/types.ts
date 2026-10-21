import type {
  FeedSource,
  FeedSourceConfig,
  FeedSourceType,
  RawFeedJob,
  FeedPollResult,
} from "../../../types/feed-source";
import type { PreFilterCandidateCriteria } from "../../filters/prefilter";
import type { CandidateFilterCriteria } from "../../filters/deterministic";

export type { RawFeedJob, FeedPollResult, FeedSource, FeedSourceConfig, FeedSourceType };

export interface AdapterPollOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  limit?: number;
  abortSignal?: AbortSignal;
  boardSlugOverride?: string;
  sessionPayload?: unknown;
}

export function parseNumeric(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export interface FeedAdapter {
  readonly sourceType: FeedSourceType | string;
  poll(
    source: FeedSource,
    candidate?: CandidateFilterCriteria | PreFilterCandidateCriteria,
    options?: AdapterPollOptions
  ): Promise<FeedPollResult>;
  validateConfig(config: FeedSourceConfig | Record<string, unknown>): boolean;
}
