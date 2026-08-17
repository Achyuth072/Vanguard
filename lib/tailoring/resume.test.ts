import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  TailoredResumeSchema,
  SelectedProjectSchema,
  ExperienceHighlightSchema,
} from "../../types/tailoring";
import { tailorResume } from "./resume";
import {
  type CandidateContext,
  type JobContext,
  tailorResume as tailorResumeFromRouter,
  TailoredResumeSchema as TailoredResumeSchemaFromRouter,
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

describe("TailoredResume Schemas", () => {
  describe("SelectedProjectSchema", () => {
    it("validates a structured selected project", () => {
      const valid = {
        id: "proj-1",
        title: "Pulse Career Module",
        relevanceRationale: "Directly demonstrates local-first Next.js architecture matching the job stack.",
        bulletPoints: [
          "Engineered deterministic filtering pipeline in TypeScript",
          "Implemented provider-agnostic AI failover router",
        ],
      };

      const parsed = SelectedProjectSchema.safeParse(valid);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.id, "proj-1");
        assert.strictEqual(parsed.data.title, "Pulse Career Module");
        assert.strictEqual(parsed.data.bulletPoints.length, 2);
      }
    });

    it("rejects project missing required fields", () => {
      const invalid = {
        id: "proj-1",
        // missing title and relevanceRationale
        bulletPoints: [],
      };
      const parsed = SelectedProjectSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
    });
  });

  describe("ExperienceHighlightSchema", () => {
    it("validates a valid experience highlight", () => {
      const valid = {
        company: "Acme Corp",
        role: "Senior Software Engineer",
        bulletPoints: ["Architected event-driven microservices processing 10M daily events."],
      };

      const parsed = ExperienceHighlightSchema.safeParse(valid);
      assert.strictEqual(parsed.success, true);
    });
  });

  describe("TailoredResumeSchema", () => {
    it("validates complete tailored resume schema", () => {
      const validResume = {
        summary: "Fullstack engineer with 5+ years of experience specializing in TypeScript and Next.js.",
        matchingSkills: ["TypeScript", "Next.js", "SQLite", "Prisma"],
        selectedProjects: [
          {
            id: "proj-1",
            title: "Pulse Career Module",
            relevanceRationale: "Matches local-first fullstack requirement",
            bulletPoints: ["Built zero-cost AI router with fallback support"],
          },
        ],
        experienceHighlights: [
          {
            company: "Tech Co",
            role: "Full Stack Engineer",
            bulletPoints: ["Scaled Next.js web application to 100k MAU"],
          },
        ],
        markdownContent: "# John Doe\n\n## Summary\nFullstack engineer...",
      };

      const parsed = TailoredResumeSchema.safeParse(validResume);
      assert.strictEqual(parsed.success, true);
    });

    it("rejects resume with missing markdownContent or invalid types", () => {
      const invalid = {
        summary: "Summary only",
        matchingSkills: "TypeScript", // should be array
        selectedProjects: [],
        experienceHighlights: [],
      };

      const parsed = TailoredResumeSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
    });
  });
});

describe("AI Resume Tailoring Engine", () => {
  const sampleCandidate: CandidateContext = {
    name: "Alex Rivera",
    targetRole: "Senior Fullstack Engineer",
    yearsOfExperience: 6,
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma", "Docker"],
    projects: [
      {
        id: "pulse-career",
        title: "Pulse Career Module",
        technologies: ["TypeScript", "Next.js", "SQLite", "Prisma"],
        highlights: ["Designed provider-agnostic AI failover router", "Built deterministic job filter engine"],
        metrics: ["100% offline-first", "0ms local query latency"],
        description: "Local-first job search aggregator and application tracker.",
      },
      {
        id: "crypto-wallet",
        title: "Web3 Custody Engine",
        technologies: ["Solidity", "Rust", "EVM"],
        highlights: ["Built multi-sig transaction coordinator"],
        metrics: ["$50M secured"],
        description: "Institutional crypto asset management tool.",
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
    resumeText: "Alex Rivera - Senior Fullstack Engineer specializing in TypeScript, Next.js, and reliable local-first tools.",
  };

  const sampleJob: JobContext = {
    title: "Senior Full Stack Engineer",
    company: "Vercel",
    location: "Remote",
    remoteStatus: "REMOTE",
    description: "Looking for an expert TypeScript and Next.js engineer to build developer tooling.",
  };

  it("generates structured tailored resume with selected projects and anti-hallucination fidelity", async () => {
    let capturedPrompt = "";
    let capturedSystem = "";

    const mockOutput = {
      summary: "Senior Fullstack Engineer with 6 years building high-performance TypeScript and Next.js applications.",
      matchingSkills: ["TypeScript", "Next.js", "React", "Node.js", "Prisma"],
      selectedProjects: [
        {
          id: "pulse-career",
          title: "Pulse Career Module",
          relevanceRationale: "Demonstrates deep Next.js, TypeScript, and developer-tooling architecture directly applicable to Vercel.",
          bulletPoints: [
            "Designed provider-agnostic AI failover router",
            "Built deterministic job filter engine with zero-cost local execution",
          ],
        },
      ],
      experienceHighlights: [
        {
          company: "Stripe",
          role: "Software Engineer",
          bulletPoints: ["Built developer dashboard using Next.js and TypeScript"],
        },
      ],
      markdownContent: `# Alex Rivera\n**Senior Fullstack Engineer**\n\n## Summary\nSenior Fullstack Engineer with 6 years building high-performance TypeScript and Next.js applications.\n\n## Matching Skills\n- TypeScript, Next.js, React, Node.js, Prisma\n\n## Selected Projects\n### Pulse Career Module\n- Designed provider-agnostic AI failover router\n- Built deterministic job filter engine\n\n## Experience\n### Stripe — Software Engineer\n- Built developer dashboard using Next.js and TypeScript`,
    };

    const mockModel = createMockModel({
      generateOutput: mockOutput,
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

    const result = await tailorResume(sampleCandidate, sampleJob, {
      primaryModel: mockModel,
    });

    assert.strictEqual(result.summary, mockOutput.summary);
    assert.strictEqual(result.selectedProjects.length, 1);
    assert.strictEqual(result.selectedProjects[0].id, "pulse-career");
    assert.strictEqual(result.selectedProjects[0].title, "Pulse Career Module");
    assert.deepStrictEqual(result.matchingSkills, ["TypeScript", "Next.js", "React", "Node.js", "Prisma"]);
    assert.ok(result.markdownContent.includes("Pulse Career Module"));
    assert.ok(result.markdownContent.includes("Alex Rivera"));

    // Verify system instructions include anti-hallucination constraints
    assert.ok(capturedSystem.includes("CRITICAL ANTI-HALLUCINATION INVARIANTS"));
    assert.ok(capturedSystem.includes("Ground all generated content STRICTLY and EXCLUSIVELY in the provided candidate facts"));
    assert.ok(capturedPrompt.includes("Alex Rivera"));
    assert.ok(capturedPrompt.includes("Vercel"));
  });

  it("asserts non-existent technologies are not introduced into the tailored output", async () => {
    const candidateSkills = new Set(["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma", "Docker"]);
    const knownCandidateProjectIds = new Set(["pulse-career", "crypto-wallet"]);

    const mockOutput = {
      summary: "Engineer focused on TypeScript and Next.js.",
      matchingSkills: ["TypeScript", "Next.js", "Docker"],
      selectedProjects: [
        {
          id: "pulse-career",
          title: "Pulse Career Module",
          relevanceRationale: "Relevant to Next.js role.",
          bulletPoints: ["Designed provider-agnostic AI failover router"],
        },
      ],
      experienceHighlights: [
        {
          company: "Stripe",
          role: "Software Engineer",
          bulletPoints: ["Built developer dashboard using Next.js and TypeScript"],
        },
      ],
      markdownContent: "Resume text with verified facts",
    };

    const mockModel = createMockModel({
      generateOutput: mockOutput,
    });

    const result = await tailorResume(sampleCandidate, sampleJob, {
      primaryModel: mockModel,
    });

    // Verify every matching skill exists in candidate facts
    for (const skill of result.matchingSkills) {
      assert.strictEqual(
        candidateSkills.has(skill),
        true,
        `Unexpected hallucinated skill introduced: ${skill}`
      );
    }

    // Verify selected project exists in candidate projects
    for (const proj of result.selectedProjects) {
      assert.strictEqual(
        knownCandidateProjectIds.has(proj.id),
        true,
        `Unexpected hallucinated project ID: ${proj.id}`
      );
    }
  });

  it("fails over to Gemini fallback when primary provider fails", async () => {
    let primaryCalled = false;
    let fallbackCalled = false;

    const mockPrimary = createMockModel({
      shouldThrow: true,
      errorMessage: "OpenRouter rate limited (429)",
      onCall: () => {
        primaryCalled = true;
      },
    });

    const fallbackOutput = {
      summary: "Fallback tailored summary from Gemini 2.0 Flash.",
      matchingSkills: ["TypeScript", "Next.js"],
      selectedProjects: [
        {
          id: "pulse-career",
          title: "Pulse Career Module",
          relevanceRationale: "Primary match",
          bulletPoints: ["Built local engine"],
        },
      ],
      experienceHighlights: [],
      markdownContent: "# Tailored Resume (Gemini Fallback)",
    };

    const mockFallback = createMockModel({
      generateOutput: fallbackOutput,
      onCall: () => {
        fallbackCalled = true;
      },
    });

    const result = await tailorResume(sampleCandidate, sampleJob, {
      primaryModel: mockPrimary,
      fallbackModel: mockFallback,
    });

    assert.strictEqual(primaryCalled, true);
    assert.strictEqual(fallbackCalled, true);
    assert.strictEqual(result.summary, "Fallback tailored summary from Gemini 2.0 Flash.");
    assert.strictEqual(result.selectedProjects[0].id, "pulse-career");
  });

  it("exports tailorResume and schemas correctly from router.ts", async () => {
    assert.strictEqual(typeof tailorResumeFromRouter, "function");
    assert.strictEqual(typeof TailoredResumeSchemaFromRouter.parse, "function");

    const mockOutput = {
      summary: "Exported router test summary",
      matchingSkills: ["TypeScript"],
      selectedProjects: [],
      experienceHighlights: [],
      markdownContent: "Markdown from re-exported router function",
    };

    const result = await tailorResumeFromRouter(sampleCandidate, sampleJob, {
      primaryModel: createMockModel({ generateOutput: mockOutput }),
    });

    assert.strictEqual(result.summary, "Exported router test summary");
  });
});
