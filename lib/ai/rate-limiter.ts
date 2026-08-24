export interface RateLimitStatus {
  remainingRequests?: number;
  remainingTokens?: number;
  resetRequestsMs?: number;
  resetTokensMs?: number;
  lastUpdated: number;
}

export interface SlidingWindowBucket {
  timestamps: number[];
  tokenCount: number;
  windowMs: number;
  maxRequests: number;
}

/**
 * Adaptive Rate Limiter and Proactive Header-Driven Rate-Limit Parser.
 * Tracks remaining quotas from provider responses to avoid hitting 429/RESOURCE_EXHAUSTED errors.
 */
export class RateLimiter {
  private statusMap = new Map<string, RateLimitStatus>();
  private slidingWindows = new Map<string, SlidingWindowBucket>();

  /**
   * Parses standard rate-limit headers from fetch responses or API error details.
   */
  public parseHeaders(headers: Record<string, string | number | undefined> | Headers): RateLimitStatus {
    const getHeader = (name: string): string | undefined => {
      if (!headers) return undefined;
      if (typeof (headers as Headers).get === "function") {
        return (headers as Headers).get(name) ?? (headers as Headers).get(name.toLowerCase()) ?? undefined;
      }
      const record = headers as Record<string, string | number | undefined>;
      const val = record[name] ?? record[name.toLowerCase()];
      return val !== undefined ? String(val) : undefined;
    };

    const remainingReqStr =
      getHeader("x-ratelimit-remaining-requests") ||
      getHeader("ratelimit-remaining-requests") ||
      getHeader("x-ratelimit-remaining");

    const remainingTokStr =
      getHeader("x-ratelimit-remaining-tokens") ||
      getHeader("ratelimit-remaining-tokens");

    const resetReqStr =
      getHeader("x-ratelimit-reset-requests") ||
      getHeader("retry-after") ||
      getHeader("ratelimit-reset-requests");

    const remainingRequests = remainingReqStr !== undefined ? parseInt(remainingReqStr, 10) : undefined;
    const remainingTokens = remainingTokStr !== undefined ? parseInt(remainingTokStr, 10) : undefined;

    let resetRequestsMs: number | undefined;
    if (resetReqStr) {
      const parsedNum = parseFloat(resetReqStr);
      if (!isNaN(parsedNum)) {
        // If string ends with 's' or 'ms' or raw number
        if (resetReqStr.endsWith("ms")) {
          resetRequestsMs = parsedNum;
        } else {
          // Standard seconds
          resetRequestsMs = parsedNum * 1000;
        }
      }
    }

    return {
      remainingRequests: isNaN(remainingRequests ?? NaN) ? undefined : remainingRequests,
      remainingTokens: isNaN(remainingTokens ?? NaN) ? undefined : remainingTokens,
      resetRequestsMs,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Updates rate limit status for a given candidate ID based on response headers.
   */
  public recordHeaders(
    candidateId: string,
    headers: Record<string, string | number | undefined> | Headers
  ): RateLimitStatus {
    const status = this.parseHeaders(headers);
    this.statusMap.set(candidateId, status);
    return status;
  }

  /**
   * Checks if candidate is within safe rate limit thresholds.
   * Proactively returns false if remaining requests <= 1 or tokens < 1000.
   */
  public isCandidateProactivelyThrottled(candidateId: string): boolean {
    const status = this.statusMap.get(candidateId);
    if (!status) return false;

    // Check if status is recent (< 60 seconds old)
    if (Date.now() - status.lastUpdated > 60_000) {
      return false;
    }

    // If remaining requests is critically low (<= 1)
    if (status.remainingRequests !== undefined && status.remainingRequests <= 1) {
      return true;
    }

    // If remaining tokens is critically low (< 1,000 tokens)
    if (status.remainingTokens !== undefined && status.remainingTokens < 1000) {
      return true;
    }

    return false;
  }

  /**
   * Registers a sliding window bucket for a candidate or provider (e.g. 15 RPM for Gemini).
   */
  public registerBucket(candidateId: string, maxRequests: number, windowMs = 60_000): void {
    this.slidingWindows.set(candidateId, {
      timestamps: [],
      tokenCount: 0,
      windowMs,
      maxRequests,
    });
  }

  /**
   * Checks if sliding window allows an execution.
   */
  public checkSlidingWindow(candidateId: string): boolean {
    const bucket = this.slidingWindows.get(candidateId);
    if (!bucket) return true;

    const now = Date.now();
    const cutoff = now - bucket.windowMs;

    // Filter out old timestamps
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    return bucket.timestamps.length < bucket.maxRequests;
  }

  /**
   * Records an execution event in the sliding window.
   */
  public recordExecution(candidateId: string): void {
    const bucket = this.slidingWindows.get(candidateId);
    if (!bucket) return;

    bucket.timestamps.push(Date.now());
  }

  /**
   * Gets current tracked status for candidate.
   */
  public getStatus(candidateId: string): RateLimitStatus | undefined {
    return this.statusMap.get(candidateId);
  }

  /**
   * Resets all tracked rate limit statuses.
   */
  public reset(): void {
    this.statusMap.clear();
    this.slidingWindows.clear();
  }
}

export const rateLimiter = new RateLimiter();
