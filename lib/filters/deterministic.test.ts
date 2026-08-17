import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDeterministicFilters,
  extractRequiredExperience,
  type CandidateFilterCriteria,
  type JobFilterInput,
} from "./deterministic";

describe("Deterministic Filter Engine", () => {
  const baseCandidate: CandidateFilterCriteria = {
    minSalary: 100000,
    yearsOfExperience: 4,
    remotePreference: "REMOTE_ONLY",
    preferredLocations: ["Remote", "San Francisco, CA"],
    blacklistedCompanies: ["SpamCorp", "Unethical AI"],
    blacklistedKeywords: ["gambling", "crypto scam", "unpaid internship"],
  };

  const baseJob: JobFilterInput = {
    title: "Senior Fullstack Engineer",
    company: "TechNova",
    location: "San Francisco, CA",
    remoteStatus: "REMOTE",
    salaryMin: 120000,
    salaryMax: 150000,
    description: "Looking for an engineer with 4-5 years of experience building modern web apps.",
    requiredExperienceYears: 5,
  };

  describe("Passing jobs", () => {
    it("passes when all constraints are met", () => {
      const result = evaluateDeterministicFilters(baseCandidate, baseJob);
      assert.strictEqual(result.passed, true);
      assert.deepStrictEqual(result.reasons, []);
    });

    it("passes when job has no salaryMax specified", () => {
      const job: JobFilterInput = { ...baseJob, salaryMax: null };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, true);
      assert.deepStrictEqual(result.reasons, []);
    });

    it("passes when candidate has no minSalary specified", () => {
      const candidate: CandidateFilterCriteria = { ...baseCandidate, minSalary: 0 };
      const job: JobFilterInput = { ...baseJob, salaryMax: 50000 };
      const result = evaluateDeterministicFilters(candidate, job);
      assert.strictEqual(result.passed, true);
    });

    it("passes when candidate remotePreference is ANY", () => {
      const candidate: CandidateFilterCriteria = { ...baseCandidate, remotePreference: "ANY" };
      const job: JobFilterInput = { ...baseJob, remoteStatus: "ONSITE" };
      const result = evaluateDeterministicFilters(candidate, job);
      assert.strictEqual(result.passed, true);
    });
  });

  describe("Salary filter", () => {
    it("rejects when job salaryMax is strictly less than candidate minSalary", () => {
      const job: JobFilterInput = {
        ...baseJob,
        salaryMin: 70000,
        salaryMax: 90000,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.reasons.length, 1);
      assert.match(result.reasons[0], /Salary ceiling \$90,000 is below candidate minimum \$100,000/i);
    });

    it("passes when job salaryMax equals candidate minSalary", () => {
      const job: JobFilterInput = {
        ...baseJob,
        salaryMin: 80000,
        salaryMax: 100000,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, true);
    });
  });

  describe("Remote filter", () => {
    it("rejects when candidate requires REMOTE_ONLY and job is ONSITE", () => {
      const job: JobFilterInput = {
        ...baseJob,
        remoteStatus: "ONSITE",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.reasons.length, 1);
      assert.match(result.reasons[0], /Job is ONSITE but candidate preference is REMOTE_ONLY/i);
    });

    it("passes when candidate requires REMOTE_ONLY and job is REMOTE", () => {
      const job: JobFilterInput = {
        ...baseJob,
        remoteStatus: "REMOTE",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, true);
    });

    it("rejects when candidate requires REMOTE_ONLY and job is HYBRID", () => {
      const job: JobFilterInput = {
        ...baseJob,
        remoteStatus: "HYBRID",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.match(result.reasons[0], /Job is HYBRID but candidate preference is REMOTE_ONLY/i);
    });
  });

  describe("Experience delta filter", () => {
    it("passes when required experience exceeds candidate experience within tolerance (default tolerance = 2)", () => {
      // Candidate: 4 years, Job: 6 years (delta = 2, tolerance = 2) -> Pass
      const job: JobFilterInput = {
        ...baseJob,
        requiredExperienceYears: 6,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, true);
    });

    it("rejects when required experience exceeds candidate experience beyond tolerance", () => {
      // Candidate: 4 years, Job: 8 years (delta = 4 > tolerance 2) -> Reject
      const job: JobFilterInput = {
        ...baseJob,
        requiredExperienceYears: 8,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.reasons.length, 1);
      assert.match(result.reasons[0], /Required experience \(8 years\) exceeds candidate experience \(4 years\) by more than tolerance \(2 years\)/i);
    });

    it("respects custom experience tolerance option", () => {
      // Candidate: 4 years, Job: 6 years, tolerance = 1 -> Reject
      const job: JobFilterInput = {
        ...baseJob,
        requiredExperienceYears: 6,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job, { experienceDeltaTolerance: 1 });
      assert.strictEqual(result.passed, false);
      assert.match(result.reasons[0], /tolerance \(1 years\)/i);
    });

    it("parses required experience from description when requiredExperienceYears is null", () => {
      const job: JobFilterInput = {
        ...baseJob,
        requiredExperienceYears: null,
        description: "Requirements: Minimum 10+ years of software development experience required.",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.match(result.reasons[0], /Required experience \(10 years\) exceeds candidate experience \(4 years\)/i);
    });
  });

  describe("Blacklist filters", () => {
    it("rejects when company matches candidate blacklist case-insensitively", () => {
      const job: JobFilterInput = {
        ...baseJob,
        company: "spamcorp",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.reasons.length, 1);
      assert.match(result.reasons[0], /Company 'spamcorp' is in blacklisted companies/i);
    });

    it("rejects when title contains blacklisted keyword", () => {
      const job: JobFilterInput = {
        ...baseJob,
        title: "Unpaid Internship Fullstack Developer",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.match(result.reasons[0], /Blacklisted keyword 'unpaid internship' found in title/i);
    });

    it("rejects when description contains blacklisted keyword", () => {
      const job: JobFilterInput = {
        ...baseJob,
        description: "Join our team to build next gen crypto scam detection, or maybe a crypto scam platform.",
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.match(result.reasons[0], /Blacklisted keyword 'crypto scam' found in description/i);
    });
  });

  describe("Multiple violation aggregation", () => {
    it("aggregates multiple failure reasons in a single evaluation", () => {
      const job: JobFilterInput = {
        ...baseJob,
        company: "SpamCorp",
        remoteStatus: "ONSITE",
        salaryMax: 60000,
        requiredExperienceYears: 10,
      };
      const result = evaluateDeterministicFilters(baseCandidate, job);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.reasons.length, 4);
    });
  });

  describe("extractRequiredExperience helper", () => {
    it("extracts years from various JD formats", () => {
      assert.strictEqual(extractRequiredExperience("5+ years of experience in React"), 5);
      assert.strictEqual(extractRequiredExperience("Requires 3-5 years of industry experience"), 5);
      assert.strictEqual(extractRequiredExperience("At least 7 years software engineering"), 7);
      assert.strictEqual(extractRequiredExperience("Minimum of 4 years experience"), 4);
      assert.strictEqual(extractRequiredExperience("10+ yrs experience"), 10);
      assert.strictEqual(extractRequiredExperience("No experience mentioned"), null);
    });
  });
});
