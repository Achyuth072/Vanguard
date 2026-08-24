import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scoreJobHybrid,
  classifyFunnelAction,
  evaluateHybridFunnel,
} from "./hybrid";
import type { CandidateContext, JobContext } from "../ai/router";

describe("3-Tier Local Hybrid Scoring Engine", () => {
  const sampleCandidate: CandidateContext = {
    name: "Alex Dev",
    targetRole: "Senior Software Engineer",
    yearsOfExperience: 6,
    skills: JSON.stringify([
      { name: "TypeScript", category: "LANGUAGES" },
      { name: "React", category: "FRONTEND" },
      { name: "Next.js", category: "FRONTEND" },
      { name: "Node.js", category: "BACKEND" },
      { name: "PostgreSQL", category: "DATABASES" },
    ]),
    experiences: JSON.stringify([
      {
        title: "Senior Full Stack Engineer",
        company: "Tech Corp",
        summary: "Architected high-scale web apps using Next.js, React, Node.js and PostgreSQL.",
      },
    ]),
  };

  it("scores a highly relevant job with a high hybrid score and APPLY recommendation", async () => {
    const matchingJob: JobContext = {
      title: "Senior Fullstack Engineer",
      company: "Acme Cloud",
      description:
        "Looking for a Senior Software Engineer with 5+ years experience in TypeScript, React, Next.js, Node.js, and PostgreSQL to scale modern cloud applications.",
    };

    const fit = await scoreJobHybrid(sampleCandidate, matchingJob);

    assert.ok(fit.score >= 80, `Expected score >= 80, got ${fit.score}`);
    assert.equal(fit.recommendation, "APPLY");
    assert.ok(fit.skillsFit >= 75, `Expected high skills fit, got ${fit.skillsFit}`);
    assert.ok(fit.experienceFit >= 85, `Expected high experience fit, got ${fit.experienceFit}`);
    assert.ok(fit.domainFit >= 70, `Expected high domain fit, got ${fit.domainFit}`);
    assert.ok(fit.trajectoryFit >= 85, `Expected high trajectory fit, got ${fit.trajectoryFit}`);
    assert.ok(fit.strengths.length > 0);
    assert.ok(fit.reasoning.includes("Skills"));
  });

  it("scores an unrelated job with a low hybrid score and IGNORE recommendation", async () => {
    const unrelatedJob: JobContext = {
      title: "Head Nurse - Intensive Care Unit",
      company: "City Hospital",
      description:
        "Seeking an experienced Registered Nurse / Charge Nurse with 10+ years of ICU clinical experience and healthcare patient management.",
    };

    const fit = await scoreJobHybrid(sampleCandidate, unrelatedJob);

    assert.ok(fit.score < 60, `Expected score < 60 for unrelated job, got ${fit.score}`);
    assert.equal(fit.recommendation, "IGNORE");
    assert.ok(fit.skillsFit < 40, `Expected low skills fit, got ${fit.skillsFit}`);
    assert.ok(fit.risks.length > 0 || fit.gaps.length > 0);
  });

  it("penalizes experience when candidate falls short of required YOE", async () => {
    const juniorCandidate: CandidateContext = {
      ...sampleCandidate,
      yearsOfExperience: 2,
    };

    const principalJob: JobContext = {
      title: "Principal Staff Infrastructure Architect",
      company: "Enterprise Corp",
      description: "Minimum 10+ years of experience required. Must have deep knowledge of TypeScript and PostgreSQL.",
      requiredExperienceYears: 10,
    };

    const fit = await scoreJobHybrid(juniorCandidate, principalJob);

    assert.ok(
      fit.experienceFit <= 50,
      `Expected experience penalty for 2 YOE vs 10 req, got ${fit.experienceFit}`
    );
    assert.ok(fit.gaps.some((g) => g.toLowerCase().includes("experience") || g.toLowerCase().includes("short")));
  });

  it("classifies funnel actions accurately based on score thresholds", () => {
    assert.equal(classifyFunnelAction(90), "AUTO_STAGE_HIGH_MATCH");
    assert.equal(classifyFunnelAction(82), "AUTO_STAGE_HIGH_MATCH");
    assert.equal(classifyFunnelAction(75), "SELECTIVE_LLM_DEEP_INSPECTION");
    assert.equal(classifyFunnelAction(55), "SELECTIVE_LLM_DEEP_INSPECTION");
    assert.equal(classifyFunnelAction(54), "AUTO_IGNORE");
    assert.equal(classifyFunnelAction(30), "AUTO_IGNORE");
  });

  it("evaluates a batch of jobs in evaluateHybridFunnel with 0 tokens", async () => {
    const jobs = [
      {
        id: "job-1",
        title: "Senior Next.js Developer",
        company: "Fast Startup",
        description: "TypeScript, React, Next.js, Node.js. 5 years experience.",
      },
      {
        id: "job-2",
        title: "Real Estate Property Manager",
        company: "Realty Inc",
        description: "Commercial real estate leasing and site tours.",
      },
    ];

    const results = await evaluateHybridFunnel(sampleCandidate, jobs);

    assert.equal(results.length, 2);
    assert.equal(results[0].jobId, "job-1");
    assert.ok(results[0].score >= results[1].score);
    assert.ok(results[0].funnelAction !== "AUTO_IGNORE");
    assert.equal(results[1].funnelAction, "AUTO_IGNORE");
  });
});

