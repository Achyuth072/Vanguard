import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AICacheService } from "./cache";

describe("AICacheService Tier Caching", () => {
  beforeEach(() => {
    AICacheService.clear();
  });

  test("generates identical deterministic SHA-256 keys for identical inputs", () => {
    const key1 = AICacheService.generateKey(["candidate_1", "job_123", "FIT_SCORING", "v1.0"]);
    const key2 = AICacheService.generateKey(["candidate_1", "job_123", "FIT_SCORING", "v1.0"]);
    const keyDiff = AICacheService.generateKey(["candidate_1", "job_124", "FIT_SCORING", "v1.0"]);

    assert.equal(key1, key2);
    assert.notEqual(key1, keyDiff);
    assert.equal(key1.length, 64, "Should be 64-char SHA-256 hex string");
  });

  test("handles object serialization with deterministic key ordering", () => {
    const obj1 = { role: "Engineer", exp: 5 };
    const obj2 = { exp: 5, role: "Engineer" };

    const key1 = AICacheService.generateKey([obj1]);
    const key2 = AICacheService.generateKey([obj2]);

    assert.equal(key1, key2);
  });

  test("sets, gets, and respects TTL expiration", async () => {
    const key = "test_key_1";
    const payload = { score: 92, recommendation: "APPLY" };

    AICacheService.set(key, payload, 50); // 50ms TTL
    assert.ok(AICacheService.has(key));

    const cached = AICacheService.get<typeof payload>(key);
    assert.deepEqual(cached, payload);

    // Wait for TTL expiry
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(AICacheService.has(key), false);
    assert.equal(AICacheService.get(key), null);
  });

  test("tracks cache stats accurately (hits, misses, hit ratio)", () => {
    const key = "stats_test_key";
    AICacheService.set(key, "data_payload");

    AICacheService.get(key); // Hit 1
    AICacheService.get(key); // Hit 2
    AICacheService.get("missing_key"); // Miss 1

    const stats = AICacheService.getStats();
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
    assert.equal(stats.hitRatio, 0.6667);
  });
});
