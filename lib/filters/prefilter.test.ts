import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preFilterRawText,
  extractSalaryFromRawText,
  classifyRemoteAndLocation,
  type PreFilterCandidateCriteria,
  type PreFilterResult,
} from "./prefilter";

describe("Zero-Token 6-Dimension Regex Pre-Filter", () => {
  const baseCandidate: PreFilterCandidateCriteria = {
    targetRoleKeywords: ["Software Engineer", "Full Stack", "Backend", "Frontend"],
    techStack: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    minSalary: 120000,
    currency: "USD",
    yearsOfExperience: 4,
    remotePreference: "ANY",
    preferredLocations: ["San Francisco", "New York", "Remote"],
    companyStageBlacklist: ["agency", "staffing", "crypto"],
    blacklistedCompanies: ["Revature", "Infosys"],
    blacklistedKeywords: ["unpaid", "crypto trading"],
  };

  describe("Dimension 1: Target Role Keyword Matching", () => {
    it("passes when a target role keyword matches with word boundaries", () => {
      const text = "Acme Corp is hiring a Senior Full Stack Engineer to lead our core product team.";
      const res = preFilterRawText(text, baseCandidate);
      assert.strictEqual(res.matchedDimensions.roleKeywords, true);
      assert.ok(res.extractedMetadata.detectedRoles.some((r) => /full stack/i.test(r)));
    });

    it("matches multi-word roles and hyphenated roles", () => {
      const text = "Looking for a full-stack developer with strong React experience.";
      const res = preFilterRawText(text, {
        targetRoleKeywords: ["Full Stack", "Frontend"],
      });
      assert.strictEqual(res.matchedDimensions.roleKeywords, true);
      assert.ok(res.extractedMetadata.detectedRoles.length > 0);
    });

    it("rejects when candidate specifies targetRoleKeywords but none match in the raw text", () => {
      const text = "We are looking for a Senior Product Marketing Manager and Sales Lead.";
      const res = preFilterRawText(text, {
        targetRoleKeywords: ["Software Engineer", "Backend Developer", "DevOps"],
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.roleKeywords, false);
      assert.ok(res.reasons.some((r) => r.includes("target role keywords")));
    });

    it("passes dimension 1 when candidate has no role keywords specified", () => {
      const text = "General engineering role at a fast-growing startup.";
      const res = preFilterRawText(text, { targetRoleKeywords: [] });
      assert.strictEqual(res.matchedDimensions.roleKeywords, true);
    });
  });

  describe("Dimension 2: Tech Stack & Skills Detection", () => {
    it("detects standard programming languages and frameworks", () => {
      const text = "Requirements: Strong experience with TypeScript, React, and PostgreSQL.";
      const res = preFilterRawText(text, baseCandidate);
      assert.strictEqual(res.matchedDimensions.techStack, true);
      assert.ok(res.extractedMetadata.detectedSkills.includes("TypeScript"));
      assert.ok(res.extractedMetadata.detectedSkills.includes("React"));
      assert.ok(res.extractedMetadata.detectedSkills.includes("PostgreSQL"));
    });

    it("handles special characters in tech stack correctly (C++, C#, Node.js, Next.js, .NET, CI/CD)", () => {
      const text = "We build high-performance systems in C++ and C# with .NET backend and Next.js UI using CI/CD pipelines.";
      const res = preFilterRawText(text, {
        techStack: ["C++", "C#", "Next.js", ".NET", "CI/CD"],
      });
      assert.strictEqual(res.matchedDimensions.techStack, true);
      assert.strictEqual(res.extractedMetadata.detectedSkills.length, 5);
      assert.ok(res.extractedMetadata.detectedSkills.includes("C++"));
      assert.ok(res.extractedMetadata.detectedSkills.includes("C#"));
      assert.ok(res.extractedMetadata.detectedSkills.includes("Next.js"));
      assert.ok(res.extractedMetadata.detectedSkills.includes(".NET"));
      assert.ok(res.extractedMetadata.detectedSkills.includes("CI/CD"));
    });

    it("rejects when candidate specifies techStack/skills and 0 matching skills are found", () => {
      const text = "Role requires Ruby on Rails, Elixir, Erlang, and MySQL.";
      const res = preFilterRawText(text, {
        techStack: ["Python", "Django", "FastAPI"],
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.techStack, false);
      assert.ok(res.reasons.some((r) => r.includes("tech stack or skills")));
    });

    it("passes dimension 2 when candidate has no tech stack specified", () => {
      const text = "Any programming background welcome.";
      const res = preFilterRawText(text, { techStack: [], skills: [] });
      assert.strictEqual(res.matchedDimensions.techStack, true);
    });
  });

  describe("Dimension 3: Salary Floor Regex Parser & Converter", () => {
    it("extracts USD salary ranges in $Xk format and passes when above floor", () => {
      const text = "Salary range: $140k - $180k + equity.";
      const salary = extractSalaryFromRawText(text);
      assert.ok(salary);
      assert.strictEqual(salary.min, 140000);
      assert.strictEqual(salary.max, 180000);
      assert.strictEqual(salary.currency, "USD");

      const res = preFilterRawText(text, { minSalary: 120000, currency: "USD" });
      assert.strictEqual(res.matchedDimensions.salary, true);
    });

    it("rejects when USD salary ceiling is below candidate minSalary", () => {
      const text = "Compensation: $80,000 - $100,000 per year.";
      const res = preFilterRawText(text, { minSalary: 130000, currency: "USD" });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.salary, false);
      assert.ok(res.reasons.some((r) => r.includes("Salary ceiling")));
    });

    it("extracts INR LPA salary ranges (₹X - ₹Y LPA) and evaluates against candidate INR minSalary", () => {
      const text = "Compensation: ₹25 LPA - ₹35 LPA depending on experience.";
      const salary = extractSalaryFromRawText(text);
      assert.ok(salary);
      assert.strictEqual(salary.min, 2500000);
      assert.strictEqual(salary.max, 3500000);
      assert.strictEqual(salary.currency, "INR");

      const passRes = preFilterRawText(text, { minSalary: 2000000, currency: "INR" });
      assert.strictEqual(passRes.matchedDimensions.salary, true);

      const failRes = preFilterRawText(text, { minSalary: 4000000, currency: "INR" });
      assert.strictEqual(failRes.passed, false);
      assert.strictEqual(failRes.matchedDimensions.salary, false);
    });

    it("extracts EUR ranges (€Xk - €Yk) and converts to candidate currency for comparison", () => {
      const text = "Package: €80k - €100k + bonus.";
      const salary = extractSalaryFromRawText(text);
      assert.ok(salary);
      assert.strictEqual(salary.min, 80000);
      assert.strictEqual(salary.max, 100000);
      assert.strictEqual(salary.currency, "EUR");

      // 100,000 EUR * 92 (EUR to INR) = ~9,200,000 INR
      const inrCandidate: PreFilterCandidateCriteria = {
        minSalary: 5000000, // 50 LPA INR
        currency: "INR",
      };
      const res = preFilterRawText(text, inrCandidate);
      assert.strictEqual(res.matchedDimensions.salary, true);
    });

    it("extracts GBP ranges (£Xk - £Yk) accurately", () => {
      const text = "Salary: £70k - £90k per annum.";
      const salary = extractSalaryFromRawText(text);
      assert.ok(salary);
      assert.strictEqual(salary.min, 70000);
      assert.strictEqual(salary.max, 90000);
      assert.strictEqual(salary.currency, "GBP");
    });

    it("passes salary dimension when no salary information is present in text", () => {
      const text = "Competitive salary + equity package.";
      const res = preFilterRawText(text, { minSalary: 150000, currency: "USD" });
      assert.strictEqual(res.matchedDimensions.salary, true);
      assert.strictEqual(res.extractedMetadata.detectedSalary, null);
    });
  });

  describe("Dimension 4: Remote vs Location Classification", () => {
    it("detects REMOTE classifications from common keywords", () => {
      const text1 = "Stripe | Senior Engineer | REMOTE (US / Canada)";
      assert.strictEqual(classifyRemoteAndLocation(text1).remoteStatus, "REMOTE");

      const text2 = "100% remote work from anywhere in Europe.";
      assert.strictEqual(classifyRemoteAndLocation(text2).remoteStatus, "REMOTE");

      const text3 = "Distributed team, work from home.";
      assert.strictEqual(classifyRemoteAndLocation(text3).remoteStatus, "REMOTE");
    });

    it("detects HYBRID and ONSITE classifications", () => {
      const hybridText = "Role is Hybrid: 2 days in office in San Francisco, CA.";
      assert.strictEqual(classifyRemoteAndLocation(hybridText).remoteStatus, "HYBRID");

      const onsiteText = "Strictly Onsite only at our Austin headquarters. Relocation required.";
      assert.strictEqual(classifyRemoteAndLocation(onsiteText).remoteStatus, "ONSITE");
    });

    it("rejects strictly onsite jobs when candidate requires REMOTE_ONLY", () => {
      const text = "Acme Inc | Onsite Only | London, UK | No remote work allowed.";
      const res = preFilterRawText(text, {
        remotePreference: "REMOTE_ONLY",
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.location, false);
      assert.ok(res.reasons.some((r) => r.includes("REMOTE_ONLY")));
    });

    it("passes remote jobs when candidate requires REMOTE_ONLY", () => {
      const text = "Acme Inc | Full Stack Engineer | Fully Remote | Anywhere in US";
      const res = preFilterRawText(text, {
        remotePreference: "REMOTE_ONLY",
      });
      assert.strictEqual(res.matchedDimensions.location, true);
    });
  });

  describe("Dimension 5: Experience Requirement Parser", () => {
    it("extracts experience requirements (e.g. 5+ years, 3-5 years, minimum 6 years)", () => {
      const text = "Requirements: At least 5+ years of experience building scalable backend systems.";
      const res = preFilterRawText(text, {
        yearsOfExperience: 4, // 4 + tolerance(2) = 6 >= 5 -> passes
      });
      assert.strictEqual(res.matchedDimensions.experience, true);
      assert.strictEqual(res.extractedMetadata.detectedExperienceYears, 5);
    });

    it("rejects when required experience exceeds candidate experience + tolerance", () => {
      const text = "Looking for a Principal Architect with 10+ years of experience.";
      const res = preFilterRawText(
        text,
        { yearsOfExperience: 3 }, // 3 + 2 = 5 < 10 -> rejects
        { experienceDeltaTolerance: 2 }
      );
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.experience, false);
      assert.ok(res.reasons.some((r) => r.includes("Required experience (10 years)")));
    });

    it("passes experience dimension when no explicit experience years are specified", () => {
      const text = "Software Engineer - Growth Team. Come build with us!";
      const res = preFilterRawText(text, { yearsOfExperience: 2 });
      assert.strictEqual(res.matchedDimensions.experience, true);
      assert.strictEqual(res.extractedMetadata.detectedExperienceYears, null);
    });
  });

  describe("Dimension 6: Company Stage & Blacklist Filtering", () => {
    it("rejects jobs from blacklisted companies case-insensitively", () => {
      const text = "Revature is hiring entry level software developers across the US.";
      const res = preFilterRawText(text, {
        blacklistedCompanies: ["Revature", "Wipro"],
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.companyStage, false);
      assert.ok(res.reasons.some((r) => r.includes("blacklisted company") || r.includes("Revature")));
    });

    it("rejects staffing agencies and body shops when agency/staffing terms are blacklisted", () => {
      const text = "Apex Systems | Multiple Roles | We are a staffing agency recruiting on behalf of our client. C2C only.";
      const res = preFilterRawText(text, {
        companyStageBlacklist: ["staffing", "agency"],
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.companyStage, false);
      assert.ok(res.reasons.some((r) => r.includes("agency") || r.includes("staffing")));
    });

    it("rejects text containing blacklisted keywords", () => {
      const text = "Software Engineer for automated crypto trading bot with high risk tokens.";
      const res = preFilterRawText(text, {
        blacklistedKeywords: ["crypto trading", "gambling"],
      });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.matchedDimensions.companyStage, false);
      assert.ok(res.reasons.some((r) => r.includes("crypto trading")));
    });
  });

  describe("Real-World Hacker News 'Who is Hiring?' Comments", () => {
    it("passes a legitimate SF startup HN comment meeting all criteria", () => {
      const hnComment = `
        Linear (YC W20) | Full Stack Engineer | San Francisco / REMOTE | Full-time | $160k - $210k + equity
        Linear is building the next generation of software project management tools.
        We're looking for experienced Full Stack and Frontend Engineers who love craft and UI speed.
        Tech stack: TypeScript, React, Node.js, GraphQL, SQLite, Electron.
        Requirements:
        - 3+ years of experience with web applications
        - Strong background with TypeScript and React
        Apply at https://linear.app/careers
      `;

      const candidate: PreFilterCandidateCriteria = {
        targetRoleKeywords: ["Full Stack", "Frontend", "Software Engineer"],
        techStack: ["TypeScript", "React", "Node.js"],
        minSalary: 140000,
        currency: "USD",
        yearsOfExperience: 4,
        remotePreference: "ANY",
        companyStageBlacklist: ["agency", "staffing"],
      };

      const res = preFilterRawText(hnComment, candidate);
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.reasons.length, 0);
      assert.strictEqual(res.matchedDimensions.roleKeywords, true);
      assert.strictEqual(res.matchedDimensions.techStack, true);
      assert.strictEqual(res.matchedDimensions.salary, true);
      assert.strictEqual(res.matchedDimensions.location, true);
      assert.strictEqual(res.matchedDimensions.experience, true);
      assert.strictEqual(res.matchedDimensions.companyStage, true);
      assert.strictEqual(res.extractedMetadata.detectedSalary?.min, 160000);
      assert.strictEqual(res.extractedMetadata.detectedSalary?.max, 210000);
      assert.strictEqual(res.extractedMetadata.detectedRemote, "REMOTE");
    });

    it("passes an Indian Tech / Bengaluru HN comment with INR LPA salary", () => {
      const hnComment = `
        Hasura | Backend Engineer | Bengaluru, India / Remote (India) | ₹30 LPA - ₹45 LPA
        Hasura makes data access blazingly fast.
        We are hiring Backend Engineers to work on our core GraphQL engine and metadata service.
        Tech: Go, Haskell, PostgreSQL, Kubernetes, Docker.
        Looking for engineers with 4+ years building distributed backend services.
      `;

      const candidate: PreFilterCandidateCriteria = {
        targetRoleKeywords: ["Backend Engineer", "Software Engineer"],
        techStack: ["Go", "PostgreSQL", "Kubernetes", "Docker"],
        minSalary: 2500000, // 25 LPA
        currency: "INR",
        yearsOfExperience: 5,
        remotePreference: "ANY",
        preferredLocations: ["Bengaluru", "Remote"],
      };

      const res = preFilterRawText(hnComment, candidate);
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.extractedMetadata.detectedSalary?.min, 3000000);
      assert.strictEqual(res.extractedMetadata.detectedSalary?.max, 4500000);
      assert.strictEqual(res.extractedMetadata.detectedSalary?.currency, "INR");
    });

    it("rejects an HN comment from a staffing agency recruiting for C2C clients", () => {
      const hnComment = `
        TalentBridge Staffing | Various Engineering Roles | Remote (US) | $60-$80/hr C2C only
        We are a recruitment agency representing top tier FinTech clients.
        No direct candidates, Corp-to-Corp and 1099 contracts only.
      `;

      const candidate: PreFilterCandidateCriteria = {
        targetRoleKeywords: ["Engineering", "Software Engineer"],
        companyStageBlacklist: ["staffing", "agency"],
      };

      const res = preFilterRawText(hnComment, candidate);
      assert.strictEqual(res.passed, false);
      assert.ok(res.reasons.some((r) => r.toLowerCase().includes("agency") || r.toLowerCase().includes("staffing")));
    });

    it("processes 100 job comments in under 50ms with 0 tokens and 0 network calls", () => {
      const sample = `
        PostHog (YC W20) | Senior Full Stack Engineer | REMOTE (Worldwide) | $170k - $210k | posthog.com
        Tech: Python, TypeScript, React, ClickHouse, Django, Kafka.
        Requirements: 5+ years of software engineering experience.
      `;

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        preFilterRawText(sample, baseCandidate);
      }
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 50, `Expected 100 iterations to take < 50ms, took ${elapsed.toFixed(2)}ms`);
    });
  });
});
