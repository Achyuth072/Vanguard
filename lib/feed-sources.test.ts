import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db";
import {
  seedDefaultFeedSources,
  parseFeedSourceConfig,
  getDefaultBaselineFeedSources,
} from "./feed-sources";

describe("FeedSource Database Extensions & Seed Helper", () => {
  before(async () => {
    // Clean test records
    await db.job.deleteMany({
      where: {
        dedupeKey: {
          startsWith: "test-feed-",
        },
      },
    });
    await db.feedSource.deleteMany({
      where: {
        id: {
          startsWith: "test-feed-",
        },
      },
    });
  });

  after(async () => {
    // Cleanup
    await db.job.deleteMany({
      where: {
        dedupeKey: {
          startsWith: "test-feed-",
        },
      },
    });
    await db.feedSource.deleteMany({
      where: {
        id: {
          startsWith: "test-feed-",
        },
      },
    });
  });

  it("creates and retrieves a FeedSource record with full metrics and config", async () => {
    const feedSource = await db.feedSource.create({
      data: {
        id: "test-feed-ashby-1",
        name: "Test Ashby Source",
        type: "ASHBY",
        url: "https://api.ashbyhq.com/posting-api/job-board",
        config: JSON.stringify({ boardSlugs: ["anthropic", "openai"] }),
        enabled: true,
        autoPoll: false,
        pollIntervalMs: 14400000,
        lastCursor: "2026-08-22T00:00:00Z",
        consecutiveEmpty: 2,
        jobsDiscovered: 25,
        jobsPassed: 10,
        errorCount: 1,
        lastError: "Rate limit warning",
      },
    });

    assert.strictEqual(feedSource.id, "test-feed-ashby-1");
    assert.strictEqual(feedSource.type, "ASHBY");
    assert.strictEqual(feedSource.enabled, true);
    assert.strictEqual(feedSource.autoPoll, false);
    assert.strictEqual(feedSource.pollIntervalMs, 14400000);
    assert.strictEqual(feedSource.consecutiveEmpty, 2);
    assert.strictEqual(feedSource.jobsDiscovered, 25);
    assert.strictEqual(feedSource.jobsPassed, 10);
    assert.strictEqual(feedSource.errorCount, 1);
    assert.strictEqual(feedSource.lastError, "Rate limit warning");

    const parsedConfig = parseFeedSourceConfig(feedSource.config);
    assert.deepStrictEqual(parsedConfig.boardSlugs, ["anthropic", "openai"]);
  });

  it("verifies Job extensions: clusterKey, sourceExternalId, feedSource relation, and isStaged default", async () => {
    const job = await db.job.create({
      data: {
        id: "test-job-feed-1",
        dedupeKey: "test-feed-dedupe-1",
        clusterKey: "test-feed-cluster-key-sha256",
        sourceExternalId: "ashby-job-98765",
        title: "Staff Software Engineer",
        company: "Anthropic",
        description: "Develop cutting-edge AI systems.",
        url: "https://jobs.ashbyhq.com/anthropic/98765",
        source: "ASHBY",
        feedSourceId: "test-feed-ashby-1",
        isStaged: true,
      },
      include: {
        feedSource: true,
      },
    });

    assert.strictEqual(job.clusterKey, "test-feed-cluster-key-sha256");
    assert.strictEqual(job.sourceExternalId, "ashby-job-98765");
    assert.strictEqual(job.isStaged, true);
    assert.ok(job.feedSource);
    assert.strictEqual(job.feedSource?.id, "test-feed-ashby-1");
    assert.strictEqual(job.feedSource?.name, "Test Ashby Source");
  });

  it("verifies default value for Job.isStaged is false for standard jobs", async () => {
    const job = await db.job.create({
      data: {
        id: "test-job-feed-2",
        dedupeKey: "test-feed-dedupe-2",
        title: "Direct Job",
        company: "Acme",
        description: "Direct job description",
      },
    });

    assert.strictEqual(job.isStaged, false);
    assert.strictEqual(job.clusterKey, "");
    assert.strictEqual(job.sourceExternalId, "");
    assert.strictEqual(job.feedSourceId, null);
  });

  it("verifies Candidate model stores targetRoleKeywords, techStack, and companyStageBlacklist", async () => {
    const candidateId = "test-candidate-prefs";
    const candidate = await db.candidate.upsert({
      where: { id: candidateId },
      update: {
        targetRoleKeywords: JSON.stringify(["lead", "staff", "principal"]),
        techStack: JSON.stringify(["TypeScript", "Rust", "Node.js"]),
        companyStageBlacklist: JSON.stringify(["early-stage-stealth", "staffing"]),
      },
      create: {
        id: candidateId,
        name: "Test Candidate Preferences",
        targetRoleKeywords: JSON.stringify(["lead", "staff", "principal"]),
        techStack: JSON.stringify(["TypeScript", "Rust", "Node.js"]),
        companyStageBlacklist: JSON.stringify(["early-stage-stealth", "staffing"]),
      },
    });

    assert.strictEqual(candidate.id, candidateId);
    assert.deepStrictEqual(JSON.parse(candidate.targetRoleKeywords), [
      "lead",
      "staff",
      "principal",
    ]);
    assert.deepStrictEqual(JSON.parse(candidate.techStack), [
      "TypeScript",
      "Rust",
      "Node.js",
    ]);
    assert.deepStrictEqual(JSON.parse(candidate.companyStageBlacklist), [
      "early-stage-stealth",
      "staffing",
    ]);

    // Clean up test candidate
    await db.candidate.delete({ where: { id: candidateId } });
  });

  it("idempotently seeds all 11 baseline feed sources via seedDefaultFeedSources", async () => {
    const firstRun = await seedDefaultFeedSources(db);
    assert.strictEqual(firstRun.length, 11);

    const secondRun = await seedDefaultFeedSources(db);
    assert.strictEqual(secondRun.length, 11);

    const allSources = await db.feedSource.findMany({
      where: {
        id: {
          in: getDefaultBaselineFeedSources().map((s) => s.id),
        },
      },
    });

    assert.strictEqual(allSources.length, 11);
    const types = allSources.map((s) => s.type);
    assert.ok(types.includes("ASHBY"));
    assert.ok(types.includes("GREENHOUSE"));
    assert.ok(types.includes("LEVER"));
    assert.ok(types.includes("HIMALAYAS"));
    assert.ok(types.includes("REMOTEOK"));
    assert.ok(types.includes("JOBICY"));
    assert.ok(types.includes("HN"));
    assert.ok(types.includes("HIRINGCAFE"));
    assert.ok(types.includes("WWR"));
    assert.ok(types.includes("WELLFOUND"));
    assert.ok(types.includes("INDEED"));
  });
});
