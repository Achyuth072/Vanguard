import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  ApplicationAnswerSchema,
  ApplicationAnswersBatchSchema,
} from "../../types/tailoring";
import {
  generateApplicationAnswers,
  answerCustomQuestion,
  STANDARD_APPLICATION_QUESTIONS,
} from "./answers";
import {
  type CandidateContext,
  type JobContext,
  generateApplicationAnswers as generateAnswersFromRouter,
  answerCustomQuestion as answerQuestionFromRouter,
  ApplicationAnswerSchema as ApplicationAnswerSchemaFromRouter,
  STANDARD_APPLICATION_QUESTIONS as STANDARD_QUESTIONS_FROM_ROUTER,
} from "../ai/router";

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
        throw new Error(params.errorMessage || "Simulated Provider Error");
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

describe("Application Answer Schemas", () => {
  describe("ApplicationAnswerSchema", () => {
    it("validates a structured application answer", () => {
      const valid = {
        id: "ans-1",
        question: "Why are you interested in this role and company?",
        answer:
          "I am excited by your mission to build high-performance developer infrastructure using Next.js and TypeScript.",
        keyPointsUsed: ["TypeScript expertise", "Pulse Career Module architecture"],
        createdAt: "2026-08-17T12:00:00.000Z",
      };

      const parsed = ApplicationAnswerSchema.safeParse(valid);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.id, "ans-1");
        assert.strictEqual(parsed.data.keyPointsUsed.length, 2);
      }
    });

    it("rejects answer missing required fields", () => {
      const invalid = {
        id: "ans-1",
        // missing question and answer
        keyPointsUsed: [],
        createdAt: "2026-08-17T12:00:00.000Z",
      };
      const parsed = ApplicationAnswerSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
    });
  });

  describe("ApplicationAnswersBatchSchema", () => {
    it("validates batch answers schema", () => {
      const validBatch = {
        answers: [
          {
            id: "ans-1",
            question: "Question 1",
            answer: "Answer 1",
            keyPointsUsed: ["Point 1"],
            createdAt: "2026-08-17T12:00:00.000Z",
          },
          {
            id: "ans-2",
            question: "Question 2",
            answer: "Answer 2",
            keyPointsUsed: ["Point 2"],
            createdAt: "2026-08-17T12:00:00.000Z",
          },
        ],
      };

      const parsed = ApplicationAnswersBatchSchema.safeParse(validBatch);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.answers.length, 2);
      }
    });

    it("rejects invalid batch structure", () => {
      const invalidBatch = {
        answers: "not-an-array",
      };
      const parsed = ApplicationAnswersBatchSchema.safeParse(invalidBatch);
      assert.strictEqual(parsed.success, false);
    });
  });
});

describe("Grounded Application Question Answering Engine", () => {
  const sampleCandidate: CandidateContext = {
    name: "Alex Rivera",
    targetRole: "Senior Fullstack Engineer",
    yearsOfExperience: 6,
    minSalary: 140000,
    remotePreference: "REMOTE_ONLY",
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma"],
    projects: [
      {
        id: "pulse-career",
        title: "Pulse Career Module",
        technologies: ["TypeScript", "Next.js", "SQLite", "Prisma"],
        highlights: ["Designed provider-agnostic AI failover router"],
        metrics: ["100% offline-first", "0ms local query latency"],
        description: "Local-first job search aggregator.",
      },
    ],
    experiences: [
      {
        id: "exp-1",
        company: "Stripe",
        title: "Software Engineer",
        highlights: ["Built developer dashboard using Next.js and TypeScript"],
      },
    ],
    resumeText:
      "Alex Rivera - Senior Fullstack Engineer. Target role: Senior Fullstack Engineer. US Citizen, open to remote roles.",
  };

  const sampleJob: JobContext = {
    title: "Senior Full Stack Engineer",
    company: "Vercel",
    location: "Remote",
    remoteStatus: "REMOTE",
    description: "Looking for an expert TypeScript and Next.js engineer to build developer tooling.",
  };

  it("generates answers for standard preset questions when questions array is omitted", async () => {
    let capturedPrompt = "";
    let capturedSystem = "";

    const mockAnswers = [
      {
        id: "ans-standard-1",
        question: STANDARD_APPLICATION_QUESTIONS[0],
        answer:
          "I want to join Vercel because of my deep focus on Next.js and high-performance developer tooling as demonstrated in my work at Stripe and Pulse Career Module.",
        keyPointsUsed: ["Next.js expertise", "Stripe experience", "Pulse Career Module"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
      {
        id: "ans-standard-2",
        question: STANDARD_APPLICATION_QUESTIONS[1],
        answer:
          "In the Pulse Career Module project, I engineered a provider-agnostic AI router with offline-first SQLite persistence.",
        keyPointsUsed: ["Pulse Career Module", "TypeScript", "Next.js"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
      {
        id: "ans-standard-3",
        question: STANDARD_APPLICATION_QUESTIONS[2],
        answer:
          "My base compensation target is $140k+ for full-time remote roles, with standard 2-week notice availability and authorized US work status.",
        keyPointsUsed: ["$140k target salary", "REMOTE_ONLY preference", "US Citizen"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
    ];

    const mockModel = createMockModel({
      generateOutput: { answers: mockAnswers },
      onCall: (options) => {
        capturedPrompt = JSON.stringify(options.prompt);
        if (options.prompt && Array.isArray(options.prompt)) {
          const sysMsg = options.prompt.find((p) => p.role === "system");
          if (sysMsg && typeof sysMsg.content === "string") {
            capturedSystem = sysMsg.content;
          }
        }
      },
    });

    const results = await generateApplicationAnswers(sampleCandidate, sampleJob, undefined, {
      primaryModel: mockModel,
    });

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].question, STANDARD_APPLICATION_QUESTIONS[0]);
    assert.strictEqual(results[1].question, STANDARD_APPLICATION_QUESTIONS[1]);
    assert.strictEqual(results[2].question, STANDARD_APPLICATION_QUESTIONS[2]);
    assert.deepStrictEqual(results[0].keyPointsUsed, [
      "Next.js expertise",
      "Stripe experience",
      "Pulse Career Module",
    ]);

    // Verify anti-hallucination constraints, voice guidelines, and prompt details
    assert.ok(capturedSystem.includes("CRITICAL ANTI-HALLUCINATION INVARIANTS"));
    assert.ok(capturedSystem.includes("Ground all answers STRICTLY and EXCLUSIVELY in the provided candidate facts"));
    assert.ok(capturedSystem.includes("VOICE, TONE & STYLE GUIDELINES"));
    assert.ok(capturedSystem.includes("PRACTITIONER PERSONA"));
    assert.ok(capturedSystem.includes("BANNED AI CLICHÉS & BUZZWORDS"));
    assert.ok(capturedSystem.includes("RHYTHMIC VARIANCE & BURSTINESS"));
    assert.ok(capturedPrompt.includes("Alex Rivera"));
    assert.ok(capturedPrompt.includes("Vercel"));
    assert.ok(capturedPrompt.includes(STANDARD_APPLICATION_QUESTIONS[0]));
  });

  it("generates answers for custom requested questions", async () => {
    const customQuestions = [
      "How do you approach database schema migrations in production?",
    ];

    const mockAnswers = [
      {
        id: "ans-custom-1",
        question: customQuestions[0],
        answer:
          "I approach schema migrations iteratively using Prisma and SQLite/PostgreSQL with backward-compatible additive changes.",
        keyPointsUsed: ["Prisma", "PostgreSQL", "SQLite"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
    ];

    const mockModel = createMockModel({
      generateOutput: { answers: mockAnswers },
    });

    const results = await generateApplicationAnswers(sampleCandidate, sampleJob, customQuestions, {
      primaryModel: mockModel,
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].question, customQuestions[0]);
    assert.strictEqual(results[0].answer, mockAnswers[0].answer);
  });

  it("answers single custom portal question via answerCustomQuestion", async () => {
    let capturedPrompt = "";
    let capturedSystem = "";

    const singleAnswer = {
      id: "ans-single-1",
      question: "Describe your experience with Next.js App Router.",
      answer:
        "I have extensive experience building applications with Next.js App Router, including developer tooling and local-first architecture in the Pulse Career Module.",
      keyPointsUsed: ["Next.js", "Pulse Career Module"],
      createdAt: "2026-08-17T12:00:00.000Z",
    };

    const mockModel = createMockModel({
      generateOutput: singleAnswer,
      onCall: (options) => {
        capturedPrompt = JSON.stringify(options.prompt);
        if (options.prompt && Array.isArray(options.prompt)) {
          const sysMsg = options.prompt.find((p) => p.role === "system");
          if (sysMsg && typeof sysMsg.content === "string") {
            capturedSystem = sysMsg.content;
          }
        }
      },
    });

    const result = await answerCustomQuestion(
      sampleCandidate,
      sampleJob,
      "Describe your experience with Next.js App Router.",
      { primaryModel: mockModel }
    );

    assert.strictEqual(result.id, "ans-single-1");
    assert.strictEqual(result.question, "Describe your experience with Next.js App Router.");
    assert.strictEqual(result.answer, singleAnswer.answer);
    assert.ok(capturedPrompt.includes("Describe your experience with Next.js App Router."));
    assert.ok(capturedSystem.includes("VOICE, TONE & STYLE GUIDELINES"));
    assert.ok(capturedSystem.includes("BANNED AI CLICHÉS & BUZZWORDS"));
    assert.ok(capturedSystem.includes("CRITICAL ANTI-HALLUCINATION INVARIANTS"));
  });

  it("fails over to Gemini fallback when primary provider throws error", async () => {
    let primaryCalled = false;
    let fallbackCalled = false;

    const mockPrimary = createMockModel({
      shouldThrow: true,
      errorMessage: "OpenRouter rate limited (429)",
      onCall: () => {
        primaryCalled = true;
      },
    });

    const fallbackBatch = {
      answers: [
        {
          id: "ans-fb-1",
          question: STANDARD_APPLICATION_QUESTIONS[0],
          answer: "Fallback answer from Gemini 2.0 Flash.",
          keyPointsUsed: ["Candidate facts"],
          createdAt: "2026-08-17T12:00:00.000Z",
        },
      ],
    };

    const mockFallback = createMockModel({
      generateOutput: fallbackBatch,
      onCall: () => {
        fallbackCalled = true;
      },
    });

    const results = await generateApplicationAnswers(sampleCandidate, sampleJob, undefined, {
      primaryModel: mockPrimary,
      fallbackModel: mockFallback,
    });

    assert.strictEqual(primaryCalled, true);
    assert.strictEqual(fallbackCalled, true);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].answer, "Fallback answer from Gemini 2.0 Flash.");
  });

  it("exports answer functions, standard questions, and schemas correctly from router.ts", async () => {
    assert.strictEqual(typeof generateAnswersFromRouter, "function");
    assert.strictEqual(typeof answerQuestionFromRouter, "function");
    assert.strictEqual(typeof ApplicationAnswerSchemaFromRouter.parse, "function");
    assert.strictEqual(STANDARD_QUESTIONS_FROM_ROUTER.length, 3);

    const mockAnswer = {
      id: "ans-router-test",
      question: "Test question",
      answer: "Test answer from router export",
      keyPointsUsed: ["Test point"],
      createdAt: "2026-08-17T12:00:00.000Z",
    };

    const result = await answerQuestionFromRouter(sampleCandidate, sampleJob, "Test question", {
      primaryModel: createMockModel({ generateOutput: mockAnswer }),
    });

    assert.strictEqual(result.id, "ans-router-test");
    assert.strictEqual(result.answer, "Test answer from router export");
  });
});
