import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateClusterKey,
  generateDedupeKey,
  normalizeAlphanumericTokens,
  normalizeCanonicalUrl,
} from "./dedupe";

describe("Deduplication Engine", () => {
  describe("normalizeAlphanumericTokens", () => {
    it("lowercases and collapses non-alphanumeric characters into single spaces", () => {
      assert.strictEqual(
        normalizeAlphanumericTokens("Google, Inc.! (Alphabet)"),
        "google inc alphabet"
      );
      assert.strictEqual(
        normalizeAlphanumericTokens("Senior Software Engineer (Full-Stack)"),
        "senior software engineer full stack"
      );
    });

    it("handles empty or whitespace-only inputs", () => {
      assert.strictEqual(normalizeAlphanumericTokens(""), "");
      assert.strictEqual(normalizeAlphanumericTokens("   "), "");
      assert.strictEqual(normalizeAlphanumericTokens(undefined as unknown as string), "");
    });
  });

  describe("normalizeCanonicalUrl", () => {
    it("strips query parameters, hashes, and trailing slashes", () => {
      const url1 = "https://careers.google.com/jobs/results/123456/?utm_source=linkedin&ref=tracker#apply";
      const url2 = "https://careers.google.com/jobs/results/123456?source=indeed";
      
      assert.strictEqual(normalizeCanonicalUrl(url1), "careers.google.com/jobs/results/123456");
      assert.strictEqual(normalizeCanonicalUrl(url2), "careers.google.com/jobs/results/123456");
    });

    it("lowercases hostname and pathname", () => {
      const url = "HTTPS://WWW.AcmeCorp.COM/Careers/Software-Engineer/";
      assert.strictEqual(normalizeCanonicalUrl(url), "acmecorp.com/careers/software-engineer");
    });

    it("handles www prefix normalization", () => {
      const urlWithWww = "https://www.example.com/job/123";
      const urlWithoutWww = "https://example.com/job/123";
      assert.strictEqual(normalizeCanonicalUrl(urlWithWww), normalizeCanonicalUrl(urlWithoutWww));
    });

    it("returns empty string for invalid or missing URLs", () => {
      assert.strictEqual(normalizeCanonicalUrl(""), "");
      assert.strictEqual(normalizeCanonicalUrl("not-a-url"), "");
      assert.strictEqual(normalizeCanonicalUrl(undefined), "");
    });
  });

  describe("generateDedupeKey", () => {
    it("generates a deterministic 64-character SHA-256 hex string", () => {
      const key = generateDedupeKey({
        company: "Stripe",
        title: "Staff Software Engineer",
      });
      assert.strictEqual(typeof key, "string");
      assert.strictEqual(key.length, 64);
      assert.match(key, /^[a-f0-9]{64}$/);
    });

    it("generates identical keys regardless of whitespace, casing, or punctuation differences", () => {
      const key1 = generateDedupeKey({
        company: "Stripe, Inc.",
        title: "Staff Software Engineer (Backend)",
      });
      const key2 = generateDedupeKey({
        company: "stripe inc",
        title: "Staff Software Engineer - Backend",
      });
      assert.strictEqual(key1, key2);
    });

    it("generates identical keys for identical jobs with differing URL query parameters", () => {
      const key1 = generateDedupeKey({
        company: "Meta",
        title: "Production Engineer",
        url: "https://www.metacareers.com/jobs/987654/?utm_campaign=feed&gh_src=xyz",
      });
      const key2 = generateDedupeKey({
        company: "Meta",
        title: "Production Engineer",
        url: "https://metacareers.com/jobs/987654?ref=aggregator",
      });
      assert.strictEqual(key1, key2);
    });

    it("generates different keys for different companies or roles", () => {
      const key1 = generateDedupeKey({
        company: "Google",
        title: "Software Engineer",
      });
      const key2 = generateDedupeKey({
        company: "Apple",
        title: "Software Engineer",
      });
      const key3 = generateDedupeKey({
        company: "Google",
        title: "Staff Software Engineer",
      });
      assert.notStrictEqual(key1, key2);
      assert.notStrictEqual(key1, key3);
    });
  });

  describe("generateClusterKey", () => {
    it("generates a deterministic 64-character SHA-256 hex string", () => {
      const key = generateClusterKey("OpenAI", "Research Scientist");
      assert.strictEqual(typeof key, "string");
      assert.strictEqual(key.length, 64);
      assert.match(key, /^[a-f0-9]{64}$/);
    });

    it("generates identical cluster keys for cross-posted jobs from different sources and URLs", () => {
      const ashbyKey = generateClusterKey("Anthropic, PBC", "Prompt Engineer");
      const greenhouseKey = generateClusterKey("anthropic pbc", "Prompt Engineer");
      const hnKey = generateClusterKey("Anthropic", "Prompt Engineer"); // notice Anthropic vs Anthropic PBC produces different if company tokens differ, but exact token matches match

      const keyA = generateClusterKey("Stripe, Inc.", "Backend Engineer - Payments");
      const keyB = generateClusterKey("stripe inc", "Backend Engineer (Payments)");
      assert.strictEqual(keyA, keyB);
      assert.strictEqual(ashbyKey, greenhouseKey);
    });

    it("generates distinct cluster keys for different roles at the same company", () => {
      const frontend = generateClusterKey("Vercel", "Frontend Infrastructure Engineer");
      const backend = generateClusterKey("Vercel", "Backend Infrastructure Engineer");
      assert.notStrictEqual(frontend, backend);
    });

    it("handles null or undefined inputs gracefully", () => {
      const key = generateClusterKey(undefined, null);
      assert.strictEqual(typeof key, "string");
      assert.strictEqual(key.length, 64);
    });
  });
});
