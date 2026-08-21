import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Tactical Intelligence Cockpit — Master-Detail View (Issue 03)", () => {
  const jobListTablePath = path.join(process.cwd(), "app/components/JobListTable.tsx");
  const jobIntelligenceViewPath = path.join(process.cwd(), "app/components/JobIntelligenceView.tsx");
  const vanguardCockpitPath = path.join(process.cwd(), "app/components/VanguardCockpit.tsx");
  const pagePath = path.join(process.cwd(), "app/page.tsx");

  describe("JobListTable Component Specification", () => {
    it("app/components/JobListTable.tsx exists", () => {
      assert.ok(fs.existsSync(jobListTablePath), "app/components/JobListTable.tsx should exist");
    });

    it("defines hairline borders, score anchor box, and middle-dot metadata", () => {
      const content = fs.readFileSync(jobListTablePath, "utf-8");

      // 1px hairline divider
      assert.ok(content.includes("#2a2e38") || content.includes("#2A2E38"));
      // Score anchor styling for >= 80 (brass), >= 60 (sage), and default
      assert.match(content, />=\s*80/);
      assert.match(content, />=\s*60/);
      assert.ok(content.includes("#d4a745") || content.includes("#D4A745"));
      assert.ok(content.includes("#8ab384") || content.includes("#8AB384"));
      assert.ok(content.includes("tabular-nums"));

      // Middle-dot separator
      assert.ok(content.includes("·"));
    });

    it("implements keyboard navigation (J/K, ArrowUp/ArrowDown, Enter) and search focus (/)", () => {
      const content = fs.readFileSync(jobListTablePath, "utf-8");

      // Navigation keys
      assert.ok(content.includes('"j"') || content.includes("'j'"));
      assert.ok(content.includes('"k"') || content.includes("'k'"));
      assert.ok(content.includes('"ArrowDown"') || content.includes("'ArrowDown'"));
      assert.ok(content.includes('"ArrowUp"') || content.includes("'ArrowUp'"));
      assert.ok(content.includes('"Enter"') || content.includes("'Enter'"));

      // Quick search '/' shortcut and ref
      assert.ok(content.includes('"/"') || content.includes("'/'"));
      assert.ok(content.includes("searchInputRef") || content.includes(".focus()"));
    });
  });

  describe("JobIntelligenceView Component Specification", () => {
    it("app/components/JobIntelligenceView.tsx exists", () => {
      assert.ok(fs.existsSync(jobIntelligenceViewPath), "app/components/JobIntelligenceView.tsx should exist");
    });

    it("defines 4-up ReticleGauge evaluation dimensions grid with correct weights", () => {
      const content = fs.readFileSync(jobIntelligenceViewPath, "utf-8");

      // 4 evaluation dimensions
      assert.ok(content.includes("Skills Fit"));
      assert.ok(content.includes("Experience"));
      assert.ok(content.includes("Domain Fit"));
      assert.ok(content.includes("Trajectory"));

      // Standard weights
      assert.ok(content.includes('"35%"') || content.includes("'35%'"));
      assert.ok(content.includes('"30%"') || content.includes("'30%'"));
      assert.ok(content.includes('"20%"') || content.includes("'20%'"));
      assert.ok(content.includes('"15%"') || content.includes("'15%'"));
    });

    it("defines high-contrast signals, watchpoints, direct risk box, and description tab", () => {
      const content = fs.readFileSync(jobIntelligenceViewPath, "utf-8");

      // Confirmed signals with sage (#8ab384) and '+'
      assert.ok(content.includes("#8ab384") || content.includes("#8AB384"));
      assert.ok(content.includes("Confirmed Signals & Strengths") || content.includes("Strengths"));

      // Watchpoints with rust (#c4634e) and '!'
      assert.ok(content.includes("#c4634e") || content.includes("#C4634E"));
      assert.ok(content.includes("Watchpoints & Vulnerabilities") || content.includes("Watchpoints"));

      // Direct Risk factors alert
      assert.ok(content.includes("Direct Risk Factors") || content.includes("risks"));

      // Deploy application button
      assert.ok(content.includes("Deploy Application"));

      // Raw Description tab toggle
      assert.ok(content.includes("description") || content.includes("Target Description"));
    });

    it("wires status change and rescore action triggers", () => {
      const content = fs.readFileSync(jobIntelligenceViewPath, "utf-8");
      assert.ok(content.includes("onStatusChange"));
      assert.ok(content.includes("onRescore"));
      assert.ok(content.includes("onDeployApplication"));
    });
  });

  describe("VanguardCockpit Master-Detail Orchestrator", () => {
    it("app/components/VanguardCockpit.tsx exists", () => {
      assert.ok(fs.existsSync(vanguardCockpitPath), "app/components/VanguardCockpit.tsx should exist");
    });

    it("integrates TelemetryStrip, JobListTable, JobIntelligenceView, and ApplicationTracker", () => {
      const content = fs.readFileSync(vanguardCockpitPath, "utf-8");
      assert.ok(content.includes("TelemetryStrip"));
      assert.ok(content.includes("JobListTable"));
      assert.ok(content.includes("JobIntelligenceView"));
      assert.ok(content.includes("ApplicationTracker"));
      assert.ok(content.includes("ApplicationPreparationDrawer"));
      assert.ok(content.includes("IngestModal"));
    });

    it("renders split 5/7 columns master-detail layout on non-pipeline tabs", () => {
      const content = fs.readFileSync(vanguardCockpitPath, "utf-8");
      assert.ok(content.includes("lg:col-span-5"));
      assert.ok(content.includes("lg:col-span-7"));
    });
  });

  describe("Landing Page (app/page.tsx)", () => {
    it("serves VanguardCockpit with Ink & Brass styling", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("VanguardCockpit"));
      assert.ok(content.includes("#0d0e12") || content.includes("#0D0E12") || content.includes("bg-"));
      assert.ok(content.includes("#f4f2ec") || content.includes("#F4F2EC"));
    });
  });
});
