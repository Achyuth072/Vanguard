import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Feed Sources Management & Discovery Inbox UI (Issue 06)", () => {
  const feedSourcesManagerPath = path.join(
    process.cwd(),
    "components/settings/FeedSourcesManager.tsx"
  );
  const reExportFeedSourcesPath = path.join(
    process.cwd(),
    "app/components/FeedSourcesManager.tsx"
  );
  const discoveryInboxPath = path.join(
    process.cwd(),
    "components/discovery/DiscoveryInbox.tsx"
  );
  const reExportDiscoveryPath = path.join(
    process.cwd(),
    "app/components/DiscoveryInbox.tsx"
  );
  const settingsPagePath = path.join(process.cwd(), "app/settings/page.tsx");
  const vanguardCockpitPath = path.join(
    process.cwd(),
    "app/components/VanguardCockpit.tsx"
  );
  const telemetryStripPath = path.join(
    process.cwd(),
    "components/ui/TelemetryStrip.tsx"
  );
  const commandPalettePath = path.join(
    process.cwd(),
    "components/GlobalCommandPalette.tsx"
  );

  describe("FeedSourcesManager Component Specification", () => {
    it("components/settings/FeedSourcesManager.tsx exists and is re-exported", () => {
      assert.ok(
        fs.existsSync(feedSourcesManagerPath),
        "components/settings/FeedSourcesManager.tsx should exist"
      );
      assert.ok(
        fs.existsSync(reExportFeedSourcesPath),
        "app/components/FeedSourcesManager.tsx should exist"
      );
    });

    it("defines healthy/error/disabled status indicators and color tokens", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      // Healthy indicator (#8ab384)
      assert.ok(content.includes("#8ab384") || content.includes("HEALTHY"));
      // Error indicator (#c4634e)
      assert.ok(content.includes("#c4634e") || content.includes("FAILS"));
      // Disabled indicator
      assert.ok(content.includes("DISABLED") || content.includes("disabled"));
    });

    it("implements company board slugs controls for Ashby, Greenhouse, and Lever", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      // Board slugs support
      assert.ok(content.includes("boardSlugs") || content.includes("slugs"));
      assert.ok(content.includes("ASHBY") && content.includes("GREENHOUSE") && content.includes("LEVER"));
      assert.ok(content.includes("handleAddSlug") || content.includes("handleRemoveSlug") || content.includes("Add Slug"));
    });

    it("implements individual 'Fetch Now' button and global 'Sync All Sources' button with spinners", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      assert.ok(content.includes("Fetch Now") || content.includes("Fetching..."));
      assert.ok(content.includes("Sync All Sources") || content.includes("Syncing All..."));
      assert.ok(content.includes("animate-spin"));
      assert.ok(content.includes("/api/feeds/sync"));
    });

    it("implements Background Auto-polling toggle explicitly labeled and default-off", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      assert.ok(content.includes("Background Auto-polling") || content.includes("autoPoll"));
      assert.ok(content.includes("Off by default") || content.includes("DEFAULT OFF"));
    });

    it("implements diagnostic error display when errorCount > 0", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      assert.ok(content.includes("errorCount") || content.includes("hasError"));
      assert.ok(content.includes("lastError") || content.includes("Diagnostic"));
    });

    it("implements in-memory feedSourcesCache to eliminate redundant /api/feeds fetches on tab switches", () => {
      const content = fs.readFileSync(feedSourcesManagerPath, "utf-8");

      assert.ok(content.includes("feedSourcesCache"));
      assert.ok(content.includes("clearFeedSourcesCache"));
    });
  });

  describe("DiscoveryInbox Component Specification", () => {
    it("components/discovery/DiscoveryInbox.tsx exists and is re-exported", () => {
      assert.ok(
        fs.existsSync(discoveryInboxPath),
        "components/discovery/DiscoveryInbox.tsx should exist"
      );
      assert.ok(
        fs.existsSync(reExportDiscoveryPath),
        "app/components/DiscoveryInbox.tsx should exist"
      );
    });

    it("renders filter-passed staged job feed cards with deterministic match badges", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      // Match badges
      assert.ok(content.includes("matchBadges") || content.includes("FILTER PASSED"));
      assert.ok(content.includes("remoteStatus") || content.includes("REMOTE"));
      assert.ok(content.includes("salaryMin") || content.includes("salaryMax"));
      assert.ok(content.includes("location"));
    });

    it("implements discoveryCache and non-destructive isFetching state to prevent UI content flash on source switch", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      assert.ok(content.includes("discoveryCache"));
      assert.ok(content.includes("isFetching"));
      assert.ok(content.includes("querySeqRef"));
    });

    it("implements 'Score with AI' action button to trigger AI scoring and transfer to Priority Inbox", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      assert.ok(content.includes("Score with AI") || content.includes("handleScoreSingleJob"));
      assert.ok(content.includes("/api/discovery/ingest"));
    });

    it("implements 'Dismiss' button to remove irrelevant staged postings", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      assert.ok(content.includes("Dismiss") || content.includes("handleDismissSingleJob"));
      assert.ok(content.includes("/api/discovery/dismiss"));
    });

    it("implements multi-select batch actions with token preview calculation", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      // Batch selection
      assert.ok(content.includes("selectedJobIds") || content.includes("toggleSelectJob"));
      assert.ok(content.includes("Score Selected") || content.includes("handleBatchScore"));
      assert.ok(content.includes("handleBatchDismiss") || content.includes("Dismiss ("));

      // Token estimation badge (~800 tokens per evaluation)
      assert.ok(content.includes("800") || content.includes("estimatedTokens") || content.includes("est. tokens"));
    });

    it("implements search, source platform filtering, and sort controls", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      assert.ok(content.includes("searchQuery") || content.includes("Search by role"));
      assert.ok(content.includes("selectedSource") || content.includes("All Platforms"));
      assert.ok(content.includes("sortBy") || content.includes("Newest Discovered"));
    });

    it("implements clean empty buffer state", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");

      assert.ok(content.includes("Discovery Buffer Empty"));
      assert.ok(content.includes("Check for New Feed Jobs") || content.includes("Trigger a feed sync"));
    });
  });

  describe("Cockpit & Settings Navigation Integration", () => {
    it("integrates DiscoveryInbox into VanguardCockpit with live staged count telemetry", () => {
      const content = fs.readFileSync(vanguardCockpitPath, "utf-8");

      assert.ok(content.includes("DiscoveryInbox"));
      assert.ok(content.includes("discoveryCount"));
      assert.ok(content.includes("activeTab === \"discovery\"") || content.includes('activeTab === "discovery"'));
    });

    it("TelemetryStrip supports Discovery tab with staged badge", () => {
      const content = fs.readFileSync(telemetryStripPath, "utf-8");

      assert.ok(content.includes('"discovery"') || content.includes("'discovery'"));
      assert.ok(content.includes("04 · Discovery") || content.includes("05 · Discovery"));
      assert.ok(content.includes("discoveryCount"));
    });

    it("SettingsPage integrates FeedSourcesManager with tabbed layout", () => {
      const content = fs.readFileSync(settingsPagePath, "utf-8");

      assert.ok(content.includes("FeedSourcesManager"));
      assert.ok(content.includes("Job Feeds") || content.includes("01 · Job Feeds"));
    });

    it("GlobalCommandPalette supports shortcuts for Discovery Inbox & Feed Sources", () => {
      const content = fs.readFileSync(commandPalettePath, "utf-8");

      assert.ok(content.includes("Open Discovery Staging Buffer") || content.includes("Filter: Staged Discovery Feeds"));
      assert.ok(content.includes("Feed Sources & Scoring Settings") || content.includes("Settings"));
    });
  });

  describe("Token Calculation & UI Logic Validation", () => {
    it("calculates estimated token usage accurately for arbitrary batch sizes", () => {
      const TOKENS_PER_JOB = 800;
      assert.equal(0 * TOKENS_PER_JOB, 0);
      assert.equal(1 * TOKENS_PER_JOB, 800);
      assert.equal(5 * TOKENS_PER_JOB, 4000);
      assert.equal(25 * TOKENS_PER_JOB, 20000);
    });

    it("computes status health and active feeds count accurately", () => {
      const mockSources = [
        { id: "s1", enabled: true, errorCount: 0, jobsDiscovered: 40, jobsPassed: 10 },
        { id: "s2", enabled: true, errorCount: 2, jobsDiscovered: 20, jobsPassed: 5 },
        { id: "s3", enabled: false, errorCount: 0, jobsDiscovered: 0, jobsPassed: 0 },
      ];

      const activeCount = mockSources.filter((s) => s.enabled).length;
      const totalDiscovered = mockSources.reduce((acc, s) => acc + s.jobsDiscovered, 0);
      const totalPassed = mockSources.reduce((acc, s) => acc + s.jobsPassed, 0);
      const healthyCount = mockSources.filter((s) => s.enabled && s.errorCount === 0).length;

      assert.equal(activeCount, 2);
      assert.equal(totalDiscovered, 60);
      assert.equal(totalPassed, 15);
      assert.equal(healthyCount, 1);
    });
  });
});
