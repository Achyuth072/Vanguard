import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { ingestJobPipeline, fetchJobPageContent, type IngestionInput } from "./pipeline";
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
}

interface MockFitScore {
  id: string;
  jobId: string;
  score: number;
  recommendation: string;
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

// In-memory mock database client simulating Prisma
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
      skills: JSON.stringify(["TypeScript", "Node.js", "PostgreSQL", "Go"]),
      projects: JSON.stringify([]),
      experiences: JSON.stringify([]),
      resumeText: "5 years building distributed backend systems in TypeScript and Go.",
    },
  ];

  const jobs = new Map<string, MockJob>();
  const fitScores = new Map<string, MockFitScore>();
  const events: MockEvent[] = [];

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
        include?: { fitScore?: boolean };
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

describe("Ingestion Pipeline", () => {
  it("successfully ingests, filters, scores, and shortlists a matching job from raw text", async () => {
    const mockDb = createMockDb();

    const mockModel = createMockModel({
      score: 90,
      recommendation: "APPLY",
      strengths: ["Strong TypeScript and backend experience", "Meets 5 years requirement"],
      gaps: [],
      risks: [],
      reasoning: "Excellent alignment with candidate profile.",
    });

    const input: IngestionInput = {
      title: "Senior Backend Engineer",
      company: "Acme Cloud",
      remoteStatus: "REMOTE",
      salaryMin: 130000,
      salaryMax: 160000,
      description: "We are looking for a Senior Backend Engineer with 5+ years of experience in TypeScript and distributed systems.",
    };

    const result = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: {
        primaryModel: mockModel,
        fallbackModel: mockModel,
      },
    });

    assert.strictEqual(result.isDuplicate, false);
    assert.strictEqual(result.status, "DISCOVERED");
    assert.strictEqual(result.fitScore?.score, 90);
    assert.strictEqual(result.fitScore?.recommendation, "APPLY");
    assert.strictEqual(result.filterResult?.passed, true);

    // Verify DB persistence
    const savedJob = await mockDb.job.findUnique({
      where: { id: result.job.id },
      include: { fitScore: true },
    });
    assert.ok(savedJob);
    assert.strictEqual(savedJob.status, "DISCOVERED");
    assert.ok(savedJob.fitScore);
    assert.strictEqual(savedJob.fitScore.score, 90);

    // Verify Audit Events
    const events = mockDb._state.events.filter((e) => e.entityId === result.job.id);
    const eventTypes = events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("DISCOVERED"), "Should log DISCOVERED event");
    assert.ok(eventTypes.includes("SCORED"), "Should log SCORED event");
  });

  it("extracts structured fields when only unstructured rawText is provided", async () => {
    const mockDb = createMockDb();

    // Mock response for extraction and scoring
    const extractionResponse = {
      title: "Staff Node Developer",
      company: "TechNova",
      location: "San Francisco, CA",
      remoteStatus: "REMOTE",
      salaryMin: 140000,
      salaryMax: 180000,
      employmentType: "FULL_TIME",
      description: "Staff Node Developer needed at TechNova.",
      requiredExperienceYears: 5,
      skills: ["Node.js", "TypeScript"],
    };

    const scoringResponse = {
      score: 75,
      recommendation: "REVIEW",
      skillsFit: 80,
      experienceFit: 75,
      domainFit: 70,
      trajectoryFit: 70,
      strengths: ["Strong Node skills"],
      gaps: ["No GraphQL listed in resume"],
      risks: [],
      reasoning: "Solid candidate, worth human review.",
    };

    let callCount = 0;
    const mockExtractAndScoreModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        callCount++;
        const output = callCount === 1 ? extractionResponse : scoringResponse;
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    const result = await ingestJobPipeline(
      {
        rawText: "TechNova is hiring a Staff Node Developer. Salary 140k-180k. Remote ok.",
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        aiOptions: {
          primaryModel: mockExtractAndScoreModel,
          fallbackModel: mockExtractAndScoreModel,
        },
      }
    );

    assert.strictEqual(result.job.title, "Staff Node Developer");
    assert.strictEqual(result.job.company, "TechNova");
    assert.strictEqual(result.status, "DISCOVERED");
    assert.strictEqual(result.fitScore?.score, 75);
    assert.strictEqual(callCount, 2, "Extraction + Scoring should both execute");
  });

  it("handles duplicate ingestion idempotently without re-triggering AI fit scoring", async () => {
    const mockDb = createMockDb();
    let aiCalls = 0;

    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        aiCalls++;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                score: 85,
                recommendation: "APPLY",
                skillsFit: 85,
                experienceFit: 85,
                domainFit: 85,
                trajectoryFit: 85,
                strengths: ["Great match"],
                gaps: [],
                risks: [],
                reasoning: "High match.",
              }),
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
    } as unknown as LanguageModel;

    const input1: IngestionInput = {
      title: "Backend Engineer",
      company: "Dropbox",
      url: "https://dropbox.com/jobs/12345?utm_source=linkedin",
      remoteStatus: "REMOTE",
      description: "Backend engineer role.",
    };

    const firstRun = await ingestJobPipeline(input1, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(firstRun.isDuplicate, false);
    assert.strictEqual(aiCalls, 1);

    // Second ingestion with different URL query params
    const input2: IngestionInput = {
      title: "Backend Engineer",
      company: "Dropbox",
      url: "https://www.dropbox.com/jobs/12345?ref=newsletter",
      remoteStatus: "REMOTE",
      description: "Updated description text.",
    };

    const secondRun = await ingestJobPipeline(input2, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(secondRun.isDuplicate, true);
    assert.strictEqual(secondRun.job.id, firstRun.job.id);
    assert.strictEqual(aiCalls, 1, "Duplicate ingestion MUST NOT call AI inference again");
  });

  it("short-circuits and persists FILTERED_OUT jobs without calling AI when deterministic filters fail", async () => {
    const mockDb = createMockDb();
    let aiCalls = 0;

    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        aiCalls++;
        throw new Error("AI should NOT be called for deterministically filtered jobs");
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    // Job fails salary filter (Candidate minSalary is 120,000; Job salaryMax is 80,000)
    const input: IngestionInput = {
      title: "Junior Developer",
      company: "Budget Corp",
      remoteStatus: "REMOTE",
      salaryMin: 50000,
      salaryMax: 80000,
      description: "Entry-level developer role.",
    };

    const result = await ingestJobPipeline(input, {
      prismaClient: mockDb as unknown as typeof db,
      aiOptions: { primaryModel: mockModel },
    });

    assert.strictEqual(result.isDuplicate, false);
    assert.strictEqual(result.status, "FILTERED_OUT");
    assert.strictEqual(result.fitScore, null);
    assert.strictEqual(result.filterResult?.passed, false);
    assert.strictEqual(aiCalls, 0, "AI was never called");

    // Verify DB state
    const savedJob = await mockDb.job.findUnique({
      where: { id: result.job.id },
      include: { fitScore: true },
    });
    assert.ok(savedJob);
    assert.strictEqual(savedJob.status, "FILTERED_OUT");
    assert.strictEqual(savedJob.fitScore, null);

    // Verify FILTERED_OUT audit event
    const events = mockDb._state.events.filter((e) => e.entityId === result.job.id);
    const filterEvent = events.find((e) => e.eventType === "FILTERED_OUT");
    assert.ok(filterEvent, "Should log FILTERED_OUT audit event");
  });

  it("fetches URL content, strips HTML markup, and ingests job", async () => {
    const mockDb = createMockDb();

    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Job Posting</title><script>var x = 1;</script><style>body { color: red; }</style></head>
        <body>
          <h1>Staff Infrastructure Engineer</h1>
          <p>Company: CloudScale</p>
          <p>We are seeking a Staff Infrastructure Engineer with 5 years experience in Go and TypeScript.</p>
        </body>
      </html>
    `;

    const mockFetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => mockHtml,
      } as unknown as Response);

    const mockModel = createMockModel({
      score: 88,
      recommendation: "APPLY",
      strengths: ["Go and TypeScript experience"],
      gaps: [],
      risks: [],
      reasoning: "Great match.",
    });

    const result = await ingestJobPipeline(
      {
        url: "https://cloudscale.io/careers/infra-101",
        title: "Staff Infrastructure Engineer",
        company: "CloudScale",
        remoteStatus: "REMOTE",
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        fetchFn: mockFetch as unknown as typeof fetch,
        aiOptions: { primaryModel: mockModel },
      }
    );

    assert.strictEqual(result.isDuplicate, false);
    assert.strictEqual(result.status, "DISCOVERED");
    assert.strictEqual(result.job.company, "CloudScale");
    assert.ok(result.job.description.includes("Staff Infrastructure Engineer"));
    assert.ok(!result.job.description.includes("<script>"), "HTML tags and scripts should be stripped");
  });

  it("extracts missing location, remoteStatus, and salary even when manual title and company are provided", async () => {
    const mockDb = createMockDb();

    const extractionResponse = {
      title: "Extracted Title",
      company: "Extracted Company",
      location: "San Francisco, CA",
      remoteStatus: "REMOTE",
      salaryMin: 140000,
      salaryMax: 180000,
      currency: "USD",
      employmentType: "FULL_TIME",
      description: "Hiring engineer in San Francisco or Remote.",
      requiredExperienceYears: 4,
      skills: ["React", "Next.js"],
    };

    const scoringResponse = {
      score: 85,
      recommendation: "APPLY",
      skillsFit: 85,
      experienceFit: 85,
      domainFit: 85,
      trajectoryFit: 85,
      strengths: ["Strong experience"],
      gaps: [],
      risks: [],
      reasoning: "Great candidate match.",
    };

    let callCount = 0;
    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        callCount++;
        const output = callCount === 1 ? extractionResponse : scoringResponse;
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    const result = await ingestJobPipeline(
      {
        rawText: "We are hiring in SF / Remote, paying $140k-$180k.",
        title: "Staff Frontend Architect", // User manual override
        company: "Acme Corp",              // User manual override
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    // Title & company should be from user manual override
    assert.strictEqual(result.job.title, "Staff Frontend Architect");
    assert.strictEqual(result.job.company, "Acme Corp");
    // Location, remoteStatus, and salary should be extracted by AI
    assert.strictEqual(result.job.location, "San Francisco, CA");
    assert.strictEqual(result.job.remoteStatus, "REMOTE");
    assert.strictEqual(result.job.salaryMin, 140000);
    assert.strictEqual(result.job.salaryMax, 180000);
    assert.strictEqual(result.job.currency, "USD");
    assert.strictEqual(callCount, 2, "Both extraction and scoring should be called");
  });

  it("respects manual overrides for location, remoteStatus, and salary over AI extracted values", async () => {
    const mockDb = createMockDb();

    const extractionResponse = {
      title: "Extracted Title",
      company: "Extracted Company",
      location: "San Francisco, CA",
      remoteStatus: "ONSITE",
      salaryMin: 100000,
      salaryMax: 120000,
      currency: "USD",
      employmentType: "FULL_TIME",
      description: "Job posting description.",
      requiredExperienceYears: 3,
      skills: ["Go"],
    };

    const scoringResponse = {
      score: 90,
      recommendation: "APPLY",
      skillsFit: 90,
      experienceFit: 90,
      domainFit: 90,
      trajectoryFit: 90,
      strengths: ["Senior Go skills"],
      gaps: [],
      risks: [],
      reasoning: "Exceptional match.",
    };

    let callCount = 0;
    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        callCount++;
        const output = callCount === 1 ? extractionResponse : scoringResponse;
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    const result = await ingestJobPipeline(
      {
        rawText: "Job description text here...",
        title: "Senior Backend Lead",
        company: "Stripe",
        location: "Remote - US",
        remoteStatus: "REMOTE",
        salaryMin: 180000,
        salaryMax: 220000,
        currency: "USD",
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    // All user-provided fields should override AI extraction
    assert.strictEqual(result.job.title, "Senior Backend Lead");
    assert.strictEqual(result.job.company, "Stripe");
    assert.strictEqual(result.job.location, "Remote - US");
    assert.strictEqual(result.job.remoteStatus, "REMOTE");
    assert.strictEqual(result.job.salaryMin, 180000);
    assert.strictEqual(result.job.salaryMax, 220000);
    assert.strictEqual(result.job.currency, "USD");
  });

  it("handles direct manual entry ingestion without rawText or URL", async () => {
    const mockDb = createMockDb();

    const scoringResponse = {
      score: 88,
      recommendation: "APPLY",
      skillsFit: 90,
      experienceFit: 85,
      domainFit: 88,
      trajectoryFit: 89,
      strengths: ["Strong systems engineering background"],
      gaps: [],
      risks: [],
      reasoning: "Great alignment with target profile.",
    };

    let scoringCallCount = 0;
    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        scoringCallCount++;
        return {
          content: [{ type: "text", text: JSON.stringify(scoringResponse) }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    const result = await ingestJobPipeline(
      {
        source: "MANUAL",
        title: "Staff Infrastructure Engineer",
        company: "Vercel",
        location: "Remote",
        remoteStatus: "REMOTE",
        salaryMin: 200000,
        salaryMax: 240000,
        currency: "USD",
        description: "Leading next-gen edge infrastructure initiatives.",
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    assert.strictEqual(result.job.title, "Staff Infrastructure Engineer");
    assert.strictEqual(result.job.company, "Vercel");
    assert.strictEqual(result.job.location, "Remote");
    assert.strictEqual(result.job.remoteStatus, "REMOTE");
    assert.strictEqual(result.job.salaryMin, 200000);
    assert.strictEqual(result.job.salaryMax, 240000);
    assert.strictEqual(result.job.currency, "USD");
    assert.strictEqual(result.job.source, "MANUAL");
    assert.strictEqual(result.job.description, "Leading next-gen edge infrastructure initiatives.");
    assert.strictEqual(result.isDuplicate, false);
    assert.strictEqual(result.fitScore?.score, 88);
    assert.strictEqual(scoringCallCount, 1, "Only AI scoring should be called (no extraction needed for pure manual entry)");
  });

  it("preserves AI extracted currency (INR) when input currency is AUTO or undefined", async () => {
    const mockDb = createMockDb();

    const extractionResponse = {
      title: "Senior Fullstack Engineer",
      company: "Razorpay",
      location: "Bengaluru, India",
      remoteStatus: "HYBRID",
      salaryMin: 2500000,
      salaryMax: 3500000,
      currency: "INR",
      employmentType: "FULL_TIME",
      description: "Fast-growing fintech platform.",
      requiredExperienceYears: 4,
      skills: ["Node.js", "TypeScript", "React"],
    };

    const scoringResponse = {
      score: 87,
      recommendation: "APPLY",
      skillsFit: 88,
      experienceFit: 86,
      domainFit: 85,
      trajectoryFit: 89,
      strengths: ["Relevant fintech background"],
      gaps: [],
      risks: [],
      reasoning: "Solid candidate match.",
    };

    let callCount = 0;
    const mockModel: LanguageModel = {
      specificationVersion: "v2",
      provider: "test-mock-provider",
      modelId: "test-mock-model",
      supportedUrls: {},
      async doGenerate() {
        callCount++;
        const output = callCount === 1 ? extractionResponse : scoringResponse;
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        throw new Error("Stream not supported");
      },
    } as unknown as LanguageModel;

    // Test with currency: "AUTO"
    const resultAuto = await ingestJobPipeline(
      {
        rawText: "Razorpay is hiring a Senior Fullstack Engineer in Bengaluru, paying 25-35 LPA INR.",
        currency: "AUTO",
      },
      {
        prismaClient: mockDb as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    assert.strictEqual(resultAuto.job.currency, "INR");
    assert.strictEqual(resultAuto.job.salaryMin, 2500000);
    assert.strictEqual(resultAuto.job.salaryMax, 3500000);

    // Test with undefined currency (omitted)
    const mockDbUndefined = createMockDb();
    callCount = 0;
    const resultUndefined = await ingestJobPipeline(
      {
        rawText: "Razorpay is hiring a Senior Fullstack Engineer in Bengaluru, paying 25-35 LPA INR.",
      },
      {
        prismaClient: mockDbUndefined as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    assert.strictEqual(resultUndefined.job.currency, "INR");

    // Test with explicit currency override: "EUR" using fresh mockDb
    const mockDbOverride = createMockDb();
    callCount = 0;
    const resultOverride = await ingestJobPipeline(
      {
        rawText: "Razorpay is hiring a Senior Fullstack Engineer in Bengaluru, paying 25-35 LPA INR.",
        currency: "EUR",
      },
      {
        prismaClient: mockDbOverride as unknown as typeof db,
        aiOptions: { primaryModel: mockModel },
      }
    );

    assert.strictEqual(resultOverride.job.currency, "EUR");
  });

  describe("fetchJobPageContent — Seam 1 (Anti-Bot & SPA Detection)", () => {
    it("uses standard browser User-Agent header instead of bot string", async () => {
      let capturedHeaders: Record<string, string> = {};
      const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          text: async () => "<html><body><h1>Software Engineer</h1><p>Description with plenty of details about the engineering position.</p></body></html>",
        } as unknown as Response;
      };

      await fetchJobPageContent("https://example.com/job/123", mockFetch as unknown as typeof fetch);
      const ua = capturedHeaders["User-Agent"] || capturedHeaders["user-agent"] || "";
      assert.ok(ua.includes("Mozilla/5.0"), "User-Agent should look like a standard modern browser");
      assert.ok(!ua.includes("VanguardCareerBot"), "Should not use VanguardCareerBot user-agent");
    });

    it("throws descriptive error when AWS WAF or bot challenge returns 202 challenge or robot verification text", async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 202,
        statusText: "Accepted",
        headers: new Headers({ "x-amzn-waf-action": "challenge" }),
        text: async () => "JavaScript is disabled In order to continue, we need to verify that you're not a robot. This requires JavaScript. Enable JavaScript and then reload the page.",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await fetchJobPageContent("https://pwcta.phenompro.com/global/en/job/", mockFetch as unknown as typeof fetch);
        },
        (err: Error) => {
          assert.match(err.message, /protected by anti-bot verification|requires JavaScript/i);
          return true;
        }
      );
    });

    it("throws descriptive error when Cloudflare challenge (403 / Turnstile / Just a moment) is returned", async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({ "cf-mitigated": "challenge" }),
        text: async () => "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await fetchJobPageContent("https://hiring.cafe/jobs/123", mockFetch as unknown as typeof fetch);
        },
        (err: Error) => {
          assert.match(err.message, /protected by anti-bot verification|Cloudflare|requires JavaScript/i);
          return true;
        }
      );
    });

    it("successfully extracts job page content from pages containing Cloudflare telemetry (challenge-platform) and Turnstile scripts when valid HTML content is returned", async () => {
      const mockHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Senior Platform Engineer at Wellfound Startup</title>
  <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
  <script>
    turnstileLoad = function () {
      const overlay = document.getElementById("turnstile_widget");
    };
  </script>
</head>
<body>
  <h1>Senior Platform Engineer</h1>
  <p>About the Job: We are seeking an experienced Senior Platform Engineer to scale our distributed cloud systems. Requirements include 5+ years of TypeScript, Kubernetes, and Go experience.</p>
</body>
</html>`;

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => mockHtml,
      } as unknown as Response);

      const content = await fetchJobPageContent(
        "https://wellfound.com/jobs/12345-senior-platform-engineer",
        mockFetch as unknown as typeof fetch
      );

      assert.ok(content.length > 50);
      assert.ok(content.includes("Senior Platform Engineer"));
      assert.ok(content.includes("About the Job: We are seeking an experienced"));
    });

    it("throws descriptive error when HTTP 200 contains an interstitial Turnstile challenge with minimal text", async () => {
      const mockHtml = `<!DOCTYPE html>
<html>
<head><title>Verification Required</title></head>
<body>
  <div id="challenge-form">
    <div class="cf-turnstile" data-sitekey="sample"></div>
    <p>Please verify that you're not a robot to access this career page.</p>
  </div>
</body>
</html>`;

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => mockHtml,
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await fetchJobPageContent("https://protected-site.com/jobs/1", mockFetch as unknown as typeof fetch);
        },
        (err: Error) => {
          assert.match(err.message, /protected by anti-bot verification|requires JavaScript/i);
          return true;
        }
      );
    });

    it("throws descriptive error when page content is an empty SPA shell requiring JavaScript", async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => "<!DOCTYPE html><html><head><title>Job Board</title></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await fetchJobPageContent("https://spa-board.com/jobs/123", mockFetch as unknown as typeof fetch);
        },
        (err: Error) => {
          assert.match(err.message, /dynamically rendered via JavaScript|empty shell/i);
          return true;
        }
      );
    });
  });

  describe("ingestJobPipeline — Seam 2 (URL Error Propagation)", () => {
    it("propagates descriptive URL fetch failure error when URL fetching fails and title/company are not provided", async () => {
      const mockDb = createMockDb();
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({ "cf-mitigated": "challenge" }),
        text: async () => "Just a moment...",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await ingestJobPipeline(
            { url: "https://hiring.cafe/jobs/sample-role" },
            {
              prismaClient: mockDb as unknown as typeof db,
              fetchFn: mockFetch as unknown as typeof fetch,
            }
          );
        },
        (err: Error) => {
          assert.match(
            err.message,
            /protected by anti-bot verification|Cloudflare|requires JavaScript/i
          );
          assert.doesNotMatch(
            err.message,
            /^Job title and company name are required for ingestion$/
          );
          return true;
        }
      );
    });

    it("propagates URL fetch error when URL is provided with manual title/company but description failed to load", async () => {
      const mockDb = createMockDb();
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        text: async () => "Forbidden",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await ingestJobPipeline(
            {
              url: "https://protected-ats.com/job/456",
              title: "Staff Engineer",
              company: "Protected Corp",
            },
            {
              prismaClient: mockDb as unknown as typeof db,
              fetchFn: mockFetch as unknown as typeof fetch,
            }
          );
        },
        (err: Error) => {
          assert.match(err.message, /Failed to fetch job posting/i);
          return true;
        }
      );
    });

    it("propagates WAF challenge error when PhenomPro-style robot verification page is encountered", async () => {
      const mockDb = createMockDb();
      const mockFetch = async () => ({
        ok: true,
        status: 202,
        statusText: "Accepted",
        headers: new Headers({ "x-amzn-waf-action": "challenge" }),
        text: async () => "JavaScript is disabled In order to continue, we need to verify that you're not a robot.",
      } as unknown as Response);

      await assert.rejects(
        async () => {
          await ingestJobPipeline(
            { url: "https://pwcta.phenompro.com/global/en/job/" },
            {
              prismaClient: mockDb as unknown as typeof db,
              fetchFn: mockFetch as unknown as typeof fetch,
            }
          );
        },
        (err: Error) => {
          assert.match(
            err.message,
            /protected by anti-bot verification|requires JavaScript/i
          );
          return true;
        }
      );
    });
  });
});
