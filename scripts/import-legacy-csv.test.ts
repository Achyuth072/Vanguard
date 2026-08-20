import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCompany,
  cleanRoleTitle,
  cleanLocationAndRemote,
  parseCompensationString,
  mapLegacyStatus,
  mapLegacyPriorityToScore,
  parseLegacyCsvRow,
} from "./import-legacy-csv";

describe("scripts/import-legacy-csv", () => {
  describe("cleanCompany", () => {
    test("cleans Wellfound company URLs", () => {
      assert.equal(cleanCompany("https://wellfound.com/company/brainsightai-1"), "Brainsight AI");
      assert.equal(cleanCompany("https://wellfound.com/company/tagleaf-1"), "Tagleaf");
      assert.equal(cleanCompany("https://www.vitraga.com/"), "Vitraga");
    });

    test("cleans quoted and whitespace names", () => {
      assert.equal(cleanCompany(' " Whipscribe by Neugence Technology"'), "Whipscribe by Neugence Technology");
      assert.equal(cleanCompany(' " loopfour"'), "loopfour");
    });
  });

  describe("cleanRoleTitle", () => {
    test("strips notion URL prefixes and tab characters", () => {
      assert.equal(cleanRoleTitle("https://app.notion.com\tFull Stack Engineer"), "Full Stack Engineer");
      assert.equal(cleanRoleTitle("https://app.notion.comFrontend Developer (Next.js, React)"), "Frontend Developer (Next.js, React)");
    });

    test("handles Oracle cloud URL roles with company fallback", () => {
      const title = cleanRoleTitle("https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210742917", "JPMorganChase");
      assert.equal(title, "Software Engineer (Job 210742917)");
    });
  });

  describe("cleanLocationAndRemote", () => {
    test("cleans location URLs and identifies remote status", () => {
      const res1 = cleanLocationAndRemote("https://wellfound.com/location/bangalore-urban");
      assert.equal(res1.location, "Bangalore Urban");
      assert.equal(res1.remoteStatus, "ONSITE");

      const res2 = cleanLocationAndRemote("Remote (Everywhere)");
      assert.equal(res2.location, "Everywhere");
      assert.equal(res2.remoteStatus, "REMOTE");

      const res3 = cleanLocationAndRemote("Thane, Maharashtra / Hybrid");
      assert.equal(res3.location, "Thane, Maharashtra");
      assert.equal(res3.remoteStatus, "HYBRID");
    });
  });

  describe("parseCompensationString", () => {
    test("parses INR LPA ranges", () => {
      const res = parseCompensationString("₹5L – ₹15L");
      assert.equal(res.salaryMin, 500000);
      assert.equal(res.salaryMax, 1500000);
      assert.equal(res.currency, "INR");
    });

    test("parses USD ranges", () => {
      const res = parseCompensationString("$80k – $100k");
      assert.equal(res.salaryMin, 80000);
      assert.equal(res.salaryMax, 100000);
      assert.equal(res.currency, "USD");
    });

    test("parses INR Lakh with equity note", () => {
      const res = parseCompensationString("₹9L – ₹11L • No equity");
      assert.equal(res.salaryMin, 900000);
      assert.equal(res.salaryMax, 1100000);
      assert.equal(res.currency, "INR");
    });

    test("handles competitive / equity-only gracefully", () => {
      const res = parseCompensationString("0.1% – 0.25%");
      assert.equal(res.salaryMin, null);
      assert.equal(res.salaryMax, null);
    });
  });

  describe("mapLegacyStatus", () => {
    test("maps statuses correctly", () => {
      assert.deepEqual(mapLegacyStatus("Applied"), { jobStatus: "APPLIED", appStatus: "APPLIED" });
      assert.deepEqual(mapLegacyStatus("Take-home / OA"), { jobStatus: "ASSESSMENT", appStatus: "ASSESSMENT" });
      assert.deepEqual(mapLegacyStatus("Rejected"), { jobStatus: "REJECTED", appStatus: "REJECTED" });
      assert.deepEqual(mapLegacyStatus("Withdrew"), { jobStatus: "WITHDRAWN", appStatus: "WITHDRAWN" });
      assert.deepEqual(mapLegacyStatus("Archived"), { jobStatus: "ARCHIVED", appStatus: null });
    });
  });

  describe("mapLegacyPriorityToScore", () => {
    test("maps High, Med, Low priorities", () => {
      assert.deepEqual(mapLegacyPriorityToScore("High"), { score: 85, recommendation: "APPLY" });
      assert.deepEqual(mapLegacyPriorityToScore("Med"), { score: 70, recommendation: "REVIEW" });
      assert.deepEqual(mapLegacyPriorityToScore("Low"), { score: 55, recommendation: "REVIEW" });
    });
  });

  describe("parseLegacyCsvRow", () => {
    test("parses a full CSV line correctly", () => {
      const row = [
        "Waybill (S26)",
        "Founding Engineer",
        "YC",
        "Bangalore",
        "Applied",
        "High",
        "₹15L – ₹25L",
        "August 18, 2026",
        "https://www.workatastartup.com/jobs/105120",
      ];
      const parsed = parseLegacyCsvRow(row);
      assert.ok(parsed);
      assert.equal(parsed.company, "Waybill");
      assert.equal(parsed.title, "Founding Engineer");
      assert.equal(parsed.source, "YC");
      assert.equal(parsed.salaryMin, 1500000);
      assert.equal(parsed.salaryMax, 2500000);
      assert.equal(parsed.currency, "INR");
      assert.equal(parsed.status, "APPLIED");
    });
  });
});
