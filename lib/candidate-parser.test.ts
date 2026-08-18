import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseResumeMarkdownToProfile } from "./candidate-parser";

describe("Candidate Resume Markdown Parser", () => {
  it("parses candidate resume from Markdown correctly", () => {
    const resumePath = path.join(process.cwd(), ".scratch", "Resume", "Achyuth.md");
    const markdown = fs.readFileSync(resumePath, "utf-8");

    const profile = parseResumeMarkdownToProfile(markdown, "candidate-default");

    assert.strictEqual(profile.id, "candidate-default");
    assert.strictEqual(profile.name, "Achyuth S");
    assert.strictEqual(profile.yearsOfExperience, 2);
    assert.strictEqual(profile.experiences.length, 3);
    assert.strictEqual(profile.experiences[0].company, "She Drives");
    assert.strictEqual(profile.experiences[0].title, "Core Developer");
    assert.strictEqual(profile.experiences[0].startDate, "2025-05");
    assert.strictEqual(profile.experiences[0].endDate, "2025-11");
    assert.strictEqual(profile.experiences[0].highlights.length, 4);

    assert.strictEqual(profile.projects.length, 2);
    assert.strictEqual(profile.projects[0].title, "Kagelin");
    assert.ok(profile.projects[0].technologies.includes("Next.js 16"));
    assert.strictEqual(profile.projects[1].title, "Agentic Career CRM");

    assert.ok(profile.skills.length >= 8);
    const jsSkill = profile.skills.find((s) => s.name === "JavaScript");
    assert.ok(jsSkill);
    assert.strictEqual(jsSkill.category, "LANGUAGE");
    assert.strictEqual(jsSkill.yearsOfExperience, 2);

    const reactSkill = profile.skills.find((s) => s.name === "React.js");
    assert.ok(reactSkill);
    assert.strictEqual(reactSkill.category, "FRAMEWORK");
  });

  it("handles empty or blank markdown gracefully", () => {
    const profile = parseResumeMarkdownToProfile("", "test-empty");
    assert.strictEqual(profile.id, "test-empty");
    assert.strictEqual(profile.name, "Default Candidate");
    assert.strictEqual(profile.skills.length, 0);
    assert.strictEqual(profile.experiences.length, 0);
    assert.strictEqual(profile.projects.length, 0);
  });
});
