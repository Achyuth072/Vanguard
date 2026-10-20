import test from "node:test";
import assert from "node:assert/strict";
import { overrideJobFilter } from "./service";
import { getJobs } from "../data";
import { db } from "../db";

test("Filter Override & Dropped Job Recovery Suite", async (t) => {
  const dedupeKey = `test_override_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const droppedJob = await db.job.create({
    data: {
      dedupeKey,
      title: "Junior Backend Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      remoteStatus: "ONSITE",
      status: "FILTERED_OUT",
      description: "Junior role dropped by salary or remote policy constraints.",
    },
  });

  // Create a FILTERED_OUT event simulating deterministic filter failure
  await db.event.create({
    data: {
      entityType: "Job",
      entityId: droppedJob.id,
      eventType: "FILTERED_OUT",
      payload: JSON.stringify({
        reasons: ["Location is foreign ONSITE", "Salary 60000 below target minimum 100000"],
        dedupeKey,
      }),
    },
  });

  t.after(async () => {
    await db.event.deleteMany({ where: { entityId: droppedJob.id } });
    await db.application.deleteMany({ where: { jobId: droppedJob.id } });
    await db.job.deleteMany({ where: { id: droppedJob.id } });
  });

  await t.test("getJobs enriches FILTERED_OUT jobs with filterReasons from audit events", async () => {
    const jobs = await getJobs();
    const found = jobs.find((j) => j.id === droppedJob.id);
    assert.ok(found, "Job should be returned by getJobs");
    assert.equal(found.status, "FILTERED_OUT");
    assert.ok(Array.isArray(found.filterReasons), "filterReasons should be an array");
    assert.equal(found.filterReasons?.length, 2);
    assert.ok(found.filterReasons?.includes("Location is foreign ONSITE"));
  });

  await t.test("overrideJobFilter transitions FILTERED_OUT job to SHORTLISTED and logs audit event", async () => {
    const overridden = await overrideJobFilter(droppedJob.id, "SHORTLISTED", "Candidate approved remote exception");
    assert.equal(overridden.status, "SHORTLISTED");

    // Verify DB state
    const jobInDb = await db.job.findUnique({
      where: { id: droppedJob.id },
      include: { application: true },
    });
    assert.equal(jobInDb?.status, "SHORTLISTED");
    assert.ok(jobInDb?.application, "Application record should be created/updated for SHORTLISTED");
    assert.equal(jobInDb.application?.status, "SHORTLISTED");

    // Verify FILTER_OVERRIDDEN audit event
    const events = await db.event.findMany({
      where: { entityId: droppedJob.id, eventType: "FILTER_OVERRIDDEN" },
    });
    assert.equal(events.length, 1);
    const eventPayload = JSON.parse(events[0].payload);
    assert.equal(eventPayload.previousStatus, "FILTERED_OUT");
    assert.equal(eventPayload.targetStatus, "SHORTLISTED");
    assert.equal(eventPayload.overrideReason, "Candidate approved remote exception");
  });
});
