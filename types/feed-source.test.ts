import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FeedSourceSchema,
  FeedSourceTypeSchema,
  FeedSourceConfigSchema,
  DEFAULT_BASELINE_FEED_SOURCES,
  type FeedSourceType,
} from "./feed-source";
import {
  parseFeedSourceConfig,
  serializeFeedSourceConfig,
} from "../lib/feed-sources";

describe("FeedSource Types and Config Serializers", () => {
  describe("Schema Validation", () => {
    it("validates valid FeedSourceType values", () => {
      const validTypes: FeedSourceType[] = [
        "ASHBY",
        "GREENHOUSE",
        "LEVER",
        "HN",
        "HIMALAYAS",
        "REMOTEOK",
        "JOBICY",
        "WELLFOUND",
        "YC",
        "HIRINGCAFE",
        "WWR",
        "INDEED",
        "MANUAL",
      ];

      for (const type of validTypes) {
        assert.strictEqual(FeedSourceTypeSchema.parse(type), type);
      }
    });

    it("rejects invalid FeedSourceType", () => {
      assert.throws(() => FeedSourceTypeSchema.parse("UNKNOWN_SOURCE"));
    });

    it("validates FeedSourceSchema with defaults", () => {
      const parsed = FeedSourceSchema.parse({
        name: "Test Source",
        type: "ASHBY",
      });

      assert.strictEqual(parsed.name, "Test Source");
      assert.strictEqual(parsed.type, "ASHBY");
      assert.strictEqual(parsed.enabled, true);
      assert.strictEqual(parsed.autoPoll, false);
      assert.strictEqual(parsed.lastCursor, "");
      assert.strictEqual(parsed.pollIntervalMs, 14400000);
      assert.strictEqual(parsed.consecutiveEmpty, 0);
      assert.strictEqual(parsed.jobsDiscovered, 0);
      assert.strictEqual(parsed.jobsPassed, 0);
      assert.strictEqual(parsed.errorCount, 0);
      assert.strictEqual(parsed.lastError, "");
    });

    it("validates FeedSourceConfigSchema with various adapter options", () => {
      const config = {
        boardSlugs: ["stripe", "figma", "vercel"],
        categories: ["software-development"],
        tags: ["dev", "engineer"],
        industry: "engineering",
        count: 50,
        searchStoryPrefix: "Ask HN: Who is hiring?",
      };

      const parsed = FeedSourceConfigSchema.parse(config);
      assert.deepStrictEqual(parsed.boardSlugs, ["stripe", "figma", "vercel"]);
      assert.strictEqual(parsed.count, 50);
      assert.strictEqual(parsed.searchStoryPrefix, "Ask HN: Who is hiring?");
    });
  });

  describe("Baseline Feed Sources Definition", () => {
    it("defines all 11 baseline supported job sources", () => {
      assert.strictEqual(DEFAULT_BASELINE_FEED_SOURCES.length, 11);

      const sourceTypes = DEFAULT_BASELINE_FEED_SOURCES.map((s) => s.type);
      assert.ok(sourceTypes.includes("ASHBY"));
      assert.ok(sourceTypes.includes("GREENHOUSE"));
      assert.ok(sourceTypes.includes("LEVER"));
      assert.ok(sourceTypes.includes("HIMALAYAS"));
      assert.ok(sourceTypes.includes("REMOTEOK"));
      assert.ok(sourceTypes.includes("JOBICY"));
      assert.ok(sourceTypes.includes("HN"));
      assert.ok(sourceTypes.includes("HIRINGCAFE"));
      assert.ok(sourceTypes.includes("WWR"));
      assert.ok(sourceTypes.includes("WELLFOUND"));
      assert.ok(sourceTypes.includes("INDEED"));
    });

    it("ensures all baseline sources default to autoPoll = false for zero unsolicited background overhead", () => {
      for (const source of DEFAULT_BASELINE_FEED_SOURCES) {
        assert.strictEqual(source.autoPoll, false);
        assert.strictEqual(source.enabled, true);
        assert.ok(source.pollIntervalMs > 0);
      }
    });
  });

  describe("Feed Source Config Parsing & Serialization", () => {
    it("parses valid JSON config string safely", () => {
      const jsonStr = JSON.stringify({ boardSlugs: ["anthropic", "openai"] });
      const parsed = parseFeedSourceConfig(jsonStr);
      assert.deepStrictEqual(parsed.boardSlugs, ["anthropic", "openai"]);
    });

    it("recovers safely from invalid or malformed JSON config strings", () => {
      assert.deepStrictEqual(parseFeedSourceConfig("{invalid"), {});
      assert.deepStrictEqual(parseFeedSourceConfig(""), {});
      assert.deepStrictEqual(parseFeedSourceConfig(null as unknown as string), {});
    });

    it("serializes config object to JSON string", () => {
      const config = { boardSlugs: ["palantir"] };
      const serialized = serializeFeedSourceConfig(config);
      assert.strictEqual(serialized, JSON.stringify(config));
    });
  });
});
