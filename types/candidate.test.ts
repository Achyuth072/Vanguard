import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MasterSkillSchema,
  MasterProjectSchema,
  MasterExperienceSchema,
  CandidateProfileSchema,
  serializeCandidateProfile,
  deserializeCandidateProfile,
  parseMasterSkills,
  parseMasterProjects,
  parseMasterExperiences,
  parsePreferredLocations,
  type CandidateProfileInput,
  type RawCandidateDbRecord,
} from "./candidate";

describe("Candidate Master Types and Serializers", () => {
  describe("Schema Validation", () => {
    it("validates valid MasterSkill records", () => {
      const skill = {
        name: "TypeScript",
        category: "LANGUAGE",
        yearsOfExperience: 4,
      };
      const parsed = MasterSkillSchema.parse(skill);
      assert.strictEqual(parsed.name, "TypeScript");
      assert.strictEqual(parsed.category, "LANGUAGE");
      assert.strictEqual(parsed.yearsOfExperience, 4);
    });

    it("rejects invalid MasterSkill category", () => {
      const invalid = {
        name: "TypeScript",
        category: "INVALID_CAT",
      };
      assert.throws(() => MasterSkillSchema.parse(invalid));
    });

    it("validates valid MasterProject records with defaults", () => {
      const project = {
        id: "proj-1",
        title: "Pulse Career Copilot",
        technologies: ["TypeScript", "Next.js", "SQLite"],
        highlights: ["Engineered deterministic filtering", "Integrated AI scoring"],
        metrics: ["Reduced manual screening time by 90%"],
        description: "An AI-augmented job discovery and tailoring application.",
      };
      const parsed = MasterProjectSchema.parse(project);
      assert.strictEqual(parsed.id, "proj-1");
      assert.strictEqual(parsed.company, "");
      assert.strictEqual(parsed.role, "");
      assert.strictEqual(parsed.technologies.length, 3);
    });

    it("validates valid MasterExperience records", () => {
      const exp = {
        id: "exp-1",
        company: "Acme Corp",
        title: "Senior Fullstack Engineer",
        location: "Bengaluru, India",
        remoteStatus: "HYBRID",
        startDate: "2022-01",
        endDate: "2024-05",
        isCurrent: false,
        highlights: ["Architected core microservices", "Led team of 4 engineers"],
      };
      const parsed = MasterExperienceSchema.parse(exp);
      assert.strictEqual(parsed.id, "exp-1");
      assert.strictEqual(parsed.remoteStatus, "HYBRID");
      assert.strictEqual(parsed.isCurrent, false);
      assert.strictEqual(parsed.highlights.length, 2);
    });

    it("validates CandidateProfileSchema with default values", () => {
      const minimal = {};
      const parsed = CandidateProfileSchema.parse(minimal);
      assert.strictEqual(parsed.id, "candidate-default");
      assert.strictEqual(parsed.name, "Default Candidate");
      assert.strictEqual(parsed.targetRole, "Software Engineer");
      assert.deepStrictEqual(parsed.skills, []);
      assert.deepStrictEqual(parsed.projects, []);
      assert.deepStrictEqual(parsed.experiences, []);
    });
  });

  describe("Serialization and Deserialization", () => {
    const sampleProfile: CandidateProfileInput = {
      id: "candidate-123",
      name: "Jane Doe",
      targetRole: "Senior Software Engineer",
      minSalary: 120000,
      yearsOfExperience: 5,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: ["Remote", "Bengaluru", "San Francisco"],
      skills: [
        { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 5 },
        { name: "React", category: "FRAMEWORK", yearsOfExperience: 4 },
        { name: "PostgreSQL", category: "DATABASE", yearsOfExperience: 3 },
      ],
      projects: [
        {
          id: "proj-1",
          title: "Pulse Job Search",
          company: "Pulse",
          role: "Lead Engineer",
          startDate: "2024-01",
          endDate: null,
          technologies: ["TypeScript", "Next.js", "Prisma"],
          highlights: ["Built real-time scoring"],
          metrics: ["10x speedup"],
          description: "Career search copilot.",
        },
      ],
      experiences: [
        {
          id: "exp-1",
          company: "TechNova",
          title: "Software Engineer",
          location: "San Francisco, CA",
          remoteStatus: "REMOTE",
          startDate: "2021-03",
          endDate: "2023-12",
          isCurrent: false,
          highlights: ["Scaled backend APIs"],
        },
      ],
      resumeText: "Experienced engineer with 5 years in TypeScript.",
    };

    it("serializes full candidate profile to JSON string fields for Prisma", () => {
      const serialized = serializeCandidateProfile(sampleProfile);
      assert.strictEqual(serialized.id, "candidate-123");
      assert.strictEqual(serialized.name, "Jane Doe");
      assert.strictEqual(typeof serialized.skills, "string");
      assert.strictEqual(typeof serialized.projects, "string");
      assert.strictEqual(typeof serialized.experiences, "string");
      assert.strictEqual(typeof serialized.preferredLocations, "string");

      const skillsJson = JSON.parse(serialized.skills);
      assert.strictEqual(skillsJson.length, 3);
      assert.strictEqual(skillsJson[0].name, "TypeScript");
    });

    it("deserializes raw DB records back into typed CandidateProfile", () => {
      const serialized = serializeCandidateProfile(sampleProfile);
      const dbRecord: RawCandidateDbRecord = {
        ...serialized,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      const deserialized = deserializeCandidateProfile(dbRecord);
      assert.strictEqual(deserialized.id, sampleProfile.id);
      assert.strictEqual(deserialized.name, sampleProfile.name);
      assert.strictEqual(deserialized.skills.length, 3);
      assert.strictEqual(deserialized.skills[0].name, "TypeScript");
      assert.strictEqual(deserialized.skills[0].category, "LANGUAGE");
      assert.strictEqual(deserialized.projects.length, 1);
      assert.strictEqual(deserialized.projects[0].title, "Pulse Job Search");
      assert.strictEqual(deserialized.experiences.length, 1);
      assert.strictEqual(deserialized.experiences[0].company, "TechNova");
      assert.deepStrictEqual(deserialized.preferredLocations, [
        "Remote",
        "Bengaluru",
        "San Francisco",
      ]);
    });

    it("handles legacy string arrays in parseMasterSkills", () => {
      const legacyJson = JSON.stringify(["TypeScript", "React", "Node.js"]);
      const parsed = parseMasterSkills(legacyJson);
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].name, "TypeScript");
      assert.strictEqual(parsed[0].category, "DOMAIN");
    });

    it("resiliently recovers from malformed or corrupted JSON strings", () => {
      assert.deepStrictEqual(parseMasterSkills("{corrupted json}"), []);
      assert.deepStrictEqual(parseMasterProjects("null"), []);
      assert.deepStrictEqual(parseMasterExperiences(123), []);
      assert.deepStrictEqual(parsePreferredLocations(undefined), []);
    });
  });
});
