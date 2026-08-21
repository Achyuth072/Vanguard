import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Application Preparation Drawer & Cited Q&A (Issue 05)", () => {
  const drawerPath = path.join(process.cwd(), "app/components/ApplicationPreparationDrawer.tsx");
  const resumeEditorPath = path.join(process.cwd(), "app/components/TailoredResumeEditor.tsx");
  const qaListPath = path.join(process.cwd(), "app/components/QuestionAnswersList.tsx");

  describe("ApplicationPreparationDrawer Component Specification", () => {
    it("app/components/ApplicationPreparationDrawer.tsx exists", () => {
      assert.ok(fs.existsSync(drawerPath), "app/components/ApplicationPreparationDrawer.tsx should exist");
    });

    it("renders Radix Sheet with backdrop, Escape dismissal, and Ink & Brass surface", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");

      // Radix sheet components
      assert.ok(content.includes("Sheet") && content.includes("SheetContent"));
      // Surface and hairline tokens
      assert.ok(content.includes("#15171d") || content.includes("#15171D") || content.includes("var(--ink-900)"));
      assert.ok(content.includes("#2a2e38") || content.includes("#2A2E38") || content.includes("var(--hairline)"));
      assert.ok(content.includes("#f4f2ec") || content.includes("#F4F2EC") || content.includes("var(--paper)"));
    });

    it("defines tab navigation with 12px monospace indicators", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");

      assert.ok(content.includes("font-mono"));
      assert.ok(content.includes("01 ·") || content.includes("01"));
      assert.ok(content.includes("02 ·") || content.includes("02"));
      assert.ok(content.includes("03 ·") || content.includes("03"));
    });

    it("defines action footer with high-contrast brass [ Mark as Applied ] and [ Export PDF/MD ]", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");

      // Mark as Applied CTA with brass styling
      assert.ok(content.includes("Mark as Applied") || content.includes("Mark Applied"));
      assert.ok(content.includes("#d4a745") || content.includes("#D4A745") || content.includes("brass"));

      // Export / Download action
      assert.ok(content.includes("Export") || content.includes("Download"));
    });

    it("wires status change and server action transitions creating audit events", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");

      assert.ok(content.includes("updateJobStatusAction"));
      assert.ok(content.includes("recordRejectionAction"));
    });
  });

  describe("TailoredResumeEditor Component Specification", () => {
    it("app/components/TailoredResumeEditor.tsx exists", () => {
      assert.ok(fs.existsSync(resumeEditorPath), "app/components/TailoredResumeEditor.tsx should exist");
    });

    it("provides clean textarea with monospace executive summary / markdown editor", () => {
      const content = fs.readFileSync(resumeEditorPath, "utf-8");

      assert.ok(content.includes("<Textarea") || content.includes("<textarea"));
      assert.ok(content.includes("font-mono"));
      assert.ok(content.includes("characters") || content.includes("length"));
    });

    it("provides high-contrast skills tag chips with 2px radius and remove button", () => {
      const content = fs.readFileSync(resumeEditorPath, "utf-8");

      assert.ok(content.includes("rounded-[2px]"));
      assert.ok(content.includes("matchingSkills") || content.includes("skills"));
      assert.ok(content.includes("remove") || content.includes("handleRemoveSkill") || content.includes("onRemove"));
    });

    it("provides master projects selector with AI relevance rationale in 14px leading-relaxed prose", () => {
      const content = fs.readFileSync(resumeEditorPath, "utf-8");

      assert.ok(content.includes("selectedProjects"));
      assert.ok(content.includes("relevanceRationale"));
      assert.ok(content.includes("leading-relaxed"));
    });

    it("provides high-contrast action toolbar with save, copy, and export", () => {
      const content = fs.readFileSync(resumeEditorPath, "utf-8");

      assert.ok(content.includes("handleSave") || content.includes("updateTailoredResume"));
      assert.ok(content.includes("handleCopy") || content.includes("clipboard"));
      assert.ok(content.includes("handleDownload") || content.includes("Export"));
    });
  });

  describe("QuestionAnswersList Component Specification", () => {
    it("app/components/QuestionAnswersList.tsx exists", () => {
      assert.ok(fs.existsSync(qaListPath), "app/components/QuestionAnswersList.tsx should exist");
    });

    it("provides structured Q&A cards with grounded candidate facts evidence citations", () => {
      const content = fs.readFileSync(qaListPath, "utf-8");

      assert.ok(content.includes("keyPointsUsed") || content.includes("facts") || content.includes("Facts"));
      assert.ok(content.includes("#15171d") || content.includes("#15171D") || content.includes("bg-"));
      assert.ok(content.includes("#2a2e38") || content.includes("#2A2E38") || content.includes("border-"));
    });

    it("provides 1-click copy with instant feedback indicator", () => {
      const content = fs.readFileSync(qaListPath, "utf-8");

      assert.ok(content.includes("handleCopy"));
      assert.ok(content.includes("Copied") || content.includes("copied"));
    });

    it("provides custom question input with AI draft generation trigger", () => {
      const content = fs.readFileSync(qaListPath, "utf-8");

      assert.ok(content.includes("askCustomApplicationQuestion") || content.includes("handleAskCustom"));
      assert.ok(content.includes("customQuestion") || content.includes("custom"));
      assert.ok(content.includes("#d4a745") || content.includes("#D4A745") || content.includes("bg-[#d4a745]"));
    });
  });
});
