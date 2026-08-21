"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Settings,
  User,
  Download,
  Layers,
  Sparkles,
  Link2,
  FileText,
  Filter,
  Kanban,
  Ghost,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";

export default function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search commands, pipeline stages, or triage actions (⌘K)..." />
        <CommandList>
          <CommandEmpty>No matching command or action found.</CommandEmpty>

          {/* Quick Ingest & Actions */}
          <CommandGroup heading="Ingestion & Operations">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("open-ingest-modal", { detail: { mode: "paste" } }));
                })
              }
            >
              <Sparkles className="mr-2 h-4 w-4 text-[#d4a745]" />
              <span>Quick Ingest (Paste JD Text)</span>
              <CommandShortcut>⇧ I</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("open-ingest-modal", { detail: { mode: "url" } }));
                })
              }
            >
              <Link2 className="mr-2 h-4 w-4 text-[#d4a745]" />
              <span>Direct URL Job Scrape</span>
              <CommandShortcut>⇧ U</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("open-ingest-modal", { detail: { mode: "manual" } }));
                })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4 text-[#d4a745]" />
              <span>Manual Job Opportunity Entry</span>
              <CommandShortcut>⇧ M</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  const profileBtn = document.querySelector<HTMLButtonElement>(
                    '[data-testid="candidate-profile-button"]'
                  );
                  if (profileBtn) {
                    profileBtn.click();
                  } else {
                    const fallbackBtn = Array.from(document.querySelectorAll("button")).find(
                      (b) => b.textContent?.includes("Candidate Profile") || b.textContent?.includes("Profile")
                    );
                    fallbackBtn?.click();
                  }
                })
              }
            >
              <User className="mr-2 h-4 w-4 text-[#d4a745]" />
              <span>Open Candidate Profile Drawer</span>
              <CommandShortcut>⇧ P</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Pipeline Stage Filters */}
          <CommandGroup heading="Pipeline & Stage Filters">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("set-cockpit-filter", { detail: { tab: "priority" } }));
                })
              }
            >
              <Flame className="mr-2 h-4 w-4 text-[#d4a745]" />
              <span>Filter: Priority Queue (Fit ≥80)</span>
              <CommandShortcut>G P</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("set-cockpit-filter", { detail: { tab: "shortlisted" } }));
                })
              }
            >
              <Target className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Filter: Shortlisted Opportunities</span>
              <CommandShortcut>G 1</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("set-cockpit-filter", { detail: { tab: "prepared" } }));
                })
              }
            >
              <FileText className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Filter: Prepared Applications</span>
              <CommandShortcut>G 2</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("set-cockpit-filter", { detail: { tab: "applied" } }));
                })
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-[#8ab384]" />
              <span>Filter: Active In-Flight Pipeline</span>
              <CommandShortcut>G 3</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("set-cockpit-filter", { detail: { tab: "pipeline" } }));
                })
              }
            >
              <Kanban className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Open Interactive Kanban Pipeline Board</span>
              <CommandShortcut>G K</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation & Telemetry */}
          <CommandGroup heading="Navigation & System Telemetry">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  router.push("/");
                })
              }
            >
              <Layers className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Vanguard Intelligence Dashboard</span>
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  router.push("/settings");
                })
              }
            >
              <Settings className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Scoring Settings &amp; Calibration</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  const exportBtn = document.querySelector<HTMLButtonElement>(
                    '[data-testid="export-menu-button"]'
                  );
                  if (exportBtn) {
                    exportBtn.click();
                  } else {
                    const fallbackBtn = Array.from(document.querySelectorAll("button")).find(
                      (b) => b.textContent?.includes("Export")
                    );
                    fallbackBtn?.click();
                  }
                })
              }
            >
              <Download className="mr-2 h-4 w-4 text-[#a6abbd]" />
              <span>Export Applications Data (CSV/JSON)</span>
              <CommandShortcut>⇧ E</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
