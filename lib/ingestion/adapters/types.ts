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
