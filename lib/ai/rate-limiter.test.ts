import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter & Proactive Header Tracker", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  test("parses standard rate-limit headers correctly", () => {
    const headers = {
      "x-ratelimit-remaining-requests": "14",
      "x-ratelimit-remaining-tokens": "950000",
      "retry-after": "5",
    };

    const status = limiter.parseHeaders(headers);
    assert.equal(status.remainingRequests, 14);
    assert.equal(status.remainingTokens, 950000);
    assert.equal(status.resetRequestsMs, 5000);
  });

  test("flags candidate for proactive throttling when remaining quotas are critically low", () => {
    const candidateId = "groq:k1:llama-3.3-70b";

    limiter.recordHeaders(candidateId, {
      "x-ratelimit-remaining-requests": "1",
      "x-ratelimit-remaining-tokens": "500",
    });

    assert.equal(limiter.isCandidateProactivelyThrottled(candidateId), true);

    // Normal safe headers
    limiter.recordHeaders("safe_candidate", {
      "x-ratelimit-remaining-requests": "25",
      "x-ratelimit-remaining-tokens": "50000",
    });
    assert.equal(limiter.isCandidateProactivelyThrottled("safe_candidate"), false);
  });

  test("enforces sliding window request rate limiting", () => {
    const candidateId = "gemini_free_tier";
    limiter.registerBucket(candidateId, 3, 1000); // 3 requests per 1 second

    assert.equal(limiter.checkSlidingWindow(candidateId), true);
    limiter.recordExecution(candidateId); // 1
    assert.equal(limiter.checkSlidingWindow(candidateId), true);
    limiter.recordExecution(candidateId); // 2
    assert.equal(limiter.checkSlidingWindow(candidateId), true);
    limiter.recordExecution(candidateId); // 3

    // 4th request in the same window should be blocked
    assert.equal(limiter.checkSlidingWindow(candidateId), false);
  });
});
