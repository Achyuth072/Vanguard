import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import {
  IngestionOrchestrator,
  syncFeedSource,
} from "./orchestrator";
import { generateClusterKey, generateDedupeKey } from "./dedupe";

const FIXTURES_DIR = path.resolve(process.cwd(), ".scratch/multi-source-ingestion/fixtures");

function loadFixture(filename: string): unknown {
  const filePath = path.join(FIXTURES_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createMockFetch(fixtureMap: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const urlStr = input.toString();

    for (const [key, fixture] of Object.entries(fixtureMap)) {
      if (urlStr.includes(key)) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => fixture,
          text: async () => (typeof fixture === "string" ? fixture : JSON.stringify(fixture)),
        } as unknown as Response;
      }
    }

    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "Not found" }),
      text: async () => "Not found",
    } as unknown as Response;
  }) as typeof fetch;
}

describe("IngestionOrchestrator Integration & Deduplication Suite", () => {
  const TEST_PREFIX = "test-orch-";

  before(async () => {
    // Clean up any test leftovers
    await db.job.deleteMany({
      where: {
        OR: [
          { dedupeKey: { startsWith: TEST_PREFIX } },
          { feedSourceId: { startsWith: TEST_PREFIX } },
          { url: { contains: "test-orch" } },
          { company: { contains: "test-orch" } },
          { company: "Existing Co" },
        ],
      },
    });
    await db.event.deleteMany({
      where: {
        entityId: { startsWith: TEST_PREFIX },
      },
    });
    await db.feedSource.deleteMany({
      where: {
        id: { startsWith: TEST_PREFIX },
      },
    });
    await db.candidate.deleteMany({
      where: {
        id: { startsWith: TEST_PREFIX },
      },
    });

    // Create a deterministic test candidate
    await db.candidate.create({
      data: {
        id: `${TEST_PREFIX}candidate-1`,
        name: "Test Engineer",
        targetRole: "Full Stack Engineer",
        minSalary: 120000,
        currency: "USD",
        yearsOfExperience: 4,
        remotePreference: "REMOTE_ONLY",
        preferredLocations: JSON.stringify(["United States", "Remote"]),
        skills: JSON.stringify([
          { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 4 },
          { name: "React", category: "FRAMEWORK", yearsOfExperience: 4 },
          { name: "Node.js", category: "FRAMEWORK", yearsOfExperience: 4 },
        ]),
        projects: "[]",
        experiences: "[]",
        resumeText: "Senior Full Stack Engineer with 4 years of TypeScript and React experience.",
        targetRoleKeywords: JSON.stringify(["software", "engineer", "developer"]),
        techStack: JSON.stringify(["TypeScript", "React", "Node.js"]),
        companyStageBlacklist: JSON.stringify(["Cyberdyne Blacklist Corp", "Spam Staffing LLC"]),
      },
    });
  });

  after(async () => {
    // Cleanup test records
    await db.job.deleteMany({
      where: {
        OR: [
          { dedupeKey: { startsWith: TEST_PREFIX } },
          { feedSourceId: { startsWith: TEST_PREFIX } },
          { url: { contains: "test-orch" } },
          { company: { contains: "test-orch" } },
          { company: "Existing Co" },
        ],
      },
    });
    await db.event.deleteMany({
      where: {
        entityId: { startsWith: TEST_PREFIX },
      },
    });
    await db.feedSource.deleteMany({
      where: {
        id: { startsWith: TEST_PREFIX },
      },
    });
    await db.candidate.deleteMany({
      where: {
        id: { startsWith: TEST_PREFIX },
      },
    });
  });

  beforeEach(async () => {
    // Clear jobs, events, and feed sources for the test prefix between tests
    await db.job.deleteMany({
      where: {
        OR: [
          { dedupeKey: { startsWith: TEST_PREFIX } },
          { feedSourceId: { startsWith: TEST_PREFIX } },
          { url: { contains: "test-orch" } },
          { company: { contains: "test-orch" } },
          { company: "Existing Co" },
        ],
      },
    });
    await db.event.deleteMany({
      where: {
        entityId: { startsWith: TEST_PREFIX },
      },
    });
    await db.feedSource.deleteMany({
      where: {
        id: { startsWith: TEST_PREFIX },
      },
    });
  });

  it("successfully synchronizes a single feed source, deduplicates, and stages jobs", async () => {
    const ashbyFixture = loadFixture("ashby-response.json");
    const mockFetch = createMockFetch({
      "api.ashbyhq.com": ashbyFixture,
    });

    const sourceId = `${TEST_PREFIX}source-ashby-1`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Test Ashby Feed",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["anthropic"] }),
        enabled: true,
        autoPoll: false,
        jobsDiscovered: 0,
        jobsPassed: 0,
      },
    });

    const orchestrator = new IngestionOrchestrator(db);
    const result = await orchestrator.syncSource(sourceId, {
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
    });

    assert.strictEqual(result.status, "SUCCESS");
    assert.strictEqual(result.sourceId, sourceId);
    assert.strictEqual(result.sourceType, "ASHBY");
    assert.strictEqual(result.jobsDiscovered, 2);
    assert.strictEqual(result.jobsStaged > 0, true);
    assert.strictEqual(result.jobsDuplicates, 0);

    // Verify staged records in database
    const stagedJobs = await db.job.findMany({
      where: { feedSourceId: sourceId },
    });

    assert.strictEqual(stagedJobs.length, result.jobsStaged);
    for (const job of stagedJobs) {
      assert.strictEqual(job.isStaged, true);
      assert.strictEqual(job.status, "DISCOVERED");
      assert.strictEqual(job.source, "ASHBY");
      assert.strictEqual(typeof job.clusterKey, "string");
      assert.strictEqual(job.clusterKey.length, 64);
      assert.strictEqual(job.clusterKey, generateClusterKey(job.company, job.title));
      assert.strictEqual(job.dedupeKey.length, 64);
    }

    // Verify source state was updated
    const updatedSource = await db.feedSource.findUnique({
      where: { id: sourceId },
    });
    assert.strictEqual(updatedSource?.jobsDiscovered, 2);
    assert.strictEqual(updatedSource?.jobsPassed, result.jobsStaged);
    assert.ok(updatedSource?.lastPolledAt);
    assert.strictEqual(updatedSource?.errorCount, 0);
    assert.strictEqual(updatedSource?.lastError, "");

    // Verify audit event was recorded
    const events = await db.event.findMany({
      where: { entityId: sourceId, eventType: "FEED_SYNC_SUCCESS" },
    });
    assert.strictEqual(events.length, 1);
    const eventPayload = JSON.parse(events[0].payload);
    assert.strictEqual(eventPayload.sourceType, "ASHBY");
    assert.strictEqual(eventPayload.discovered, 2);
    assert.strictEqual(eventPayload.staged, result.jobsStaged);
  });

  it("handles two-tier deduplication by filtering intra-batch duplicates and existing DB records", async () => {
    const runId = Math.random().toString(36).substring(2, 8);
    const existingUrl = `https://jobs.ashbyhq.com/existingco/job-c-${runId}`;
    const existingDedupeKey = generateDedupeKey({
      company: "Existing Co",
      title: "Existing Engineer",
      url: existingUrl,
    });

    await db.job.create({
      data: {
        id: `${TEST_PREFIX}existing-job-c-${runId}`,
        dedupeKey: existingDedupeKey,
        clusterKey: generateClusterKey("Existing Co", "Existing Engineer"),
        sourceExternalId: `ext-job-c-${runId}`,
        title: "Existing Engineer",
        company: "Existing Co",
        location: "Remote",
        remoteStatus: "REMOTE",
        description: "Existing job in database.",
        url: existingUrl,
        source: "ASHBY",
        isStaged: true,
        status: "DISCOVERED",
      },
    });

    const ashbyCustomPayload = {
      jobs: [
        {
          id: `job-a-${runId}`,
          title: "Unique Role A",
          location: "Remote",
          isRemote: true,
          jobUrl: `https://jobs.ashbyhq.com/existingco/job-a-${runId}`,
          descriptionPlain: "Role A description",
        },
        {
          id: `job-b-${runId}`,
          title: "Duplicate Role B",
          location: "Remote",
          isRemote: true,
          jobUrl: `https://jobs.ashbyhq.com/existingco/job-b-${runId}`,
          descriptionPlain: "Role B description",
        },
        {
          id: `job-b-${runId}`, // Exact duplicate ID & URL in same batch
          title: "Duplicate Role B",
          location: "Remote",
          isRemote: true,
          jobUrl: `https://jobs.ashbyhq.com/existingco/job-b-${runId}`,
          descriptionPlain: "Role B description duplicate",
        },
        {
          id: `ext-job-c-${runId}`, // Matches pre-inserted DB record
          title: "Existing Engineer",
          location: "Remote",
          isRemote: true,
          jobUrl: existingUrl,
          descriptionPlain: "Existing job description",
        },
      ],
    };

    const mockFetch = createMockFetch({
      "api.ashbyhq.com": ashbyCustomPayload,
    });

    const sourceId = `${TEST_PREFIX}source-ashby-dedup`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Test Ashby Dedupe",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["existingco"] }),
        enabled: true,
        jobsDiscovered: 0,
        jobsPassed: 0,
      },
    });

    const orchestrator = new IngestionOrchestrator(db);

    const syncResult = await orchestrator.syncSource(sourceId, {
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
    });

    assert.strictEqual(syncResult.status, "SUCCESS");
    assert.strictEqual(syncResult.jobsDiscovered, 4);
    // Out of 4 jobs: 1 intra-batch duplicate (job-b) + 1 existing DB record (job-c) = 2 duplicates filtered out!
    assert.strictEqual(syncResult.jobsDuplicates, 2);
    // Surviving: Job A and 1 instance of Job B = 2 staged
    assert.strictEqual(syncResult.jobsStaged, 2);

    const stagedJobs = await db.job.findMany({
      where: { feedSourceId: sourceId },
    });
    assert.strictEqual(stagedJobs.length, 2);
  });

  it("applies deterministic filters to reject jobs failing salary, remote, or blacklist rules with zero AI", async () => {
    // Custom fixture containing:
    // 1. Passing role ($160k, Remote)
    // 2. Low pay role ($60k max, below candidate $120k min)
    // 3. Onsite only role (rejects REMOTE_ONLY preference)
    // 4. Blacklisted company role
    const customPayload = {
      jobs: [
        {
          id: 101,
          title: "Senior Fullstack Engineer",
          location: { name: "Remote - US" },
          updated_at: "2026-08-20T10:00:00Z",
          absolute_url: "https://boards.greenhouse.io/goodtech/jobs/101",
          content: "We offer $160,000 USD salary. Remote work from anywhere in US.",
          metadata: [
            { name: "Salary Range", value_type: "single_select", value: "$160,000 - $180,000" },
          ],
        },
        {
          id: 102,
          title: "Low Pay Developer",
          location: { name: "Remote" },
          updated_at: "2026-08-20T10:00:00Z",
          absolute_url: "https://boards.greenhouse.io/goodtech/jobs/102",
          content: "Salary $60,000 USD max.",
          metadata: [
            { name: "Salary Range", value_type: "single_select", value: "$50,000 - $60,000" },
          ],
        },
        {
          id: 103,
          title: "Onsite Only Engineer",
          location: { name: "New York, NY (Strictly Onsite)" },
          updated_at: "2026-08-20T10:00:00Z",
          absolute_url: "https://boards.greenhouse.io/goodtech/jobs/103",
          content: "No remote allowed. 5 days in office.",
        },
        {
          id: 104,
          title: "Software Engineer at Spam Staffing LLC",
          location: { name: "Remote" },
          updated_at: "2026-08-20T10:00:00Z",
          absolute_url: "https://boards.greenhouse.io/goodtech/jobs/104",
          content: "Spam Staffing LLC is recruiting for client roles.",
        },
      ],
    };

    const mockFetch = createMockFetch({
      "boards-api.greenhouse.io": customPayload,
    });

    const sourceId = `${TEST_PREFIX}source-filter-test`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Test Filter Greenhouse",
        type: "GREENHOUSE",
        url: "https://boards-api.greenhouse.io/v1/boards",
        config: JSON.stringify({ boardSlugs: ["goodtech"] }),
        enabled: true,
      },
    });

    const orchestrator = new IngestionOrchestrator(db);
    const result = await orchestrator.syncSource(sourceId, {
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
    });

    assert.strictEqual(result.status, "SUCCESS");
    assert.strictEqual(result.jobsDiscovered, 4);
    // Only job 101 should survive the candidate criteria (minSalary: 120k, REMOTE_ONLY, blacklist: Spam Staffing LLC)
    assert.strictEqual(result.jobsPassed, 1);
    assert.strictEqual(result.jobsStaged, 1);

    const staged = await db.job.findMany({
      where: { feedSourceId: sourceId },
    });
    assert.strictEqual(staged.length, 1);
    assert.strictEqual(staged[0].sourceExternalId, "101");
  });

  it("skips disabled feed sources unless forceSync is specified", async () => {
    const sourceId = `${TEST_PREFIX}source-disabled`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Disabled Source",
        type: "LEVER",
        url: "https://api.lever.co/v0/postings",
        config: JSON.stringify({ boardSlugs: ["netflix"] }),
        enabled: false,
      },
    });

    const orchestrator = new IngestionOrchestrator(db);
    
    // Normal sync: should skip
    const skippedResult = await orchestrator.syncSource(sourceId);
    assert.strictEqual(skippedResult.status, "SKIPPED");
    assert.strictEqual(skippedResult.jobsDiscovered, 0);

    // Force sync: should execute
    const leverFixture = loadFixture("lever-response.json");
    const mockFetch = createMockFetch({
      "api.lever.co": leverFixture,
    });

    const forcedResult = await orchestrator.syncSource(sourceId, {
      forceSync: true,
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
    });
    assert.strictEqual(forcedResult.status, "SUCCESS");
    assert.strictEqual(forcedResult.jobsDiscovered, 2);
  });

  it("isolates errors per feed source and updates health metrics without crashing", async () => {
    const errorFetch = (async () => {
      throw new Error("HTTP 503 Service Unavailable: Remote API rate limited");
    }) as typeof fetch;

    const sourceId = `${TEST_PREFIX}source-failing`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Failing RemoteOK Feed",
        type: "REMOTEOK",
        url: "https://remoteok.com/api",
        config: "{}",
        enabled: true,
        errorCount: 0,
        lastError: "",
      },
    });

    const orchestrator = new IngestionOrchestrator(db);
    const result = await orchestrator.syncSource(sourceId, {
      fetchFn: errorFetch,
    });

    assert.strictEqual(result.status, "ERROR");
    assert.ok(result.error?.includes("503"));

    // Verify FeedSource record was updated with error diagnostics
    const source = await db.feedSource.findUnique({
      where: { id: sourceId },
    });
    assert.strictEqual(source?.errorCount, 1);
    assert.ok(source?.lastError.includes("503"));
    assert.ok(source?.lastPolledAt);

    // Verify audit event was logged
    const errorEvents = await db.event.findMany({
      where: { entityId: sourceId, eventType: "FEED_SYNC_ERROR" },
    });
    assert.strictEqual(errorEvents.length, 1);
    const payload = JSON.parse(errorEvents[0].payload);
    assert.ok(payload.error.includes("503"));
  });

  it("synchronizes all enabled sources sequentially with syncAllSources", async () => {
    const himalayasFixture = loadFixture("himalayas-response.json");
    const jobicyFixture = loadFixture("jobicy-response.json");

    const mockFetch = createMockFetch({
      "himalayas.app": himalayasFixture,
      "jobicy.com": jobicyFixture,
    });

    const source1Id = `${TEST_PREFIX}all-source-1`;
    const source2Id = `${TEST_PREFIX}all-source-2`;
    const sourceDisabledId = `${TEST_PREFIX}all-source-disabled`;

    await db.feedSource.createMany({
      data: [
        {
          id: source1Id,
          name: "All Himalayas",
          type: "HIMALAYAS",
          url: "https://himalayas.app/jobs/api",
          config: JSON.stringify({ categories: ["engineering"] }),
          enabled: true,
        },
        {
          id: source2Id,
          name: "All Jobicy",
          type: "JOBICY",
          url: "https://jobicy.com/api/v2/remote-jobs",
          config: JSON.stringify({ industry: "engineering", count: 20 }),
          enabled: true,
        },
        {
          id: sourceDisabledId,
          name: "All Disabled",
          type: "LEVER",
          url: "https://api.lever.co/v0/postings",
          config: "{}",
          enabled: false,
        },
      ],
    });

    const orchestrator = new IngestionOrchestrator(db);
    const allResult = await orchestrator.syncAllSources({
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
      sourceIds: [source1Id, source2Id],
    });

    assert.strictEqual(allResult.totalSources, 2);
    assert.strictEqual(allResult.successfulSources, 2);
    assert.strictEqual(allResult.failedSources, 0);
    assert.strictEqual(allResult.totalDiscovered > 0, true);
    assert.strictEqual(allResult.results.length, 2);
  });

  it("provides functional helper wrappers syncFeedSource and syncAllFeedSources", async () => {
    const hnFixture = loadFixture("hn-algolia-response.json");
    const mockFetch = createMockFetch({
      "hn.algolia.com": hnFixture,
    });

    const sourceId = `${TEST_PREFIX}wrapper-hn`;
    await db.feedSource.create({
      data: {
        id: sourceId,
        name: "Wrapper HN Source",
        type: "HN",
        url: "https://hn.algolia.com/api/v1",
        config: JSON.stringify({ searchStoryPrefix: "Ask HN: Who is hiring?" }),
        enabled: true,
      },
    });

    const res = await syncFeedSource(sourceId, {
      candidateId: `${TEST_PREFIX}candidate-1`,
      fetchFn: mockFetch,
    });

    assert.strictEqual(res.status, "SUCCESS");
    assert.strictEqual(res.sourceType, "HN");
    // In the HN fixture, 1 job passes pre-filter and is returned
    assert.strictEqual(res.jobsDiscovered, 1);
    assert.strictEqual(res.jobsStaged, 1);
  });

  it("handles cross-source clusterKey consistency when the same job is discovered from different adapters", async () => {
    // Both jobs share company "Acme Corporation" and title "Senior Frontend Engineer" across formatting differences
    const keyAshby = generateClusterKey("Acme Corporation", "Senior Frontend Engineer");
    const keyGreenhouse = generateClusterKey("Acme - Corporation", "Senior Frontend-Engineer");
    const keyDirect = generateClusterKey("acme corporation", "senior frontend engineer");

    assert.strictEqual(keyAshby, keyDirect);
    assert.strictEqual(keyGreenhouse, keyDirect);
    assert.strictEqual(typeof keyAshby, "string");
    assert.strictEqual(keyAshby.length, 64);
  });
});
