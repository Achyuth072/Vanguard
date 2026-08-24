import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ModelPoolManager } from "./pool";

describe("ModelPoolManager P2C Load Balancer", () => {
  let pool: ModelPoolManager;

  beforeEach(() => {
    pool = new ModelPoolManager();
  });

  test("handles empty and single candidate cases safely", () => {
    assert.equal(pool.selectCandidate([]), null);

    const single = { id: "gemini:k1:3.7-flash" };
    assert.equal(pool.selectCandidate([single]), single);
  });

  test("selects the least in-flight candidate using P2C heuristic", () => {
    const candidates = [
      { id: "key_1" },
      { id: "key_2" },
      { id: "key_3" },
    ];

    // Simulate key_1 has 5 in-flight requests, key_2 has 0, key_3 has 0
    pool.trackStart("key_1");
    pool.trackStart("key_1");
    pool.trackStart("key_1");
    pool.trackStart("key_1");
    pool.trackStart("key_1");

    // Over multiple random selections, key_2 and key_3 should be strongly preferred over key_1
    let key1Count = 0;
    for (let i = 0; i < 50; i++) {
      const selected = pool.selectCandidate(candidates);
      if (selected?.id === "key_1") key1Count++;
    }

    assert.ok(key1Count === 0, `Expected 0 selections for heavily loaded key_1, got ${key1Count}`);
  });

  test("updates metrics accurately on trackStart and trackEnd", () => {
    const candidateId = "nvidia:k1:glm-5.2";

    pool.trackStart(candidateId);
    let metrics = pool.getMetrics(candidateId);
    assert.equal(metrics?.inFlightRequests, 1);
    assert.equal(metrics?.totalRequests, 1);

    pool.trackEnd(candidateId, true);
    metrics = pool.getMetrics(candidateId);
    assert.equal(metrics?.inFlightRequests, 0);
    assert.equal(metrics?.failureCount, 0);
    assert.ok((metrics?.lastSuccessAt ?? 0) > 0);

    // Failure simulation
    pool.trackStart(candidateId);
    pool.trackEnd(candidateId, false);
    metrics = pool.getMetrics(candidateId);
    assert.equal(metrics?.failureCount, 1);
  });

  test("prioritizes candidates sorting least-loaded first", () => {
    const candidates = [
      { id: "cand_busy" },
      { id: "cand_free" },
    ];

    pool.trackStart("cand_busy");
    const prioritized = pool.prioritizeCandidates(candidates);

    assert.equal(prioritized[0].id, "cand_free");
    assert.equal(prioritized[1].id, "cand_busy");
  });
});
