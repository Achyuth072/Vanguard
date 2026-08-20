import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDaysSinceApplied,
  isApplicationStale,
  isApplicationGhostable,
  identifyGhostableJobs,
  autoGhostStaleApplications,
  DEFAULT_GHOST_THRESHOLD_DAYS,
  STALE_THRESHOLD_DAYS,
} from "./auto-ghost";
import { db } from "../db";
import type { EnrichedJob } from "../data";

function createMockJob(overrides: Partial<EnrichedJob> = {}): EnrichedJob {
  return {
    id: `job-${Math.random().toString(36).slice(2, 7)}`,
    dedupeKey: `key-${Math.random().toString(36).slice(2, 7)}`,
    title: "Fullstack Engineer",
    company: "Acme Corp",
    location: "Remote",
    remoteStatus: "REMOTE",
    salaryMin: 2000000,
    salaryMax: 3000000,
    currency: "INR",
    employmentType: "FULL_TIME",
    description: "Job description",
    url: "https://example.com/job",
    source: "MANUAL",
    status: "APPLIED",
    postedAt: new Date("2026-07-01"),
    discoveredAt: new Date("2026-07-01"),
    companyName: "Acme Corp",
    role: "Fullstack Engineer",
    dateApplied: new Date("2026-07-01"),
    aiAnalysis: null,
    fitScore: null,
    application: {
      id: `app-${Math.random().toString(36).slice(2, 7)}`,
      status: "APPLIED",
      appliedAt: new Date("2026-07-15T00:00:00Z"),
      firstResponseAt: null,
      responseTimeDays: null,
      rejectionStage: null,
      rejectionReason: null,
      resumeVersion: "v1",
      tailoredNotes: "",
      followUpAt: null,
    },
    ...overrides,
  };
}

test("calculateDaysSinceApplied", async (t) => {
  const relativeTo = new Date("2026-08-10T00:00:00Z");

  await t.test("returns correct integer days difference", () => {
    const appliedAt = new Date("2026-07-20T00:00:00Z"); // 21 days before Aug 10
    assert.equal(calculateDaysSinceApplied(appliedAt, relativeTo), 21);
  });

  await t.test("returns 0 for applied on same day or future date", () => {
    const sameDay = new Date("2026-08-10T00:00:00Z");
    assert.equal(calculateDaysSinceApplied(sameDay, relativeTo), 0);
  });

  await t.test("returns null if appliedAt is null or undefined", () => {
    assert.equal(calculateDaysSinceApplied(null, relativeTo), null);
    assert.equal(calculateDaysSinceApplied(undefined, relativeTo), null);
  });
});

test("isApplicationStale and isApplicationGhostable", async (t) => {
  const relativeTo = new Date("2026-08-10T00:00:00Z");

  await t.test("marks application stale at 14+ days and ghostable at 21+ days", () => {
    const job10d = createMockJob({
      application: {
        id: "app-1",
        status: "APPLIED",
        appliedAt: new Date("2026-07-31T00:00:00Z"), // 10 days
        firstResponseAt: null,
        responseTimeDays: null,
        rejectionStage: null,
        rejectionReason: null,
        resumeVersion: "v1",
        tailoredNotes: "",
        followUpAt: null,
      },
    });

    const job16d = createMockJob({
      application: {
        id: "app-2",
        status: "APPLIED",
        appliedAt: new Date("2026-07-25T00:00:00Z"), // 16 days
        firstResponseAt: null,
        responseTimeDays: null,
        rejectionStage: null,
        rejectionReason: null,
        resumeVersion: "v1",
        tailoredNotes: "",
        followUpAt: null,
      },
    });

    const job25d = createMockJob({
      application: {
        id: "app-3",
        status: "APPLIED",
        appliedAt: new Date("2026-07-16T00:00:00Z"), // 25 days
        firstResponseAt: null,
        responseTimeDays: null,
        rejectionStage: null,
        rejectionReason: null,
        resumeVersion: "v1",
        tailoredNotes: "",
        followUpAt: null,
      },
    });

    assert.equal(isApplicationStale(job10d, 14, relativeTo), false);
    assert.equal(isApplicationGhostable(job10d, 21, relativeTo), false);

    assert.equal(isApplicationStale(job16d, 14, relativeTo), true);
    assert.equal(isApplicationGhostable(job16d, 21, relativeTo), false);

    assert.equal(isApplicationStale(job25d, 14, relativeTo), true);
    assert.equal(isApplicationGhostable(job25d, 21, relativeTo), true);
  });

  await t.test("does not mark ghostable if recruiter already responded or terminal state", () => {
    const jobWithResponse = createMockJob({
      status: "SCREENING",
      application: {
        id: "app-4",
        status: "SCREENING",
        appliedAt: new Date("2026-07-01T00:00:00Z"), // 40 days ago
        firstResponseAt: new Date("2026-07-05T00:00:00Z"),
        responseTimeDays: 4,
        rejectionStage: null,
        rejectionReason: null,
        resumeVersion: "v1",
        tailoredNotes: "",
        followUpAt: null,
      },
    });

    const jobRejected = createMockJob({
      status: "REJECTED",
      application: {
        id: "app-5",
        status: "REJECTED",
        appliedAt: new Date("2026-07-01T00:00:00Z"),
        firstResponseAt: null,
        responseTimeDays: null,
        rejectionStage: "RESUME_SCREEN",
        rejectionReason: "SKILLS_GAP",
        resumeVersion: "v1",
        tailoredNotes: "",
        followUpAt: null,
      },
    });

    assert.equal(isApplicationGhostable(jobWithResponse, 21, relativeTo), false);
    assert.equal(isApplicationGhostable(jobRejected, 21, relativeTo), false);
  });
});

test("identifyGhostableJobs filters list accurately", async (t) => {
  const relativeTo = new Date("2026-08-10T00:00:00Z");
  const jobRecent = createMockJob({
    id: "job-recent",
    status: "APPLIED",
    application: {
      id: "app-recent",
      status: "APPLIED",
      appliedAt: new Date("2026-08-01T00:00:00Z"), // 9 days ago
      firstResponseAt: null,
      responseTimeDays: null,
      rejectionStage: null,
      rejectionReason: null,
      resumeVersion: "v1",
      tailoredNotes: "",
      followUpAt: null,
    },
  });

  const jobOld = createMockJob({
    id: "job-old",
    status: "APPLIED",
    application: {
      id: "app-old",
      status: "APPLIED",
      appliedAt: new Date("2026-07-10T00:00:00Z"), // 31 days ago
      firstResponseAt: null,
      responseTimeDays: null,
      rejectionStage: null,
      rejectionReason: null,
      resumeVersion: "v1",
      tailoredNotes: "",
      followUpAt: null,
    },
  });

  const identified = identifyGhostableJobs([jobRecent, jobOld], 21, relativeTo);
  assert.equal(identified.length, 1);
  assert.equal(identified[0].job.id, "job-old");
  assert.equal(identified[0].daysPending, 31);
});

test("autoGhostStaleApplications database transition and event logging", async (t) => {
  const dedupeKey1 = `test_ghost_old_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dedupeKey2 = `test_ghost_recent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const oldJob = await db.job.create({
    data: {
      dedupeKey: dedupeKey1,
      title: "Backend Engineer",
      company: "GhostCorp",
      status: "APPLIED",
      description: "Job desc",
      application: {
        create: {
          status: "APPLIED",
          appliedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
        },
      },
    },
  });

  const recentJob = await db.job.create({
    data: {
      dedupeKey: dedupeKey2,
      title: "Frontend Engineer",
      company: "FastCorp",
      status: "APPLIED",
      description: "Job desc",
      application: {
        create: {
          status: "APPLIED",
          appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
      },
    },
  });

  t.after(async () => {
    await db.event.deleteMany({ where: { entityId: { in: [oldJob.id, recentJob.id] } } });
    await db.application.deleteMany({ where: { jobId: { in: [oldJob.id, recentJob.id] } } });
    await db.job.deleteMany({ where: { id: { in: [oldJob.id, recentJob.id] } } });
  });

  const result = await autoGhostStaleApplications({ thresholdDays: 21 });
  assert.ok(result.affectedJobIds.includes(oldJob.id));
  assert.ok(!result.affectedJobIds.includes(recentJob.id));

  const updatedOldJob = await db.job.findUnique({
    where: { id: oldJob.id },
    include: { application: true },
  });
  assert.equal(updatedOldJob?.status, "GHOSTED");
  assert.equal(updatedOldJob?.application?.status, "GHOSTED");

  // Verify Event audit log
  const events = await db.event.findMany({
    where: { entityId: oldJob.id, eventType: "LIFECYCLE_AUTO_GHOSTED" },
  });
  assert.equal(events.length, 1);
});
