import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  FitScoreSchema,
  JobDetailsSchema,
  TailoredSummarySchema,
  buildCandidateFactSheet,
  generateStructuredWithFallback,
  scoreJobFit,
  extractJobDetails,
  tailorApplicationSummary,
  parseApiKeys,
  maskKey,
  type CandidateContext,
  type JobContext,
} from "./router";

function createMockModel(params: {
  generateOutput?: Record<string, unknown>;
  shouldThrow?: boolean;
  errorMessage?: string;
  onCall?: (options: Parameters<LanguageModelV2["doGenerate"]>[0]) => void;
}): LanguageModel {
  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "test-mock-provider",
    modelId: "test-mock-model",
    supportedUrls: {},
    async doGenerate(options: Parameters<LanguageModelV2["doGenerate"]>[0]) {
      if (params.onCall) {
        params.onCall(options);
      }
      if (params.shouldThrow) {
        throw new Error(params.errorMessage || "Simulated 429 Rate Limit / Quota Exhaustion");
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(params.generateOutput ?? {}),
          },
        ],
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("Stream not supported in test mock");
    },
  };

  return model;
}

describe("AI Router Schemas", () => {
  describe("FitScoreSchema", () => {
    it("validates a complete and valid fit score", () => {
      const validPayload = {
        score: 92,
        recommendation: "APPLY",
        skillsFit: 95,
        experienceFit: 90,
        domainFit: 85,
        trajectoryFit: 90,
        dimensionRationale: {
          skills: "Strong TypeScript",
          experience: "5+ years matches senior scope",
          domain: "B2B SaaS aligns",
          trajectory: "Natural next level",
        },
        strengths: ["TypeScript", "Next.js", "Domain alignment"],
        gaps: ["No direct Rust experience required by team"],
        risks: ["Fast-paced early startup environment"],
        reasoning: "Candidate matches all primary criteria with high fidelity.",
      };

      const parsed = FitScoreSchema.safeParse(validPayload);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.score, 92);
        assert.strictEqual(parsed.data.recommendation, "APPLY");
        assert.strictEqual(parsed.data.skillsFit, 95);
        assert.strictEqual(parsed.data.experienceFit, 90);
        assert.strictEqual(parsed.data.domainFit, 85);
        assert.strictEqual(parsed.data.trajectoryFit, 90);
        assert.strictEqual(parsed.data.strengths.length, 3);
      }
    });

    it("rejects score outside 0-100 bounds", () => {
      const negativeScore = FitScoreSchema.safeParse({
        score: -5,
        recommendation: "IGNORE",
        skillsFit: 0,
        experienceFit: 0,
        domainFit: 0,
        trajectoryFit: 0,
        strengths: [],
        gaps: [],
        risks: [],
        reasoning: "Negative score invalid",
      });
      assert.strictEqual(negativeScore.success, false);

      const overScore = FitScoreSchema.safeParse({
        score: 105,
        recommendation: "APPLY",
        skillsFit: 100,
        experienceFit: 100,
        domainFit: 100,
        trajectoryFit: 100,
        strengths: [],
        gaps: [],
        risks: [],
        reasoning: "Over 100 invalid",
      });
      assert.strictEqual(overScore.success, false);
    });

    it("rejects invalid recommendation enum values", () => {
      const invalidEnum = FitScoreSchema.safeParse({
        score: 75,
        recommendation: "MAYBE",
        skillsFit: 75,
        experienceFit: 75,
        domainFit: 75,
        trajectoryFit: 75,
        strengths: [],
        gaps: [],
        risks: [],
        reasoning: "Invalid enum",
      });
      assert.strictEqual(invalidEnum.success, false);
    });
  });

  describe("JobDetailsSchema", () => {
    it("validates and defaults job detail values", () => {
      const parsed = JobDetailsSchema.safeParse({
        title: "Staff Software Engineer",
        company: "Stripe",
        description: "Leading distributed payments platform.",
      });

      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.title, "Staff Software Engineer");
        assert.strictEqual(parsed.data.remoteStatus, "UNKNOWN");
        assert.strictEqual(parsed.data.employmentType, "FULL_TIME");
        assert.deepStrictEqual(parsed.data.skills, []);
      }
    });
  });

  describe("TailoredSummarySchema", () => {
    it("validates tailored summary structure", () => {
      const parsed = TailoredSummarySchema.safeParse({
        summary: "Candidate brings 5 years of fullstack TypeScript leadership.",
        matchingPoints: ["Next.js App Router expertise", "Prisma/SQLite local architecture"],
        highlightedProjects: ["Pulse Career Module"],
      });
      assert.strictEqual(parsed.success, true);
    });
  });
});

describe("Candidate Fact Sheet Formatter", () => {
  it("formats candidate facts with arrays, JSON strings, and defaults", () => {
    const candidate: CandidateContext = {
      targetRole: "Senior Backend Engineer",
      yearsOfExperience: 6,
      skills: ["Node.js", "PostgreSQL", "Docker"],
      preferredLocations: JSON.stringify(["San Francisco", "Remote"]),
      remotePreference: "REMOTE_ONLY",
      experiences: JSON.stringify([{ role: "Backend Dev", company: "Acme" }]),
      projects: ["Pulse", "OpenTelemetry collector"],
      resumeText: "Experienced engineer focusing on high throughput distributed systems.",
    };

    const sheet = buildCandidateFactSheet(candidate);
    assert.match(sheet, /Target Role: Senior Backend Engineer/);
    assert.match(sheet, /Years of Experience: 6/);
    assert.match(sheet, /Skills: Node\.js, PostgreSQL, Docker/);
    assert.match(sheet, /Preferred Locations: San Francisco, Remote/);
    assert.match(sheet, /Remote Preference: REMOTE_ONLY/);
  });
});

describe("Provider Fallback & Error Handling", () => {
  it("returns primary provider result when primary succeeds without calling fallback", async () => {
    let primaryCalled = false;
    let fallbackCalled = false;

    const mockPrimary = createMockModel({
      generateOutput: {
        score: 88,
        recommendation: "APPLY",
        skillsFit: 90,
        experienceFit: 85,
        domainFit: 90,
        trajectoryFit: 85,
        strengths: ["Clean Architecture"],
        gaps: [],
        risks: [],
        reasoning: "Excellent match across tech stack",
      },
      onCall: () => {
        primaryCalled = true;
      },
    });

    const mockFallback = createMockModel({
      generateOutput: {
        score: 50,
        recommendation: "IGNORE",
        strengths: [],
        gaps: [],
        risks: [],
        reasoning: "Fallback should not run",
      },
      onCall: () => {
        fallbackCalled = true;
      },
    });

    const result = await generateStructuredWithFallback({
      schema: FitScoreSchema,
      prompt: "Evaluate candidate fit",
      options: {
        primaryModel: mockPrimary,
        fallbackModel: mockFallback,
      },
    });

    assert.strictEqual(primaryCalled, true);
    assert.strictEqual(fallbackCalled, false);
    assert.strictEqual(result.score, 88);
    assert.strictEqual(result.recommendation, "APPLY");
  });

  it("fails over to fallback provider when primary provider encounters an HTTP 429 or quota error", async () => {
    let primaryCalled = false;
    let fallbackCalled = false;

    const mockPrimary = createMockModel({
      shouldThrow: true,
      errorMessage: "HTTP 429 Too Many Requests: OpenRouter free rate limit exceeded",
      onCall: () => {
        primaryCalled = true;
      },
    });

    const mockFallback = createMockModel({
      generateOutput: {
        score: 85,
        recommendation: "APPLY",
        skillsFit: 90,
        experienceFit: 80,
        domainFit: 80,
        trajectoryFit: 90,
        strengths: ["TypeScript", "SQLite"],
        gaps: ["Kubernetes"],
        risks: [],
        reasoning: "Fallback Gemini evaluation succeeded.",
      },
      onCall: () => {
        fallbackCalled = true;
      },
    });

    const result = await generateStructuredWithFallback({
      schema: FitScoreSchema,
      prompt: "Evaluate candidate fit",
      options: {
        primaryModel: mockPrimary,
        fallbackModel: mockFallback,
      },
    });

    assert.strictEqual(primaryCalled, true);
    assert.strictEqual(fallbackCalled, true);
    assert.strictEqual(result.score, 85);
    assert.strictEqual(result.reasoning, "Fallback Gemini evaluation succeeded.");
  });

  it("throws consolidated error when both primary and fallback providers fail", async () => {
    const mockPrimary = createMockModel({
      shouldThrow: true,
      errorMessage: "OpenRouter rate limited",
    });

    const mockFallback = createMockModel({
      shouldThrow: true,
      errorMessage: "Gemini quota exhausted",
    });

    await assert.rejects(
      async () => {
        await generateStructuredWithFallback({
          schema: FitScoreSchema,
          prompt: "Evaluate candidate fit",
          options: {
            primaryModel: mockPrimary,
            fallbackModel: mockFallback,
          },
        });
      },
      (err: Error) => {
        assert.match(err.message, /All AI providers failed/);
        assert.match(err.message, /OpenRouter rate limited/);
        assert.match(err.message, /Gemini quota exhausted/);
        return true;
      }
    );
  });

  it("cascades across 3 models in the pool (e.g. Groq -> Gemini -> OpenRouter) until one succeeds", async () => {
    let groqCalled = false;
    let geminiCalled = false;
    let openRouterCalled = false;

    const mockGroq = createMockModel({
      shouldThrow: true,
      errorMessage: "Groq 429 Rate Limit",
      onCall: () => {
        groqCalled = true;
      },
    });

    const mockGemini = createMockModel({
      shouldThrow: true,
      errorMessage: "Gemini 503 Overloaded",
      onCall: () => {
        geminiCalled = true;
      },
    });

    const mockOpenRouter = createMockModel({
      generateOutput: {
        score: 91,
        recommendation: "APPLY",
        skillsFit: 95,
        experienceFit: 90,
        domainFit: 85,
        trajectoryFit: 90,
        strengths: ["Llama-3.3-70B Match"],
        gaps: [],
        risks: [],
        reasoning: "Third provider in pool succeeded.",
      },
      onCall: () => {
        openRouterCalled = true;
      },
    });

    const result = await generateStructuredWithFallback({
      schema: FitScoreSchema,
      prompt: "Evaluate candidate fit",
      options: {
        models: [mockGroq, mockGemini, mockOpenRouter],
      },
    });

    assert.strictEqual(groqCalled, true);
    assert.strictEqual(geminiCalled, true);
    assert.strictEqual(openRouterCalled, true);
    assert.strictEqual(result.score, 91);
    assert.strictEqual(result.reasoning, "Third provider in pool succeeded.");
  });

  it("parses comma-separated API keys and masks sensitive substrings", () => {
    assert.deepStrictEqual(parseApiKeys(""), []);
    assert.deepStrictEqual(parseApiKeys("   "), []);
    assert.deepStrictEqual(parseApiKeys("key1"), ["key1"]);
    assert.deepStrictEqual(
      parseApiKeys(" gsk_1234567890abcdef , gsk_0987654321fedcba  "),
      ["gsk_1234567890abcdef", "gsk_0987654321fedcba"]
    );

    assert.strictEqual(maskKey(""), "***");
    assert.strictEqual(maskKey("short"), "***");
    assert.strictEqual(maskKey("gsk_1234567890abcdef"), "gsk_...cdef");
  });
});

describe("Structured Domain Functions", () => {
  const candidate: CandidateContext = {
    targetRole: "Fullstack Engineer",
    yearsOfExperience: 4,
    skills: ["TypeScript", "React", "Node.js"],
    remotePreference: "REMOTE_ONLY",
  };

  const job: JobContext = {
    title: "Senior Fullstack Engineer",
    company: "Acme Corp",
    location: "Remote",
    remoteStatus: "REMOTE",
    salaryMin: 120000,
    salaryMax: 150000,
    description: "Looking for an experienced TypeScript and React engineer.",
  };

  it("scoreJobFit produces a validated FitScore output", async () => {
    const mockModel = createMockModel({
      generateOutput: {
        score: 80,
        recommendation: "APPLY",
        skillsFit: 90,
        experienceFit: 85,
        domainFit: 80,
        trajectoryFit: 90,
        dimensionRationale: {
          skills: "Mastery of TS/React",
          experience: "Senior scope",
        },
        strengths: ["TypeScript expertise", "Remote experience"],
        gaps: ["No direct experience with proprietary internal tooling"],
        risks: [],
        reasoning: "Solid match with required frontend and backend technologies.",
      },
    });

    const fitScore = await scoreJobFit(candidate, job, { primaryModel: mockModel });
    // 90*0.35 + 85*0.30 + 80*0.20 + 90*0.15 = 31.5 + 25.5 + 16 + 13.5 = 86.5 -> 87
    assert.strictEqual(fitScore.score, 87);
    assert.strictEqual(fitScore.recommendation, "APPLY");
    assert.strictEqual(fitScore.skillsFit, 90);
    assert.strictEqual(fitScore.experienceFit, 85);
    assert.strictEqual(fitScore.domainFit, 80);
    assert.strictEqual(fitScore.trajectoryFit, 90);
    assert.strictEqual(fitScore.strengths[0], "TypeScript expertise");
  });

  it("scoreJobFit applies calibrated weights and injects conversion insights into prompt", async () => {
    let capturedSystem = "";
    const mockModel = createMockModel({
      generateOutput: {
        score: 75,
        recommendation: "REVIEW",
        skillsFit: 100,
        experienceFit: 80,
        domainFit: 60,
        trajectoryFit: 60,
        strengths: ["Expert skills"],
        gaps: [],
        risks: [],
        reasoning: "Good match",
      },
      onCall: (options) => {
        const sys = options.prompt.find((p) => p.role === "system");
        if (sys && typeof sys.content === "string") {
          capturedSystem = sys.content;
        }
      },
    });

    const customWeights = {
      skills: 0.50,
      experience: 0.20,
      domain: 0.15,
      trajectory: 0.15,
    };
    const conversionInsights = "CALIBRATED CONVERSION INSIGHTS:\n- Candidate demonstrates strong market conversion in: TypeScript.";

    const fitScore = await scoreJobFit(candidate, job, {
      primaryModel: mockModel,
      weights: customWeights,
      conversionInsights,
    });

    // 100*0.50 + 80*0.20 + 60*0.15 + 60*0.15 = 50 + 16 + 9 + 9 = 84
    assert.strictEqual(fitScore.score, 84);
    assert.strictEqual(fitScore.recommendation, "APPLY");
    assert.ok(capturedSystem.includes("CALIBRATED CONVERSION INSIGHTS:"));
    assert.ok(capturedSystem.includes("Candidate demonstrates strong market conversion in: TypeScript."));
  });

  it("extractJobDetails produces structured metadata from unstructured text", async () => {
    const rawText = `
      Staff Systems Engineer at Vercel
      Location: Remote - US
      Salary: $180,000 - $220,000 / year
      We are looking for an infrastructure engineer with 7+ years of experience in distributed systems, Go, and Next.js.
    `;

    const mockModel = createMockModel({
      generateOutput: {
        title: "Staff Systems Engineer",
        company: "Vercel",
        location: "Remote - US",
        remoteStatus: "REMOTE",
        salaryMin: 180000,
        salaryMax: 220000,
        employmentType: "FULL_TIME",
        description: rawText.trim(),
        requiredExperienceYears: 7,
        skills: ["Go", "Next.js", "Distributed Systems"],
      },
    });

    const details = await extractJobDetails(rawText, { primaryModel: mockModel });
    assert.strictEqual(details.title, "Staff Systems Engineer");
    assert.strictEqual(details.company, "Vercel");
    assert.strictEqual(details.remoteStatus, "REMOTE");
    assert.strictEqual(details.salaryMin, 180000);
    assert.strictEqual(details.requiredExperienceYears, 7);
  });

  it("extractJobDetails isolates base cash salary from ranges with en-dashes and equity clauses", async () => {
    const rawText = `
      Frontend Engineer at StartUpX
      Location: Remote
      Compensation: $20k – $30k • No equity
      We are hiring a Frontend Engineer with React and TypeScript skills.
    `;

    const mockModel = createMockModel({
      generateOutput: {
        title: "Frontend Engineer",
        company: "StartUpX",
        location: "Remote",
        remoteStatus: "REMOTE",
        salaryMin: 20000,
        salaryMax: 30000,
        currency: "USD",
        employmentType: "FULL_TIME",
        description: rawText.trim(),
        requiredExperienceYears: 2,
        skills: ["React", "TypeScript"],
      },
    });

    const details = await extractJobDetails(rawText, { primaryModel: mockModel });
    assert.strictEqual(details.title, "Frontend Engineer");
    assert.strictEqual(details.company, "StartUpX");
    assert.strictEqual(details.salaryMin, 20000);
    assert.strictEqual(details.salaryMax, 30000);
    assert.strictEqual(details.currency, "USD");
  });

  it("extractJobDetails correctly maps ₹ rupee symbol and Lakhs to INR full integers", async () => {
    const rawText = `
      Senior Fullstack Developer at Swiggy
      Location: Bengaluru, India
      Compensation: ₹12L – ₹35L • No equity
      Looking for experienced React / Node engineer.
    `;

    const mockModel = createMockModel({
      generateOutput: {
        title: "Senior Fullstack Developer",
        company: "Swiggy",
        location: "Bengaluru, India",
        remoteStatus: "HYBRID",
        salaryMin: 1200000,
        salaryMax: 3500000,
        currency: "INR",
        employmentType: "FULL_TIME",
        description: rawText.trim(),
        requiredExperienceYears: 4,
        skills: ["React", "Node.js"],
      },
    });

    const details = await extractJobDetails(rawText, { primaryModel: mockModel });
    assert.strictEqual(details.title, "Senior Fullstack Developer");
    assert.strictEqual(details.company, "Swiggy");
    assert.strictEqual(details.salaryMin, 1200000);
    assert.strictEqual(details.salaryMax, 3500000);
    assert.strictEqual(details.currency, "INR");
  });

  it("tailorApplicationSummary generates factual summary and match points", async () => {
    const mockModel = createMockModel({
      generateOutput: {
        summary: "4 years building robust React and TypeScript systems.",
        matchingPoints: ["Deep React knowledge", "Async Node.js services"],
        highlightedProjects: ["Enterprise Dashboard"],
      },
    });

    const result = await tailorApplicationSummary(candidate, job, { primaryModel: mockModel });
    assert.strictEqual(result.summary, "4 years building robust React and TypeScript systems.");
    assert.strictEqual(result.matchingPoints.length, 2);
  });
});
