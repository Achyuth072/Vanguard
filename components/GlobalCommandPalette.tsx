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
        <CommandInput placeholder="Type a command or search actions..." />
        <CommandList>
          <CommandEmpty>No matching commands found.</CommandEmpty>
          
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  router.push("/");
                })
              }
            >
              <Layers className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Vanguard Dashboard</span>
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("open-ingest-modal", { detail: { mode: "manual" } }));
                })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Manual Job Entry</span>
              <CommandShortcut>G N</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  router.push("/settings");
                })
              }
            >
              <Settings className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Scoring Settings & Calibration</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Candidate & Operations">
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
              <User className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Open Candidate Profile</span>
              <CommandShortcut>⇧ P</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("open-ingest-modal", { detail: { mode: "paste" } }));
                })
              }
            >
              <Sparkles className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Quick Ingest Job</span>
              <CommandShortcut>⇧ I</CommandShortcut>
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
              <Download className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Export Applications Data</span>
              <CommandShortcut>⇧ E</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
