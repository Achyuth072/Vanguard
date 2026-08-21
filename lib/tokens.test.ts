import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe("Design System Tokens & Accessibility Foundation", () => {
  const globalsCssPath = path.join(process.cwd(), "app/globals.css");
  const layoutTsxPath = path.join(process.cwd(), "app/layout.tsx");

  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");
  const layoutTsx = fs.readFileSync(layoutTsxPath, "utf-8");

  describe("WCAG Contrast Verification", () => {
    const canvasBg = "#0D0E12";
    const cardBg = "#15171D";

    it("paper (#F4F2EC) achieves WCAG AAA (> 14:1) contrast against canvas background", () => {
      const ratio = getContrastRatio("#F4F2EC", canvasBg);
      assert.ok(ratio >= 14.0, `Expected contrast >= 14.0:1, got ${ratio.toFixed(2)}:1`);
    });

    it("paper-muted (#A6ABBD) achieves WCAG AAA (> 7:1) contrast against canvas background", () => {
      const ratio = getContrastRatio("#A6ABBD", canvasBg);
      assert.ok(ratio >= 7.0, `Expected contrast >= 7.0:1, got ${ratio.toFixed(2)}:1`);
    });

    it("paper-muted (#A6ABBD) achieves WCAG AAA (> 7:1) contrast against card surface", () => {
      const ratio = getContrastRatio("#A6ABBD", cardBg);
      assert.ok(ratio >= 7.0, `Expected contrast >= 7.0:1, got ${ratio.toFixed(2)}:1`);
    });

    it("brass (#D4A745) achieves WCAG AAA (> 7:1) contrast against canvas background", () => {
      const ratio = getContrastRatio("#D4A745", canvasBg);
      assert.ok(ratio >= 7.0, `Expected contrast >= 7.0:1, got ${ratio.toFixed(2)}:1`);
    });

    it("sage (#8AB384) achieves WCAG AAA (> 7:1) contrast against canvas background", () => {
      const ratio = getContrastRatio("#8AB384", canvasBg);
      assert.ok(ratio >= 7.0, `Expected contrast >= 7.0:1, got ${ratio.toFixed(2)}:1`);
    });

    it("rust (#C4634E) achieves WCAG AA (> 4.5:1) contrast against canvas background", () => {
      const ratio = getContrastRatio("#C4634E", canvasBg);
      assert.ok(ratio >= 4.5, `Expected contrast >= 4.5:1, got ${ratio.toFixed(2)}:1`);
    });
  });

  describe("globals.css Token Definitions", () => {
    it("defines the expected Ink & Brass CSS variables in :root", () => {
      assert.match(globalsCss, /--background:\s*#0[dD]0[eE]12;/);
      assert.match(globalsCss, /--card:\s*#15171[dD];/);
      assert.match(globalsCss, /--secondary:\s*#1[fF]222[aA];/);
      assert.match(globalsCss, /--border:\s*#2[aA]2[eE]38;/);
      assert.match(globalsCss, /--hairline-bright:\s*#3[dD]4352;/);
      assert.match(globalsCss, /--foreground:\s*#[fF]4[fF]2[eE][cC];/);
      assert.match(globalsCss, /--muted-foreground:\s*#[aA]6[aA][bB][bB][dD];/);
      assert.match(globalsCss, /--primary:\s*#[dD]4[aA]745;/);
      assert.match(globalsCss, /--success:\s*#8[aA][bB]384;/);
      assert.match(globalsCss, /--destructive:\s*#[cC]4634[eE];/);
      assert.match(globalsCss, /--radius:\s*0\.1875rem;/);
    });

    it("defines focus ring styles and tabular-nums utility", () => {
      assert.ok(
        globalsCss.includes("tabular-nums") || globalsCss.includes("font-variant-numeric: tabular-nums"),
        "globals.css must define tabular-nums formatting"
      );
      assert.ok(
        globalsCss.includes("focus-ring") || globalsCss.includes("--ring") || globalsCss.includes("focus-visible"),
        "globals.css must define focus ring tokens or utilities"
      );
    });
  });

  describe("app/layout.tsx Font Configuration", () => {
    it("configures Inter font-sans with display: swap", () => {
      assert.match(layoutTsx, /Inter\(\{[\s\S]*variable:\s*["']--font-sans["'][\s\S]*display:\s*["']swap["']/);
    });

    it("configures JetBrains Mono font-mono with display: swap", () => {
      assert.match(layoutTsx, /JetBrains_Mono\(\{[\s\S]*variable:\s*["']--font-mono["'][\s\S]*display:\s*["']swap["']/);
    });

    it("applies font variables to root html or body element", () => {
      assert.match(layoutTsx, /inter\.variable/);
      assert.match(layoutTsx, /jetbrainsMono\.variable/);
    });
  });
});
