import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Ingest Navigation & Auto-Focus on Success", () => {
  const ingestModalPath = path.join(process.cwd(), "app/components/IngestModal.tsx");
  const vanguardCockpitPath = path.join(process.cwd(), "app/components/VanguardCockpit.tsx");
  const jobListTablePath = path.join(process.cwd(), "app/components/JobListTable.tsx");

  it("IngestModal exports and invokes onSuccess with IngestSuccessTarget payload", () => {
    const content = fs.readFileSync(ingestModalPath, "utf-8");

    // Defines IngestSuccessTarget interface or typed onSuccess parameter
    assert.ok(
      content.includes("IngestSuccessTarget") || content.includes("onSuccess?: (target"),
      "IngestModal should define a typed onSuccess target parameter"
    );

    // Calls resetFormAndClose with target payload on successful ingestion
    assert.match(
      content,
      /resetFormAndClose\(\s*\{\s*id:\s*res\.job\.id[\s\S]*?status:\s*res\.status/,
      "IngestModal should pass target job id and fitScore to resetFormAndClose on success"
    );

    // Calls resetFormAndClose with target payload on rescue
    assert.match(
      content,
      /resetFormAndClose\(\s*\{\s*id:\s*(droppedJobInfo\.job\.id|rescuedJobId)[\s\S]*?isRescue:\s*true/,
      "IngestModal should pass target job id and rescue flag to resetFormAndClose on rescue"
    );
  });

  it("VanguardCockpit wires IngestModal onSuccess to navigate to Priority (inbox) or Assessment (review)", () => {
    const content = fs.readFileSync(vanguardCockpitPath, "utf-8");

    // handleIngestSuccess or onSuccess handler should exist
    assert.ok(
      content.includes("handleIngestSuccess"),
      "VanguardCockpit should have a handleIngestSuccess callback handler"
    );

    // Wires to IngestModal onSuccess prop
    assert.ok(
      content.includes("onSuccess={handleIngestSuccess}"),
      "VanguardCockpit should pass handleIngestSuccess to IngestModal onSuccess"
    );

    // Sets activeTab to inbox for score >= 80 or rescue
    assert.match(
      content,
      /setActiveTab\(\s*["']inbox["']\s*\)/,
      "handleIngestSuccess should set activeTab to inbox for priority jobs"
    );

    // Sets activeTab to review for score 60-79 (Assessment)
    assert.match(
      content,
      /setActiveTab\(\s*["']review["']\s*\)/,
      "handleIngestSuccess should set activeTab to review for assessment jobs"
    );

    // Sets selectedJobId to target.id
    assert.match(
      content,
      /setSelectedJobId\(\s*target\.id\s*\)/,
      "handleIngestSuccess should set selectedJobId to the target job id"
    );
  });

  it("Priority Inbox tab includes SHORTLISTED jobs so rescued jobs are immediately visible", () => {
    const content = fs.readFileSync(vanguardCockpitPath, "utf-8");

    // tabJobs inbox filter condition
    assert.ok(
      content.includes('s === "SHORTLISTED"') || content.includes("SHORTLISTED"),
      "tabJobs for inbox should include SHORTLISTED jobs so rescued jobs display in the table"
    );
  });

  it("JobListTable automatically and smoothly scrolls the selected job row into view", () => {
    const content = fs.readFileSync(jobListTablePath, "utf-8");

    // selectedRowRef or row ref
    assert.ok(
      content.includes("selectedRowRef"),
      "JobListTable should define a selectedRowRef for the active row"
    );

    // scrollIntoView with smooth behavior
    assert.ok(
      content.includes("scrollIntoView"),
      "JobListTable should call scrollIntoView on the active row"
    );
    assert.ok(
      content.includes('"smooth"') || content.includes("'smooth'"),
      "JobListTable should use smooth scrolling behavior"
    );
    assert.ok(
      content.includes('"nearest"') || content.includes("'nearest'"),
      "JobListTable should use block nearest for snappy localized scrolling"
    );

    // UX polish: scroll-margin breathing room and click cursor stability
    assert.ok(
      content.includes("scrollMargin") || content.includes("scroll-my"),
      "JobListTable rows should define scroll-margin to prevent clamping against the container rim"
    );
    assert.ok(
      content.includes("isClickSelectionRef"),
      "JobListTable should track click selection to avoid scrolling rows out from under user cursor"
    );
  });

  it("VanguardCockpit sorts tabJobs by relevance and maintains tab-isolated job selection", () => {
    const content = fs.readFileSync(vanguardCockpitPath, "utf-8");

    // tabJobs sorted by relevance
    assert.ok(
      content.includes("compareJobsByRelevance"),
      "VanguardCockpit should sort tabJobs by relevance so index 0 matches the top of the table"
    );

    // tab-isolated job selection
    assert.ok(
      content.includes("selectedJobIdByTab"),
      "VanguardCockpit should maintain selectedJobIdByTab to preserve selection across tabs"
    );
  });

  it("JobListTable preserves scroll position per tab and suppresses scrollIntoView during tab switch", () => {
    const content = fs.readFileSync(jobListTablePath, "utf-8");

    // per-tab scroll preservation
    assert.ok(
      content.includes("scrollPositionsByTabRef"),
      "JobListTable should maintain scroll positions per tab"
    );

    // tab switch suppression of scrollIntoView
    assert.ok(
      content.includes("isTabSwitchRef"),
      "JobListTable should track tab switch state to prevent unwanted auto-scroll"
    );
  });
});
