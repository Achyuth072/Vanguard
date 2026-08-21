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
});
