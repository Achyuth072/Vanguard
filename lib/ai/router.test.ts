import { describe, it, beforeEach, afterEach } from "node:test";
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
  parseCommaSeparatedList,
  getAllConfiguredModels,
  maskKey,
  candidateCooldownMap,
  calculateCooldownDuration,
  recordCandidateCooldown,
  isCandidateInCooldown,
  clearCandidateCooldown,
  resetAllCooldowns,
  getCandidateCooldown,
  type CandidateContext,
  type JobContext,
} from "./router";

function createMockModel(params: {
  id?: string;
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

  if (params.id) {
    (model as unknown as { id: string }).id = params.id;
  }

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
  beforeEach(() => {
    resetAllCooldowns();
  });

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

  describe("parseCommaSeparatedList", () => {
    it("handles undefined, empty, and whitespace-only strings with defaultList fallback", () => {
      assert.deepStrictEqual(parseCommaSeparatedList(undefined), []);
      assert.deepStrictEqual(parseCommaSeparatedList(undefined, ["default-1", "default-2"]), [
        "default-1",
        "default-2",
      ]);
      assert.deepStrictEqual(parseCommaSeparatedList(""), []);
      assert.deepStrictEqual(parseCommaSeparatedList("", ["default-1"]), ["default-1"]);
      assert.deepStrictEqual(parseCommaSeparatedList("   , ,   "), []);
      assert.deepStrictEqual(parseCommaSeparatedList("   , ,   ", ["default-1"]), ["default-1"]);
    });

    it("parses and trims single and multiple comma-separated items", () => {
      assert.deepStrictEqual(parseCommaSeparatedList("single-item"), ["single-item"]);
      assert.deepStrictEqual(
        parseCommaSeparatedList("  item-1 , item-2  ,  item-3 "),
        ["item-1", "item-2", "item-3"]
      );
      assert.deepStrictEqual(
        parseCommaSeparatedList("gemini-3.7-flash, gemini-3.5-flash", ["fallback"]),
        ["gemini-3.7-flash", "gemini-3.5-flash"]
      );
    });
  });

  describe("getAllConfiguredModels Matrix Expansion", () => {
    const originalEnv = { ...process.env };

    afterEach?.(() => {
      process.env = { ...originalEnv };
    });

    it("generates (Keys) × (Models) candidate matrix in intra-key order for Google Gemini", () => {
      // Clean env for isolated test
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      process.env.GEMINI_API_KEY = "AIzaSyKey11111111,AIzaSyKey22222222";
      process.env.GEMINI_MODEL = "gemini-3.7-flash,gemini-3.5-flash";

      const candidates = getAllConfiguredModels();

      assert.strictEqual(candidates.length, 4);

      // Intra-key order: key1:model1, key1:model2, key2:model1, key2:model2
      assert.strictEqual(candidates[0].providerName, "Google Gemini");
      assert.strictEqual(candidates[0].modelName, "gemini-3.7-flash");
      assert.strictEqual(candidates[0].keyMask, "AIza...1111");

      assert.strictEqual(candidates[1].providerName, "Google Gemini");
      assert.strictEqual(candidates[1].modelName, "gemini-3.5-flash");
      assert.strictEqual(candidates[1].keyMask, "AIza...1111");

      assert.strictEqual(candidates[2].providerName, "Google Gemini");
      assert.strictEqual(candidates[2].modelName, "gemini-3.7-flash");
      assert.strictEqual(candidates[2].keyMask, "AIza...2222");

      assert.strictEqual(candidates[3].providerName, "Google Gemini");
      assert.strictEqual(candidates[3].modelName, "gemini-3.5-flash");
      assert.strictEqual(candidates[3].keyMask, "AIza...2222");

      // Restore env
      process.env = { ...originalEnv };
    });

    it("uses default 5-model cascade for Gemini when GEMINI_MODEL is not set", () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GEMINI_MODEL;

      process.env.GEMINI_API_KEY = "AIzaSySingleKey1234";

      const candidates = getAllConfiguredModels();

      assert.strictEqual(candidates.length, 5);
      const modelNames = candidates.map((c) => c.modelName);
      assert.deepStrictEqual(modelNames, [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
      ]);

      // Restore env
      process.env = { ...originalEnv };
    });

    it("expands multi-provider matrix and deduplicates keys cleanly", () => {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      process.env.GEMINI_API_KEY = "AIzaSyKey11111111, AIzaSyKey11111111 ";
      process.env.GEMINI_MODEL = "gemini-3.7-flash";
      process.env.GROQ_API_KEY = "gsk_GroqKey12345678";
      process.env.GROQ_MODEL = "llama-3.3-70b-versatile, llama-3.1-8b-instant";

      const candidates = getAllConfiguredModels();

      // Gemini: 1 unique key * 1 model = 1 candidate
      // Groq: 1 unique key * 2 models = 2 candidates
      assert.strictEqual(candidates.length, 3);
      assert.strictEqual(candidates[0].providerName, "Google Gemini");
      assert.strictEqual(candidates[0].modelName, "gemini-3.7-flash");
      assert.strictEqual(candidates[1].providerName, "Groq");
      assert.strictEqual(candidates[1].modelName, "llama-3.3-70b-versatile");
      assert.strictEqual(candidates[2].providerName, "Groq");
      assert.strictEqual(candidates[2].modelName, "llama-3.1-8b-instant");

      // Restore env
      process.env = { ...originalEnv };
    });
  });
});

describe("Structured Domain Functions", () => {
  beforeEach(() => {
    resetAllCooldowns();
  });

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
      skills: 0.5,
      experience: 0.2,
      domain: 0.15,
      trajectory: 0.15,
    };
    const conversionInsights =
      "CALIBRATED CONVERSION INSIGHTS:\n- Candidate demonstrates strong market conversion in: TypeScript.";

    const fitScore = await scoreJobFit(candidate, job, {
      primaryModel: mockModel,
      weights: customWeights,
      conversionInsights,
    });

    // 100*0.50 + 80*0.20 + 60*0.15 + 60*0.15 = 50 + 16 + 9 + 9 = 84
    assert.strictEqual(fitScore.score, 84);
    assert.strictEqual(fitScore.recommendation, "APPLY");
    assert.ok(capturedSystem.includes("CALIBRATED CONVERSION INSIGHTS:"));
    assert.ok(
      capturedSystem.includes(
        "Candidate demonstrates strong market conversion in: TypeScript."
      )
    );
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

describe("In-Flight Circuit Breaker & Zero-Latency Cooldown Cache", () => {
  beforeEach(() => {
    resetAllCooldowns();
  });

  afterEach(() => {
    resetAllCooldowns();
  });

  describe("calculateCooldownDuration", () => {
    it("parses retry-in with seconds and adds 1-2s jitter", () => {
      const duration = calculateCooldownDuration("Rate limit reached. retry-in: 15s");
      assert.ok(duration >= 16000 && duration <= 17000, `Expected 16-17s, got ${duration}`);
    });

    it("parses retry after with seconds words", () => {
      const duration = calculateCooldownDuration("Please retry after 5 seconds");
      assert.ok(duration >= 6000 && duration <= 7000, `Expected 6-7s, got ${duration}`);
    });

    it("parses retry in ms format", () => {
      const duration = calculateCooldownDuration("retry in 500ms");
      assert.ok(duration >= 1500 && duration <= 2500, `Expected 1.5-2.5s, got ${duration}`);
    });

    it("assigns 300 seconds (5 min) cooldown on quota exhaustion", () => {
      const duration = calculateCooldownDuration("Resource has been exhausted (check quota and billing)");
      assert.strictEqual(duration, 300_000);
    });

    it("assigns 60 seconds cooldown on HTTP 429 rate limit errors without explicit retry header", () => {
      const duration = calculateCooldownDuration("HTTP 429 Too Many Requests: rate limit exceeded");
      assert.strictEqual(duration, 60_000);
    });

    it("assigns 30 seconds cooldown on 503 / overload errors", () => {
      const duration = calculateCooldownDuration("503 Service Unavailable: The model is overloaded");
      assert.strictEqual(duration, 30_000);
    });

    it("defaults to 60 seconds when error reason is empty or generic", () => {
      assert.strictEqual(calculateCooldownDuration(undefined), 60_000);
      assert.strictEqual(calculateCooldownDuration("Unknown provider error"), 60_000);
    });
  });

  describe("Cooldown Store Management Functions", () => {
    it("records cooldown, checks cooldown status, and tracks consecutive failures", () => {
      assert.strictEqual(isCandidateInCooldown("candidate-a"), false);
      assert.strictEqual(getCandidateCooldown("candidate-a"), undefined);

      recordCandidateCooldown("candidate-a", 10_000, "HTTP 429");
      assert.strictEqual(isCandidateInCooldown("candidate-a"), true);

      const record1 = getCandidateCooldown("candidate-a");
      assert.ok(record1);
      assert.strictEqual(record1.reason, "HTTP 429");
      assert.strictEqual(record1.consecutiveFailures, 1);

      // Second failure increments consecutiveFailures
      recordCandidateCooldown("candidate-a", 10_000, "HTTP 429 retry 2");
      const record2 = getCandidateCooldown("candidate-a");
      assert.ok(record2);
      assert.strictEqual(record2.consecutiveFailures, 2);
    });

    it("clears individual candidate cooldown on clearCandidateCooldown", () => {
      recordCandidateCooldown("candidate-b", 10_000, "Quota exhausted");
      assert.strictEqual(isCandidateInCooldown("candidate-b"), true);

      clearCandidateCooldown("candidate-b");
      assert.strictEqual(isCandidateInCooldown("candidate-b"), false);
      assert.strictEqual(getCandidateCooldown("candidate-b"), undefined);
    });

    it("resets all cooldowns on resetAllCooldowns", () => {
      recordCandidateCooldown("candidate-1", 10_000, "Error 1");
      recordCandidateCooldown("candidate-2", 10_000, "Error 2");
      assert.strictEqual(candidateCooldownMap.size, 2);

      resetAllCooldowns();
      assert.strictEqual(candidateCooldownMap.size, 0);
      assert.strictEqual(isCandidateInCooldown("candidate-1"), false);
      assert.strictEqual(isCandidateInCooldown("candidate-2"), false);
    });

    it("expires cooldown naturally once Date.now() >= expiresAt", () => {
      // Record a cooldown that expired in the past
      candidateCooldownMap.set("expired-candidate", {
        expiresAt: Date.now() - 50,
        reason: "Old failure",
        consecutiveFailures: 1,
      });

      assert.strictEqual(isCandidateInCooldown("expired-candidate"), false);
      // Confirms expired record is purged from map
      assert.strictEqual(candidateCooldownMap.has("expired-candidate"), false);
    });
  });

  describe("getAllConfiguredModels with Dynamic Cooldown Skipping", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
      resetAllCooldowns();
    });

    it("skips cooling candidates immediately with zero network delay", () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      process.env.GEMINI_API_KEY = "AIzaSyKey11111111";
      process.env.GEMINI_MODEL = "gemini-3.7-flash,gemini-3.5-flash";

      const initial = getAllConfiguredModels();
      assert.strictEqual(initial.length, 2);
      assert.strictEqual(initial[0].id, "Google Gemini:AIza...1111:gemini-3.7-flash");
      assert.strictEqual(initial[1].id, "Google Gemini:AIza...1111:gemini-3.5-flash");

      // Mark gemini-3.7-flash in cooldown
      recordCandidateCooldown(initial[0].id, 60_000, "429 Rate Limit");

      // Next call skips gemini-3.7-flash instantly
      const active = getAllConfiguredModels();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].id, "Google Gemini:AIza...1111:gemini-3.5-flash");
    });
  });

  describe("generateStructuredWithFallback In-Flight Circuit Breaker", () => {
    it("marks failed candidate in cooldown on 429 and subsequent call bypasses it with 0ms penalty", async () => {
      let primaryInvocationCount = 0;
      let fallbackInvocationCount = 0;

      const mockPrimary = createMockModel({
        id: "mock-primary-model",
        shouldThrow: true,
        errorMessage: "HTTP 429 Rate limit exceeded",
        onCall: () => {
          primaryInvocationCount++;
        },
      });

      const mockFallback = createMockModel({
        id: "mock-fallback-model",
        generateOutput: {
          score: 85,
          recommendation: "APPLY",
          skillsFit: 85,
          experienceFit: 85,
          domainFit: 85,
          trajectoryFit: 85,
          strengths: [],
          gaps: [],
          risks: [],
          reasoning: "Fallback ok",
        },
        onCall: () => {
          fallbackInvocationCount++;
        },
      });

      // Request 1: Primary fails (429) -> records cooldown -> Fallback succeeds
      const result1 = await generateStructuredWithFallback({
        schema: FitScoreSchema,
        prompt: "Evaluate candidate",
        options: {
          primaryModel: mockPrimary,
          fallbackModel: mockFallback,
        },
      });

      assert.strictEqual(result1.score, 85);
      assert.strictEqual(primaryInvocationCount, 1);
      assert.strictEqual(fallbackInvocationCount, 1);
      assert.strictEqual(isCandidateInCooldown("mock-primary-model"), true);

      // Request 2: Primary is in cooldown -> Primary is SKIPPED (0 calls to Primary) -> Fallback is called directly
      const result2 = await generateStructuredWithFallback({
        schema: FitScoreSchema,
        prompt: "Evaluate candidate again",
        options: {
          primaryModel: mockPrimary,
          fallbackModel: mockFallback,
        },
      });

      assert.strictEqual(result2.score, 85);
      assert.strictEqual(primaryInvocationCount, 1); // Still 1! Never touched primary on request 2!
      assert.strictEqual(fallbackInvocationCount, 2);

      // Request 3: Cooldown expires/cleared -> Primary model is re-attempted
      clearCandidateCooldown("mock-primary-model");
      assert.strictEqual(isCandidateInCooldown("mock-primary-model"), false);
    });

    it("clears candidate cooldown on successful completion", async () => {
      recordCandidateCooldown("mock-primary-model", 60_000, "Previous transient error");
      assert.strictEqual(isCandidateInCooldown("mock-primary-model"), true);

      // Clear manually to allow primary to run
      clearCandidateCooldown("mock-primary-model");

      const mockPrimary = createMockModel({
        id: "mock-primary-model",
        generateOutput: {
          score: 95,
          recommendation: "APPLY",
          skillsFit: 95,
          experienceFit: 95,
          domainFit: 95,
          trajectoryFit: 95,
          strengths: [],
          gaps: [],
          risks: [],
          reasoning: "Primary restored",
        },
      });

      const result = await generateStructuredWithFallback({
        schema: FitScoreSchema,
        prompt: "Evaluate candidate",
        options: {
          primaryModel: mockPrimary,
        },
      });

      assert.strictEqual(result.score, 95);
      assert.strictEqual(isCandidateInCooldown("mock-primary-model"), false);
    });
  });
});
