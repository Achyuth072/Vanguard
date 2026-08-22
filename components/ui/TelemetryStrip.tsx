"use client";

import React from "react";
import type { EnrichedJob } from "@/lib/data";

export type TelemetryTab = "inbox" | "review" | "pipeline" | "all" | "discovery";

export interface TelemetryStripProps {
  jobs: EnrichedJob[];
  activeTab: TelemetryTab | string;
  onTabSelect: (tab: TelemetryTab) => void;
  className?: string;
  discoveryCount?: number;
}

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

  return (
    <div
      role="tablist"
      aria-label="Target Queue & Fleet Telemetry Views"
      className={`w-full bg-[#15171d] border border-[#2a2e38] rounded-[3px] grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#2a2e38] text-left select-none ${className}`}
    >
      {/* 1. Priority Targets (>= 80 Fit) */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "inbox"}
        onClick={() => onTabSelect("inbox")}
        className={`p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
          activeTab === "inbox" ? "bg-[#1f222a]" : ""
        }`}
      >
        {activeTab === "inbox" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
        )}
        <div className="flex items-center justify-between text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
          <span className="font-semibold text-[#f4f2ec]">01 · Priority</span>
          <span className="text-[11px] text-[#d4a745] font-bold">≥ 80 FIT</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-[#d4a745] tabular-nums">
            {priorityCount}
          </span>
          <span className="text-xs font-mono text-[#a6abbd]">
            targets {totalActive > 0 ? `(${priorityPercentage}%)` : ""}
          </span>
        </div>
      </button>

      {/* 2. Assessment / Review (60–79 Fit) */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "review"}
        onClick={() => onTabSelect("review")}
        className={`p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
          activeTab === "review" ? "bg-[#1f222a]" : ""
        }`}
      >
        {activeTab === "review" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
        )}
        <div className="flex items-center justify-between text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
          <span className="font-semibold text-[#f4f2ec]">02 · Assessment</span>
          <span className="text-[11px] text-[#a6abbd]">60–79 FIT</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-[#f4f2ec] tabular-nums">
            {reviewCount}
          </span>
          <span className="text-xs font-mono text-[#a6abbd]">pending</span>
        </div>
      </button>

      {/* 3. Active Operations / Pipeline */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "pipeline"}
        onClick={() => onTabSelect("pipeline")}
        className={`p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
          activeTab === "pipeline" ? "bg-[#1f222a]" : ""
        }`}
      >
        {activeTab === "pipeline" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
        )}
        <div className="flex items-center justify-between text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
          <span className="font-semibold text-[#f4f2ec]">03 · Pipeline</span>
          <span className="text-[11px] text-[#8ab384] font-bold">ACTIVE OPS</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-[#8ab384] tabular-nums">
            {pipelineCount}
          </span>
          <span className="text-xs font-mono text-[#a6abbd]">in flight</span>
        </div>
      </button>

      {/* 4. Fleet Telemetry Index (Avg Fit & Total Pool) */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "all"}
        onClick={() => onTabSelect("all")}
        className={`p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
          activeTab === "all" ? "bg-[#1f222a]" : ""
        }`}
      >
        {activeTab === "all" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
        )}
        <div className="flex items-center justify-between text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
          <span className="font-semibold text-[#f4f2ec]">04 · Fleet Index</span>
          <span className="text-[11px] text-[#a6abbd]">{totalActive} TOTAL</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-[#f4f2ec] tabular-nums">
            {avgFit}
          </span>
          <span className="text-xs font-mono text-[#a6abbd]">/100 avg fit</span>
        </div>
      </button>

      {/* 5. Discovery Staging Buffer */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "discovery"}
        onClick={() => onTabSelect("discovery")}
        className={`col-span-2 md:col-span-1 p-3.5 sm:py-3 sm:px-4 text-left transition-colors relative group hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745] ${
          activeTab === "discovery" ? "bg-[#1f222a]" : ""
        }`}
      >
        {activeTab === "discovery" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
        )}
        <div className="flex items-center justify-between text-xs font-mono tracking-wide text-[#a6abbd] uppercase">
          <span className="font-semibold text-[#f4f2ec]">05 · Discovery</span>
          <span className="text-[11px] text-[#d4a745] font-bold">FEEDS</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-[#d4a745] tabular-nums">
            {discoveryCount !== undefined ? discoveryCount : "—"}
          </span>
          <span className="text-xs font-mono text-[#a6abbd]">staged</span>
        </div>
      </button>
    </div>
  );
}

export default TelemetryStrip;

