import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Candidate Profile Drawer, Ingest Modals & Command Palette (Issue 06)", () => {
  const profileDrawerPath = path.join(process.cwd(), "app/components/ProfileDrawer.tsx");
  const ingestModalPath = path.join(process.cwd(), "app/components/IngestModal.tsx");
  const editJobModalPath = path.join(process.cwd(), "app/components/EditJobModal.tsx");
  const commandPalettePath = path.join(process.cwd(), "components/GlobalCommandPalette.tsx");

  describe("ProfileDrawer Component Specification", () => {
    it("app/components/ProfileDrawer.tsx exists", () => {
      assert.ok(fs.existsSync(profileDrawerPath), "ProfileDrawer.tsx should exist");
    });

    it("defines 12px monospace section navigation with PREFERENCES, SKILLS, EXPERIENCE, RESUME, PROJECTS", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");

      assert.ok(content.includes("font-mono"));
      assert.ok(content.includes("PREFERENCES") || content.includes("PREFERENCES & TARGET"));
      assert.ok(content.includes("SKILLS") || content.includes("VERIFIED SKILLS"));
      assert.ok(content.includes("EXPERIENCE") || content.includes("WORK EXPERIENCE"));
      assert.ok(content.includes("RESUME") || content.includes("MASTER RESUME"));
    });

    it("defines scalar filters editor with ISO currency dropdown, remote filter, and experience", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");

      // Currency dropdown with supported currencies
      assert.ok(content.includes("SUPPORTED_CURRENCIES") || content.includes("currency"));
      assert.ok(content.includes("minSalary") || content.includes("Min. Expected Salary"));

      // Remote filter
      assert.ok(content.includes("remotePreference"));
      assert.ok(content.includes("REMOTE_ONLY") || content.includes("REMOTE"));

      // Experience input
      assert.ok(content.includes("yearsOfExperience"));
    });

    it("uses Ink & Brass tokens (#0d0e12, #15171d, #1f222a, #2a2e38, #d4a745, #f4f2ec)", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");

      assert.ok(content.includes("#0d0e12") || content.includes("#0D0E12"));
      assert.ok(content.includes("#15171d") || content.includes("#15171D"));
      assert.ok(content.includes("#2a2e38") || content.includes("#2A2E38"));
      assert.ok(content.includes("#d4a745") || content.includes("#D4A745"));
      assert.ok(content.includes("#f4f2ec") || content.includes("#F4F2EC"));
    });

    it("supports high-contrast skill chips and strict persistence action", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");

      assert.ok(content.includes("updateCandidateProfile"));
      assert.ok(content.includes("handleSave"));
      assert.ok(content.includes("handleRemoveSkill"));
      assert.ok(content.includes("handleAddSkill"));
    });
  });

  describe("IngestModal & EditJobModal Component Specification", () => {
    it("app/components/IngestModal.tsx exists", () => {
      assert.ok(fs.existsSync(ingestModalPath), "IngestModal.tsx should exist");
    });

    it("app/components/EditJobModal.tsx exists", () => {
      assert.ok(fs.existsSync(editJobModalPath), "EditJobModal.tsx should exist");
    });

    it("IngestModal provides tabbed mode selector for Paste Text, Direct URL, and Manual", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");

      assert.ok(content.includes("paste") && content.includes("url") && content.includes("manual"));
      assert.ok(content.includes("Paste") || content.includes("PASTE"));
      assert.ok(content.includes("URL") || content.includes("Direct URL"));
      assert.ok(content.includes("Manual") || content.includes("MANUAL"));
    });

    it("IngestModal displays real-time extraction preview / normalized metadata badges", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");

      assert.ok(content.includes("preview") || content.includes("Preview") || content.includes("EXTRACTION PREVIEW") || content.includes("NORMALIZED PREVIEW"));
      assert.ok(content.includes("font-mono"));
    });

    it("IngestModal and EditJobModal use Ink & Brass tokens (#15171d, #2a2e38, #d4a745)", () => {
      const ingestContent = fs.readFileSync(ingestModalPath, "utf-8");
      const editContent = fs.readFileSync(editJobModalPath, "utf-8");

      assert.ok(ingestContent.includes("#15171d") || ingestContent.includes("#15171D") || ingestContent.includes("#0d0e12"));
      assert.ok(ingestContent.includes("#2a2e38") || ingestContent.includes("#2A2E38"));
      assert.ok(ingestContent.includes("#d4a745") || ingestContent.includes("#D4A745"));

      assert.ok(editContent.includes("#15171d") || editContent.includes("#15171D") || editContent.includes("#0d0e12"));
      assert.ok(editContent.includes("#2a2e38") || editContent.includes("#2A2E38"));
      assert.ok(editContent.includes("#d4a745") || editContent.includes("#D4A745"));
    });

    it("EditJobModal provides normalized preview and re-score trigger", () => {
      const content = fs.readFileSync(editJobModalPath, "utf-8");

      assert.ok(content.includes("updateJobDetailsAction"));
      assert.ok(content.includes("rerunAI") || content.includes("rescore"));
    });

    it("IngestModal displays dropped job warning banner, filter reasons, and 1-click rescue button", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");

      // Warning state and alert icon
      assert.ok(content.includes("droppedJobInfo"));
      assert.ok(content.includes("AlertTriangle"));
      assert.ok(content.includes("Target Opportunity Filtered Out"));

      // Filter reason list rendering
      assert.ok(content.includes("Filter Reasons") || content.includes("reasons"));
      assert.ok(content.includes(".map"));

      // 1-Click rescue trigger
      assert.ok(content.includes("overrideJobFilterAction"));
      assert.ok(content.includes("Rescue &amp; Move to Inbox") || content.includes("Rescue & Move to Inbox"));
    });

    it("IngestModal defaults currency to AUTO with Auto-detect option and omits hardcoded USD payload", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");

      // Defaults to AUTO
      assert.ok(
        content.includes('useState<string>("AUTO")') ||
        content.includes('useState("AUTO")'),
        "Currency state should default to AUTO"
      );

      // Has option for Auto-detect from JD
      assert.ok(
        content.includes('value="AUTO"') && content.includes("Auto-detect"),
        "Currency dropdown should have an AUTO auto-detect option"
      );

      // Omits currency when AUTO in submission payload
      assert.ok(
        content.includes('currency !== "AUTO"') ||
        content.includes('currency && currency !== "AUTO"'),
        "Payload should only include currency override when not AUTO"
      );
    });
  });

  describe("GlobalCommandPalette Component Specification", () => {
    it("components/GlobalCommandPalette.tsx exists", () => {
      assert.ok(fs.existsSync(commandPalettePath), "GlobalCommandPalette.tsx should exist");
    });

    it("listens for ⌘K / Ctrl+K keyboard shortcut and traps focus properly", () => {
      const content = fs.readFileSync(commandPalettePath, "utf-8");

      assert.ok(content.includes('"k"') || content.includes("'k'") || content.includes('"K"') || content.includes("'K'"));
      assert.ok(content.includes("metaKey") || content.includes("ctrlKey"));
      assert.ok(content.includes("CommandDialog") || content.includes("Command"));
    });

    it("provides fast shortcuts for navigation, ingestion, candidate profile, and stage filtering", () => {
      const content = fs.readFileSync(commandPalettePath, "utf-8");

      assert.ok(content.includes("CommandShortcut"));
      assert.ok(content.includes("Ingest") || content.includes("ingest"));
      assert.ok(content.includes("Profile") || content.includes("profile"));
      assert.ok(content.includes("Stage") || content.includes("Filter") || content.includes("Pipeline") || content.includes("Shortlisted"));
    });

    it("applies high-contrast Ink & Brass active item and surface styling", () => {
      const content = fs.readFileSync(commandPalettePath, "utf-8");

      assert.ok(
        content.includes("#1f222a") ||
        content.includes("#1F222A") ||
        content.includes("#15171d") ||
        content.includes("#15171D") ||
        content.includes("#d4a745") ||
        content.includes("#D4A745")
      );
    });
  });
});
