import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { ingestJobPipeline, type IngestionInput } from "@/lib/ingestion/pipeline";
import { rescoreJob } from "@/lib/scoring/rescore";
import type { db } from "@/lib/db";

interface MockCandidate {
  id: string;
  name: string;
  targetRole: string;
  minSalary: number;
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
  employmentType: string;
  description: string;
  url: string;
  source: string;
  status: string;
  discoveredAt: Date;
  postedAt?: Date | null;
  fitScore?: MockFitScore | null;
  application?: unknown | null;
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
        score: typeof output.score === "number" ? output.score : 85,
        recommendation: (output.recommendation as string) || "APPLY",
        skillsFit: typeof output.score === "number" ? output.score : 85,
        experienceFit: typeof output.score === "number" ? output.score : 85,
        domainFit: typeof output.score === "number" ? output.score : 85,
        trajectoryFit: typeof output.score === "number" ? output.score : 85,
        strengths: (output.strengths as string[]) || ["Strong fit"],
        gaps: (output.gaps as string[]) || [],
        risks: (output.risks as string[]) || [],
        reasoning: (output.reasoning as string) || "Good fit",
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
      preferredLocations: "San Francisco, New York",
      skills: '["TypeScript", "Node.js", "PostgreSQL", "Next.js"]',
      projects: "[]",
      experiences: "[]",
      resumeText: "5 years building backend microservices with Node.js and TypeScript.",
    },
  ];

  const jobs = new Map<string, MockJob>();
  const fitScores = new Map<string, MockFitScore>();
  const events: MockEvent[] = [];

  const dbInterface = {
    candidate: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return candidates.find((c) => c.id === where.id) || null;
      },
      findFirst: async () => candidates[0] || null,
    },
    job: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const job = jobs.get(where.id);
        if (!job) throw new Error("Job not found");
        return { ...job, fitScore: fitScores.get(job.id) || null, application: null };
      },
      findUnique: async ({ where }: { where: { id?: string; dedupeKey?: string } }) => {
        if (where.id) {
          const job = jobs.get(where.id);
          return job ? { ...job, fitScore: fitScores.get(job.id) || null, application: null } : null;
        }
        if (where.dedupeKey) {
          for (const job of jobs.values()) {
            if (job.dedupeKey === where.dedupeKey) {
              return { ...job, fitScore: fitScores.get(job.id) || null, application: null };
            }
          }
        }
        return null;
      },
      create: async ({ data }: { data: Omit<MockJob, "id" | "discoveredAt"> & { id?: string } }) => {
        const id = data.id || `job-${Date.now()}`;
        const created: MockJob = {
          id,
          discoveredAt: new Date(),
          postedAt: null,
          fitScore: null,
          application: null,
          ...data,
        };
        jobs.set(id, created);
        return { ...created };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockJob> }) => {
        const existing = jobs.get(where.id);
        if (!existing) throw new Error("Job not found for update");
        const updated = { ...existing, ...data };
        jobs.set(where.id, updated);
        return { ...updated };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { dedupeKey: string };
        create: Omit<MockJob, "id" | "discoveredAt">;
        update: Partial<MockJob>;
      }) => {
        for (const [id, j] of jobs.entries()) {
          if (j.dedupeKey === where.dedupeKey) {
            const updated = { ...j, ...update };
            jobs.set(id, updated);
            return { ...updated };
          }
        }
        const id = `job-${Date.now()}`;
        const created: MockJob = {
          id,
          discoveredAt: new Date(),
          postedAt: null,
          fitScore: null,
          application: null,
          ...create,
        };
        jobs.set(id, created);
        return { ...created };
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

  return dbInterface;
}

describe("Scoring Status Guard — No Auto-Shortlist / Auto-Apply", () => {
  it("ingestion of a high-scoring job (score >= 80) must remain DISCOVERED, not auto-shortlisted", async () => {
    const mockDb = createMockDb();
    const mockModel = createMockModel({
      score: 95,
      recommendation: "APPLY",
      reasoning: "Perfect fit for candidate profile.",
    });

    const input: IngestionInput = {
      title: "Senior Backend Engineer",
      company: "Acme Cloud",
      remoteStatus: "REMOTE",
      salaryMin: 140000,
      salaryMax: 180000,
      description: "We are looking for a Senior Backend Engineer with 5+ years of experience in TypeScript and distributed systems.",
    };

    const result = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel, fallbackModel: mockModel },
    });

    // Score is 95, but lifecycle status must be DISCOVERED (not auto-SHORTLISTED into application pipeline)
    assert.strictEqual(result.fitScore?.score, 95);
    assert.strictEqual(result.fitScore?.recommendation, "APPLY");
    assert.strictEqual(result.job.status, "DISCOVERED");
    assert.strictEqual(result.status, "DISCOVERED");
  });

  it("rescoring an existing DISCOVERED job to 90+ must keep status as DISCOVERED", async () => {
    const mockDb = createMockDb();
    await mockDb.job.create({
      data: {
        id: "job-discovered-1",
        dedupeKey: "acme-backend",
        title: "Senior Backend Engineer",
        company: "Acme Corp",
        location: "Remote",
        remoteStatus: "REMOTE",
        salaryMin: 150000,
        salaryMax: 180000,
        employmentType: "FULL_TIME",
        description: "TypeScript and Node.js engineer needed.",
        url: "",
        source: "MANUAL",
        status: "DISCOVERED",
      },
    });

    const mockModel = createMockModel({
      score: 92,
      recommendation: "APPLY",
      reasoning: "Great match.",
    });

    const result = await rescoreJob("job-discovered-1", {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(result.fitScore?.score, 92);
    assert.strictEqual(result.status, "DISCOVERED");

    const savedJob = await mockDb.job.findUnique({ where: { id: "job-discovered-1" } });
    assert.strictEqual(savedJob?.status, "DISCOVERED");
  });
});
