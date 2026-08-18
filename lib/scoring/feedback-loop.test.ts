import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDimensionDeltas,
  calibrateWeights,
  generateConversionInsights,
  determineCalibrationPhase,
  normalizeAndClampWeights,
  type ApplicationOutcomeRecord,
  type FeedbackLoopConfig,
} from "./feedback-loop";
import { DEFAULT_FIT_SCORE_WEIGHTS, validateWeights, type FitScoreWeights } from "./fit-score";

describe("FeedbackLoopService - Calibration & Cold-Start Guardrails", () => {
  const sampleApplications: ApplicationOutcomeRecord[] = [
    // 6 positive outcomes (high domain & skills)
    {
      id: "app-1",
      status: "INTERVIEW",
      skillsFit: 90,
      experienceFit: 75,
      domainFit: 95,
      trajectoryFit: 70,
      title: "Senior Backend Engineer",
      company: "SaaSify",
      skills: ["TypeScript", "Node.js", "PostgreSQL"],
    },
    {
      id: "app-2",
      status: "INTERVIEW",
      skillsFit: 85,
      experienceFit: 80,
      domainFit: 90,
      trajectoryFit: 75,
      title: "Lead Platform Engineer",
      company: "CloudScale",
      skills: ["TypeScript", "AWS", "Kubernetes"],
    },
    {
      id: "app-3",
      status: "OFFER",
      skillsFit: 95,
      experienceFit: 85,
      domainFit: 90,
      trajectoryFit: 80,
      title: "Staff Engineer",
      company: "DataFlow",
      skills: ["TypeScript", "Distributed Systems"],
    },
    {
      id: "app-4",
      status: "INTERVIEW",
      skillsFit: 88,
      experienceFit: 70,
      domainFit: 85,
      trajectoryFit: 65,
      title: "Backend Architect",
      company: "FinHub",
      skills: ["Node.js", "PostgreSQL"],
    },
    {
      id: "app-5",
      status: "INTERVIEW",
      skillsFit: 92,
      experienceFit: 78,
      domainFit: 92,
      trajectoryFit: 72,
      title: "Principal Engineer",
      company: "DevPlatform",
      skills: ["TypeScript", "Go"],
    },
    {
      id: "app-6",
      status: "OFFER",
      skillsFit: 90,
      experienceFit: 82,
      domainFit: 88,
      trajectoryFit: 78,
      title: "Fullstack Lead",
      company: "ModernApp",
      skills: ["TypeScript", "React", "Node.js"],
    },
    // 6 negative resume screen rejections (low domain & trajectory)
    {
      id: "app-7",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 80,
      experienceFit: 60,
      domainFit: 40,
      trajectoryFit: 45,
      title: "Embedded Systems Engineer",
      company: "HardwareCorp",
      skills: ["C++", "Embedded Linux"],
    },
    {
      id: "app-8",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 75,
      experienceFit: 65,
      domainFit: 35,
      trajectoryFit: 50,
      title: "Firmware Developer",
      company: "IoTDevices",
      skills: ["C", "RTOS"],
    },
    {
      id: "app-9",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 70,
      experienceFit: 70,
      domainFit: 45,
      trajectoryFit: 40,
      title: "Chipset Architect",
      company: "SemiTech",
      skills: ["Verilog", "C++"],
    },
    {
      id: "app-10",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 78,
      experienceFit: 55,
      domainFit: 30,
      trajectoryFit: 45,
      title: "Robotics Programmer",
      company: "RoboDynamics",
      skills: ["ROS", "C++"],
    },
    {
      id: "app-11",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 82,
      experienceFit: 60,
      domainFit: 50,
      trajectoryFit: 40,
      title: "Automotive Software Dev",
      company: "AutoDrive",
      skills: ["CANbus", "C++"],
    },
    {
      id: "app-12",
      status: "REJECTED",
      rejectionStage: "RESUME_SCREEN",
      skillsFit: 76,
      experienceFit: 58,
      domainFit: 38,
      trajectoryFit: 42,
      title: "DSP Engineer",
      company: "AudioTech",
      skills: ["DSP", "C++"],
    },
  ];

  it("determines correct calibration phases based on sample size thresholds", () => {
    assert.strictEqual(determineCalibrationPhase(0), "COLD_START");
    assert.strictEqual(determineCalibrationPhase(9), "COLD_START");
    assert.strictEqual(determineCalibrationPhase(10), "SUGGESTED");
    assert.strictEqual(determineCalibrationPhase(24), "SUGGESTED");
    assert.strictEqual(determineCalibrationPhase(25), "AUTOMATED");
    assert.strictEqual(determineCalibrationPhase(50), "AUTOMATED");
  });

  it("calculates dimension conversion deltas accurately between positive and negative outcomes", () => {
    const deltas = calculateDimensionDeltas(sampleApplications);
    // Positive outcomes have domainFit ~90 vs rejections ~39.7 -> delta ~ +0.50
    assert.ok(deltas.domain > 0.3, `Expected domain delta > 0.3, got ${deltas.domain}`);
    // SkillsFit positive ~90 vs rejections ~77 -> delta ~ +0.13
    assert.ok(deltas.skills > 0, `Expected positive skills delta, got ${deltas.skills}`);
  });

  it("keeps weights static during Phase 0 (N < 10)", () => {
    const smallSample = sampleApplications.slice(0, 8);
    const result = calibrateWeights({
      currentWeights: DEFAULT_FIT_SCORE_WEIGHTS,
      applications: smallSample,
    });

    assert.strictEqual(result.phase, "COLD_START");
    assert.strictEqual(result.sampleSize, 8);
    assert.deepStrictEqual(result.calibratedWeights, DEFAULT_FIT_SCORE_WEIGHTS);
    assert.strictEqual(result.hasChanges, false);
  });

  it("computes suggested conservative drift during Phase 1 (10 <= N < 25)", () => {
    const mediumSample = sampleApplications.slice(0, 12); // N = 12 (6 interviews, 6 rejections)
    const result = calibrateWeights({
      currentWeights: DEFAULT_FIT_SCORE_WEIGHTS,
      applications: mediumSample,
    });

    assert.strictEqual(result.phase, "SUGGESTED");
    assert.strictEqual(result.sampleSize, 12);
    assert.strictEqual(result.hasChanges, true);
    // Domain fit should have drifted upward due to high conversion correlation
    assert.ok(
      result.calibratedWeights.domain > DEFAULT_FIT_SCORE_WEIGHTS.domain,
      `Expected domain weight to increase from ${DEFAULT_FIT_SCORE_WEIGHTS.domain}, got ${result.calibratedWeights.domain}`
    );
    // Weights must strictly validate
    validateWeights(result.calibratedWeights);
  });

  it("computes automated drift during Phase 2 (N >= 25) clamped to max step 0.03", () => {
    // Generate 26 applications
    const largeSample: ApplicationOutcomeRecord[] = [];
    for (let i = 0; i < 13; i++) {
      largeSample.push({
        id: `pos-${i}`,
        status: "INTERVIEW",
        skillsFit: 95,
        experienceFit: 80,
        domainFit: 95,
        trajectoryFit: 70,
      });
      largeSample.push({
        id: `neg-${i}`,
        status: "REJECTED",
        rejectionStage: "RESUME_SCREEN",
        skillsFit: 60,
        experienceFit: 70,
        domainFit: 20,
        trajectoryFit: 40,
      });
    }

    const result = calibrateWeights({
      currentWeights: DEFAULT_FIT_SCORE_WEIGHTS,
      applications: largeSample,
    });

    assert.strictEqual(result.phase, "AUTOMATED");
    assert.strictEqual(result.sampleSize, 26);
    assert.strictEqual(result.hasChanges, true);

    // Max step per dimension must be <= 0.03
    const domainChange = Math.abs(result.calibratedWeights.domain - DEFAULT_FIT_SCORE_WEIGHTS.domain);
    assert.ok(
      domainChange <= 0.0301,
      `Expected domain weight change <= 0.03, got ${domainChange}`
    );

    validateWeights(result.calibratedWeights);
  });

  it("strictly enforces bounds [0.10, 0.50] and sum = 1.0 even with extreme deltas", () => {
    const extremeWeights: FitScoreWeights = {
      skills: 0.49,
      experience: 0.21,
      domain: 0.20,
      trajectory: 0.10,
    };

    const extremeApps: ApplicationOutcomeRecord[] = [
      ...Array(20).fill(null).map((_, i) => ({
        id: `pos-${i}`,
        status: "INTERVIEW",
        skillsFit: 100,
        experienceFit: 20,
        domainFit: 20,
        trajectoryFit: 20,
      })),
      ...Array(10).fill(null).map((_, i) => ({
        id: `neg-${i}`,
        status: "REJECTED",
        rejectionStage: "RESUME_SCREEN",
        skillsFit: 0,
        experienceFit: 80,
        domainFit: 80,
        trajectoryFit: 80,
      })),
    ];

    const result = calibrateWeights({
      currentWeights: extremeWeights,
      applications: extremeApps,
    });

    assert.ok(result.calibratedWeights.skills <= 0.50, "Skills weight must not exceed 0.50");
    assert.ok(result.calibratedWeights.trajectory >= 0.10, "Trajectory weight must not fall below 0.10");
    validateWeights(result.calibratedWeights);
  });

  it("respects user-locked / pinned dimensions during calibration", () => {
    const config: FeedbackLoopConfig = {
      currentWeights: DEFAULT_FIT_SCORE_WEIGHTS,
      applications: sampleApplications,
      locked: {
        domain: true, // User locked domain at 0.20
      },
    };

    const result = calibrateWeights(config);
    assert.strictEqual(result.calibratedWeights.domain, DEFAULT_FIT_SCORE_WEIGHTS.domain);
    validateWeights(result.calibratedWeights);
  });

  it("generates 2-line conversion insights only when sample size >= 15 with statistical clustering", () => {
    // With 12 samples (< 15) -> returns null/empty
    const under15 = generateConversionInsights(sampleApplications);
    assert.strictEqual(under15, "");

    // With 16 samples (10 positive TS/SaaS, 6 negative Embedded) -> returns 2-line block
    const sample16: ApplicationOutcomeRecord[] = [
      ...sampleApplications,
      {
        id: "app-13",
        status: "INTERVIEW",
        skillsFit: 90,
        experienceFit: 80,
        domainFit: 95,
        trajectoryFit: 75,
        title: "Frontend Architect",
        company: "WebTech",
        skills: ["TypeScript", "React"],
      },
      {
        id: "app-14",
        status: "OFFER",
        skillsFit: 92,
        experienceFit: 85,
        domainFit: 90,
        trajectoryFit: 80,
        title: "Senior Fullstack",
        company: "NextGen",
        skills: ["TypeScript", "Node.js"],
      },
      {
        id: "app-15",
        status: "INTERVIEW",
        skillsFit: 89,
        experienceFit: 78,
        domainFit: 88,
        trajectoryFit: 72,
        title: "Cloud Engineer",
        company: "SaaSCloud",
        skills: ["TypeScript", "AWS"],
      },
      {
        id: "app-16",
        status: "INTERVIEW",
        skillsFit: 94,
        experienceFit: 82,
        domainFit: 92,
        trajectoryFit: 78,
        title: "Lead Platform Engineer",
        company: "CoreInfra",
        skills: ["TypeScript", "Distributed Systems"],
      },
    ];

    const insights = generateConversionInsights(sample16);
    assert.ok(insights.length > 0, "Expected non-empty insights");
    assert.ok(insights.includes("CALIBRATED CONVERSION INSIGHTS:"), "Must include header");
    assert.ok(insights.includes("Candidate demonstrates strong market conversion in:"), "Must include positive line");
    assert.ok(insights.includes("Low conversion / recurring resume screen drop-off in:"), "Must include drop-off line");
  });

  it("normalizes and clamps weights accurately via normalizeAndClampWeights helper", () => {
    const raw = {
      skills: 0.60,
      experience: 0.30,
      domain: 0.15,
      trajectory: 0.05,
    };
    const normalized = normalizeAndClampWeights(raw);
    validateWeights(normalized);
    assert.ok(normalized.skills <= 0.50);
    assert.ok(normalized.trajectory >= 0.10);
  });
});
