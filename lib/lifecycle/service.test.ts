import test from "node:test";
import assert from "node:assert/strict";
import {
  transitionApplicationStatus,
  calculateResponseTimeDays,
  isValidTransition,
} from "./service";
import { getJobs } from "../data";
import { db } from "../db";

test("Application Lifecycle Service & State Machine", async (t) => {
  const dedupeKey = `test_lifecycle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const testJob = await db.job.create({
    data: {
      dedupeKey,
      title: "Staff Fullstack Engineer",
      company: "Linear Technologies",
      location: "San Francisco, CA",
      remoteStatus: "REMOTE",
      status: "DISCOVERED",
      description: "Leading frontend architecture and cloud integrations.",
      fitScore: {
        create: {
          score: 92,
          recommendation: "APPLY",
          skillsFit: 95,
          experienceFit: 90,
          domainFit: 90,
          trajectoryFit: 88,
          strengths: JSON.stringify(["React", "TypeScript", "Prisma"]),
          gaps: JSON.stringify([]),
          risks: JSON.stringify([]),
          reasoning: "Exceptional architecture and TypeScript alignment.",
        },
      },
    },
  });

  t.after(async () => {
    await db.event.deleteMany({ where: { entityId: testJob.id } });
    await db.application.deleteMany({ where: { jobId: testJob.id } });
    await db.fitScore.deleteMany({ where: { jobId: testJob.id } });
    await db.job.deleteMany({ where: { id: testJob.id } });
  });

  await t.test("calculateResponseTimeDays calculates fractional days accurately", () => {
    const applied = new Date("2026-08-01T10:00:00Z");
    const response1 = new Date("2026-08-04T10:00:00Z");
    assert.equal(calculateResponseTimeDays(applied, response1), 3);

    const response2 = new Date("2026-08-01T22:00:00Z");
    assert.equal(calculateResponseTimeDays(applied, response2), 0.5);

    // Negative elapsed time clamp
    const before = new Date("2026-07-31T10:00:00Z");
    assert.equal(calculateResponseTimeDays(applied, before), 0);
  });

  await t.test("isValidTransition validates permitted and forbidden transitions", () => {
    assert.equal(isValidTransition("DISCOVERED", "SHORTLISTED"), true);
    assert.equal(isValidTransition("SHORTLISTED", "PREPARED"), true);
    assert.equal(isValidTransition("SHORTLISTED", "INTERVIEW"), true);
    assert.equal(isValidTransition("PREPARED", "APPLIED"), true);
    assert.equal(isValidTransition("PREPARED", "SCREENING"), true);
    assert.equal(isValidTransition("PREPARED", "INTERVIEW"), true);
    assert.equal(isValidTransition("PREPARED", "OFFER"), true);
    assert.equal(isValidTransition("APPLIED", "SCREENING"), true);
    assert.equal(isValidTransition("APPLIED", "ASSESSMENT"), true);
    assert.equal(isValidTransition("APPLIED", "TAKE_HOME"), true);
    assert.equal(isValidTransition("APPLIED", "INTERVIEW"), true);
    assert.equal(isValidTransition("APPLIED", "PREPARED"), true);
    assert.equal(isValidTransition("APPLIED", "REJECTED"), true);
    assert.equal(isValidTransition("APPLIED", "DISCOVERED"), true);
    assert.equal(isValidTransition("SHORTLISTED", "DISCOVERED"), true);
    assert.equal(isValidTransition("PREPARED", "DISCOVERED"), true);
    assert.equal(isValidTransition("SCREENING", "PREPARED"), true);
    assert.equal(isValidTransition("SCREENING", "ASSESSMENT"), true);
    assert.equal(isValidTransition("SCREENING", "TAKE_HOME_OA"), true);
    assert.equal(isValidTransition("SCREENING", "SHORTLISTED"), true);
    assert.equal(isValidTransition("SCREENING", "OFFER"), true);
    assert.equal(isValidTransition("ASSESSMENT", "INTERVIEW"), true);
    assert.equal(isValidTransition("ASSESSMENT", "REJECTED"), true);
    assert.equal(isValidTransition("OFFER", "PREPARED"), true);
    assert.equal(isValidTransition("DISCOVERED", "OFFER"), false);
    assert.equal(isValidTransition("ARCHIVED", "DISCOVERED"), true);
    assert.equal(isValidTransition("ARCHIVED", "SHORTLISTED"), true);
    assert.equal(isValidTransition("ARCHIVED", "PREPARED"), true);
    assert.equal(isValidTransition("ARCHIVED", "APPLIED"), true);
    assert.equal(isValidTransition("ARCHIVED", "ASSESSMENT"), true);
    assert.equal(isValidTransition("ARCHIVED", "INTERVIEW"), true);
    assert.equal(isValidTransition("ARCHIVED", "OFFER"), true);
    assert.equal(isValidTransition("IGNORED", "DISCOVERED"), true);
  });



  await t.test("transitions through progressive lifecycle states", async () => {
    // 1. SHORTLISTED
    const res1 = await transitionApplicationStatus(testJob.id, "SHORTLISTED", {
      note: "Candidate marked high priority",
    });
    assert.equal(res1.newStatus, "SHORTLISTED");
    assert.equal(res1.previousStatus, "DISCOVERED");

    let app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);
    assert.equal(app.status, "SHORTLISTED");
    assert.equal(app.appliedAt, null);

    // 2. PREPARED
    const res2 = await transitionApplicationStatus(testJob.id, "PREPARED");
    assert.equal(res2.newStatus, "PREPARED");
    assert.equal(res2.previousStatus, "SHORTLISTED");

    // 3. APPLIED
    const appliedTimestamp = new Date("2026-08-10T12:00:00Z");
    const res3 = await transitionApplicationStatus(testJob.id, "APPLIED", {
      appliedAt: appliedTimestamp,
    });
    assert.equal(res3.newStatus, "APPLIED");
    assert.ok(res3.appliedAt);

    app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);
    assert.equal(app.status, "APPLIED");
    assert.equal(app.appliedAt?.toISOString(), appliedTimestamp.toISOString());
    assert.equal(app.firstResponseAt, null);
    assert.equal(app.responseTimeDays, null);

    // 4. SCREENING (triggers first response latency calculation)
    const screeningTimestamp = new Date("2026-08-13T18:00:00Z"); // 3.25 days later
    const res4 = await transitionApplicationStatus(testJob.id, "SCREENING", {
      firstResponseAt: screeningTimestamp,
    });
    assert.equal(res4.newStatus, "SCREENING");
    assert.equal(res4.responseTimeDays, 3.25);
    assert.ok(res4.firstResponseAt);

    app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);
    assert.equal(app.status, "SCREENING");
    assert.equal(app.responseTimeDays, 3.25);
    assert.equal(app.firstResponseAt?.toISOString(), screeningTimestamp.toISOString());

    // 5. ASSESSMENT (Take-home / Online Assessment via TAKE_HOME alias)
    const res5 = await transitionApplicationStatus(testJob.id, "TAKE_HOME");
    assert.equal(res5.newStatus, "ASSESSMENT");
    assert.equal(res5.previousStatus, "SCREENING");

    app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);
    assert.equal(app.status, "ASSESSMENT");

    // 6. INTERVIEW
    const res6 = await transitionApplicationStatus(testJob.id, "INTERVIEW");
    assert.equal(res6.newStatus, "INTERVIEW");

    // 7. OFFER
    const res7 = await transitionApplicationStatus(testJob.id, "OFFER");
    assert.equal(res7.newStatus, "OFFER");
  });

  await t.test("handles rejection with structured stage and reason", async () => {
    const res = await transitionApplicationStatus(testJob.id, "REJECTED", {
      rejectionStage: "TECHNICAL_INTERVIEW",
      rejectionReason: "COMPENSATION_MISMATCH",
      note: "Role salary band was below minimum target",
    });

    assert.equal(res.newStatus, "REJECTED");
    assert.equal(res.rejectionStage, "TECHNICAL_INTERVIEW");
    assert.equal(res.rejectionReason, "COMPENSATION_MISMATCH");

    const app = await db.application.findUnique({ where: { jobId: testJob.id } });
    assert.ok(app);
    assert.equal(app.status, "REJECTED");
    assert.equal(app.rejectionStage, "TECHNICAL_INTERVIEW");
    assert.equal(app.rejectionReason, "COMPENSATION_MISMATCH");

    // Verify Event audit log
    const events = await db.event.findMany({
      where: { entityId: testJob.id, eventType: "STATUS_TRANSITION" },
      orderBy: { timestamp: "desc" },
    });
    const latestEvent = events[0];
    const payload = JSON.parse(latestEvent.payload);
    assert.equal(payload.newStatus, "REJECTED");
    assert.equal(payload.rejectionStage, "TECHNICAL_INTERVIEW");
    assert.equal(payload.rejectionReason, "COMPENSATION_MISMATCH");
    assert.equal(payload.note, "Role salary band was below minimum target");
  });

  await t.test("rejects invalid transition when not forced", async () => {
    // Reset to DISCOVERED for this check
    await db.job.update({ where: { id: testJob.id }, data: { status: "DISCOVERED" } });

    await assert.rejects(
      async () => {
        await transitionApplicationStatus(testJob.id, "OFFER");
      },
      {
        message: /Invalid lifecycle transition from DISCOVERED to OFFER/,
      }
    );

    // Permitted if force is set
    const forced = await transitionApplicationStatus(testJob.id, "OFFER", { force: true });
    assert.equal(forced.newStatus, "OFFER");
  });

  await t.test("getJobs returns all enriched lifecycle fields", async () => {
    const jobs = await getJobs();
    const found = jobs.find((j) => j.id === testJob.id);
    assert.ok(found);
    assert.ok(found.application);
    assert.equal(found.application.rejectionStage, "TECHNICAL_INTERVIEW");
    assert.equal(found.application.rejectionReason, "COMPENSATION_MISMATCH");
    assert.equal(found.application.responseTimeDays, 3.25);
    assert.ok(found.application.firstResponseAt);
    assert.ok(found.application.appliedAt);
  });

  await t.test("allows resetting APPLIED back to DISCOVERED", async () => {
    // Reset testJob to APPLIED
    await db.job.update({ where: { id: testJob.id }, data: { status: "APPLIED" } });

    const res = await transitionApplicationStatus(testJob.id, "DISCOVERED");
    assert.equal(res.newStatus, "DISCOVERED");
    assert.equal(res.previousStatus, "APPLIED");

    const updatedJob = await db.job.findUnique({ where: { id: testJob.id } });
    assert.equal(updatedJob?.status, "DISCOVERED");
  });
});
