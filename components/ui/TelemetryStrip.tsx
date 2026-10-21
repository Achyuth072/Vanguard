"use client";

import React from "react";
import type { EnrichedJob } from "@/lib/data";

export type TelemetryTab = "inbox" | "review" | "pipeline" | "all" | "discovery" | "filtered";

export interface TelemetryStripProps {
  jobs: EnrichedJob[];
  activeTab: TelemetryTab | string;
  onTabSelect: (tab: TelemetryTab) => void;
  className?: string;
  discoveryCount?: number;
}

const TARGET_QUEUE_IDS: ReadonlySet<TelemetryTab> = new Set(["inbox", "review", "filtered", "all"]);

export function TelemetryStrip({
  jobs,
  activeTab,
  onTabSelect,
  className = "",
  discoveryCount,
}: TelemetryStripProps) {
  const activeJobs = jobs.filter((j) => {
    const s = j.status.toUpperCase();
    return s !== "ARCHIVED" && s !== "IGNORED" && s !== "FILTERED_OUT";
  });

  const priorityCount = activeJobs.filter((j) => {
    const score = j.fitScore?.score;
    return score !== undefined && score !== null && score >= 80;
  }).length;

  const reviewCount = activeJobs.filter((j) => {
    const score = j.fitScore?.score;
    return score !== undefined && score !== null && score >= 60 && score < 80;
  }).length;

  const pipelineCount = activeJobs.filter((j) => {
    const s = j.status.toUpperCase();
    return (
      s === "SHORTLISTED" ||
      s === "PREPARED" ||
      s === "APPLIED" ||
      s === "SCREENING" ||
      s === "ASSESSMENT" ||
      s === "INTERVIEW" ||
      s === "INTERVIEWING" ||
      s === "OFFER" ||
      j.application !== null
    );
  }).length;

  const scoredJobs = activeJobs.filter(
    (j) => j.fitScore?.score !== undefined && j.fitScore?.score !== null
  );

  const avgFit =
    scoredJobs.length > 0
      ? Math.round(
          scoredJobs.reduce((acc, j) => acc + (j.fitScore?.score || 0), 0) /
            scoredJobs.length
        )
      : 0;

  const totalActive = activeJobs.length;
  const priorityPercentage =
    totalActive > 0 ? Math.round((priorityCount / totalActive) * 100) : 0;

  const droppedCount = jobs.filter((j) => {
    const s = j.status.toUpperCase();
    return s === "FILTERED_OUT" || s === "IGNORED";
  }).length;

  const metrics = [
    {
      id: "inbox" as const,
      mobileTitle: "Priority",
      desktopTitle: "01 · Priority",
      mobileBadge: "≥80",
      desktopBadge: "≥ 80 FIT",
      value: priorityCount,
      desktopValue: priorityCount,
      subtext: `targets ${totalActive > 0 ? `(${priorityPercentage}%)` : ""}`,
      activePillClass: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]",
      mobileBadgeClass: "bg-[#d4a745]/20 text-[#d4a745]",
      mobileSubtextClass: "text-[#d4a745] font-bold",
      desktopBadgeClass: "text-[#d4a745] font-bold",
      desktopValueClass: "text-[#d4a745]",
    },
    {
      id: "review" as const,
      mobileTitle: "Assessment",
      desktopTitle: "02 · Assessment",
      mobileBadge: "60–79",
      desktopBadge: "60–79 FIT",
      value: reviewCount,
      desktopValue: reviewCount,
      subtext: "pending",
      activePillClass: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]",
      mobileBadgeClass: "bg-[#1f222a] border border-[#2a2e38] text-[#f4f2ec]",
      mobileSubtextClass: "text-[#a6abbd]",
      desktopBadgeClass: "text-[#a6abbd]",
      desktopValueClass: "text-[#f4f2ec]",
    },
    {
      id: "pipeline" as const,
      mobileTitle: "Pipeline",
      desktopTitle: "03 · Pipeline",
      mobileBadge: "ACTIVE",
      desktopBadge: "ACTIVE OPS",
      value: pipelineCount,
      desktopValue: pipelineCount,
      subtext: "in flight",
      activePillClass: "bg-[#1f222a] text-[#8ab384] border-[#8ab384]",
      mobileBadgeClass: "bg-[#8ab384]/20 text-[#8ab384]",
      mobileSubtextClass: "text-[#8ab384] font-bold",
      desktopBadgeClass: "text-[#8ab384] font-bold",
      desktopValueClass: "text-[#8ab384]",
    },
    {
      id: "discovery" as const,
      mobileTitle: "Discovery",
      desktopTitle: "04 · Discovery",
      mobileBadge: "FEEDS",
      desktopBadge: "FEEDS",
      value: discoveryCount !== undefined ? discoveryCount : 0,
      desktopValue: discoveryCount !== undefined ? discoveryCount : "—",
      subtext: "staged",
      activePillClass: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]",
      mobileBadgeClass: "bg-[#d4a745]/20 text-[#d4a745]",
      mobileSubtextClass: "text-[#d4a745] font-bold",
      desktopBadgeClass: "text-[#d4a745] font-bold",
      desktopValueClass: "text-[#d4a745]",
    },
    {
      id: "filtered" as const,
      mobileTitle: "Filtered",
      desktopTitle: "05 · Filtered",
      mobileBadge: "DROPPED",
      desktopBadge: "DROPPED",
      value: droppedCount,
      desktopValue: droppedCount,
      subtext: "dropped",
      activePillClass: "bg-[#1f222a] text-[#c4634e] border-[#c4634e]",
      mobileBadgeClass: "bg-[#c4634e]/20 text-[#c4634e]",
      mobileSubtextClass: "text-[#c4634e]",
      desktopBadgeClass: "text-[#c4634e] font-bold",
      desktopValueClass: "text-[#c4634e]",
    },
    {
      id: "all" as const,
      mobileTitle: "Fleet",
      desktopTitle: "06 · Fleet Index",
      mobileBadge: "/100",
      desktopBadge: `${totalActive} TOTAL`,
      value: avgFit,
      desktopValue: avgFit,
      subtext: "/100 avg fit",
      activePillClass: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]",
      mobileBadgeClass: "bg-[#1f222a] border border-[#2a2e38] text-[#f4f2ec]",
      mobileSubtextClass: "text-[#a6abbd]",
      desktopBadgeClass: "text-[#a6abbd]",
      desktopValueClass: "text-[#f4f2ec]",
    },
  ];

  const mobileRailRef = React.useRef<HTMLDivElement>(null);
  const mobileMetrics = metrics.filter((m) => TARGET_QUEUE_IDS.has(m.id));

  React.useEffect(() => {
    if (!mobileRailRef.current) return;
    const activeEl = mobileRailRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeTab]);

  return (
    <div className={className}>
      {/* Mobile Compact Strip (<md): Horizontal scrolling pill rail for Target queues */}
      {activeTab !== "pipeline" && activeTab !== "discovery" && (
        <div
          ref={mobileRailRef}
          role="tablist"
          aria-label="Target Queue & Fleet Telemetry Views"
          className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 bg-[#15171d] border border-[#2a2e38] rounded-[3px] select-none text-xs font-mono"
        >
          {mobileMetrics.map((m) => {
            const isSelected = activeTab === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onTabSelect(m.id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-[2px] flex items-center gap-1.5 transition-colors border focus-visible:outline-2 focus-visible:outline-[#d4a745] ${
                  isSelected
                    ? m.activePillClass
                    : "bg-[#0d0e12] text-[#a6abbd] border-[#2a2e38] hover:text-[#f4f2ec]"
                }`}
              >
                <span className="font-semibold text-[#f4f2ec] whitespace-nowrap">{m.mobileTitle}</span>
                <span className={`px-1.5 py-0.5 rounded-[2px] font-bold text-[10px] tabular-nums whitespace-nowrap shrink-0 ${m.mobileBadgeClass}`}>
                  {m.value}
                </span>
                <span className={`text-[10px] whitespace-nowrap shrink-0 font-medium ${m.mobileSubtextClass}`}>
                  ({m.mobileBadge})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop Grid View (md+) */}
      <div
        role="tablist"
        aria-label="Target Queue & Fleet Telemetry Views"
        className="hidden md:grid w-full bg-[#15171d] border border-[#2a2e38] rounded-[3px] md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-[#2a2e38] text-left select-none"
      >
        {metrics.map((m) => {
          const isSelected = activeTab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onTabSelect(m.id)}
              className={`p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
                isSelected ? "bg-[#1f222a]" : ""
              }`}
            >
              {isSelected && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
              )}
              <div className="flex items-center justify-between gap-1.5 text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
                <span className="font-semibold text-[#f4f2ec] truncate">{m.desktopTitle}</span>
                <span className={`text-[11px] shrink-0 font-medium ${m.desktopBadgeClass}`}>{m.desktopBadge}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${m.desktopValueClass}`}>
                  {m.desktopValue}
                </span>
                <span className="text-xs font-mono text-[#a6abbd]">
                  {m.subtext}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TelemetryStrip;

