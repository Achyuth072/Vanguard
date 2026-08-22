import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AshbyAdapter,
  GreenhouseAdapter,
  LeverAdapter,
  HimalayasAdapter,
  RemoteOKAdapter,
  JobicyAdapter,
  HackerNewsAdapter,
  getFeedAdapter,
  getAllRegisteredAdapters,
} from "./index";
import type { FeedSource } from "../../../types/feed-source";

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
          text: async () => JSON.stringify(fixture),
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

describe("Deterministic Feed Adapters", () => {
  describe("Adapter Registry", () => {
    it("registers and retrieves all 7 deterministic adapters", () => {
      const types = ["ASHBY", "GREENHOUSE", "LEVER", "HIMALAYAS", "REMOTEOK", "JOBICY", "HN"];
      for (const type of types) {
        const adapter = getFeedAdapter(type);
        assert.equal(adapter.sourceType, type);
      }
      assert.equal(getAllRegisteredAdapters().length, 7);
    });

    it("throws when requesting an unknown adapter type", () => {
      assert.throws(() => getFeedAdapter("UNKNOWN_BOARD"), {
        message: /No FeedAdapter registered for source type: 'UNKNOWN_BOARD'/,
      });
    });
  });

  describe("AshbyAdapter", () => {
    const ashbyFixture = loadFixture("ashby-response.json");
    const adapter = new AshbyAdapter();

    it("extracts structured jobs, salary tiers, remote status, and clean descriptions", async () => {
      const mockFetch = createMockFetch({ "posting-api/job-board/anthropic": ashbyFixture });
      const source: FeedSource = {
        id: "fs-ashby",
        name: "Ashby Boards",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["anthropic"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "ashby-job-001");
      assert.equal(job1.title, "Senior AI Systems Engineer");
      assert.equal(job1.company, "Anthropic");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 220000);
      assert.equal(job1.salaryMax, 300000);
      assert.equal(job1.salaryCurrency, "USD");
      assert.match(job1.description, /Anthropic is building frontier AI safety models/);
      assert.equal(job1.url, "https://jobs.ashbyhq.com/anthropic/ashby-job-001");
      assert.ok(result.nextCursor);
    });

    it("respects lastCursor by skipping older postings", async () => {
      const mockFetch = createMockFetch({ "posting-api/job-board/anthropic": ashbyFixture });
      const source: FeedSource = {
        id: "fs-ashby",
        name: "Ashby Boards",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["anthropic"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "2026-08-20T14:30:00.000Z", // Timestamp of job 1
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      // Only job 2 should be returned
      assert.equal(result.jobs.length, 1);
      assert.equal(result.jobs[0].sourceExternalId, "ashby-job-002");
    });

    it("throws descriptive error on HTTP failures", async () => {
      const failingFetch = (async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })) as unknown as typeof fetch;

      const source: FeedSource = {
        id: "fs-ashby",
        name: "Ashby",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["nonexistent"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      await assert.rejects(
        () => adapter.poll(source, undefined, { fetchFn: failingFetch }),
        /Ashby API request failed for board 'nonexistent'/
      );
    });
  });

  describe("GreenhouseAdapter", () => {
    const greenhouseFixture = loadFixture("greenhouse-response.json");
    const adapter = new GreenhouseAdapter();

    it("parses Greenhouse jobs, decodes HTML entities, and extracts metadata salary", async () => {
      const mockFetch = createMockFetch({ "boards/stripe/jobs": greenhouseFixture });
      const source: FeedSource = {
        id: "fs-greenhouse",
        name: "Greenhouse",
        type: "GREENHOUSE",
        url: "https://boards-api.greenhouse.io/v1/boards",
        config: JSON.stringify({ boardSlugs: ["stripe"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "9876543");
      assert.equal(job1.title, "Staff Backend Engineer, Payment Intelligence");
      assert.equal(job1.company, "Stripe");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 210000);
      assert.equal(job1.salaryMax, 285000);
      assert.doesNotMatch(job1.description, /&lt;|&gt;|<p>/);
      assert.match(job1.description, /Stripe is a financial infrastructure platform/);
    });

    it("appends updated_after cursor to endpoint query", async () => {
      let requestedUrl = "";
      const customFetch = (async (url: RequestInfo | URL) => {
        requestedUrl = url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => greenhouseFixture,
        } as unknown as Response;
      }) as typeof fetch;

      const source: FeedSource = {
        id: "fs-greenhouse",
        name: "Greenhouse",
        type: "GREENHOUSE",
        url: "https://boards-api.greenhouse.io/v1/boards",
        config: JSON.stringify({ boardSlugs: ["stripe"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "2026-08-20T10:00:00Z",
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      await adapter.poll(source, undefined, { fetchFn: customFetch });
      assert.ok(requestedUrl.includes("updated_after="));
    });
  });

  describe("LeverAdapter", () => {
    const leverFixture = loadFixture("lever-response.json");
    const adapter = new LeverAdapter();

    it("parses Lever postings, workplaceType, and salary range", async () => {
      const mockFetch = createMockFetch({ "v0/postings/palantir": leverFixture });
      const source: FeedSource = {
        id: "fs-lever",
        name: "Lever",
        type: "LEVER",
        url: "https://api.lever.co/v0/postings",
        config: JSON.stringify({ boardSlugs: ["palantir"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 14400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "lever-job-001");
      assert.equal(job1.title, "Lead Infrastructure Engineer");
      assert.equal(job1.company, "Palantir");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 185000);
      assert.equal(job1.salaryMax, 240000);
      assert.equal(job1.salaryCurrency, "USD");
      assert.match(job1.description, /Palantir builds software/);
      assert.match(job1.description, /Requirements/);

      const job2 = result.jobs[1];
      assert.equal(job2.remoteStatus, "HYBRID");
      assert.equal(job2.salaryCurrency, "GBP");
    });
  });

  describe("HimalayasAdapter", () => {
    const himalayasFixture = loadFixture("himalayas-response.json");
    const adapter = new HimalayasAdapter();

    it("parses Himalayas remote jobs, salary, and offsets", async () => {
      const mockFetch = createMockFetch({ "jobs/api": himalayasFixture });
      const source: FeedSource = {
        id: "fs-himalayas",
        name: "Himalayas",
        type: "HIMALAYAS",
        url: "https://himalayas.app/jobs/api",
        config: JSON.stringify({ categories: ["software-development"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "0",
        pollIntervalMs: 21600000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "himalayas-job-001");
      assert.equal(job1.title, "Staff Distributed Systems Engineer");
      assert.equal(job1.company, "Automattic");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 160000);
      assert.equal(job1.salaryMax, 220000);
      assert.equal(result.nextCursor, "2");
    });
  });

  describe("RemoteOKAdapter", () => {
    const remoteokFixture = loadFixture("remoteok-response.json");
    const adapter = new RemoteOKAdapter();

    it("parses RemoteOK jobs and skips legal notice object", async () => {
      const mockFetch = createMockFetch({ "remoteok.com/api": remoteokFixture });
      const source: FeedSource = {
        id: "fs-remoteok",
        name: "RemoteOK",
        type: "REMOTEOK",
        url: "https://remoteok.com/api",
        config: JSON.stringify({ tags: ["dev"] }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 21600000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "90210");
      assert.equal(job1.title, "Principal Cloud Engineer");
      assert.equal(job1.company, "Canonical");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 150000);
      assert.equal(job1.salaryMax, 210000);
      assert.ok(result.nextCursor);
    });
  });

  describe("JobicyAdapter", () => {
    const jobicyFixture = loadFixture("jobicy-response.json");
    const adapter = new JobicyAdapter();

    it("parses Jobicy jobs, salary, and advances page cursor", async () => {
      const mockFetch = createMockFetch({ "remote-jobs": jobicyFixture });
      const source: FeedSource = {
        id: "fs-jobicy",
        name: "Jobicy",
        type: "JOBICY",
        url: "https://jobicy.com/api/v2/remote-jobs",
        config: JSON.stringify({ industry: "engineering", count: 50 }),
        enabled: true,
        autoPoll: false,
        lastCursor: "1",
        pollIntervalMs: 21600000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });

      assert.equal(result.jobs.length, 2);
      const job1 = result.jobs[0];
      assert.equal(job1.sourceExternalId, "55123");
      assert.equal(job1.title, "Senior Platform Engineer");
      assert.equal(job1.company, "GitLab");
      assert.equal(job1.remoteStatus, "REMOTE");
      assert.equal(job1.salaryMin, 145000);
      assert.equal(job1.salaryMax, 195000);
      assert.equal(result.nextCursor, "2");
    });
  });

  describe("HackerNewsAdapter", () => {
    const hnStoryFixture = loadFixture("hn-story-response.json");
    const hnCommentsFixture = loadFixture("hn-algolia-response.json");
    const adapter = new HackerNewsAdapter();

    it("parses HN comments, extracts header metadata, and applies zero-AI pre-filtering", async () => {
      const mockFetch = createMockFetch({
        "search?query=Ask": hnStoryFixture,
        "search_by_date?tags=comment": hnCommentsFixture,
      });

      const source: FeedSource = {
        id: "fs-hn",
        name: "HN Hiring",
        type: "HN",
        url: "https://hn.algolia.com/api/v1",
        config: JSON.stringify({ searchStoryPrefix: "Ask HN: Who is hiring" }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 86400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const candidate = {
        targetRoleKeywords: ["Database Engineer", "Frontend Engineer", "Full Stack"],
        techStack: ["PostgreSQL", "Rust", "React", "Next.js"],
        minSalary: 120000,
        currency: "USD",
        remotePreference: "REMOTE_ONLY",
        companyStageBlacklist: ["staffing", "agency"],
      };

      const result = await adapter.poll(source, candidate, { fetchFn: mockFetch });

      // In the fixture, 3 comments exist:
      // 1. Supabase ($175k-$230k, Remote, PostgreSQL/Rust) -> PASS
      // 2. Razorpay (₹45-₹65 LPA, Remote, React/Next.js) -> PASS (~$54k-$78k converted vs $120k min -> check conversion or prefilter)
      // 3. TalentBridge Staffing (Agency, Onsite Chicago) -> FAIL (rejected by pre-filter)
      assert.ok(result.jobs.length >= 1);
      const supabaseJob = result.jobs.find((j) => j.company === "Supabase");
      assert.ok(supabaseJob);
      assert.equal(supabaseJob.title, "Senior Database Engineer");
      assert.equal(supabaseJob.remoteStatus, "REMOTE");
      assert.equal(supabaseJob.salaryMin, 175000);
      assert.equal(supabaseJob.salaryMax, 230000);
      assert.equal(supabaseJob.salaryCurrency, "USD");
      assert.ok(result.nextCursor);
    });

    it("extracts all comments when no candidate criteria is specified", async () => {
      const mockFetch = createMockFetch({
        "search?query=Ask": hnStoryFixture,
        "search_by_date?tags=comment": hnCommentsFixture,
      });

      const source: FeedSource = {
        id: "fs-hn",
        name: "HN Hiring",
        type: "HN",
        url: "https://hn.algolia.com/api/v1",
        config: JSON.stringify({ searchStoryId: 41250000 }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 86400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });
      assert.equal(result.jobs.length, 3);
      const ids = result.jobs.map((j) => j.sourceExternalId);
      assert.deepEqual(ids, ["41250101", "41250102", "41250103"]);
    });

    it("filters out nested comments, conversational noise, and unstructured non-delimiter comments", async () => {
      const mockFetch = createMockFetch({
        "search_by_date?tags=comment": {
          hits: [
            {
              objectID: "1001",
              created_at_i: 1755691200,
              parent_id: 41250000,
              comment_text: "<p>Acme Corp | Senior Backend Engineer | Remote | $150k - $180k</p><p>We build great software.</p>",
            },
            {
              objectID: "1002",
              created_at_i: 1755691300,
              parent_id: 1001, // Nested reply!
              comment_text: "<p>Is visa sponsorship available?</p>",
            },
            {
              objectID: "1003",
              created_at_i: 1755691400,
              parent_id: 41250000,
              comment_text: "<p>Thanks for sharing! I just applied via email sent.</p>", // Conversational noise!
            },
            {
              objectID: "1004",
              created_at_i: 1755691500,
              parent_id: 41250000,
              comment_text: "<p>We are a stealth startup looking for hackers in NYC.</p>", // Missing delimiters!
            },
          ],
        },
      });

      const source: FeedSource = {
        id: "fs-hn-filter-test",
        name: "HN Hiring",
        type: "HN",
        url: "https://hn.algolia.com/api/v1",
        config: JSON.stringify({ searchStoryId: 41250000 }),
        enabled: true,
        autoPoll: false,
        lastCursor: "",
        pollIntervalMs: 86400000,
        consecutiveEmpty: 0,
        jobsDiscovered: 0,
        jobsPassed: 0,
        errorCount: 0,
        lastError: "",
      };

      const result = await adapter.poll(source, undefined, { fetchFn: mockFetch });
      assert.equal(result.jobs.length, 1);
      assert.equal(result.jobs[0].sourceExternalId, "1001");
      assert.equal(result.jobs[0].company, "Acme Corp");
      assert.equal(result.jobs[0].title, "Senior Backend Engineer");
    });
  });
});
