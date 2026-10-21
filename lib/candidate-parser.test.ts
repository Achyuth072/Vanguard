import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { LanguageModel } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  parseResumeMarkdownToProfile,
  parseResumeMarkdownWithAI,
} from "./candidate-parser";

function createMockLanguageModel(params: {
  generateOutput?: Record<string, unknown>;
  shouldThrow?: boolean;
  errorMessage?: string;
}): LanguageModel {
  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "test-mock-provider",
    modelId: "test-mock-model",
    supportedUrls: {},
    async doGenerate() {
      if (params.shouldThrow) {
        throw new Error(params.errorMessage || "Mock provider rate limited");
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
      throw new Error("Stream not supported");
    },
  };

  return model;
}

describe("Candidate Resume Markdown Parser", () => {
  it("parses candidate resume from Markdown correctly", () => {
    const resumePath = path.join(process.cwd(), ".scratch", "Resume", "Achyuth.md");
    const markdown = fs.readFileSync(resumePath, "utf-8");

    const profile = parseResumeMarkdownToProfile(markdown, "candidate-default");

    assert.strictEqual(profile.id, "candidate-default");
    assert.strictEqual(profile.name, "Achyuth S");
    assert.strictEqual(profile.location, "");
    assert.deepStrictEqual(profile.preferredLocations, ["Remote"]);
    assert.strictEqual(profile.targetRole, "Core Developer");
    assert.strictEqual(profile.yearsOfExperience, 2);
    assert.strictEqual(profile.experiences.length, 3);
    assert.strictEqual(profile.experiences[0].company, "She Drives");
    assert.strictEqual(profile.experiences[0].title, "Core Developer");
    assert.strictEqual(profile.experiences[0].startDate, "2025-05");
    assert.strictEqual(profile.experiences[0].endDate, "2025-11");
    assert.strictEqual(profile.experiences[0].highlights.length, 4);

    assert.strictEqual(profile.projects.length, 2);
    assert.strictEqual(profile.projects[0].title, "Kagelin");
    assert.ok(profile.projects[0].technologies.includes("Next.js 16"));
    assert.strictEqual(profile.projects[1].title, "Vanguard");

    assert.ok(profile.skills.length >= 8);
    const jsSkill = profile.skills.find((s) => s.name === "JavaScript");
    assert.ok(jsSkill);
    assert.strictEqual(jsSkill.category, "LANGUAGE");
    assert.strictEqual(jsSkill.yearsOfExperience, 2);

    const reactSkill = profile.skills.find((s) => s.name === "React.js");
    assert.ok(reactSkill);
    assert.strictEqual(reactSkill.category, "FRAMEWORK");

    const postgresSkill = profile.skills.find((s) => s.name === "PostgreSQL");
    assert.ok(postgresSkill, "Extracts parenthesized database tech like PostgreSQL");
    assert.strictEqual(postgresSkill?.category, "DATABASE");

    // Must not inject synthetic skills
    assert.ok(!profile.skills.some((s) => s.name === "AI Agents / LLMs"));
  });

  it("handles empty or blank markdown gracefully", () => {
    const profile = parseResumeMarkdownToProfile("", "test-empty");
    assert.strictEqual(profile.id, "test-empty");
    assert.strictEqual(profile.name, "Default Candidate");
    assert.strictEqual(profile.skills.length, 0);
    assert.strictEqual(profile.experiences.length, 0);
    assert.strictEqual(profile.projects.length, 0);
  });

  it("parseResumeMarkdownWithAI returns parsed profile with fallback when no API configured", async () => {
    const resumePath = path.join(process.cwd(), ".scratch", "Resume", "Achyuth.md");
    const markdown = fs.readFileSync(resumePath, "utf-8");

    const profile = await parseResumeMarkdownWithAI(markdown, "test-ai-fallback");
    assert.strictEqual(profile.id, "test-ai-fallback");
    assert.ok(profile.name.length > 0);
    assert.ok(profile.skills.length > 0);
    assert.ok(profile.projects.length > 0);
    assert.ok(profile.experiences.length > 0);
    assert.strictEqual(profile.resumeText, markdown);
  });

  it("parseResumeMarkdownWithAI handles empty input gracefully", async () => {
    const profile = await parseResumeMarkdownWithAI("", "test-empty-ai");
    assert.strictEqual(profile.id, "test-empty-ai");
    assert.strictEqual(profile.name, "Default Candidate");
    assert.strictEqual(profile.skills.length, 0);
  });



  it("parseResumeMarkdownWithAI succeeds with AI primary model", async () => {
    const mockOutput = {
      name: "Sam Altman",
      targetRole: "Chief Executive Officer",
      minSalary: 2500000,
      currency: "USD",
      yearsOfExperience: 15,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: ["San Francisco", "Remote"],
      skills: [
        { name: "Executive Leadership", category: "DOMAIN", yearsOfExperience: 15 },
        { name: "Python", category: "LANGUAGE", yearsOfExperience: 10 },
      ],
      projects: [
        {
          id: "proj-openai",
          title: "Generative AI Platform",
          company: "OpenAI",
          role: "CEO",
          startDate: "2019-01",
          endDate: null,
          technologies: ["Python", "PyTorch"],
          highlights: ["Shipped ChatGPT to 100M+ users"],
          metrics: ["100M+ active users"],
          description: "Pioneered conversational frontier models.",
        },
      ],
      experiences: [
        {
          id: "exp-openai",
          company: "OpenAI",
          title: "CEO",
          location: "San Francisco",
          remoteStatus: "HYBRID",
          startDate: "2019-01",
          endDate: null,
          isCurrent: true,
          highlights: ["Led company strategy"],
        },
      ],
    };

    const mockPrimary = createMockLanguageModel({ generateOutput: mockOutput });
    const profile = await parseResumeMarkdownWithAI(
      "# Sam Altman\nCEO at OpenAI",
      "test-sam",
      { primaryModel: mockPrimary }
    );

    assert.strictEqual(profile.id, "test-sam");
    assert.strictEqual(profile.name, "Sam Altman");
    assert.strictEqual(profile.targetRole, "Chief Executive Officer");
    assert.strictEqual(profile.yearsOfExperience, 15);
    assert.strictEqual(profile.currency, "USD");
    assert.strictEqual(profile.projects.length, 1);
    assert.strictEqual(profile.projects[0].title, "Generative AI Platform");
    assert.strictEqual(profile.experiences.length, 1);
    assert.strictEqual(profile.skills.length, 2);
  });

  it("parseResumeMarkdownWithAI fails over to fallback model when primary fails", async () => {
    const failingPrimary = createMockLanguageModel({
      shouldThrow: true,
      errorMessage: "Primary 429 Quota Exhausted",
    });

    const fallbackOutput = {
      name: "Fallback Candidate",
      targetRole: "Systems Engineer",
      minSalary: 120000,
      currency: "INR",
      yearsOfExperience: 4,
      remotePreference: "ANY",
      preferredLocations: ["Remote", "Bengaluru"],
      skills: [{ name: "Rust", category: "LANGUAGE", yearsOfExperience: 4 }],
      projects: [],
      experiences: [],
    };

    const workingFallback = createMockLanguageModel({ generateOutput: fallbackOutput });

    const profile = await parseResumeMarkdownWithAI(
      "# Fallback Candidate\nSystems Engineer",
      "test-fallback-model",
      {
        primaryModel: failingPrimary,
        fallbackModel: workingFallback,
      }
    );

    assert.strictEqual(profile.id, "test-fallback-model");
    assert.strictEqual(profile.name, "Fallback Candidate");
    assert.strictEqual(profile.targetRole, "Systems Engineer");
    assert.strictEqual(profile.skills[0].name, "Rust");
  });

  it("full outage simulation: degrades seamlessly to deterministic regex AST parser with zero thrown runtime errors", async () => {
    const resumePath = path.join(process.cwd(), ".scratch", "Resume", "Achyuth.md");
    const markdown = fs.readFileSync(resumePath, "utf-8");

    const failingPrimary = createMockLanguageModel({
      shouldThrow: true,
      errorMessage: "HTTP 429 Rate Limit: All Gemini quotas exhausted",
    });

    const failingFallback = createMockLanguageModel({
      shouldThrow: true,
      errorMessage: "HTTP 503 Service Unavailable: All NVIDIA NIM models overloaded",
    });

    // Both models throw, simulating full AI inference outage
    const profile = await parseResumeMarkdownWithAI(markdown, "test-full-outage", {
      primaryModel: failingPrimary,
      fallbackModel: failingFallback,
    });

    assert.ok(profile, "Returned valid profile without throwing runtime errors");
    assert.strictEqual(profile.id, "test-full-outage");
    assert.strictEqual(profile.name, "Achyuth S");
    assert.strictEqual(profile.targetRole, "Core Developer");
    assert.strictEqual(profile.yearsOfExperience, 2);
    assert.strictEqual(profile.experiences.length, 3);
    assert.strictEqual(profile.projects.length, 2);
    assert.ok(profile.skills.length >= 8);
  });
});


