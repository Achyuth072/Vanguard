import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Export UI Button & Dropdown — Vanguard Tactical Design System (.scratch/design-doc.md)", () => {
  const exportMenuPath = path.join(process.cwd(), "app/components/ExportMenu.tsx");
  const exportMenuContent = fs.readFileSync(exportMenuPath, "utf-8");

  describe("File Integrity & Component Architecture", () => {
    it("app/components/ExportMenu.tsx exists", () => {
      assert.ok(fs.existsSync(exportMenuPath), "ExportMenu component must exist");
    });

    it("declares client-side component directive", () => {
      assert.ok(
        exportMenuContent.startsWith('"use client";') ||
          exportMenuContent.startsWith("'use client';"),
        "ExportMenu must be a client component"
      );
    });

    it("defines structured export endpoints matching API router specs", () => {
      // Must target the 3 supported endpoints per design doc 4.1 & Issue 06
      assert.ok(
        exportMenuContent.includes("/api/export?format=json"),
        "Must include full JSON snapshot download endpoint"
      );
      assert.ok(
        exportMenuContent.includes("/api/export?format=applications"),
        "Must include Applications CSV download endpoint"
      );
      assert.ok(
        exportMenuContent.includes("/api/export?format=jobs"),
        "Must include All Jobs CSV download endpoint"
      );
    });
  });

  describe("Ink & Brass Palette & Token Compliance (Design Doc 2.1)", () => {
    it("uses Ink & Brass palette colors for surfaces, borders, and text", () => {
      // Primary Surface #15171d
      assert.match(exportMenuContent, /#15171d/i);
      // Elevated Surface #1f222a
      assert.match(exportMenuContent, /#1f222a/i);
      // Hairline Structural Border #2a2e38
      assert.match(exportMenuContent, /#2a2e38/i);
      // Active / Hover Hairline #3d4352
      assert.match(exportMenuContent, /#3d4352/i);
      // Primary Paper Text #f4f2ec
      assert.match(exportMenuContent, /#f4f2ec/i);
      // Muted Paper Text #c5c9d6
      assert.match(exportMenuContent, /#c5c9d6/i);
      // Brass Primary Accent #d4a745
      assert.match(exportMenuContent, /#d4a745/i);
      // Sage Success Accent #8ab384
      assert.match(exportMenuContent, /#8ab384/i);
    });

    it("does NOT contain disallowed off-palette colors (purple, blue, generic green)", () => {
      assert.doesNotMatch(exportMenuContent, /bg-purple-/i);
      assert.doesNotMatch(exportMenuContent, /bg-blue-/i);
      assert.doesNotMatch(exportMenuContent, /emerald-/i);
      assert.doesNotMatch(exportMenuContent, /neutral-/i);
    });

    it("enforces zero drop shadows per design doc executive summary", () => {
      // Zero drop shadows
      assert.doesNotMatch(exportMenuContent, /shadow-(?:sm|md|lg|xl|2xl)/i);
      assert.ok(
        exportMenuContent.includes("shadow-none"),
        "Must explicitly specify shadow-none"
      );
    });

    it("strictly respects geometry and corner radii rules (Design Doc 2.3)", () => {
      // 2px radius on buttons and items (rounded-[2px])
      assert.ok(
        exportMenuContent.includes("rounded-[2px]"),
        "Button and items must have 2px radius (rounded-[2px])"
      );
      // Max 3px radius on menu sheet/panel (rounded-[3px])
      assert.ok(
        exportMenuContent.includes("rounded-[3px]"),
        "Dropdown panel must have max 3px radius (rounded-[3px])"
      );
      // Disallow rounded-full, rounded-lg, rounded-xl on buttons or panels
      assert.doesNotMatch(exportMenuContent, /rounded-(?:full|lg|xl|2xl|3xl)/i);
    });
  });

  describe("Accessibility (WCAG 2.1 AAA) & Font Floor (Design Doc 2.2 & 5.0)", () => {
    it("strictly forbids micro-text below 10px and enforces 12px font-mono standard", () => {
      assert.doesNotMatch(
        exportMenuContent,
        /text-\[(?:[0-9]|10|11)px\]/i,
        "No sub-12px or sub-10px arbitrary sizes allowed"
      );
      assert.ok(
        exportMenuContent.includes("text-xs"),
        "Must use text-xs (12px) standard minimum font size"
      );
      assert.ok(
        exportMenuContent.includes("font-mono"),
        "Must use JetBrains Mono for precision telemetry/labels"
      );
    });

    it("enforces minimum tap target of >= 36px on desktop (Design Doc 5.0)", () => {
      assert.ok(
        exportMenuContent.includes("min-h-[36px]") ||
          exportMenuContent.includes("h-9") ||
          exportMenuContent.includes("py-2"),
        "Trigger button must satisfy tap target >= 36px"
      );
    });

    it("defines high-contrast 2px brass focus indicators (Design Doc 2.3)", () => {
      assert.ok(
        exportMenuContent.includes("focus-visible:outline-[#d4a745]") ||
          exportMenuContent.includes("focus-visible:ring-"),
        "Must include high-contrast brass focus indicators"
      );
    });

    it("provides complete WAI-ARIA menu landmarks and state attributes", () => {
      assert.ok(
        exportMenuContent.includes('role="menu"'),
        "Dropdown container must declare role='menu'"
      );
      assert.ok(
        exportMenuContent.includes('role="menuitem"'),
        "Each export link item must declare role='menuitem'"
      );
      assert.ok(
        exportMenuContent.includes('aria-haspopup="menu"'),
        "Trigger must declare aria-haspopup='menu'"
      );
      assert.ok(
        exportMenuContent.includes("aria-expanded="),
        "Trigger must dynamically report aria-expanded state"
      );
      assert.ok(
        exportMenuContent.includes("aria-label="),
        "Trigger must provide accessible aria-label"
      );
      assert.ok(
        exportMenuContent.includes("aria-labelledby="),
        "Dropdown menu must link to trigger via aria-labelledby"
      );
    });
  });

  describe("Keyboard Navigation Engine (Design Doc 1.1 & 5.0)", () => {
    it("handles Escape key dismissal and restores focus", () => {
      assert.ok(
        exportMenuContent.includes('"Escape"') ||
          exportMenuContent.includes("'Escape'"),
        "Must listen for Escape key dismissal"
      );
    });

    it("handles ArrowDown and ArrowUp roving focus inside menu items", () => {
      assert.ok(
        exportMenuContent.includes('"ArrowDown"') ||
          exportMenuContent.includes("'ArrowDown'"),
        "Must support ArrowDown navigation"
      );
      assert.ok(
        exportMenuContent.includes('"ArrowUp"') ||
          exportMenuContent.includes("'ArrowUp'"),
        "Must support ArrowUp navigation"
      );
    });

    it("handles Home and End keys for rapid navigation", () => {
      assert.ok(
        exportMenuContent.includes('"Home"') ||
          exportMenuContent.includes("'Home'"),
        "Must support Home key"
      );
      assert.ok(
        exportMenuContent.includes('"End"') ||
          exportMenuContent.includes("'End'"),
        "Must support End key"
      );
    });

    it("handles click-outside dismissal via mousedown listener", () => {
      assert.ok(
        exportMenuContent.includes("handleClickOutside") &&
          exportMenuContent.includes("contains"),
        "Must dismiss on outside click"
      );
    });
  });
});
