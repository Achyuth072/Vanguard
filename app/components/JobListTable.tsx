"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { EnrichedJob } from "@/lib/data";
import { formatSalaryRange } from "@/lib/utils/currency";
import { normalizeSource } from "@/lib/utils/source";
import {
  compareJobsByRelevance,
  compareJobsByScore,
  compareJobsByRecent,
} from "@/lib/utils/sorting";
import { Search, ArrowUpDown } from "lucide-react";

export interface JobListTableProps {
  jobs: EnrichedJob[];
  selectedJobId: string | null;
  onSelectJob: (job: EnrichedJob) => void;
  className?: string;
  activeTab?: string;
  autoScrollTargetId?: string | null;
}

export function JobListTable({
  jobs,
  selectedJobId,
  onSelectJob,
  className = "",
  activeTab = "inbox",
  autoScrollTargetId,
}: JobListTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [sortMode, setSortMode] = useState<"relevance" | "score" | "recent">("relevance");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const isClickSelectionRef = useRef(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsByTabRef = useRef<Record<string, number>>({});
  const prevTabRef = useRef<string>(activeTab);
  const isTabSwitchRef = useRef(false);

  // Extract distinct sources for the dropdown filter
  const sources = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      const src = normalizeSource(j.source, j.url);
      if (src) set.add(src);
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => {
      if (sourceFilter !== "ALL" && normalizeSource(job.source, job.url) !== sourceFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.source && job.source.toLowerCase().includes(q)) ||
        (job.fitScore?.reasoning && job.fitScore.reasoning.toLowerCase().includes(q))
      );
    });

    if (sortMode === "relevance") {
      result = [...result].sort(compareJobsByRelevance);
    } else if (sortMode === "score") {
      result = [...result].sort(compareJobsByScore);
    } else {
      result = [...result].sort(compareJobsByRecent);
    }

    return result;
  }, [jobs, searchQuery, sourceFilter, sortMode]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollPositionsByTabRef.current[activeTab] = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      isTabSwitchRef.current = true;
      prevTabRef.current = activeTab;
      if (listContainerRef.current) {
        const savedScroll = scrollPositionsByTabRef.current[activeTab] ?? 0;
        listContainerRef.current.scrollTop = savedScroll;
      }
    }
  }, [activeTab]);

  // Auto-scroll selected row into view smoothly and snappily for keyboard nav & programmatic ingest
  useEffect(() => {
    // If the user explicitly clicked the row, skip scroll adjustment to avoid moving the target under their cursor
    if (isClickSelectionRef.current) {
      isClickSelectionRef.current = false;
      return;
    }

    const isProgrammaticIngest = Boolean(autoScrollTargetId && autoScrollTargetId === selectedJobId);

    // If tab just switched and it's not a programmatic ingest target, skip scroll adjustment so preserved position is maintained
    if (isTabSwitchRef.current && !isProgrammaticIngest) {
      isTabSwitchRef.current = false;
      return;
    }
    isTabSwitchRef.current = false;

    if (selectedJobId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedJobId, filteredJobs, autoScrollTargetId]);

  // Keyboard navigation [J/K] & Arrow keys & '/' focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input on '/' when not already inside an input or textarea
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Don't capture other shortcuts when user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = filteredJobs.findIndex((j) => j.id === selectedJobId);
        if (currentIndex < filteredJobs.length - 1) {
          onSelectJob(filteredJobs[currentIndex + 1]);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = filteredJobs.findIndex((j) => j.id === selectedJobId);
        if (currentIndex > 0) {
          onSelectJob(filteredJobs[currentIndex - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredJobs, selectedJobId, onSelectJob]);

  const getScoreStyle = (score?: number | null) => {
    if (score === undefined || score === null) {
      return { text: "text-[#a6abbd]", bg: "bg-[#1f222a]", border: "border-[#2a2e38]" };
    }
    if (score >= 80) {
      return { text: "text-[#d4a745]", bg: "bg-[#d4a745]/15", border: "border-[#d4a745]/40" };
    }
    if (score >= 60) {
      return { text: "text-[#8ab384]", bg: "bg-[#8ab384]/15", border: "border-[#8ab384]/40" };
    }
    return { text: "text-[#a6abbd]", bg: "bg-[#1f222a]", border: "border-[#2a2e38]" };
  };

  const formatSalary = (job: EnrichedJob) => {
    return formatSalaryRange(job.salaryMin, job.salaryMax, job.currency);
  };

  return (
    <div
      className={`bg-[#15171d] border border-[#2a2e38] rounded-[3px] flex flex-col h-full overflow-hidden ${className}`}
    >
      {/* Search and filter toolbar */}
      <div className="p-3 border-b border-[#2a2e38] bg-[#101114] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a6abbd]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search targets, tech, company... (/)"
            className="w-full pl-9 pr-3 py-1.5 bg-[#0d0e12] border border-[#2a2e38] text-xs text-[#f4f2ec] placeholder-[#a6abbd]/70 rounded-[2px] focus:outline-none focus:border-[#d4a745] font-sans"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Source filter */}
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Filter by source"
              className="px-2.5 py-1.5 bg-[#0d0e12] border border-[#2a2e38] text-xs font-mono text-[#a6abbd] rounded-[2px] focus:outline-none focus:border-[#d4a745] cursor-pointer"
            >
              <option value="ALL">ALL SOURCES</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Sort toggle */}
          <button
            type="button"
            onClick={() =>
              setSortMode((prev) =>
                prev === "relevance" ? "score" : prev === "score" ? "recent" : "relevance"
              )
            }
            title={`Sorting by ${
              sortMode === "relevance"
                ? "Relevance (Status & Score)"
                : sortMode === "score"
                ? "Fit Score"
                : "Discovered Time"
            }`}
            className="px-2.5 py-1.5 bg-[#0d0e12] border border-[#2a2e38] text-xs font-mono text-[#a6abbd] hover:text-[#f4f2ec] rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="uppercase">
              {sortMode === "relevance" ? "RELEVANCE" : sortMode === "score" ? "SCORE" : "TIME"}
            </span>
          </button>
        </div>
      </div>

      {/* Target list headers & keyboard hint */}
      <div className="px-3.5 py-2 bg-[#0d0e12] border-b border-[#2a2e38] flex items-center justify-between text-xs font-mono uppercase tracking-wide text-[#a6abbd] shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#a6abbd]">SCORE</span>
          <span className="font-semibold text-[#a6abbd]">TARGET / ORGANIZATION</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[#a6abbd] font-mono">NAV [J/K]</span>
          <span className="font-semibold text-[#f4f2ec]">{filteredJobs.length} TARGETS</span>
        </div>
      </div>

      {/* Rows Container */}
      <div
        ref={listContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto divide-y divide-[#2a2e38] focus:outline-none"
      >
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-[#a6abbd] font-mono text-xs">
            NO TARGETS MATCHING CURRENT CRITERIA
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isSelected = job.id === selectedJobId;
            const scoreStyle = getScoreStyle(job.fitScore?.score);
            const salary = formatSalary(job);
            const sourceName = normalizeSource(job.source, job.url);
            const statusUpper = job.status.toUpperCase();
            const isDropped = statusUpper === "FILTERED_OUT" || statusUpper === "IGNORED";

            return (
              <div
                key={job.id}
                ref={isSelected ? selectedRowRef : undefined}
                role="button"
                tabIndex={0}
                onClick={() => {
                  isClickSelectionRef.current = true;
                  onSelectJob(job);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectJob(job);
                  }
                }}
                className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start gap-3.5 select-none scroll-my-3.5 ${
                  isSelected
                    ? "bg-[#1f222a] border-l-[3px] border-l-[#d4a745]"
                    : "bg-[#15171d] hover:bg-[#1b1e25] border-l-[3px] border-l-transparent"
                }`}
              >
                {/* Score Anchor Box */}
                <div
                  className={`w-11 h-11 shrink-0 border ${scoreStyle.border} ${scoreStyle.bg} flex flex-col items-center justify-center rounded-[2px]`}
                >
                  <span className={`text-lg font-bold font-mono ${scoreStyle.text} leading-none tabular-nums`}>
                    {job.fitScore?.score ?? "--"}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-[#a6abbd] uppercase tracking-wider mt-0.5">
                    FIT
                  </span>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#f4f2ec] truncate font-sans tracking-tight">
                      {job.title}
                    </h3>
                    <span
                      className={`text-xs font-mono uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-[2px] border ${
                        isDropped
                          ? "bg-[#c4634e]/15 border-[#c4634e]/40 text-[#c4634e]"
                          : "bg-[#0d0e12] border-[#2a2e38] text-[#a6abbd]"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Dot-delimited metadata line */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#a6abbd] truncate font-sans">
                    <span className="font-semibold text-[#f4f2ec] truncate">{job.company}</span>
                    <span>·</span>
                    <span className="font-mono text-xs text-[#a6abbd] uppercase">{sourceName}</span>
                    {job.location && (
                      <>
                        <span>·</span>
                        <span className="truncate text-[#a6abbd]">{job.location}</span>
                      </>
                    )}
                    {salary && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-xs font-semibold text-[#d4a745]">{salary}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default JobListTable;
