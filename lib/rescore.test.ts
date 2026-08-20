import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { rescoreJob } from "./scoring/rescore";
import type { db } from "@/lib/db";

interface MockCandidate {
  id: string;
  name: string;
  targetRole: string;
  minSalary: number;
  currency?: string;
  yearsOfExperience: number;
  remotePreference: string;
  preferredLocations: string;
  skills: string;
  projects: string;
  experiences: string;
  resumeText: string;
}

interface MockJob {
  id: string;
  dedupeKey: string;
  title: string;
  company: string;
  location: string;
  remoteStatus: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency?: string;
  employmentType: string;
  description: string;
  url: string;
  source: string;
  status: string;
  discoveredAt: Date;
  postedAt?: Date | null;
}

interface MockFitScore {
  id: string;
  jobId: string;
  score: number;
  recommendation: string;
  skillsFit?: number | null;
  experienceFit?: number | null;
  domainFit?: number | null;
  trajectoryFit?: number | null;
  strengths: string;
  gaps: string;
  risks: string;
  reasoning: string;
  createdAt: Date;
}

interface MockEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  payload: string;
  timestamp: Date;
}

function createMockModel(output: Record<string, unknown>): LanguageModel {
  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "test-mock-provider",
    modelId: "test-mock-model",
    supportedUrls: {},
    async doGenerate() {
      const payload = {
        skillsFit: typeof output.score === "number" ? output.score : 85,
        experienceFit: typeof output.score === "number" ? output.score : 85,
        domainFit: typeof output.score === "number" ? output.score : 85,
        trajectoryFit: typeof output.score === "number" ? output.score : 85,
        strengths: [],
        gaps: [],
        risks: [],
        reasoning: "Mock model reasoning",
        ...output,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
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
  return model as unknown as LanguageModel;
}

function createMockDb() {
  const candidates: MockCandidate[] = [
    {
      id: "candidate-default",
      name: "Alex Dev",
      targetRole: "Senior Backend Engineer",
      minSalary: 120000,
      yearsOfExperience: 5,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: JSON.stringify(["Remote", "US"]),
      skills: JSON.stringify(["TypeScript", "Node.js", "PostgreSQL"]),
      projects: JSON.stringify([]),
      experiences: JSON.stringify([]),
      resumeText: "5 years building backend systems in TypeScript and Node.js.",
    },
  ];

  const jobs = new Map<string, MockJob>();
  const fitScores = new Map<string, MockFitScore>();
  const events: MockEvent[] = [];

  const initialJob: MockJob = {
    id: "job-123",
    dedupeKey: "dedupe-123",
    title: "Senior Backend Engineer",
    company: "CloudTech",
    location: "Remote",
    remoteStatus: "REMOTE",
    salaryMin: 140000,
    salaryMax: 180000,
    employmentType: "FULL_TIME",
    description: "Senior Backend Engineer with TypeScript experience.",
    url: "https://cloudtech.com/jobs/123",
    source: "MANUAL",
    status: "REVIEW",
    discoveredAt: new Date(),
  };
  jobs.set(initialJob.id, initialJob);

  const initialFit: MockFitScore = {
    id: "fit-123",
    jobId: "job-123",
    score: 65,
    recommendation: "REVIEW",
    skillsFit: 65,
    experienceFit: 65,
    domainFit: 65,
    trajectoryFit: 65,
    strengths: JSON.stringify(["TypeScript"]),
    gaps: JSON.stringify(["GraphQL"]),
    risks: JSON.stringify([]),
    reasoning: "Initial review score",
    createdAt: new Date(),
  };
  fitScores.set(initialJob.id, initialFit);

  return {
    candidate: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        candidates.find((c) => c.id === where.id) || null,
      findFirst: async () => candidates[0] || null,
    },
    job: {
      findUnique: async ({ where }: { where: { id?: string } }) => {
        if (!where.id) return null;
        return jobs.get(where.id) || null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const job = jobs.get(where.id);
        if (!job) throw new Error("Job not found");
        return { ...job };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockJob> }) => {
        const existing = jobs.get(where.id);
        if (!existing) throw new Error("Job not found");
        const updated: MockJob = { ...existing, ...data };
        jobs.set(where.id, updated);
        return { ...updated };
      },
    },
    fitScore: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { jobId: string };
        create: Partial<MockFitScore> & { score: number; recommendation: string };
        update: Partial<MockFitScore>;
      }) => {
        const existing = fitScores.get(where.jobId);
        if (existing) {
          const updated: MockFitScore = { ...existing, ...update };
          fitScores.set(where.jobId, updated);
          return { ...updated };
        }
        const created: MockFitScore = {
          id: `fit-${Date.now()}`,
          jobId: where.jobId,
          strengths: "[]",
          gaps: "[]",
          risks: "[]",
          reasoning: "",
          ...create,
          createdAt: new Date(),
        };
        fitScores.set(where.jobId, created);
        return { ...created };
      },
    },
    event: {
      create: async ({ data }: { data: Omit<MockEvent, "id" | "timestamp"> }) => {
        const record: MockEvent = {
          id: `event-${Date.now()}`,
          timestamp: new Date(),
          ...data,
        };
        events.push(record);
        return record;
      },
    },
    _state: {
      jobs,
      fitScores,
      events,
    },
  };
}

describe("Job Re-scoring", () => {
  it("re-evaluates fit score with AI router and updates FitScore and Job status", async () => {
    const mockDb = createMockDb();
    const mockModel = createMockModel({
      score: 92,
      recommendation: "APPLY",
      skillsFit: 95,
      experienceFit: 90,
      domainFit: 90,
      trajectoryFit: 92,
      strengths: ["Excellent TypeScript alignment", "Meets salary requirements"],
      gaps: [],
      risks: [],
      reasoning: "Updated description now demonstrates perfect match.",
    });

    const result = await rescoreJob("job-123", {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(result.fitScore?.score, 92);
    assert.strictEqual(result.fitScore?.recommendation, "APPLY");
    assert.strictEqual(result.status, "REVIEW");

    // Check DB state
    const savedFit = mockDb._state.fitScores.get("job-123");
    assert.ok(savedFit);
    assert.strictEqual(savedFit.score, 92);
    assert.strictEqual(savedFit.recommendation, "APPLY");

    const savedJob = mockDb._state.jobs.get("job-123");
    assert.ok(savedJob);
    assert.strictEqual(savedJob.status, "REVIEW");


    // Check audit event
    const scoredEvent = mockDb._state.events.find(
      (e) => e.entityId === "job-123" && e.eventType === "SCORED"
    );
    assert.ok(scoredEvent, "Should log a SCORED audit event");
  });

  it("filters out job and marks FILTERED_OUT if updated details fail deterministic constraints", async () => {
    const mockDb = createMockDb();
    // Update salaryMax to below candidate minSalary (candidate minSalary is 120k)
    const existingJob = mockDb._state.jobs.get("job-123")!;
    existingJob.salaryMax = 80000;
    existingJob.salaryMin = 60000;

    let aiCalled = false;
    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        aiCalled = true;
        throw new Error("AI should not be invoked when filters fail");
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;


    const result = await rescoreJob("job-123", {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(result.status, "FILTERED_OUT");
    assert.strictEqual(result.filterResult?.passed, false);
    assert.strictEqual(aiCalled, false, "Deterministic filters should short-circuit AI invocation");

    const savedJob = mockDb._state.jobs.get("job-123");
    assert.strictEqual(savedJob?.status, "FILTERED_OUT");
  });

  it("correctly converts currency when job currency differs from candidate currency (e.g. USD job with INR candidate)", async () => {
    const mockDb = createMockDb();
    const candidate = (await mockDb.candidate.findFirst())!;
    candidate.minSalary = 1200000; // 12 Lakhs INR
    candidate.currency = "INR";

    const job = mockDb._state.jobs.get("job-123")!;
    job.salaryMin = 140000; // $140k USD
    job.salaryMax = 180000; // $180k USD
    job.currency = "USD";
    job.status = "FILTERED_OUT"; // was previously filtered out

    const mockModel = createMockModel({
      score: 88,
      recommendation: "APPLY",
    });

    const result = await rescoreJob("job-123", {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(result.filterResult?.passed, true, "USD $180k should exceed INR ₹12L requirement");
    assert.strictEqual(result.status, "DISCOVERED", "Should reset status from FILTERED_OUT to DISCOVERED");
    assert.strictEqual(result.fitScore?.score, 88);
  });
});
