import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { updateJob, type UpdateJobInput } from "./data";
import type { db } from "@/lib/db";

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
}

interface MockEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  payload: string;
  timestamp: Date;
}

function createMockDb() {
  const jobs = new Map<string, MockJob>();
  const events: MockEvent[] = [];

  const initialJob: MockJob = {
    id: "test-job-1",
    dedupeKey: "key-1",
    title: "Old Title",
    company: "Old Company",
    location: "Old Location",
    remoteStatus: "UNKNOWN",
    salaryMin: 100000,
    salaryMax: 120000,
    employmentType: "FULL_TIME",
    description: "Old description text.",
    url: "https://example.com/old",
    source: "MANUAL",
    status: "DISCOVERED",
    discoveredAt: new Date(),
  };

  jobs.set(initialJob.id, initialJob);

  return {
    job: {
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
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const job = jobs.get(where.id);
        if (!job) throw new Error("Job not found");
        return { ...job };
      },
    },
    event: {
      create: async ({ data }: { data: Omit<MockEvent, "id" | "timestamp"> }) => {
        const record: MockEvent = {
          id: `event-${Date.now()}`,
          timestamp: new Date(),
          ...data,
        };
        events.push(record);
        return record;
      },
    },
    _state: {
      jobs,
      events,
    },
  };
}

describe("Job Details Update", () => {
  it("updates small job details and logs an audit event", async () => {
    const mockDb = createMockDb();

    const updatePayload: UpdateJobInput = {
      title: "Senior Fullstack Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      remoteStatus: "HYBRID",
      salaryMin: 150000,
      salaryMax: 190000,
      employmentType: "FULL_TIME",
      url: "https://acme.com/jobs/senior-fullstack",
      description: "Updated job description.",
    };

    const updatedJob = await updateJob("test-job-1", updatePayload, mockDb as unknown as typeof db);

    assert.strictEqual(updatedJob.title, "Senior Fullstack Engineer");
    assert.strictEqual(updatedJob.company, "Acme Corp");
    assert.strictEqual(updatedJob.location, "San Francisco, CA");
    assert.strictEqual(updatedJob.remoteStatus, "HYBRID");
    assert.strictEqual(updatedJob.salaryMin, 150000);
    assert.strictEqual(updatedJob.salaryMax, 190000);
    assert.strictEqual(updatedJob.employmentType, "FULL_TIME");
    assert.strictEqual(updatedJob.url, "https://acme.com/jobs/senior-fullstack");
    assert.strictEqual(updatedJob.description, "Updated job description.");

    // Check event audit trail
    const auditEvent = mockDb._state.events.find(
      (e) => e.entityId === "test-job-1" && e.eventType === "DETAILS_UPDATED"
    );
    assert.ok(auditEvent, "Should create a DETAILS_UPDATED event");
    const payload = JSON.parse(auditEvent.payload);
    assert.strictEqual(payload.title, "Senior Fullstack Engineer");
  });

  it("handles partial updates without modifying untouched fields", async () => {
    const mockDb = createMockDb();

    const partialPayload: UpdateJobInput = {
      salaryMin: 160000,
      salaryMax: 200000,
    };

    const updatedJob = await updateJob("test-job-1", partialPayload, mockDb as unknown as typeof db);

    assert.strictEqual(updatedJob.title, "Old Title");
    assert.strictEqual(updatedJob.company, "Old Company");
    assert.strictEqual(updatedJob.salaryMin, 160000);
    assert.strictEqual(updatedJob.salaryMax, 200000);
  });
});
