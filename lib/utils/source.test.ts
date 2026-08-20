import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectSourceFromUrl,
  normalizeSource,
  getSourceLabel,
  SUPPORTED_SOURCES,
} from "./source";

describe("lib/utils/source", () => {
  describe("detectSourceFromUrl", () => {
    test("detects YC from workatastartup.com and ycombinator.com URLs", () => {
      assert.equal(detectSourceFromUrl("https://www.workatastartup.com/jobs/105120"), "YC");
      assert.equal(detectSourceFromUrl("https://www.ycombinator.com/companies/stripe/jobs"), "YC");
    });

    test("detects Wellfound from wellfound.com and angel.co URLs", () => {
      assert.equal(detectSourceFromUrl("https://wellfound.com/l/2CppR2"), "WELLFOUND");
      assert.equal(detectSourceFromUrl("https://angel.co/company/foo/jobs"), "WELLFOUND");
    });

    test("detects HiringCafe from hiring.cafe URLs", () => {
      assert.equal(detectSourceFromUrl("https://hiring.cafe/job/12345"), "HIRING_CAFE");
    });

    test("detects LinkedIn from linkedin.com URLs", () => {
      assert.equal(detectSourceFromUrl("https://www.linkedin.com/jobs/view/987654321"), "LINKEDIN");
    });

    test("detects Indeed from indeed.com URLs", () => {
      assert.equal(detectSourceFromUrl("https://www.indeed.com/viewjob?jk=abcdef"), "INDEED");
    });

    test("detects Company Portal from ATS URLs (Greenhouse, Lever, Ashby, Oracle)", () => {
      assert.equal(detectSourceFromUrl("https://boards.greenhouse.io/stripe/jobs/123"), "COMPANY_SITE");
      assert.equal(detectSourceFromUrl("https://jobs.lever.co/figma/abc"), "COMPANY_SITE");
      assert.equal(detectSourceFromUrl("https://jobs.ashbyhq.com/openai/xyz"), "COMPANY_SITE");
      assert.equal(detectSourceFromUrl("https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210742917"), "COMPANY_SITE");
    });

    test("returns OTHER or null for unknown generic URLs", () => {
      assert.equal(detectSourceFromUrl("https://example.com/custom-job"), "OTHER");
      assert.equal(detectSourceFromUrl(""), null);
      assert.equal(detectSourceFromUrl(undefined), null);
    });
  });

  describe("normalizeSource", () => {
    test("normalizes standard names and variations", () => {
      assert.equal(normalizeSource("wellfound"), "WELLFOUND");
      assert.equal(normalizeSource("WELLFOUND"), "WELLFOUND");
      assert.equal(normalizeSource("yc"), "YC");
      assert.equal(normalizeSource("Y Combinator"), "YC");
      assert.equal(normalizeSource("HiringCafe"), "HIRING_CAFE");
      assert.equal(normalizeSource("hiring cafe"), "HIRING_CAFE");
      assert.equal(normalizeSource("Company Site"), "COMPANY_SITE");
      assert.equal(normalizeSource("CompanySite"), "COMPANY_SITE");
      assert.equal(normalizeSource("direct"), "COMPANY_SITE");
    });

    test("falls back to URL detection when source is empty or generic", () => {
      assert.equal(normalizeSource("", "https://wellfound.com/l/2CppR2"), "WELLFOUND");
      assert.equal(normalizeSource("URL", "https://www.workatastartup.com/jobs/105120"), "YC");
      assert.equal(normalizeSource(undefined, "https://hiring.cafe/job/1"), "HIRING_CAFE");
    });

    test("defaults to MANUAL if no source and no URL", () => {
      assert.equal(normalizeSource(undefined, undefined), "MANUAL");
      assert.equal(normalizeSource("", ""), "MANUAL");
    });
  });

  describe("getSourceLabel", () => {
    test("returns user-friendly labels", () => {
      assert.equal(getSourceLabel("YC"), "YC");
      assert.equal(getSourceLabel("WELLFOUND"), "Wellfound");
      assert.equal(getSourceLabel("HIRING_CAFE"), "HiringCafe");
      assert.equal(getSourceLabel("COMPANY_SITE"), "Company Site");
      assert.equal(getSourceLabel("MANUAL"), "Manual");
    });
  });

  describe("SUPPORTED_SOURCES list", () => {
    test("contains all primary job discovery platforms", () => {
      const keys = SUPPORTED_SOURCES.map((s) => s.key);
      assert.ok(keys.includes("YC"));
      assert.ok(keys.includes("WELLFOUND"));
      assert.ok(keys.includes("HIRING_CAFE"));
      assert.ok(keys.includes("LINKEDIN"));
      assert.ok(keys.includes("COMPANY_SITE"));
    });
  });
});
