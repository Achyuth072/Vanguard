import test from "node:test";
import assert from "node:assert/strict";
import { compareJobsForInbox, sortJobsForInbox, getStatusSortPriority } from "./sorting";
import type { EnrichedJob } from "@/lib/data";

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

test("compareJobsForInbox and sortJobsForInbox", async (t) => {
  await t.test("sorts DISCOVERED jobs with highest score first, then APPLIED jobs with highest score", () => {
    const jobDiscovered90 = createMockJob({
      id: "disc-90",
      status: "DISCOVERED",
      fitScore: { score: 90 } as any,
      discoveredAt: new Date("2026-08-10"),
    });

    const jobDiscovered80 = createMockJob({
      id: "disc-80",
      status: "DISCOVERED",
      fitScore: { score: 80 } as any,
      discoveredAt: new Date("2026-08-15"),
    });

    const jobApplied95 = createMockJob({
      id: "app-95",
      status: "APPLIED",
      fitScore: { score: 95 } as any,
      discoveredAt: new Date("2026-08-05"),
      application: { appliedAt: new Date("2026-08-12") } as any,
    });

    const jobApplied85 = createMockJob({
      id: "app-85",
      status: "APPLIED",
      fitScore: { score: 85 } as any,
      discoveredAt: new Date("2026-08-02"),
      application: { appliedAt: new Date("2026-08-11") } as any,
    });

    const unsorted = [jobApplied95, jobDiscovered80, jobApplied85, jobDiscovered90];
    const sorted = sortJobsForInbox(unsorted);

    assert.deepEqual(
      sorted.map((j) => j.id),
      ["disc-90", "disc-80", "app-95", "app-85"]
    );
  });

  await t.test("breaks score ties in DISCOVERED using discoveredAt descending", () => {
    const olderDisc90 = createMockJob({
      id: "older-disc-90",
      status: "DISCOVERED",
      fitScore: { score: 90 } as any,
      discoveredAt: new Date("2026-08-01"),
    });

    const newerDisc90 = createMockJob({
      id: "newer-disc-90",
      status: "DISCOVERED",
      fitScore: { score: 90 } as any,
      discoveredAt: new Date("2026-08-10"),
    });

    const sorted = sortJobsForInbox([olderDisc90, newerDisc90]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["newer-disc-90", "older-disc-90"]
    );
  });

  await t.test("works identically for Review tab score range (60-79)", () => {
    const disc75 = createMockJob({
      id: "disc-75",
      status: "DISCOVERED",
      fitScore: { score: 75 } as any,
      discoveredAt: new Date("2026-08-10"),
    });

    const disc65 = createMockJob({
      id: "disc-65",
      status: "DISCOVERED",
      fitScore: { score: 65 } as any,
      discoveredAt: new Date("2026-08-12"),
    });

    const app78 = createMockJob({
      id: "app-78",
      status: "APPLIED",
      fitScore: { score: 78 } as any,
      discoveredAt: new Date("2026-08-01"),
    });

    const app62 = createMockJob({
      id: "app-62",
      status: "APPLIED",
      fitScore: { score: 62 } as any,
      discoveredAt: new Date("2026-08-01"),
    });

    const sorted = sortJobsForInbox([app78, disc65, app62, disc75]);
    assert.deepEqual(
      sorted.map((j) => j.id),
      ["disc-75", "disc-65", "app-78", "app-62"]
    );
  });

  await t.test("handles jobs without fitScore gracefully", () => {
    const withScore = createMockJob({
      id: "with-score",
      status: "DISCOVERED",
      fitScore: { score: 85 } as any,
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
