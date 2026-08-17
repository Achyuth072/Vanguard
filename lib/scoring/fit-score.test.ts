import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCompositeFitScore,
  deriveRecommendation,
  DEFAULT_FIT_SCORE_WEIGHTS,
  validateWeights,
  normalizeSubDimensions,
  type FitScoreWeights,
  type FitScoreSubDimensions,
} from "./fit-score";

describe("FitScore Sub-dimension & Composite Calculation", () => {
  it("calculates composite score accurately with default baseline weights", () => {
    const subScores: FitScoreSubDimensions = {
      skillsFit: 90,       // 90 * 0.35 = 31.5
      experienceFit: 80,   // 80 * 0.30 = 24.0
      domainFit: 70,       // 70 * 0.20 = 14.0
      trajectoryFit: 60,   // 60 * 0.15 = 9.0
    };
    // Sum = 31.5 + 24.0 + 14.0 + 9.0 = 78.5 -> Math.round -> 79
    const composite = computeCompositeFitScore(subScores);
    assert.strictEqual(composite, 79);
    assert.strictEqual(deriveRecommendation(composite), "REVIEW");
  });

  it("calculates composite score accurately at boundary values (100 and 0)", () => {
    const perfect: FitScoreSubDimensions = {
      skillsFit: 100,
      experienceFit: 100,
      domainFit: 100,
      trajectoryFit: 100,
    };
    assert.strictEqual(computeCompositeFitScore(perfect), 100);
    assert.strictEqual(deriveRecommendation(100), "APPLY");

    const zero: FitScoreSubDimensions = {
      skillsFit: 0,
      experienceFit: 0,
      domainFit: 0,
      trajectoryFit: 0,
    };
    assert.strictEqual(computeCompositeFitScore(zero), 0);
    assert.strictEqual(deriveRecommendation(0), "IGNORE");
  });

  it("supports custom valid weights within [0.10, 0.50] summing to 1.0", () => {
    const customWeights: FitScoreWeights = {
      skills: 0.40,
      experience: 0.25,
      domain: 0.20,
      trajectory: 0.15,
    };
    const subScores: FitScoreSubDimensions = {
      skillsFit: 100,
      experienceFit: 80,
      domainFit: 60,
      trajectoryFit: 80,
    };
    // 40 + 20 + 12 + 12 = 84
    assert.strictEqual(computeCompositeFitScore(subScores, customWeights), 84);
  });

  it("throws validation errors for weights that do not sum to 1.0", () => {
    const invalidSum: FitScoreWeights = {
      skills: 0.35,
      experience: 0.30,
      domain: 0.20,
      trajectory: 0.20, // Sum = 1.05
    };
    assert.throws(() => validateWeights(invalidSum), /must sum to 1\.0/);
  });

  it("throws validation errors for weights outside [0.10, 0.50] bounds", () => {
    const outOfBounds: FitScoreWeights = {
      skills: 0.60,
      experience: 0.20,
      domain: 0.10,
      trajectory: 0.10,
    };
    assert.throws(() => validateWeights(outOfBounds), /must be within \[0\.1, 0\.5\]/);

    const tooSmall: FitScoreWeights = {
      skills: 0.45,
      experience: 0.35,
      domain: 0.15,
      trajectory: 0.05,
    };
    assert.throws(() => validateWeights(tooSmall), /must be within \[0\.1, 0\.5\]/);
  });

  it("derives recommendation correctly across score thresholds", () => {
    assert.strictEqual(deriveRecommendation(80), "APPLY");
    assert.strictEqual(deriveRecommendation(95), "APPLY");
    assert.strictEqual(deriveRecommendation(79), "REVIEW");
    assert.strictEqual(deriveRecommendation(60), "REVIEW");
    assert.strictEqual(deriveRecommendation(59), "IGNORE");
    assert.strictEqual(deriveRecommendation(0), "IGNORE");
  });

  it("normalizes legacy database records gracefully with fallback scores", () => {
    const legacyFallback = normalizeSubDimensions(null, 75);
    assert.deepStrictEqual(legacyFallback, {
      skillsFit: 75,
      experienceFit: 75,
      domainFit: 75,
      trajectoryFit: 75,
    });

    const partial = normalizeSubDimensions({ skillsFit: 90 }, 60);
    assert.deepStrictEqual(partial, {
      skillsFit: 90,
      experienceFit: 60,
      domainFit: 60,
      trajectoryFit: 60,
    });

    const nullFallback = normalizeSubDimensions(undefined, null);
    assert.deepStrictEqual(nullFallback, {
      skillsFit: 0,
      experienceFit: 0,
      domainFit: 0,
      trajectoryFit: 0,
    });
  });
});
