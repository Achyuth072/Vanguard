import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import {
  getCandidateProfile,
  updateCandidateProfile,
  parseCandidateResumeAction,
  getLocalResumeMarkdownAction,
} from "./candidate";
import type { CandidateProfileInput } from "@/types/candidate";

describe("Candidate Server Actions", () => {
  beforeEach(async () => {
    // Reset candidate record to predictable state
    await db.candidate.deleteMany({
      where: { id: "test-candidate-1" },
    });
  });

  it("getCandidateProfile returns parsed default profile when db is empty", async () => {
    const profile = await getCandidateProfile("test-candidate-nonexistent");
    assert.strictEqual(profile.id, "test-candidate-nonexistent");
    assert.strictEqual(profile.targetRole, "Software Engineer");
    assert.deepStrictEqual(profile.projects, []);
    assert.deepStrictEqual(profile.skills, []);
  });

  it("updateCandidateProfile saves and returns valid CandidateProfile with structured collections", async () => {
    const input: CandidateProfileInput = {
      id: "test-candidate-1",
      name: "Alex Builder",
      targetRole: "Staff AI Engineer",
      minSalary: 180000,
      yearsOfExperience: 8,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: ["Remote", "San Francisco"],
      skills: [
        { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 6 },
        { name: "PostgreSQL", category: "DATABASE", yearsOfExperience: 5 },
      ],
      projects: [
        {
          id: "proj-agent",
          title: "Autonomous Job Copilot",
          company: "Pulse Ops",
          role: "Lead Architect",
          startDate: "2024-01",
          endDate: null,
          technologies: ["TypeScript", "Next.js", "Prisma"],
          highlights: ["Automated resume tailoring", "Deterministic filtering engine"],
          metrics: ["Cut screening turnaround by 90%"],
          description: "End-to-end career copilot system.",
        },
      ],
      experiences: [
        {
          id: "exp-pulse",
          company: "Tech Corp",
          title: "Principal Engineer",
          location: "San Francisco, CA",
          remoteStatus: "REMOTE",
          startDate: "2021-01",
          endDate: "2023-12",
          isCurrent: false,
          highlights: ["Led distributed systems team"],
        },
      ],
      resumeText: "# Alex Builder\nStaff AI Engineer with 8 years experience.",
    };

    const res = await updateCandidateProfile(input);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.profile.name, "Alex Builder");
    assert.strictEqual(res.profile.projects.length, 1);
    assert.strictEqual(res.profile.projects[0].title, "Autonomous Job Copilot");
    assert.strictEqual(res.profile.skills.length, 2);
    assert.strictEqual(res.profile.skills[0].name, "TypeScript");

    // Verify fetching it back from DB
    const fetched = await getCandidateProfile("test-candidate-1");
    assert.strictEqual(fetched.name, "Alex Builder");
    assert.strictEqual(fetched.targetRole, "Staff AI Engineer");
    assert.strictEqual(fetched.projects.length, 1);
    assert.strictEqual(fetched.projects[0].technologies.length, 3);
    assert.strictEqual(fetched.experiences.length, 1);
    assert.strictEqual(fetched.resumeText.includes("Alex Builder"), true);

    // Verify audit event was logged
    const event = await db.event.findFirst({
      where: {
        entityType: "Candidate",
        entityId: "test-candidate-1",
        eventType: "CANDIDATE_PROFILE_UPDATED",
      },
      orderBy: { timestamp: "desc" },
    });
    assert.ok(event, "Audit event must be logged");
  });

  it("updateCandidateProfile throws on invalid input data", async () => {
    const invalidInput = {
      id: "test-candidate-1",
      minSalary: -500, // Invalid: must be non-negative
    } as unknown as CandidateProfileInput;

    await assert.rejects(async () => {
      await updateCandidateProfile(invalidInput);
    });
  });

  it("parseCandidateResumeAction extracts profile with fallback on raw markdown", async () => {
    const sampleMarkdown = `# Jane Doe\n\n## Technical Skills\n- Python, TypeScript, React\n\n## Experience\n### Senior Engineer — Acme Corp\n*Jan 2022 -- Dec 2024*\n- Architected high-scale platform\n`;
    const res = await parseCandidateResumeAction(sampleMarkdown, "candidate-test-parse");
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.profile.id, "candidate-test-parse");
    assert.strictEqual(res.profile.name, "Jane Doe");
    assert.ok(res.profile.skills.length > 0);
  });

  it("getLocalResumeMarkdownAction reads local resume if present", async () => {
    const res = await getLocalResumeMarkdownAction();
    assert.strictEqual(typeof res.success, "boolean");
    if (res.success) {
      assert.ok(typeof res.markdown === "string");
      assert.ok(res.markdown.length > 0);
    }
  });

  after(async () => {
    await db.event.deleteMany({
      where: {
        entityType: "Candidate",
        entityId: { in: ["test-candidate-1", "candidate-test-parse"] },
      },
    });
    await db.candidate.deleteMany({
      where: {
        id: { in: ["test-candidate-1", "candidate-test-parse"] },
      },
    });
  });
});

