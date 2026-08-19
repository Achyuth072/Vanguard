import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { ingestJobPipeline, type IngestionInput } from "./pipeline";
import { generateDedupeKey } from "./dedupe";
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
  application?: MockApplication | null;
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

interface MockApplication {
  id: string;
  jobId: string;
  status: string;
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

function createMockDb(preseeded?: { jobs?: MockJob[]; fitScores?: MockFitScore[] }) {
  const candidates: MockCandidate[] = [
    {
      id: "candidate-default",
      name: "Alex Dev",
      targetRole: "Senior Backend Engineer",
      minSalary: 120000,
      yearsOfExperience: 5,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: JSON.stringify(["Remote", "US"]),
      skills: JSON.stringify(["TypeScript", "Node.js", "PostgreSQL", "Go"]),
      projects: JSON.stringify([]),
      experiences: JSON.stringify([]),
      resumeText: "5 years building distributed backend systems in TypeScript and Go.",
    },
  ];

  const jobs = new Map<string, MockJob>();
  const fitScores = new Map<string, MockFitScore>();
  const events: MockEvent[] = [];

  if (preseeded?.jobs) {
    for (const j of preseeded.jobs) jobs.set(j.id, j);
  }
  if (preseeded?.fitScores) {
    for (const f of preseeded.fitScores) fitScores.set(f.jobId, f);
  }

  return {
    candidate: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        candidates.find((c) => c.id === where.id) || null,
      findFirst: async () => candidates[0] || null,
    },
    job: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id?: string; dedupeKey?: string };
        include?: { fitScore?: boolean; application?: boolean };
      }) => {
        let job: MockJob | null = null;
        if (where.dedupeKey) {
          job = Array.from(jobs.values()).find((j) => j.dedupeKey === where.dedupeKey) || null;
        } else if (where.id) {
          job = jobs.get(where.id) || null;
        }
        if (!job) return null;
        const res: MockJob = { ...job };
        if (include?.fitScore) {
          res.fitScore = fitScores.get(job.id) || null;
        }
        if (include?.application) {
          res.application = null;
        }
        return res;
      },
      create: async ({ data }: { data: Partial<MockJob> & { dedupeKey: string; title: string; company: string; description: string } }) => {
        const id = data.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const job: MockJob = {
          location: "",
          remoteStatus: "UNKNOWN",
          salaryMin: null,
          salaryMax: null,
          employmentType: "FULL_TIME",
          url: "",
          source: "MANUAL",
          status: "DISCOVERED",
          ...data,
          id,
          discoveredAt: new Date(),
        };
        jobs.set(id, job);
        return { ...job };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockJob>;
      }) => {
        const existing = jobs.get(where.id);
        if (!existing) throw new Error("Job not found");
        const updated: MockJob = { ...existing, ...data };
        jobs.set(where.id, updated);
        return { ...updated };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { dedupeKey: string };
        create: Partial<MockJob> & { dedupeKey: string; title: string; company: string; description: string };
        update: Partial<MockJob>;
      }) => {
        const existing = Array.from(jobs.values()).find((j) => j.dedupeKey === where.dedupeKey);
        if (existing) {
          const updated: MockJob = { ...existing, ...update };
          jobs.set(existing.id, updated);
          return { ...updated };
        }
        const id = create.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const created: MockJob = {
          location: "",
          remoteStatus: "UNKNOWN",
          salaryMin: null,
          salaryMax: null,
          employmentType: "FULL_TIME",
          url: "",
          source: "MANUAL",
          status: "DISCOVERED",
          ...create,
          id,
          discoveredAt: new Date(),
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
        const id = create.id || `fit-${Date.now()}`;
        const created: MockFitScore = {
          jobId: create.jobId || where.jobId,
          strengths: "[]",
          gaps: "[]",
          risks: "[]",
          reasoning: "",
          ...create,
          id,
          createdAt: new Date(),
        };
        fitScores.set(where.jobId, created);
        return { ...created };
      },
    },
    event: {
      create: async ({ data }: { data: Omit<MockEvent, "id" | "timestamp"> }) => {
        const id = `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record: MockEvent = { id, timestamp: new Date(), ...data };
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

describe("Ingestion Pipeline — Status Guard", () => {
  it("must not clobber APPLIED status when job exists without fitScore", async () => {
    // Scenario: a job was created (e.g. via manual entry or partial ingestion),
    // then manually advanced to APPLIED, then re-ingested with the same dedupeKey.
    // The job has no fitScore, so the dedupe guard at line 183 won't catch it.
    const dedupeKey = generateDedupeKey({
      company: "Acme Cloud",
      title: "Senior Backend Engineer",
    });

    const preseededJob: MockJob = {
      id: "existing-applied-job",
      dedupeKey,
      title: "Senior Backend Engineer",
      company: "Acme Cloud",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 130000,
      salaryMax: 160000,
      employmentType: "FULL_TIME",
      description: "Senior Backend Engineer with TypeScript experience.",
      url: "",
      source: "MANUAL",
      status: "APPLIED",
      discoveredAt: new Date(),
    };

    const mockDb = createMockDb({ jobs: [preseededJob] });
    const mockModel = createMockModel({
      score: 90,
      recommendation: "APPLY",
      strengths: ["Strong TypeScript and backend experience"],
      gaps: [],
      risks: [],
      reasoning: "Excellent match.",
    });

    const input: IngestionInput = {
      title: "Senior Backend Engineer",
      company: "Acme Cloud",
      remoteStatus: "REMOTE",
      salaryMin: 130000,
      salaryMax: 160000,
      description: "Senior Backend Engineer with 5+ years TypeScript experience.",
    };

    const result = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel, fallbackModel: mockModel },
    });

    const finalJob = mockDb._state.jobs.get("existing-applied-job")!;
    assert.strictEqual(
      finalJob.status,
      "APPLIED",
      `Expected status to remain APPLIED but got "${finalJob.status}" — ingestion pipeline clobbered downstream status`
    );
  });

  it("must not clobber INTERVIEW status when job exists without fitScore", async () => {
    const dedupeKey = generateDedupeKey({
      company: "StreamData",
      title: "Platform Engineer",
    });

    const preseededJob: MockJob = {
      id: "existing-interview-job",
      dedupeKey,
      title: "Platform Engineer",
      company: "StreamData",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 140000,
      salaryMax: 180000,
      employmentType: "FULL_TIME",
      description: "Platform Engineer building data streaming infrastructure.",
      url: "",
      source: "MANUAL",
      status: "INTERVIEW",
      discoveredAt: new Date(),
    };

    const mockDb = createMockDb({ jobs: [preseededJob] });
    const mockModel = createMockModel({
      score: 70,
      recommendation: "REVIEW",
      strengths: ["Relevant skills"],
      gaps: ["Missing some requirements"],
      risks: [],
      reasoning: "Worth reviewing.",
    });

    const input: IngestionInput = {
      title: "Platform Engineer",
      company: "StreamData",
      remoteStatus: "REMOTE",
      salaryMin: 140000,
      salaryMax: 180000,
      description: "Platform Engineer building data streaming infrastructure.",
    };

    const result = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel, fallbackModel: mockModel },
    });

    const finalJob = mockDb._state.jobs.get("existing-interview-job")!;
    assert.strictEqual(
      finalJob.status,
      "INTERVIEW",
      `Expected status to remain INTERVIEW but got "${finalJob.status}"`
    );
  });

  it("dedupe guard must protect APPLIED jobs even when they have a fitScore", async () => {
    // After first ingestion, job has fitScore and status SHORTLISTED.
    // User advances to APPLIED. Re-ingestion should return duplicate, not re-score.
    const mockDb = createMockDb();
    const mockModel = createMockModel({
      score: 90,
      recommendation: "APPLY",
      strengths: ["Strong TypeScript and backend experience"],
      gaps: [],
      risks: [],
      reasoning: "Excellent match.",
    });

    const input: IngestionInput = {
      title: "Senior Backend Engineer",
      company: "Acme Cloud",
      remoteStatus: "REMOTE",
      salaryMin: 130000,
      salaryMax: 160000,
      description: "Senior Backend Engineer with 5+ years TypeScript experience.",
    };

    // First ingestion
    const firstResult = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel, fallbackModel: mockModel },
    });
    assert.strictEqual(firstResult.status, "DISCOVERED");

    // Advance to APPLIED
    const jobId = firstResult.job.id;
    mockDb._state.jobs.get(jobId)!.status = "APPLIED";

    // Re-ingest
    const secondResult = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel, fallbackModel: mockModel },
    });

    // Should return as duplicate without touching status
    assert.strictEqual(secondResult.isDuplicate, true);
    const finalJob = mockDb._state.jobs.get(jobId)!;
    assert.strictEqual(finalJob.status, "APPLIED");
  });
});
