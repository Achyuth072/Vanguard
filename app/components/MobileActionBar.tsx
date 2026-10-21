"use client";

import React from "react";
import { Briefcase, Compass, Layers, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

function dispatchCockpitEvent(name: string, detail?: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
}

export default function MobileActionBar() {
  const [activeNavTab, setActiveNavTab] = React.useState<"targets" | "pipeline" | "discovery">("targets");

  React.useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: string }>;
      const tab = customEvent.detail?.tab;
      if (tab === "pipeline" || tab === "discovery") {
        setActiveNavTab(tab);
      } else if (tab === "inbox" || tab === "review" || tab === "all") {
        setActiveNavTab("targets");
      }
    };
    window.addEventListener("set-cockpit-filter", handleTabChange);
    return () => window.removeEventListener("set-cockpit-filter", handleTabChange);
  }, []);

  function handleSelect(tab: "targets" | "pipeline" | "discovery", cockpitTab: string) {
    setActiveNavTab(tab);
    dispatchCockpitEvent("set-cockpit-filter", { tab: cockpitTab });
  }

  function handleIngest() {
    dispatchCockpitEvent("open-ingest-modal", { mode: "paste" });
  }

  function handleOpenProfile() {
    dispatchCockpitEvent("open-profile-drawer");
  }

  return (
    <div
      data-testid="mobile-action-bar"
      className="fixed inset-x-0 bottom-0 z-40 block sm:hidden border-t border-[#2a2e38] bg-[#15171d]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <nav
        aria-label="Mobile primary navigation"
        className="grid grid-cols-5 gap-1 px-1 py-1.5"
      >
        {/* 1. Targets */}
        <button
          type="button"
          onClick={() => handleSelect("targets", "inbox")}
          className={cn(
            "min-h-11 rounded-[2px] border px-1 py-1 text-[10px] font-mono transition-colors flex flex-col items-center justify-center gap-0.5 leading-tight focus-visible:outline-2 focus-visible:outline-[#d4a745]",
            activeNavTab === "targets"
              ? "border-[#d4a745] bg-[#d4a745]/15 text-[#f4f2ec] font-bold"
              : "border-transparent bg-transparent text-[#a6abbd] hover:text-[#f4f2ec]"
          )}
        >
          <Briefcase className={cn("h-4 w-4 shrink-0", activeNavTab === "targets" ? "text-[#d4a745]" : "text-[#a6abbd]")} aria-hidden="true" />
          <span className="w-full text-center truncate">Targets</span>
        </button>

        {/* 2. Pipeline */}
        <button
          type="button"
          onClick={() => handleSelect("pipeline", "pipeline")}
          className={cn(
            "min-h-11 rounded-[2px] border px-1 py-1 text-[10px] font-mono transition-colors flex flex-col items-center justify-center gap-0.5 leading-tight focus-visible:outline-2 focus-visible:outline-[#d4a745]",
            activeNavTab === "pipeline"
              ? "border-[#8ab384] bg-[#8ab384]/15 text-[#f4f2ec] font-bold"
              : "border-transparent bg-transparent text-[#a6abbd] hover:text-[#f4f2ec]"
          )}
        >
          <Layers className={cn("h-4 w-4 shrink-0", activeNavTab === "pipeline" ? "text-[#8ab384]" : "text-[#a6abbd]")} aria-hidden="true" />
          <span className="w-full text-center truncate">Pipeline</span>
        </button>

        {/* 3. Ingest */}
        <button
          type="button"
          onClick={handleIngest}
          aria-label="Ingest Target"
          className="min-h-11 rounded-[2px] border border-[#d4a745]/60 bg-[#d4a745] px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0d0e12] transition-colors hover:bg-[#e8bd59] focus-visible:outline-2 focus-visible:outline-[#d4a745] flex flex-col items-center justify-center gap-0.5 leading-tight shadow-sm"
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="w-full text-center truncate">+ Ingest</span>
        </button>

        {/* 4. Discovery */}
        <button
          type="button"
          onClick={() => handleSelect("discovery", "discovery")}
          className={cn(
            "min-h-11 rounded-[2px] border px-1 py-1 text-[10px] font-mono transition-colors flex flex-col items-center justify-center gap-0.5 leading-tight focus-visible:outline-2 focus-visible:outline-[#d4a745]",
            activeNavTab === "discovery"
              ? "border-[#d4a745] bg-[#d4a745]/15 text-[#f4f2ec] font-bold"
              : "border-transparent bg-transparent text-[#a6abbd] hover:text-[#f4f2ec]"
          )}
        >
          <Compass className={cn("h-4 w-4 shrink-0", activeNavTab === "discovery" ? "text-[#d4a745]" : "text-[#a6abbd]")} aria-hidden="true" />
          <span className="w-full text-center truncate">Discovery</span>
        </button>

        {/* 5. Profile */}
        <button
          type="button"
          onClick={handleOpenProfile}
          className="min-h-11 rounded-[2px] border border-transparent bg-transparent px-1 py-1 text-[10px] font-mono text-[#a6abbd] transition-colors hover:text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] flex flex-col items-center justify-center gap-0.5 leading-tight"
        >
          <User className="h-4 w-4 shrink-0 text-[#a6abbd] hover:text-[#d4a745]" aria-hidden="true" />
          <span className="w-full text-center truncate">Profile</span>
        </button>
      </nav>
    </div>
  );
}
