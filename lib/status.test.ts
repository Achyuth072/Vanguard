import test from "node:test";
import assert from "node:assert/strict";
import { updateJobStatus, getJobs } from "./data";
import { db } from "./db";

test("Status Transitions and Event Audit Logging", async (t) => {
  // Setup a test job in SQLite
  const dedupeKey = `test_status_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const testJob = await db.job.create({
    data: {
      dedupeKey,
      title: "Senior AI Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      remoteStatus: "REMOTE",
      status: "DISCOVERED",
      description: "Building intelligent agents and career copilot modules.",
      fitScore: {
        create: {
          score: 88,
          recommendation: "APPLY",
          strengths: JSON.stringify(["TypeScript", "React", "Next.js"]),
          gaps: JSON.stringify(["GraphQL"]),
          risks: JSON.stringify(["Fast-paced environment"]),
          reasoning: "Strong technical stack alignment and relevant agent development experience.",
        },
      },
    },
  });

  t.after(async () => {
    // Cleanup created entities
    await db.event.deleteMany({ where: { entityId: testJob.id } });
    await db.application.deleteMany({ where: { jobId: testJob.id } });
    await db.fitScore.deleteMany({ where: { jobId: testJob.id } });
    await db.job.deleteMany({ where: { id: testJob.id } });
  });

  await t.test("transitions job to SHORTLISTED and initializes Application and Event", async () => {
    const updated = await updateJobStatus(testJob.id, "SHORTLISTED", { note: "Priority candidate match" });
    assert.equal(updated.status, "SHORTLISTED");

    // Verify Application record created
    const application = await db.application.findUnique({
      where: { jobId: testJob.id },
    });
    assert.ok(application);
    assert.equal(application.status, "SHORTLISTED");

    // Verify Event audit log created
    const events = await db.event.findMany({
      where: { entityId: testJob.id, eventType: "STATUS_TRANSITION" },
    });
    assert.equal(events.length, 1);
    const eventPayload = JSON.parse(events[0].payload);
    assert.equal(eventPayload.previousStatus, "DISCOVERED");
    assert.equal(eventPayload.newStatus, "SHORTLISTED");
    assert.equal(eventPayload.note, "Priority candidate match");
  });

  await t.test("transitions job to APPLIED, sets appliedAt timestamp and logs event", async () => {
    const updated = await updateJobStatus(testJob.id, "APPLIED");
    assert.equal(updated.status, "APPLIED");

    const application = await db.application.findUnique({
      where: { jobId: testJob.id },
    });
    assert.ok(application);
    assert.equal(application.status, "APPLIED");
    assert.ok(application.appliedAt);

    const events = await db.event.findMany({
      where: { entityId: testJob.id, eventType: "STATUS_TRANSITION" },
      orderBy: { timestamp: "asc" },
    });
    assert.equal(events.length, 2);
    const secondEventPayload = JSON.parse(events[1].payload);
    assert.equal(secondEventPayload.previousStatus, "SHORTLISTED");
    assert.equal(secondEventPayload.newStatus, "APPLIED");
  });

  await t.test("getJobs returns parsed fitScore JSON arrays and application state", async () => {
    const jobs = await getJobs();
    const found = jobs.find((j) => j.id === testJob.id);
    assert.ok(found);
    assert.equal(found.company, "Acme Corp");
    assert.equal(found.title, "Senior AI Engineer");
    assert.equal(found.status, "APPLIED");
    assert.ok(found.fitScore);
    assert.equal(found.fitScore.score, 88);
    assert.deepEqual(found.fitScore.strengths, ["TypeScript", "React", "Next.js"]);
    assert.deepEqual(found.fitScore.gaps, ["GraphQL"]);
    assert.deepEqual(found.fitScore.risks, ["Fast-paced environment"]);
    assert.ok(found.application);
    assert.equal(found.application.status, "APPLIED");
  });
});
