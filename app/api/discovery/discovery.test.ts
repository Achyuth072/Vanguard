import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GET } from "./route";
import { POST as ingestPOST } from "./ingest/route";
import { POST as dismissPOST } from "./dismiss/route";

describe("Discovery API Integration Tests", () => {
  const TEST_PREFIX = "test-disc-api-";
  let stagedJobId1: string;
  let stagedJobId2: string;
  let stagedJobId3: string;
  let normalJobId: string;

  before(async () => {
    // Cleanup any leftovers
    await db.job.deleteMany({
      where: {
        OR: [
          { dedupeKey: { startsWith: TEST_PREFIX } },
          { company: { startsWith: TEST_PREFIX } },
        ],
      },
    });

    // Seed test jobs
    const job1 = await db.job.create({
      data: {
        dedupeKey: `${TEST_PREFIX}job-1`,
        clusterKey: "cluster-1",
        title: `${TEST_PREFIX}Senior Fullstack Engineer`,
        company: `${TEST_PREFIX}Stripe`,
        location: "Bangalore",
        remoteStatus: "HYBRID",
        salaryMin: 4000000,
        salaryMax: 6000000,
        currency: "INR",
        employmentType: "FULL_TIME",
        description: "Looking for an experienced engineer with TypeScript and React skills.",
        url: "https://stripe.com/jobs/1",
        source: "GREENHOUSE",
        isStaged: true,
        status: "DISCOVERED",
      },
    });
    stagedJobId1 = job1.id;

    const job2 = await db.job.create({
      data: {
        dedupeKey: `${TEST_PREFIX}job-2`,
        clusterKey: "cluster-2",
        title: `${TEST_PREFIX}Staff Backend Engineer`,
        company: `${TEST_PREFIX}Anthropic`,
        location: "Remote",
        remoteStatus: "REMOTE",
        salaryMin: 5000000,
        salaryMax: 8000000,
        currency: "INR",
        employmentType: "FULL_TIME",
        description: "Build scalable distributed AI infrastructure with Go and Python.",
        url: "https://anthropic.com/jobs/2",
        source: "ASHBY",
        isStaged: true,
        status: "DISCOVERED",
      },
    });
    stagedJobId2 = job2.id;

    const job3 = await db.job.create({
      data: {
        dedupeKey: `${TEST_PREFIX}job-3`,
        clusterKey: "cluster-3",
        title: `${TEST_PREFIX}Frontend Developer`,
        company: `${TEST_PREFIX}Vercel`,
        location: "Remote",
        remoteStatus: "REMOTE",
        salaryMin: 3500000,
        salaryMax: 5000000,
        currency: "INR",
        employmentType: "FULL_TIME",
        description: "Develop next-generation web applications using Next.js and Tailwind.",
        url: "https://vercel.com/jobs/3",
        source: "GREENHOUSE",
        isStaged: true,
        status: "DISCOVERED",
      },
    });
    stagedJobId3 = job3.id;

    // Normal non-staged job (in Priority Inbox)
    const normalJob = await db.job.create({
      data: {
        dedupeKey: `${TEST_PREFIX}job-normal`,
        clusterKey: "cluster-normal",
        title: `${TEST_PREFIX}Staff Product Manager`,
        company: `${TEST_PREFIX}Google`,
        location: "Bangalore",
        remoteStatus: "ONSITE",
        description: "Lead product strategy.",
        url: "https://google.com/jobs/normal",
        source: "MANUAL",
        isStaged: false,
        status: "DISCOVERED",
      },
    });
    normalJobId = normalJob.id;
  });

  after(async () => {
    // Cleanup
    await db.job.deleteMany({
      where: {
        OR: [
          { dedupeKey: { startsWith: TEST_PREFIX } },
          { company: { startsWith: TEST_PREFIX } },
        ],
      },
    });
  });

  it("GET /api/discovery returns only staged jobs with match badges and pagination", async () => {
    const req = new NextRequest("http://localhost:3000/api/discovery?page=1&limit=50");
    const res = await GET(req);

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.success, true);
    assert.ok(json.data.jobs);
    assert.ok(json.data.pagination);

    const stagedJobIds = json.data.jobs.map((j: { id: string }) => j.id);
    assert.ok(stagedJobIds.includes(stagedJobId1));
    assert.ok(stagedJobIds.includes(stagedJobId2));
    assert.ok(stagedJobIds.includes(stagedJobId3));
    // Non-staged job must NOT be in discovery buffer
    assert.equal(stagedJobIds.includes(normalJobId), false);

    // Verify match badges are attached
    const jobWithBadges = json.data.jobs.find((j: { id: string }) => j.id === stagedJobId1);
    assert.ok(Array.isArray(jobWithBadges.matchBadges));
    assert.ok(jobWithBadges.matchBadges.length > 0);
    const sourceBadge = jobWithBadges.matchBadges.find((b: { type: string }) => b.type === "source");
    assert.ok(sourceBadge);
    assert.equal(sourceBadge.label, "GREENHOUSE");
  });

  it("GET /api/discovery filters by search query and source", async () => {
    // Search for test Anthropic
    const reqSearch = new NextRequest(`http://localhost:3000/api/discovery?search=${TEST_PREFIX}Anthropic`);
    const resSearch = await GET(reqSearch);
    const jsonSearch = await resSearch.json();

    assert.equal(jsonSearch.success, true);
    assert.equal(jsonSearch.data.jobs.length, 1);
    assert.equal(jsonSearch.data.jobs[0].id, stagedJobId2);

    // Filter by source "GREENHOUSE" with search prefix
    const reqSource = new NextRequest(`http://localhost:3000/api/discovery?source=GREENHOUSE&search=${TEST_PREFIX}`);
    const resSource = await GET(reqSource);
    const jsonSource = await resSource.json();

    assert.equal(jsonSource.success, true);
    assert.equal(jsonSource.data.jobs.length, 2);
    assert.ok(jsonSource.data.jobs.every((j: { source: string }) => j.source === "GREENHOUSE"));
  });

  it("POST /api/discovery/ingest scores staged jobs and moves them to Priority Inbox", async () => {
    const req = new NextRequest("http://localhost:3000/api/discovery/ingest", {
      method: "POST",
      body: JSON.stringify({
        jobIds: [stagedJobId1],
      }),
    });

    const res = await ingestPOST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.ingestedCount, 1);
    assert.equal(json.data.ingestedJobs[0].id, stagedJobId1);
    assert.ok(typeof json.data.ingestedJobs[0].score === "number");
    assert.ok(json.data.ingestedJobs[0].recommendation);

    // Verify in database: isStaged is now false, status is DISCOVERED
    const dbJob = await db.job.findUnique({
      where: { id: stagedJobId1 },
      include: { fitScore: true },
    });
    assert.equal(dbJob?.isStaged, false);
    assert.equal(dbJob?.status, "DISCOVERED");
    assert.ok(dbJob?.fitScore);
    assert.equal(typeof dbJob?.fitScore?.score, "number");

    // Verify audit event
    const event = await db.event.findFirst({
      where: {
        entityType: "Job",
        entityId: stagedJobId1,
        eventType: "JOB_INGESTED_FROM_DISCOVERY",
      },
    });
    assert.ok(event);
  });

  it("POST /api/discovery/dismiss batch dismisses staged jobs", async () => {
    const req = new NextRequest("http://localhost:3000/api/discovery/dismiss", {
      method: "POST",
      body: JSON.stringify({
        jobIds: [stagedJobId2, stagedJobId3],
        reason: "Salary below expectation or out of scope",
      }),
    });

    const res = await dismissPOST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.dismissedCount, 2);
    assert.deepEqual(json.data.dismissedJobIds.sort(), [stagedJobId2, stagedJobId3].sort());

    // Verify in database: isStaged is false, status is IGNORED
    const dbJob2 = await db.job.findUnique({ where: { id: stagedJobId2 } });
    const dbJob3 = await db.job.findUnique({ where: { id: stagedJobId3 } });
    assert.equal(dbJob2?.isStaged, false);
    assert.equal(dbJob2?.status, "IGNORED");
    assert.equal(dbJob3?.isStaged, false);
    assert.equal(dbJob3?.status, "IGNORED");

    // Verify audit event
    const event2 = await db.event.findFirst({
      where: {
        entityType: "Job",
        entityId: stagedJobId2,
        eventType: "JOB_DISMISSED_FROM_DISCOVERY",
      },
    });
    assert.ok(event2);
  });

  it("POST /api/discovery/ingest and dismiss return 400 for empty job lists", async () => {
    const ingestReq = new NextRequest("http://localhost:3000/api/discovery/ingest", {
      method: "POST",
      body: JSON.stringify({ jobIds: [] }),
    });
    const ingestRes = await ingestPOST(ingestReq);
    assert.equal(ingestRes.status, 400);

    const dismissReq = new NextRequest("http://localhost:3000/api/discovery/dismiss", {
      method: "POST",
      body: JSON.stringify({ jobIds: [] }),
    });
    const dismissRes = await dismissPOST(dismissReq);
    assert.equal(dismissRes.status, 400);
  });
});
