import test from "node:test";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { db } from "@/lib/db";
import {
  prepareApplication,
  askCustomApplicationQuestion,
  updateTailoredResume,
  getApplicationData,
} from "./tailoring";

function createMockModel(outputMap: Record<string, unknown>): LanguageModel {
  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "test-mock-provider",
    modelId: "test-mock-model",
    supportedUrls: {},
    async doGenerate(options) {
      const promptStr = JSON.stringify(options.prompt);
      let matchedKey = Object.keys(outputMap)[0];
      for (const key of Object.keys(outputMap)) {
        if (promptStr.toLowerCase().includes(key.toLowerCase())) {
          matchedKey = key;
          break;
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(outputMap[matchedKey] ?? {}),
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

test("Tailoring Server Actions Suite", async (t) => {
  // Ensure default candidate exists
  await db.candidate.upsert({
    where: { id: "candidate-default" },
    create: {
      id: "candidate-default",
      name: "Jordan Lee",
      targetRole: "Senior Systems Engineer",
      yearsOfExperience: 5,
      skills: JSON.stringify([
        { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 5 },
        { name: "React", category: "FRAMEWORK", yearsOfExperience: 4 },
        { name: "Next.js", category: "FRAMEWORK", yearsOfExperience: 3 },
      ]),
      projects: JSON.stringify([
        {
          id: "pulse-engine",
          title: "Pulse Engine",
          technologies: ["TypeScript", "Next.js"],
          highlights: ["Engineered zero-cost AI router"],
          metrics: ["100% test coverage"],
          description: "Career workflow automation tool.",
        },
      ]),
      experiences: JSON.stringify([
        {
          id: "exp-1",
          company: "Tech Corp",
          title: "Staff Engineer",
          highlights: ["Led frontend platform migration"],
        },
      ]),
      resumeText: "Jordan Lee - Staff Engineer with deep TypeScript and Next.js expertise.",
    },
    update: {
      name: "Jordan Lee",
    },
  });

  const dedupeKey = `test_tailor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const testJob = await db.job.create({
    data: {
      dedupeKey,
      title: "Senior Fullstack Engineer",
      company: "Acme Cloud",
      location: "Remote",
      remoteStatus: "REMOTE",
      status: "SHORTLISTED",
      description: "Seeking a senior engineer skilled in Next.js, React, and TypeScript.",
    },
  });

  t.after(async () => {
    await db.event.deleteMany({ where: { entityId: testJob.id } });
    const app = await db.application.findUnique({ where: { jobId: testJob.id } });
    if (app) {
      await db.event.deleteMany({ where: { entityId: app.id } });
      await db.application.delete({ where: { id: app.id } });
    }
    await db.job.deleteMany({ where: { id: testJob.id } });
  });

  const mockResumeOutput = {
    summary: "Senior Systems Engineer with 5 years building resilient Next.js and TypeScript architectures.",
    matchingSkills: ["TypeScript", "React", "Next.js"],
    selectedProjects: [
      {
        id: "pulse-engine",
        title: "Pulse Engine",
        relevanceRationale: "Directly matches Next.js fullstack requirement.",
        bulletPoints: ["Engineered zero-cost AI router"],
      },
    ],
    experienceHighlights: [
      {
        company: "Tech Corp",
        role: "Staff Engineer",
        bulletPoints: ["Led frontend platform migration"],
      },
    ],
    markdownContent: "# Jordan Lee\n**Senior Systems Engineer**\n\n## Summary\nSenior Systems Engineer...",
  };

  const mockAnswersOutput = {
    answers: [
      {
        id: "ans-1",
        question: "Why are you interested in this role and company?",
        answer: "I am passionate about building scalable cloud developer tools with Next.js.",
        keyPointsUsed: ["Pulse Engine", "Tech Corp"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
      {
        id: "ans-2",
        question: "What relevant project or technical challenge best demonstrates your fit for this role?",
        answer: "At Pulse Engine, I built a zero-cost local-first architecture.",
        keyPointsUsed: ["Pulse Engine"],
        createdAt: "2026-08-17T12:00:00.000Z",
      },
    ],
  };

  const mockCustomAnswerOutput = {
    id: "ans-custom-1",
    question: "Describe your experience with async error handling in Next.js Server Actions.",
    answer: "In Pulse Engine, I implemented multi-tier provider failovers with deterministic error catching.",
    keyPointsUsed: ["Pulse Engine", "TypeScript"],
    createdAt: "2026-08-17T12:05:00.000Z",
  };

  const mockModel = createMockModel({
    "questions to answer": mockAnswersOutput,
    "generate a tailored resume": mockResumeOutput,
    "async error handling": mockCustomAnswerOutput,
  });

  await t.test("prepareApplication generates resume and preset answers, updating Application to PREPARED", async () => {
    const result = await prepareApplication(testJob.id, {
      primaryModel: mockModel,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.tailoredResume.summary, mockResumeOutput.summary);
    assert.strictEqual(result.tailoredResume.selectedProjects.length, 1);
    assert.strictEqual(result.questionAnswers.length, 2);

    // Verify DB Application record
    const app = await db.application.findUnique({
      where: { jobId: testJob.id },
    });
    assert.ok(app);
    assert.strictEqual(app.status, "PREPARED");

    const parsedResume = JSON.parse(app.tailoredResume);
    assert.strictEqual(parsedResume.summary, mockResumeOutput.summary);

    const parsedAnswers = JSON.parse(app.questionAnswers);
    assert.strictEqual(parsedAnswers.length, 2);

    // Verify Job record status updated to PREPARED
    const updatedJob = await db.job.findUnique({
      where: { id: testJob.id },
    });
    assert.ok(updatedJob);
    assert.strictEqual(updatedJob.status, "PREPARED");

    // Verify Event logged
    const events = await db.event.findMany({
      where: { entityId: app.id, eventType: "APPLICATION_PREPARED" },
    });
    assert.strictEqual(events.length, 1);
  });

  await t.test("askCustomApplicationQuestion appends new answer to application", async () => {
    const customPrompt = "Describe your experience with async error handling in Next.js Server Actions.";
    const result = await askCustomApplicationQuestion(testJob.id, customPrompt, {
      primaryModel: mockModel,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.answer.question, customPrompt);
    assert.strictEqual(result.questionAnswers.length, 3);

    // Check DB state
    const app = await db.application.findUnique({
      where: { jobId: testJob.id },
    });
    assert.ok(app);
    const parsedAnswers = JSON.parse(app.questionAnswers);
    assert.strictEqual(parsedAnswers.length, 3);
    assert.strictEqual(parsedAnswers[2].question, customPrompt);
  });

  await t.test("updateTailoredResume saves modified markdown content to DB", async () => {
    const updatedMarkdown = "# Jordan Lee (Edited Live)\n\n## Summary\nUpdated live from editor.";
    const app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);

    const result = await updateTailoredResume(app.id, updatedMarkdown);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.tailoredResume.markdownContent, updatedMarkdown);

    // Check DB state
    const reloadedApp = await db.application.findUnique({ where: { id: app.id } });
    assert.ok(reloadedApp);
    const parsedResume = JSON.parse(reloadedApp.tailoredResume);
    assert.strictEqual(parsedResume.markdownContent, updatedMarkdown);
    assert.strictEqual(parsedResume.summary, mockResumeOutput.summary);
  });

  await t.test("getApplicationData returns complete parsed application data", async () => {
    const data = await getApplicationData(testJob.id);
    assert.ok(data.job);
    assert.ok(data.application);
    assert.ok(data.tailoredResume);
    assert.strictEqual(data.tailoredResume?.selectedProjects.length, 1);
    assert.strictEqual(data.questionAnswers.length, 3);
  });
});
