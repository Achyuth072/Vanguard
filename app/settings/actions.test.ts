import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getScoringFeedbackLoopState,
  getScoringWeightHistory,
  updateScoringWeights,
  applySuggestedWeights,
  resetScoringWeights,
} from "./actions";
import { DEFAULT_FIT_SCORE_WEIGHTS, validateWeights } from "@/lib/scoring/fit-score";

describe("Scoring Feedback Loop Server Actions", () => {
  it("retrieves feedback loop state without throwing", async () => {
    const state = await getScoringFeedbackLoopState();
    assert.ok(state);
    assert.ok(state.phase === "COLD_START" || state.phase === "SUGGESTED" || state.phase === "AUTOMATED");
    assert.ok(typeof state.sampleSize === "number");
    validateWeights(state.currentWeights);
    validateWeights(state.calibratedWeights);
  });

  it("updates manual weights with bounds and normalization", async () => {
    const newWeights = {
      skills: 0.40,
      experience: 0.25,
      domain: 0.20,
      trajectory: 0.15,
    };
    const res = await updateScoringWeights(newWeights, { domain: true });
    assert.strictEqual(res.success, true);
    validateWeights(res.weights);
    assert.strictEqual(res.weights.skills, 0.40);
  });

  it("applies suggested calibrated weights and logs an audit event", async () => {
    const calibrated = {
      skills: 0.38,
      experience: 0.27,
      domain: 0.20,
      trajectory: 0.15,
    };
    const res = await applySuggestedWeights(calibrated);
    assert.strictEqual(res.success, true);
    validateWeights(res.weights);

    const history = await getScoringWeightHistory();
    assert.ok(history.length > 0);
    assert.ok(history.some((h) => h.eventType === "WEIGHTS_CALIBRATED" || h.eventType === "WEIGHTS_UPDATED"));
  });

  it("resets scoring weights to default baseline", async () => {
    const res = await resetScoringWeights();
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.weights, DEFAULT_FIT_SCORE_WEIGHTS);
  });
});
