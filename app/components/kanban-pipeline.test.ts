import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Tactical Application Pipeline Kanban (Issue 04)", () => {
  const applicationTrackerPath = path.join(process.cwd(), "app/components/ApplicationTracker.tsx");

  it("app/components/ApplicationTracker.tsx exists", () => {
    assert.ok(fs.existsSync(applicationTrackerPath), "app/components/ApplicationTracker.tsx should exist");
  });

  describe("Column Containers & Headers", () => {
    it("renders column containers with flat #15171D background, 1px #2A2E38 hairline borders, and 3px radius", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("#15171d") || content.includes("#15171D") || content.includes("var(--ink-900)"));
      assert.ok(content.includes("#2a2e38") || content.includes("#2A2E38") || content.includes("var(--hairline)"));
      assert.ok(content.includes("rounded-[3px]") || content.includes("rounded-[0.1875rem]"));
    });

    it("renders column headers with monospace stage code and candidate count badge", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      // 12px / 11px monospace stage code
      assert.ok(content.includes("font-mono"));
      assert.ok(content.includes("//") || content.includes("STAGE"));
      assert.ok(content.includes("tabular-nums"));
    });
  });

  describe("Kanban Cards Layout & Score Anchor", () => {
    it("renders cards with score anchor box, title, company, middle-dot metadata, and days-since-applied", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      // Card surface
      assert.ok(content.includes("#0d0e12") || content.includes("#0D0E12") || content.includes("var(--ink-950)"));
      // Score anchor styling
      assert.match(content, />=\s*80/);
      assert.match(content, />=\s*60/);
      assert.ok(content.includes("#d4a745") || content.includes("#D4A745"));
      assert.ok(content.includes("#8ab384") || content.includes("#8AB384"));
      // Middle-dot metadata
      assert.ok(content.includes("·"));
      // Days since applied badge / calculation
      assert.ok(content.includes("calculateDaysSinceApplied"));
    });
  });

  describe("Drag and Drop Target Styling", () => {
    it("applies crisp 2px #D4A745 dashed border during drag over", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(
        content.includes("border-[#d4a745]") ||
        content.includes("border-[#D4A745]") ||
        content.includes("border-brass") ||
        content.includes("var(--brass)")
      );
      assert.ok(content.includes("border-dashed"));
    });
  });

  describe("Auto-Ghosting UI & Server Action Integration", () => {
    it("provides high-contrast stale application warning chip and batch auto-ghost action", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("autoGhostStaleApplicationsAction"));
      assert.ok(content.includes("updateJobStatusAction"));
      assert.ok(content.includes("identifyGhostableJobs"));
      assert.ok(content.includes("Auto-Ghost") || content.includes("Ghost Stale"));
    });
  });

  describe("Keyboard Fallback Menu", () => {
    it("provides accessible keyboard stage changer without mouse interaction", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("<select") || content.includes("role=\"listbox\"") || content.includes("handleMoveStage"));
      assert.ok(content.includes("aria-label"));
    });
  });

  describe("Tactical Scrollbars & Mouse Drag-to-Pan Rail", () => {
    const globalsCssPath = path.join(process.cwd(), "app/globals.css");

    it("defines high-contrast Vanguard tactical scrollbars in globals.css", () => {
      const css = fs.readFileSync(globalsCssPath, "utf-8");

      assert.ok(css.includes("scrollbar-width: thin;"), "Should declare thin scrollbar for Firefox");
      assert.ok(css.includes("scrollbar-color: var(--hairline) var(--ink-950);"), "Should map scrollbar colors to Vanguard tokens");
      assert.ok(css.includes("::-webkit-scrollbar"), "Should style Webkit scrollbars");
      assert.ok(css.includes("::-webkit-scrollbar-thumb"), "Should style scrollbar thumb with hairline");
      assert.ok(css.includes("::-webkit-scrollbar-track"), "Should style scrollbar track with ink-950");
      assert.ok(!css.includes("*::before,\n*::after {\n  scrollbar-width: none !important;"), "Should not hide scrollbars globally on all elements");
    });

    it("equips ApplicationTracker with mouse hold-and-drag horizontal canvas panning", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("railRef"), "Should attach ref to scrollable rail");
      assert.ok(content.includes("handleRailMouseDown"), "Should have mouse down handler for panning");
      assert.ok(content.includes("handleRailMouseMove"), "Should have mouse move handler for panning");
      assert.ok(content.includes("handleRailMouseUp"), "Should have mouse up handler for panning");
      assert.ok(content.includes("handleRailWheel"), "Should support mouse wheel horizontal assistance");
      assert.ok(content.includes("closest('[draggable=\"true\"]')"), "Must isolate panning from HTML5 draggable cards to prevent DnD conflicts");
      assert.ok(content.includes("cursor-grabbing") && content.includes("cursor-grab"), "Should provide interactive cursor states");
    });
  });

  describe("Pipeline Sorting (Default by Score, Date Option)", () => {
    it("defaults pipeline candidate sorting to Fit Score with Date toggle option", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("compareJobsByScore"), "Should import and use compareJobsByScore");
      assert.ok(content.includes("compareJobsByRecent"), "Should import and use compareJobsByRecent");
      assert.match(content, /useState<[^>]*>\("score"\)/, "Should default sortMode to score");
      assert.ok(content.includes("sortedPipelineJobs"), "Should compute sorted pipeline jobs");
      assert.ok(content.includes("SORT:"), "Should render tactical SORT toggle button in subheader");
      assert.ok(content.includes("ArrowUpDown"), "Should render ArrowUpDown icon for sort toggle");
    });
  });

  describe("Kanban Card Deletion Action", () => {
    it("equips ApplicationTracker cards with delete button and server action integration", () => {
      const content = fs.readFileSync(applicationTrackerPath, "utf-8");

      assert.ok(content.includes("deleteJobAction"), "Should import and integrate deleteJobAction");
      assert.ok(content.includes("handleDeleteJob"), "Should define handleDeleteJob handler");
      assert.ok(content.includes("Trash2"), "Should render Trash2 icon for deletion");
      assert.ok(content.includes("title=\"Delete Job\""), "Should provide accessible title for delete button");
    });
  });
});
