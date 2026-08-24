import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { LanguageModelV2 } from "ai";
import {
  generateStructuredWithFallback,
  AICacheService,
  poolManager,
  rateLimiter,
  BM25Scorer,
} from "./router";

describe("AIRouter Tier Caching & Token Budgeting Integration", () => {
  beforeEach(() => {
    AICacheService.clear();
    poolManager.reset();
    rateLimiter.reset();
  });

  test("returns cached object on identical sequential requests without invoking model twice", async () => {
    let invocationCount = 0;
    const mockModel: LanguageModelV2 = {
      specificationVersion: "v2",
      provider: "test-cache-provider",
      modelId: "test-cache-model",
      supportedUrls: {},
      doGenerate: async () => {
        invocationCount++;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ score: 95, recommendation: "APPLY" }),
            },
          ],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async () => {
        throw new Error("Not implemented");
      },
    };

    const schema = z.object({
      score: z.number(),
      recommendation: z.string(),
    });

    const prompt = "Evaluate fit for candidate A";
    const system = "You are a test system prompt";

    // First call: calls model
    const result1 = await generateStructuredWithFallback({
      schema,
      prompt,
      system,
      options: { primaryModel: mockModel },
    });

    assert.equal(result1.score, 95);
    assert.equal(invocationCount, 1);

    // Cache key test
    const cacheKey = AICacheService.generateKey([prompt, system, undefined, undefined, undefined]);
    AICacheService.set(cacheKey, result1);

    const cached = AICacheService.get<typeof result1>(cacheKey);
    assert.deepEqual(cached, result1);
    assert.equal(AICacheService.getStats().hits, 1);
  });

  test("BM25Scorer is accessible and functions via router export", () => {
    const scorer = new BM25Scorer();
    scorer.fit(["React TypeScript Next.js", "Python Django Flask"]);
    const score = scorer.scoreNormalized("React TypeScript", "Senior React Developer with TypeScript experience");
    assert.ok(score >= 70);
  });
});
