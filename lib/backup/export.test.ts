import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { db } from "@/lib/db";
import {
  escapeCsvValue,
  generateCsv,
  exportFullJsonSnapshot,
  generateFullJsonSnapshotString,
  exportApplicationsCsv,
  exportJobsCsv,
} from "./export";

describe("Data Export Utilities", () => {
  describe("escapeCsvValue", () => {
    it("handles null and undefined gracefully", () => {
      assert.equal(escapeCsvValue(null), "");
      assert.equal(escapeCsvValue(undefined), "");
    });

    it("formats ISO date string for Date instances", () => {
      const date = new Date("2026-08-17T12:00:00.000Z");
      assert.equal(escapeCsvValue(date), "2026-08-17T12:00:00.000Z");
    });

    it("returns plain numbers and strings unchanged when no special characters", () => {
      assert.equal(escapeCsvValue(120000), "120000");
      assert.equal(escapeCsvValue("Software Engineer"), "Software Engineer");
    });

    it("escapes strings containing commas, quotes, and newlines per RFC 4180", () => {
      assert.equal(escapeCsvValue("San Francisco, CA"), '"San Francisco, CA"');
      assert.equal(escapeCsvValue('He said "Hello"'), '"He said ""Hello"""');
      assert.equal(escapeCsvValue("Line 1\nLine 2"), '"Line 1\nLine 2"');
      assert.equal(escapeCsvValue('Multiple, "quoted", \r\n lines'), '"Multiple, ""quoted"", \r\n lines"');
    });
  });

  describe("generateCsv", () => {
    it("generates CSV with headers and rows correctly joined", () => {
      const headers = ["Name", "Company", "Notes"];
      const rows = [
        ["Alice", "Acme, Inc.", "Great match"],
        ["Bob", "Tech Corp", 'Needs "follow-up"'],
      ];
      const csv = generateCsv(headers, rows);
      const lines = csv.split("\r\n");
      assert.equal(lines.length, 3);
      assert.equal(lines[0], "Name,Company,Notes");
      assert.equal(lines[1], 'Alice,"Acme, Inc.",Great match');
      assert.equal(lines[2], 'Bob,Tech Corp,"Needs ""follow-up"""');
    });

    it("returns only header line when rows are empty", () => {
      const headers = ["Col1", "Col2"];
      const csv = generateCsv(headers, []);
      assert.equal(csv, "Col1,Col2");
    });
  });

  describe("exportFullJsonSnapshot", () => {
    it("generates full snapshot with entity counts and arrays", async () => {
      const mockCandidate = { id: "cand-1", name: "Alex" };
      const mockJob = { id: "job-1", dedupeKey: "key-1", title: "Dev" };
      const mockFit = { id: "fit-1", jobId: "job-1", score: 90 };
      const mockApp = { id: "app-1", jobId: "job-1", status: "APPLIED" };
      const mockEvent = { id: "event-1", entityType: "Job", entityId: "job-1", eventType: "INGEST" };

      const mockDb = {
        candidate: { findMany: async () => [mockCandidate] },
        job: { findMany: async () => [mockJob] },
        fitScore: { findMany: async () => [mockFit] },
        application: { findMany: async () => [mockApp] },
        event: { findMany: async () => [mockEvent] },
      } as unknown as typeof db;

      const snapshot = await exportFullJsonSnapshot(mockDb);

      assert.equal(snapshot.version, "1.0");
      assert.equal(snapshot.database, "pulse.db");
      assert.ok(snapshot.exportedAt);
      assert.deepEqual(snapshot.counts, {
        candidates: 1,
        jobs: 1,
        fitScores: 1,
        applications: 1,
        events: 1,
      });
      assert.deepEqual(snapshot.data.candidates, [mockCandidate]);
      assert.deepEqual(snapshot.data.jobs, [mockJob]);
      assert.deepEqual(snapshot.data.fitScores, [mockFit]);
      assert.deepEqual(snapshot.data.applications, [mockApp]);
      assert.deepEqual(snapshot.data.events, [mockEvent]);

      const jsonStr = await generateFullJsonSnapshotString(mockDb);
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.version, "1.0");
      assert.equal(parsed.counts.jobs, 1);
    });
  });

  describe("exportApplicationsCsv", () => {
    it("generates structured CSV matching application records and linked job details", async () => {
      const mockDb = {
        application: {
          findMany: async () => [
            {
              id: "app-101",
              jobId: "job-202",
              status: "APPLIED",
              appliedAt: new Date("2026-08-15T10:00:00Z"),
              resumeVersion: "v2-custom",
              followUpAt: new Date("2026-08-22T10:00:00Z"),
              tailoredNotes: "Submitted through referral, referenced distributed systems work.",
              createdAt: new Date("2026-08-14T09:00:00Z"),
              updatedAt: new Date("2026-08-15T10:00:00Z"),
              job: {
                company: "Stripe",
                title: "Staff Software Engineer",
                salaryMin: 180000,
                salaryMax: 240000,
                remoteStatus: "REMOTE",
                location: "San Francisco, CA",
                url: "https://stripe.com/jobs/123",
                fitScore: {
                  score: 95,
                  recommendation: "APPLY",
                },
              },
            },
          ],
        },
      } as unknown as typeof db;

      const csv = await exportApplicationsCsv(mockDb);
      const lines = csv.split("\r\n");

      assert.equal(lines.length, 2);
      assert.ok(lines[0].includes("Application ID,Job ID,Company,Title,Status"));
      assert.ok(lines[1].includes("app-101,job-202,Stripe,Staff Software Engineer,APPLIED"));
      assert.ok(lines[1].includes('"San Francisco, CA"'));
      assert.ok(lines[1].includes('"Submitted through referral, referenced distributed systems work."'));
      assert.ok(lines[1].includes("180000,240000,REMOTE"));
      assert.ok(lines[1].includes("95,APPLY"));
    });
  });

  describe("exportJobsCsv", () => {
    it("generates structured CSV matching job records, fit breakdown, and application status", async () => {
      const mockDb = {
        job: {
          findMany: async () => [
            {
              id: "job-500",
              dedupeKey: "key-hash-500",
              company: "Anthropic",
              title: "Systems Engineer, Infrastructure",
              location: "San Francisco, CA",
              remoteStatus: "HYBRID",
              salaryMin: 200000,
              salaryMax: 260000,
              employmentType: "FULL_TIME",
              status: "SHORTLISTED",
              source: "MANUAL",
              url: "https://anthropic.com/careers/500",
              description: "Build robust distributed platforms for AI training.\nMust know Rust & TypeScript.",
              discoveredAt: new Date("2026-08-16T08:00:00Z"),
              postedAt: new Date("2026-08-15T00:00:00Z"),
              fitScore: {
                score: 92,
                recommendation: "APPLY",
                strengths: JSON.stringify(["Distributed Systems", "TypeScript", "Rust"]),
                gaps: JSON.stringify(["Kubernetes operator internals"]),
                risks: JSON.stringify([]),
                reasoning: "Exceptional architecture background and low-level performance experience.",
              },
              application: {
                status: "SHORTLISTED",
                appliedAt: null,
              },
            },
          ],
        },
      } as unknown as typeof db;

      const csv = await exportJobsCsv(mockDb);
      const lines = csv.split("\r\n");

      assert.ok(lines[0].includes("Job ID,Dedupe Key,Company,Title,Location,Remote Status"));
      assert.ok(lines[1].includes("job-500,key-hash-500,Anthropic"));
      assert.ok(lines[1].includes('"Systems Engineer, Infrastructure"'));
      assert.ok(lines[1].includes("Distributed Systems; TypeScript; Rust"));
      assert.ok(lines[1].includes("Kubernetes operator internals"));
      assert.ok(lines[1].includes("SHORTLISTED"));
      assert.ok(lines[1].includes("200000,260000,FULL_TIME"));
    });
  });
});
