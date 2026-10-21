import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COMPACT_VIEWPORT_QUERY,
  SWIPE_DISMISS_DISTANCE_RATIO,
  SWIPE_DISMISS_VELOCITY_PX_PER_MS,
  resolveSheetVariant,
  shouldDismissBottomSheet,
} from "@/components/ui/bottom-sheet";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");

describe("Mobile PWA Shell (Issue 03)", () => {
  const bottomSheetPath = path.join(process.cwd(), "components/ui/bottom-sheet.tsx");

  describe("Web App Manifest", () => {
    const manifestPath = path.join(process.cwd(), "app/manifest.ts");

    it("app/manifest.ts exists", () => {
      assert.ok(fs.existsSync(manifestPath), "app/manifest.ts should exist");
    });

    it("declares a standalone Vanguard PWA with the Obsidian tactical shell", () => {
      const content = read("app/manifest.ts");

      assert.ok(content.includes('short_name: "Vanguard"'));
      assert.ok(content.includes('display: "standalone"'));
      assert.ok(content.includes('background_color: "#0d0e12"'));
      assert.ok(content.includes('theme_color: "#0d0e12"'));
      assert.ok(content.includes('start_url: "/"'));
    });

    it("registers 192px, 512px, and maskable tactical icons that exist on disk", () => {
      const content = read("app/manifest.ts");

      for (const icon of [
        "vanguard-192.png",
        "vanguard-512.png",
        "vanguard-maskable-512.png",
      ]) {
        assert.ok(content.includes(icon), `manifest should reference ${icon}`);
        assert.ok(
          fs.existsSync(path.join(process.cwd(), "public/icons", icon)),
          `public/icons/${icon} should exist`
        );
      }
      assert.ok(content.includes('purpose: "maskable"'));
    });
  });

  describe("Layout viewport configuration", () => {
    it("exports a Viewport with viewportFit cover for notch and home-indicator bounds", () => {
      const content = read("app/layout.tsx");

      assert.ok(content.includes("export const viewport: Viewport"));
      assert.ok(content.includes('viewportFit: "cover"'));
      assert.ok(content.includes('themeColor: "#0d0e12"'));
      assert.ok(content.includes('width: "device-width"'));
    });

    it("declares iOS standalone web app metadata", () => {
      const content = read("app/layout.tsx");

      assert.ok(content.includes("appleWebApp"));
      assert.ok(content.includes('statusBarStyle: "black-translucent"'));
      assert.ok(content.includes("capable: true"));
    });
  });

  describe("BottomSheet component contract", () => {
    it("components/ui/bottom-sheet.tsx exists", () => {
      assert.ok(fs.existsSync(bottomSheetPath), "bottom-sheet.tsx should exist");
    });

    it("renders the visual drag indicator", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(
        content.includes("w-12 h-1 bg-[#2a2e38] rounded-full mx-auto my-2.5"),
        "drag indicator classes must match the tactile spec"
      );
      assert.ok(content.includes('data-testid="bottom-sheet-drag-handle"'));
    });

    it("supports touch swipe-to-dismiss gestures with snap-back", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(content.includes("onTouchStart={handleTouchStart}"));
      assert.ok(content.includes("onTouchMove={handleTouchMove}"));
      assert.ok(content.includes("onTouchEnd={handleTouchEnd}"));
      assert.ok(content.includes("onTouchCancel={handleTouchEnd}"));
      assert.ok(content.includes("shouldDismissBottomSheet"));
      assert.ok(content.includes("touch-none"));
    });

    it("uses a blurred backdrop and the tactical surface tokens", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(content.includes("backdrop-blur-sm"));
      assert.ok(content.includes("bg-[#15171d]"));
      assert.ok(content.includes("border-t border-[#2a2e38]"));
      assert.ok(content.includes("bg-[#0d0e12]/70"));
    });

    it("reserves native safe-area bottom padding and slide animations", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(content.includes("pb-[env(safe-area-inset-bottom)]"));
      assert.ok(content.includes("vanguard-sheet-in"));
      assert.ok(content.includes("vanguard-sheet-out"));
    });

    it("subscribes to the compact viewport with matchMedia", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.equal(COMPACT_VIEWPORT_QUERY, "(max-width: 639px)");
      assert.ok(content.includes("window.matchMedia(COMPACT_VIEWPORT_QUERY)"));
      assert.ok(content.includes("useSyncExternalStore"));
      assert.ok(content.includes("addEventListener(\"change\""));
      assert.ok(content.includes("removeEventListener(\"change\""));
    });

    it("flips between bottom-sheet and drawer variants at the sm breakpoint", () => {
      assert.equal(resolveSheetVariant(true), "bottom-sheet");
      assert.equal(resolveSheetVariant(false), "drawer");

      const content = read("components/ui/bottom-sheet.tsx");
      assert.ok(content.includes("data-sheet-variant={variant}"));
      assert.ok(content.includes("sm:w-3/4"));
    });

    it("keeps Escape/overlay/close-button dismissal through the Radix root", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(content.includes("<DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>"));
      assert.ok(content.includes("<DialogPrimitive.Overlay"));
      assert.ok(content.includes("<DialogPrimitive.Close"));
    });

    it("defines slide keyframes in the global stylesheet", () => {
      const content = read("app/globals.css");

      for (const keyframe of [
        "vanguard-sheet-in",
        "vanguard-sheet-out",
        "vanguard-drawer-in",
        "vanguard-drawer-out",
        "vanguard-fade-in",
      ]) {
        assert.ok(content.includes(`@keyframes ${keyframe}`), `${keyframe} keyframes should exist`);
      }
    });
  });

  describe("Swipe dismissal gesture logic", () => {
    it("ignores short, slow drags so the sheet snaps back", () => {
      assert.equal(
        shouldDismissBottomSheet({ deltaY: 40, velocityY: 0.1, sheetHeight: 800 }),
        false
      );
    });

    it("dismisses once the drag passes the distance threshold", () => {
      const threshold = 800 * SWIPE_DISMISS_DISTANCE_RATIO;
      assert.equal(
        shouldDismissBottomSheet({ deltaY: threshold, velocityY: 0.05, sheetHeight: 800 }),
        true
      );
      assert.equal(
        shouldDismissBottomSheet({ deltaY: threshold - 1, velocityY: 0.05, sheetHeight: 800 }),
        false
      );
    });

    it("dismisses a fast downward flick even over a short distance", () => {
      assert.equal(
        shouldDismissBottomSheet({
          deltaY: 30,
          velocityY: SWIPE_DISMISS_VELOCITY_PX_PER_MS,
          sheetHeight: 800,
        }),
        true
      );
    });

    it("never dismisses on upward or stationary gestures", () => {
      assert.equal(
        shouldDismissBottomSheet({ deltaY: -300, velocityY: 2, sheetHeight: 800 }),
        false
      );
      assert.equal(
        shouldDismissBottomSheet({ deltaY: 0, velocityY: 0, sheetHeight: 800 }),
        false
      );
    });

    it("does not divide by a missing measurement", () => {
      assert.equal(
        shouldDismissBottomSheet({ deltaY: 100, velocityY: 0.1, sheetHeight: 0 }),
        false
      );
    });
  });

  describe("Drawer adaptation to responsive sheets", () => {
    const consumers = [
      "app/components/ApplicationPreparationDrawer.tsx",
      "app/components/ProfileDrawer.tsx",
      "app/components/IngestModal.tsx",
    ];

    for (const consumer of consumers) {
      it(`${consumer} renders through BottomSheet with mobile and desktop variants`, () => {
        const content = read(consumer);

        assert.ok(
          content.includes('from "@/components/ui/bottom-sheet"'),
          `${consumer} should import BottomSheet`
        );
        assert.ok(content.includes("<BottomSheet"), `${consumer} should render BottomSheet`);
        assert.ok(content.includes("mobileClassName="), `${consumer} should style the mobile sheet`);
        assert.ok(
          content.includes("desktopClassName="),
          `${consumer} should preserve the desktop drawer`
        );
        assert.ok(
          !content.includes("<SheetContent"),
          `${consumer} should not render a fixed desktop-only SheetContent`
        );
      });
    }

    it("keeps a right-hand slide-over drawer at sm+ and a bottom sheet below sm", () => {
      const content = read("components/ui/bottom-sheet.tsx");

      assert.ok(content.includes("fixed inset-y-0 right-0"));
      assert.ok(content.includes("fixed inset-x-0 bottom-0"));
    });

    it("preserves safe-area clearance on the ingestion sheet's scrollable body", () => {
      const content = read("app/components/IngestModal.tsx");

      assert.ok(content.includes("env(safe-area-inset-bottom)"));
      assert.ok(content.includes("min-h-0 flex-1 space-y-4 overflow-y-auto"));
    });
  });
});
