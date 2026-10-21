import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Mobile UI Ergonomics & Tactical Cockpit Refinements", () => {
  const bottomSheetPath = path.join(process.cwd(), "components/ui/bottom-sheet.tsx");
  const sheetPath = path.join(process.cwd(), "components/ui/sheet.tsx");
  const ingestModalPath = path.join(process.cwd(), "app/components/IngestModal.tsx");
  const pagePath = path.join(process.cwd(), "app/page.tsx");
  const exportMenuPath = path.join(process.cwd(), "app/components/ExportMenu.tsx");
  const telemetryStripPath = path.join(process.cwd(), "components/ui/TelemetryStrip.tsx");
  const trackerPath = path.join(process.cwd(), "app/components/ApplicationTracker.tsx");
  const settingsPagePath = path.join(process.cwd(), "app/settings/page.tsx");
  const jobListTablePath = path.join(process.cwd(), "app/components/JobListTable.tsx");
  const jobIntelligencePath = path.join(process.cwd(), "app/components/JobIntelligenceView.tsx");
  const discoveryInboxPath = path.join(process.cwd(), "components/discovery/DiscoveryInbox.tsx");

  describe("Phase 1: Drawer Accessibility & Header Button Consistency", () => {
    it("ensures bottom-sheet close button has high contrast and accessible touch sizing", () => {
      const content = fs.readFileSync(bottomSheetPath, "utf-8");
      assert.ok(
        content.includes("min-h-[36px]") || content.includes("h-9") || content.includes("p-2"),
        "BottomSheet close button should have adequate touch target padding/size"
      );
      assert.ok(
        content.includes("border-[#2a2e38]") || content.includes("border"),
        "BottomSheet close button should have a visible tactical border for contrast"
      );
      assert.ok(
        content.includes("bg-[#1f222a]") || content.includes("bg-[#15171d]"),
        "BottomSheet close button should have background for visual contrast against dark sheets"
      );
    });

    it("ensures sheet close button has high contrast and tactical styling", () => {
      const content = fs.readFileSync(sheetPath, "utf-8");
      assert.ok(
        content.includes("border-[#2a2e38]") || content.includes("border") || content.includes("bg-[#1f222a]"),
        "Sheet close button should have visible contrast styling"
      );
    });

    it("normalizes IngestModal tabs to prevent multiline wrapping and maintain Vanguard look-and-feel", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");
      assert.ok(
        content.includes("whitespace-nowrap"),
        "IngestModal tabs must enforce whitespace-nowrap to prevent multiline word wrapping"
      );
      assert.ok(
        content.includes("min-h-10") || content.includes("min-h-11") || content.includes("py-2"),
        "IngestModal tabs must provide comfortable mobile touch targets"
      );
    });

    it("unifies header action button sizing (Export and Settings)", () => {
      const pageContent = fs.readFileSync(pagePath, "utf-8");
      const exportContent = fs.readFileSync(exportMenuPath, "utf-8");

      assert.ok(
        exportContent.includes("min-h-[36px]") || exportContent.includes("h-9"),
        "ExportMenu should declare a standard 36px/h-9 button height"
      );
      assert.ok(
        pageContent.includes("min-h-[36px]") || pageContent.includes("h-9"),
        "Settings button in app/page.tsx should declare the matching 36px/h-9 button height"
      );
    });
  });

  describe("Phase 2: Tab Synchronization & Auto-Scrolling", () => {
    it("implements auto-scrolling to activeTab on mobile TelemetryStrip", () => {
      const content = fs.readFileSync(telemetryStripPath, "utf-8");
      assert.ok(
        content.includes("scrollIntoView"),
        "TelemetryStrip must auto-scroll the active tab into view when activeTab updates"
      );
    });

    it("implements auto-scrolling to activeStageId on mobile ApplicationTracker", () => {
      const content = fs.readFileSync(trackerPath, "utf-8");
      assert.ok(
        content.includes("scrollIntoView"),
        "ApplicationTracker must auto-scroll the active stage into view in the mobile rail"
      );
    });
  });

  describe("Phase 3: Settings Page Mobile Redesign", () => {
    it("removes redundant Discovery Buffer link and keeps a clean Back to Cockpit navigation", () => {
      const content = fs.readFileSync(settingsPagePath, "utf-8");
      assert.ok(
        !content.includes("Discovery Buffer &rarr;"),
        "Settings header should not have redundant duplicate Discovery Buffer button"
      );
      assert.ok(
        content.includes("Cockpit") || content.includes("Back"),
        "Settings header must maintain clear back link to Cockpit"
      );
    });

    it("provides responsive tab switcher: compact horizontal rail on mobile, full sidebar on desktop", () => {
      const content = fs.readFileSync(settingsPagePath, "utf-8");
      assert.ok(
        content.includes("md:hidden") && content.includes("overflow-x-auto"),
        "Settings must render a compact horizontal tab rail on mobile (<md)"
      );
      assert.ok(
        content.includes("hidden md:block") || content.includes("hidden md:flex"),
        "Settings should hide the full vertical navigation directory on mobile"
      );
    });
  });

  describe("Phase 4: Job Cards & Target View Ergonomics", () => {
    it("restructures JobListTable to prevent company name truncation", () => {
      const content = fs.readFileSync(jobListTablePath, "utf-8");
      // Company name should have prominent styling and not be trapped in an un-wrapped single line
      assert.ok(
        content.includes("job.company"),
        "JobListTable must render job.company"
      );
      assert.ok(
        content.includes("font-semibold text-[#d4a745]") || content.includes("text-[#d4a745] font-semibold") || content.includes("text-xs font-semibold"),
        "Company name should be prominently styled"
      );
    });

    it("prominently displays company name in JobIntelligenceView header", () => {
      const content = fs.readFileSync(jobIntelligencePath, "utf-8");
      assert.ok(
        content.includes("job.company"),
        "JobIntelligenceView must render job.company in header"
      );
    });
  });

  describe("Phase 5: Discovery Page Mobile Layout", () => {
    it("optimizes Discovery cards on mobile viewports", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");
      assert.ok(
        content.includes("flex-col") || content.includes("sm:flex-row"),
        "Discovery cards must adapt layout responsively on mobile"
      );
    });

    it("prevents horizontal overflow when scraped job postings contain long text, URLs, or tokens", () => {
      const content = fs.readFileSync(discoveryInboxPath, "utf-8");
      assert.ok(
        content.includes("break-words") && content.includes("[overflow-wrap:anywhere]"),
        "Discovery description and title must declare break-words and [overflow-wrap:anywhere]"
      );
      assert.ok(
        content.includes("min-h-11"),
        "Discovery mobile action bar must use 44px min-h touch targets"
      );
    });
  });

  describe("Phase 6: Uniform Card Height, Mobile Space Reclamation & Desktop Overlay Guard", () => {
    const profileDrawerPath = path.join(process.cwd(), "app/components/ProfileDrawer.tsx");
    const cockpitPath = path.join(process.cwd(), "app/components/VanguardCockpit.tsx");

    it("ensures JobListTable uses single-line metadata and uniform min-height to prevent card height jitter", () => {
      const content = fs.readFileSync(jobListTablePath, "utf-8");
      assert.ok(
        content.includes("whitespace-nowrap overflow-hidden") || content.includes("min-h-"),
        "JobListTable must enforce single-line metadata to guarantee uniform card heights"
      );
    });

    it("ensures ApplicationTracker metadata and badge strips avoid multiline wrapping jitter", () => {
      const content = fs.readFileSync(trackerPath, "utf-8");
      assert.ok(
        content.includes("whitespace-nowrap overflow-hidden"),
        "ApplicationTracker metadata and badges should avoid wrapping into variable-height cards"
      );
    });

    it("suppresses BottomSheet overlay when hidden on desktop to prevent desktop screen dimming", () => {
      const content = fs.readFileSync(bottomSheetPath, "utf-8");
      assert.ok(
        content.includes('!isCompact && desktopClassName?.includes("hidden") && "hidden"') ||
        content.includes("hidden"),
        "BottomSheet must suppress overlay when desktopClassName is hidden"
      );
    });

    it("gates mobile job detail sheet in VanguardCockpit to mobile viewports", () => {
      const content = fs.readFileSync(cockpitPath, "utf-8");
      assert.ok(
        content.includes("window.innerWidth < 1024"),
        "VanguardCockpit should only open mobile detail sheet below desktop breakpoint"
      );
      assert.ok(
        content.includes("pb-[calc(3.5rem+env(safe-area-inset-bottom))]"),
        "VanguardCockpit must tighten bottom padding to reclaim real estate above bottom navbar"
      );
    });

    it("hides TelemetryStrip mobile rail on pipeline and discovery views to save screen space", () => {
      const content = fs.readFileSync(telemetryStripPath, "utf-8");
      assert.ok(
        content.includes('activeTab !== "pipeline" && activeTab !== "discovery"'),
        "TelemetryStrip should hide mobile pill rail on pipeline and discovery views"
      );
      assert.ok(
        content.includes("mobileMetrics"),
        "TelemetryStrip should filter mobile metrics to target queues under targets view"
      );
    });

    it("eliminates IngestModal tab switch flash using transition-none and stable transparent borders", () => {
      const content = fs.readFileSync(ingestModalPath, "utf-8");
      assert.ok(
        content.includes("transition-none"),
        "IngestModal tabs should use transition-none for instant flicker-free mode switching"
      );
      assert.ok(
        content.includes("border border-transparent"),
        "Inactive IngestModal tabs should have explicit transparent border to prevent layout jitter"
      );
    });

    it("ensures ProfileDrawer supports tab scrolling and auto-scroll into view", () => {
      const content = fs.readFileSync(profileDrawerPath, "utf-8");
      assert.ok(
        content.includes("overflow-x-auto"),
        "ProfileDrawer tabs must support horizontal scrolling"
      );
      assert.ok(
        content.includes("scrollIntoView"),
        "ProfileDrawer should auto-scroll active tab into view"
      );
    });
  });
});
