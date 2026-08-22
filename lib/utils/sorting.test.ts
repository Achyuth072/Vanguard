import test from "node:test";
import assert from "node:assert/strict";
import {
  sortJobsForInbox,
  sortJobsByRelevance,
  sortJobsByScore,
  sortJobsByRecent,
  getStatusSortPriority,
} from "./sorting";
import type { EnrichedJob, EnrichedFitScore, EnrichedApplication } from "@/lib/data";

function createMockFitScore(score: number): EnrichedFitScore {
  return {
    id: `fit-${Math.random().toString(36).slice(2, 7)}`,
    score,
    recommendation: score >= 80 ? "APPLY" : score >= 60 ? "REVIEW" : "IGNORE",
    skillsFit: score,
    experienceFit: score,
    domainFit: score,
    trajectoryFit: score,
    strengths: [],
    gaps: [],
    risks: [],
    reasoning: "Mock reasoning",
  };
}

function createMockApplication(appliedAt: Date = new Date("2026-08-01")): EnrichedApplication {
  return {
    id: `app-${Math.random().toString(36).slice(2, 7)}`,
    status: "APPLIED",
    appliedAt,
    firstResponseAt: null,
    responseTimeDays: null,
    rejectionStage: null,
    rejectionReason: null,
    resumeVersion: "v1",
    tailoredNotes: "",
    tailoredResume: "{}",
    questionAnswers: "[]",
    followUpAt: null,
  };
}

function createMockJob(overrides: Partial<EnrichedJob> = {}): EnrichedJob {
  return {
    id: `job-${Math.random().toString(36).slice(2, 7)}`,
    dedupeKey: `key-${Math.random().toString(36).slice(2, 7)}`,
    title: "Software Engineer",
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
    status: "DISCOVERED",
    postedAt: new Date("2026-08-01"),
    discoveredAt: new Date("2026-08-01"),
    companyName: "Acme Corp",
    role: "Software Engineer",
    dateApplied: new Date("2026-08-01"),
    aiAnalysis: null,
    fitScore: null,
    application: null,
    ...overrides,
  };
}

test("getStatusSortPriority", async (t) => {
  await t.test("ranks DISCOVERED highest", () => {
    assert.equal(getStatusSortPriority("DISCOVERED"), 0);
  });

  await t.test("ranks SHORTLISTED and PREPARED right after DISCOVERED", () => {
    assert.ok(getStatusSortPriority("SHORTLISTED") > getStatusSortPriority("DISCOVERED"));
    assert.ok(getStatusSortPriority("PREPARED") > getStatusSortPriority("DISCOVERED"));
    assert.ok(getStatusSortPriority("APPLIED") > getStatusSortPriority("SHORTLISTED"));
  });

  await t.test("ranks APPLIED before terminal states", () => {
    assert.ok(getStatusSortPriority("APPLIED") < getStatusSortPriority("REJECTED"));
    assert.ok(getStatusSortPriority("APPLIED") < getStatusSortPriority("GHOSTED"));
  });
});

test("compareJobsForInbox and sortJobsByRelevance", async (t) => {
  await t.test("Priority Inbox: sorts DISCOVERED jobs with highest score first, then APPLIED jobs with highest score", () => {
    const jobDiscovered90 = createMockJob({
      id: "disc-90",
      status: "DISCOVERED",
      fitScore: createMockFitScore(90),
      discoveredAt: new Date("2026-08-10"),
    });

    const jobDiscovered80 = createMockJob({
      id: "disc-80",
      status: "DISCOVERED",
      fitScore: createMockFitScore(80),
      discoveredAt: new Date("2026-08-15"),
    });

    const jobApplied95 = createMockJob({
      id: "app-95",
      status: "APPLIED",
      fitScore: createMockFitScore(95),
      discoveredAt: new Date("2026-08-05"),
      application: createMockApplication(new Date("2026-08-12")),
    });

    const jobApplied85 = createMockJob({
      id: "app-85",
      status: "APPLIED",
      fitScore: createMockFitScore(85),
      discoveredAt: new Date("2026-08-02"),
      application: createMockApplication(new Date("2026-08-11")),
    });

    const unsorted = [jobApplied95, jobDiscovered80, jobApplied85, jobDiscovered90];
    const sorted = sortJobsByRelevance(unsorted);

    assert.deepEqual(
      sorted.map((j) => j.id),
      ["disc-90", "disc-80", "app-95", "app-85"]
    );
  });

  await t.test("breaks score ties in DISCOVERED using discoveredAt descending", () => {
    const olderDisc90 = createMockJob({
      id: "older-disc-90",
      status: "DISCOVERED",
      fitScore: createMockFitScore(90),
      discoveredAt: new Date("2026-08-01"),
    });

    const newerDisc90 = createMockJob({
      id: "newer-disc-90",
      status: "DISCOVERED",
      fitScore: createMockFitScore(90),
      discoveredAt: new Date("2026-08-10"),
    });

    const sorted = sortJobsForInbox([olderDisc90, newerDisc90]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["newer-disc-90", "older-disc-90"]
    );
  });

  await t.test("Review tab (60-79): DISCOVERED sorted by score desc, then APPLIED sorted by score desc", () => {
    const disc75 = createMockJob({
      id: "disc-75",
      status: "DISCOVERED",
      fitScore: createMockFitScore(75),
      discoveredAt: new Date("2026-08-10"),
    });

    const disc65 = createMockJob({
      id: "disc-65",
      status: "DISCOVERED",
      fitScore: createMockFitScore(65),
      discoveredAt: new Date("2026-08-12"),
    });

    const app78 = createMockJob({
      id: "app-78",
      status: "APPLIED",
      fitScore: createMockFitScore(78),
      discoveredAt: new Date("2026-08-01"),
    });

    const app62 = createMockJob({
      id: "app-62",
      status: "APPLIED",
      fitScore: createMockFitScore(62),
      discoveredAt: new Date("2026-08-01"),
    });

    const sorted = sortJobsByRelevance([app78, disc65, app62, disc75]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["disc-75", "disc-65", "app-78", "app-62"]
    );
  });

  await t.test("All Jobs: DISCOVERED + score desc, then SHORTLISTED + score desc, then APPLIED + score desc, then REJECTED", () => {
    const disc95 = createMockJob({
      id: "disc-95",
      status: "DISCOVERED",
      fitScore: createMockFitScore(95),
      discoveredAt: new Date("2026-08-10"),
    });
    const disc65 = createMockJob({
      id: "disc-65",
      status: "DISCOVERED",
      fitScore: createMockFitScore(65),
      discoveredAt: new Date("2026-08-12"),
    });
    const short88 = createMockJob({
      id: "short-88",
      status: "SHORTLISTED",
      fitScore: createMockFitScore(88),
      discoveredAt: new Date("2026-08-08"),
    });
    const app90 = createMockJob({
      id: "app-90",
      status: "APPLIED",
      fitScore: createMockFitScore(90),
      discoveredAt: new Date("2026-08-05"),
    });
    const app70 = createMockJob({
      id: "app-70",
      status: "APPLIED",
      fitScore: createMockFitScore(70),
      discoveredAt: new Date("2026-08-03"),
    });
    const rej99 = createMockJob({
      id: "rej-99",
      status: "REJECTED",
      fitScore: createMockFitScore(99),
      discoveredAt: new Date("2026-08-01"),
    });

    const unsorted = [rej99, app70, disc65, app90, short88, disc95];
    const sorted = sortJobsByRelevance(unsorted);

    assert.deepEqual(
      sorted.map((j) => j.id),
      ["disc-95", "disc-65", "short-88", "app-90", "app-70", "rej-99"]
    );
  });

  await t.test("handles jobs without fitScore gracefully", () => {
    const withScore = createMockJob({
      id: "with-score",
      status: "DISCOVERED",
      fitScore: createMockFitScore(85),
    });
    const withoutScore = createMockJob({
      id: "without-score",
      status: "DISCOVERED",
      fitScore: null,
    });

    const sorted = sortJobsForInbox([withoutScore, withScore]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["with-score", "without-score"]
    );
  });
});

test("sortJobsByScore", async (t) => {
  await t.test("sorts strictly by fit score descending across all statuses", () => {
    const disc80 = createMockJob({
      id: "disc-80",
      status: "DISCOVERED",
      fitScore: createMockFitScore(80),
    });
    const app95 = createMockJob({
      id: "app-95",
      status: "APPLIED",
      fitScore: createMockFitScore(95),
    });
    const rej90 = createMockJob({
      id: "rej-90",
      status: "REJECTED",
      fitScore: createMockFitScore(90),
    });

    const sorted = sortJobsByScore([disc80, app95, rej90]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["app-95", "rej-90", "disc-80"]
    );
  });
});

test("sortJobsByRecent", async (t) => {
  await t.test("sorts strictly by recency (appliedAt or discoveredAt descending)", () => {
    const olderJob = createMockJob({
      id: "older",
      discoveredAt: new Date("2026-08-01"),
    });
    const newerJob = createMockJob({
      id: "newer",
      discoveredAt: new Date("2026-08-15"),
    });
    const appliedRecent = createMockJob({
      id: "applied-recent",
      discoveredAt: new Date("2026-08-01"),
      application: createMockApplication(new Date("2026-08-20")),
    });

    const sorted = sortJobsByRecent([olderJob, appliedRecent, newerJob]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["applied-recent", "newer", "older"]
    );
  });
});
