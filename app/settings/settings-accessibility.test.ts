import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Settings Page Accessibility & Font Visibility Specification", () => {
  const settingsPagePath = path.join(process.cwd(), "app/settings/page.tsx");
  const feedSourcesManagerPath = path.join(
    process.cwd(),
    "components/settings/FeedSourcesManager.tsx"
  );
  const scoringSettingsPath = path.join(
    process.cwd(),
    "app/components/ScoringFeedbackLoopSettings.tsx"
  );

  const settingsContent = fs.readFileSync(settingsPagePath, "utf-8");
  const feedsContent = fs.readFileSync(feedSourcesManagerPath, "utf-8");
  const scoringContent = fs.readFileSync(scoringSettingsPath, "utf-8");

  describe("Settings Navigation & ARIA Landmarks", () => {
    it("defines proper tablist, tabs, and aria-controls linkages", () => {
      assert.ok(settingsContent.includes('role="tablist"'));
      assert.ok(settingsContent.includes('role="tab"'));
      assert.ok(settingsContent.includes("aria-selected="));
      assert.ok(settingsContent.includes("aria-controls="));
    });

    it("defines corresponding tabpanels with matching aria-labelledby attributes", () => {
      assert.ok(settingsContent.includes('role="tabpanel"'));
      assert.ok(settingsContent.includes('id="panel-feeds"'));
      assert.ok(settingsContent.includes('aria-labelledby="tab-feeds"'));
      assert.ok(settingsContent.includes('id="panel-profile"'));
      assert.ok(settingsContent.includes('id="panel-scoring"'));
      assert.ok(settingsContent.includes('id="panel-export"'));
    });

    it("ensures high contrast text tokens (#c5c9d6 / #f4f2ec) for telemetry and navigation", () => {
      assert.ok(settingsContent.includes("#c5c9d6"));
      assert.ok(settingsContent.includes("#f4f2ec"));
      // Check that raw resume textarea has an associated label
      assert.ok(settingsContent.includes('htmlFor="settings-raw-resume"'));
      assert.ok(settingsContent.includes('id="settings-raw-resume"'));
    });
  });

  describe("FeedSourcesManager Form & Switch Accessibility", () => {
    it("implements role='switch' with aria-checked on enable/disable toggles", () => {
      assert.ok(feedsContent.includes('role="switch"'));
      assert.ok(feedsContent.includes("aria-checked="));
      assert.ok(feedsContent.includes("aria-label="));
    });

    it("implements explicit htmlFor and id pairs for all input fields", () => {
      assert.ok(feedsContent.includes('htmlFor="feed-source-name"'));
      assert.ok(feedsContent.includes('id="feed-source-name"'));
      assert.ok(feedsContent.includes('htmlFor="feed-source-type"'));
      assert.ok(feedsContent.includes('id="feed-source-type"'));
      assert.ok(feedsContent.includes('htmlFor="feed-source-url"'));
      assert.ok(feedsContent.includes('id="feed-source-url"'));
    });

    it("uses readable font sizes and high-contrast labels (#c5c9d6)", () => {
      assert.ok(feedsContent.includes("#c5c9d6"));
      assert.ok(!feedsContent.includes("text-[9px] text-[#a6abbd]"));
    });
  });

  describe("ScoringFeedbackLoopSettings Sliders & Status Accessibility", () => {
    it("implements ARIA range attributes on dimension sliders", () => {
      assert.ok(scoringContent.includes('type="range"'));
      assert.ok(scoringContent.includes("aria-label="));
      assert.ok(scoringContent.includes("aria-valuemin="));
      assert.ok(scoringContent.includes("aria-valuemax="));
      assert.ok(scoringContent.includes("aria-valuenow="));
      assert.ok(scoringContent.includes("aria-valuetext="));
    });

    it("binds labels to slider inputs via htmlFor and id", () => {
      assert.ok(scoringContent.includes('htmlFor={`slider-${dim.key}`}'));
      assert.ok(scoringContent.includes('id={`slider-${dim.key}`}'));
    });

    it("ensures slider tick labels and descriptions use legible #c5c9d6 text", () => {
      assert.ok(scoringContent.includes("#c5c9d6"));
      assert.ok(scoringContent.includes("text-xs"));
    });
  });
});
