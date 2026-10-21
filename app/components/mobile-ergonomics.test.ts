import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Mobile UX Ergonomics, Responsive Metric Rail & Detail Sheet (Issue 05)", () => {
  const pagePath = path.join(process.cwd(), "app/page.tsx");
  const telemetryStripPath = path.join(process.cwd(), "components/ui/TelemetryStrip.tsx");
  const cockpitPath = path.join(process.cwd(), "app/components/VanguardCockpit.tsx");
  const mobileActionBarPath = path.join(process.cwd(), "app/components/MobileActionBar.tsx");
  const profileDrawerPath = path.join(process.cwd(), "app/components/ProfileDrawer.tsx");

  describe("Compact Mobile Header (app/page.tsx)", () => {
    it("renders single-row header with hidden subtitle on mobile viewports", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      // Single-row flex layout on mobile
      assert.ok(content.includes("flex-row items-center justify-between"), "Header should be single-row on mobile");
      // Subtitle suppressed on mobile
      assert.ok(
        content.includes("hidden sm:flex") || content.includes("hidden sm:inline-flex"),
        "Subtitle should be hidden on mobile to conserve vertical space"
      );
      // Compact settings link
      assert.ok(content.includes('href="/settings"'), "Settings link should exist in header");
    });
  });

  describe("Horizontal Metric Pill Rail (components/ui/TelemetryStrip.tsx)", () => {
    it("provides compact horizontal scrolling pill strip on mobile (<md) and preserves grid on md+", () => {
      const content = fs.readFileSync(telemetryStripPath, "utf-8");
      // Mobile compact rail
      assert.ok(
        content.includes("flex md:hidden") && content.includes("overflow-x-auto"),
        "TelemetryStrip should render a compact horizontal scrolling rail on mobile (<md)"
      );
      // Desktop grid preserved
      assert.ok(
        content.includes("hidden md:grid"),
        "TelemetryStrip should retain multi-column grid on md+ screens"
      );
      // Compact pill labels
      assert.ok(content.includes("Priority"), "Should include Priority metric pill");
      assert.ok(content.includes("Assessment"), "Should include Assessment metric pill");
      assert.ok(content.includes("Pipeline"), "Should include Pipeline metric pill");
      assert.ok(content.includes("Discovery"), "Should include Discovery metric pill");
    });
  });

  describe("Mobile Job Detail Sheet (app/components/VanguardCockpit.tsx)", () => {
    it("integrates BottomSheet for mobile job intelligence and hides off-screen right pane on <lg", () => {
      const content = fs.readFileSync(cockpitPath, "utf-8");
      // Imports or uses BottomSheet
      assert.ok(content.includes("BottomSheet"), "VanguardCockpit should import/use BottomSheet for mobile detail");
      // State for mobile detail sheet
      assert.ok(
        content.includes("isMobileDetailOpen") || content.includes("setIsMobileDetailOpen"),
        "Should manage mobile detail sheet state"
      );
      // Responsive column structure: full width on mobile, split on lg
      assert.ok(
        content.includes("col-span-12 lg:col-span-5") || content.includes("lg:col-span-5"),
        "Job table should expand to full width on mobile viewports"
      );
      assert.ok(
        content.includes("hidden lg:block lg:col-span-7") || content.includes("lg:block"),
        "Desktop intelligence pane should be hidden on mobile viewports to prevent off-screen overflow"
      );
      // Redundant page-level ingest button hidden on mobile
      assert.ok(
        content.includes("hidden sm:flex"),
        "Page-level Ingest Target button should be hidden on mobile (delegated to bottom bar)"
      );
    });
  });

  describe("Primary Mobile Navigation (app/components/MobileActionBar.tsx)", () => {
    it("routes top-level destinations (Targets, Pipeline, Discovery, Profile, Ingest) with 44px min touch targets", () => {
      const content = fs.readFileSync(mobileActionBarPath, "utf-8");
      assert.ok(content.includes("Targets"), "Should include Targets primary navigation");
      assert.ok(content.includes("Pipeline"), "Should include Pipeline primary navigation");
      assert.ok(content.includes("Discovery"), "Should include Discovery primary navigation");
      assert.ok(content.includes("Profile") || content.includes("Candidate Profile"), "Should include Profile navigation");
      assert.ok(content.includes("Ingest"), "Should include Ingest action");
      assert.ok(content.includes("min-h-11"), "Touch targets must maintain 44px minimum touch height");
      assert.ok(content.includes("set-cockpit-filter"), "Should dispatch cockpit filter events");
    });
  });

  describe("Candidate Profile Tabs Normalization (app/components/ProfileDrawer.tsx)", () => {
    it("normalizes navigation tabs with shrink-0 whitespace-nowrap", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");
      assert.ok(content.includes("shrink-0"), "Tabs should prevent shrinking");
      assert.ok(content.includes("whitespace-nowrap"), "Tabs should prevent awkward word wrapping");
    });
  });
});
