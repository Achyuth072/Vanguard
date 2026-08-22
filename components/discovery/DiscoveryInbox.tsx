"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  Trash2,
  Search,
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  DollarSign,
  Globe,
  Clock,
  Layers,
  Cpu,
  Coins,
  CheckSquare,
  Square,
  X,
  Check,
  Eye,
  Filter,
} from "lucide-react";
import type { DiscoveryJobItem, MatchBadge } from "@/lib/discovery";

export interface DiscoveryInboxProps {
  className?: string;
  onJobIngested?: (jobId?: string) => void;
  onClose?: () => void;
}

// Estimated tokens consumed per AI fit scoring evaluation
const TOKENS_PER_JOB_ESTIMATE = 800;

export function DiscoveryInbox({
  className = "",
  onJobIngested,
  onClose,
}: DiscoveryInboxProps) {
  const [jobs, setJobs] = useState<DiscoveryJobItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("discoveredAt:desc");

  // Selection state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Action loading states
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [batchScoring, setBatchScoring] = useState<boolean>(false);
  const [batchDismissing, setBatchDismissing] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Expanded card view for inspecting job description
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const fetchDiscoveryJobs = useCallback(
    async (currentPage = page) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", currentPage.toString());
        params.set("limit", "20");
        if (selectedSource !== "ALL") params.set("source", selectedSource);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (sortBy) params.set("sort", sortBy);

        const res = await fetch(`/api/discovery?${params.toString()}`);
        const json = await res.json();

        if (json.success && json.data) {
          setJobs(json.data.jobs || []);
          setTotalCount(json.data.pagination?.total || 0);
          setTotalPages(json.data.pagination?.totalPages || 1);
        } else {
          throw new Error(json.error || "Failed to load discovery jobs");
        }
      } catch (err) {
        console.error("Error loading discovery jobs:", err);
        setError(err instanceof Error ? err.message : "Error fetching discovery jobs");
      } finally {
        setLoading(false);
      }
    },
    [page, selectedSource, searchQuery, sortBy]
  );

  useEffect(() => {
    fetchDiscoveryJobs(1);
    setPage(1);
    setSelectedJobIds(new Set());
  }, [selectedSource, searchQuery, sortBy, fetchDiscoveryJobs]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setStatusNotification({ message, type });
    setTimeout(() => {
      setStatusNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Toggle selection for a single job
  const toggleSelectJob = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all visible jobs
  const handleSelectAllToggle = () => {
    if (selectedJobIds.size === jobs.length && jobs.length > 0) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map((j) => j.id)));
    }
  };

  // Score Single Job with AI
  const handleScoreSingleJob = async (job: DiscoveryJobItem) => {
    if (scoringIds.has(job.id) || batchScoring) return;

    setScoringIds((prev) => new Set(prev).add(job.id));
    try {
      const res = await fetch("/api/discovery/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const json = await res.json();

      if (json.success) {
        const ingestedItem = json.data?.ingestedJobs?.[0];
        const scoreVal = ingestedItem?.score ?? 80;
        showToast(
          `Scored & Transferred: ${job.company} — ${job.title} (${scoreVal}/100 Fit Score) moved to Priority Inbox!`,
          "success"
        );

        // Remove from local list
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setSelectedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });

        if (onJobIngested) onJobIngested(job.id);
      } else {
        throw new Error(json.error || "Failed to score job");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error scoring job with AI",
        "error"
      );
    } finally {
      setScoringIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  // Dismiss Single Job
  const handleDismissSingleJob = async (job: DiscoveryJobItem) => {
    if (dismissingIds.has(job.id) || batchDismissing) return;

    setDismissingIds((prev) => new Set(prev).add(job.id));
    try {
      const res = await fetch("/api/discovery/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const json = await res.json();

      if (json.success) {
        showToast(`Dismissed ${job.company} posting`, "info");
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setSelectedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
      } else {
        throw new Error(json.error || "Failed to dismiss job");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error dismissing job",
        "error"
      );
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  // Batch Score Selected Jobs
  const handleBatchScore = async () => {
    if (selectedJobIds.size === 0 || batchScoring) return;

    const idsToScore = Array.from(selectedJobIds);
    setBatchScoring(true);

    try {
      const res = await fetch("/api/discovery/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: idsToScore }),
      });
      const json = await res.json();

      if (json.success) {
        const count = json.data?.ingestedCount ?? idsToScore.length;
        showToast(
          `Batch AI Scoring Complete: ${count} postings scored and promoted to Priority Inbox!`,
          "success"
        );
        setSelectedJobIds(new Set());
        fetchDiscoveryJobs();
        if (onJobIngested) onJobIngested();
      } else {
        throw new Error(json.error || "Batch ingestion failed");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error running batch AI scoring",
        "error"
      );
    } finally {
      setBatchScoring(false);
    }
  };

  // Batch Dismiss Selected Jobs
  const handleBatchDismiss = async () => {
    if (selectedJobIds.size === 0 || batchDismissing) return;

    const idsToDismiss = Array.from(selectedJobIds);
    setBatchDismissing(true);

    try {
      const res = await fetch("/api/discovery/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: idsToDismiss }),
      });
      const json = await res.json();

      if (json.success) {
        const count = json.data?.dismissedCount ?? idsToDismiss.length;
        showToast(`Dismissed ${count} postings from buffer`, "info");
        setSelectedJobIds(new Set());
        fetchDiscoveryJobs();
      } else {
        throw new Error(json.error || "Batch dismissal failed");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error running batch dismissal",
        "error"
      );
    } finally {
      setBatchDismissing(false);
    }
  };

  const estimatedTokens = useMemo(() => {
    return selectedJobIds.size * TOKENS_PER_JOB_ESTIMATE;
  }, [selectedJobIds.size]);

  // Unique sources in result list for dropdown filter
  const sourceOptions = [
    { value: "ALL", label: "All Platforms" },
    { value: "ASHBY", label: "Ashby" },
    { value: "GREENHOUSE", label: "Greenhouse" },
    { value: "LEVER", label: "Lever" },
    { value: "HIMALAYAS", label: "Himalayas" },
    { value: "REMOTEOK", label: "RemoteOK" },
    { value: "JOBICY", label: "Jobicy" },
    { value: "HN", label: "Hacker News" },
  ];

  return (
    <div
      className={`h-full flex flex-col bg-[#0d0e12] text-[#f4f2ec] font-sans ${className}`}
      data-testid="discovery-inbox-view"
    >
      {/* Top Header & Telemetry Bar */}
      <div className="shrink-0 bg-[#15171d] border-b border-[#2a2e38] p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/30">
                <Sparkles className="w-4 h-4 text-[#d4a745]" />
              </div>
              <h2 className="text-lg font-bold text-[#f4f2ec] tracking-tight">
                Discovery Staging Inbox
              </h2>
              <span className="px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-mono font-bold tracking-widest bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745]">
                {totalCount} PENDING
              </span>
            </div>
            <p className="text-xs text-[#a6abbd] font-mono mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8ab384] animate-pulse" />
              Pre-filtered feed opportunities awaiting on-demand AI Fit Scoring
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchDiscoveryJobs(page)}
              disabled={loading}
              className="px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#d4a745] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] text-xs font-mono transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 mt-3 border-t border-[#2a2e38]">
          {/* Search input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#a6abbd]" />
            <input
              type="text"
              placeholder="Search by role, company, or tech stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] pl-9 pr-3 py-2 text-xs font-mono text-[#f4f2ec] placeholder-[#64697b] focus:border-[#d4a745] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[#a6abbd] hover:text-[#f4f2ec]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Source Platform Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] px-3 py-2 text-xs font-mono text-[#f4f2ec] focus:border-[#d4a745] outline-none"
            >
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] px-3 py-2 text-xs font-mono text-[#f4f2ec] focus:border-[#d4a745] outline-none"
            >
              <option value="discoveredAt:desc">Newest Discovered</option>
              <option value="postedAt:desc">Original Post Date</option>
              <option value="company:asc">Company (A-Z)</option>
              <option value="title:asc">Role Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Batch Actions Strip (Appears when items are selected) */}
        {selectedJobIds.size > 0 && (
          <div className="mt-3 p-2.5 bg-[#1f222a] border border-[#d4a745]/40 rounded-[2px] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={handleSelectAllToggle}
                className="flex items-center gap-1.5 text-[#d4a745] hover:underline font-bold"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{selectedJobIds.size} SELECTED</span>
              </button>
              <span className="text-[#64697b]">|</span>
              {/* Token Usage Badge Preview */}
              <span className="px-2 py-0.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/30 text-[#d4a745] text-[11px] font-mono flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#d4a745]" />
                ~{estimatedTokens.toLocaleString()} est. tokens
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchDismiss}
                disabled={batchDismissing || batchScoring}
                className="px-3 py-1.5 rounded-[2px] border border-[#c4634e]/40 bg-[#c4634e]/10 hover:bg-[#c4634e]/20 text-[#c4634e] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{batchDismissing ? "Dismissing..." : `Dismiss (${selectedJobIds.size})`}</span>
              </button>

              <button
                type="button"
                onClick={handleBatchScore}
                disabled={batchScoring || batchDismissing}
                className="px-3.5 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${batchScoring ? "animate-spin" : ""}`} />
                <span>{batchScoring ? "AI Scoring..." : `Score Selected (${selectedJobIds.size})`}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status notification toast */}
      {statusNotification && (
        <div
          className={`m-3 p-3 rounded-[2px] border text-xs font-mono flex items-center justify-between transition-all shrink-0 ${
            statusNotification.type === "success"
              ? "bg-[#8ab384]/15 border-[#8ab384]/40 text-[#8ab384]"
              : statusNotification.type === "error"
              ? "bg-[#c4634e]/15 border-[#c4634e]/40 text-[#c4634e]"
              : "bg-[#d4a745]/15 border-[#d4a745]/40 text-[#d4a745]"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusNotification.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {statusNotification.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{statusNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotification(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Staged Job Card Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs font-mono text-[#a6abbd] gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#d4a745]" />
            <span>Scanning discovery buffer &amp; evaluating match criteria...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-[#c4634e]/10 border border-[#c4634e]/40 rounded-[3px] text-xs font-mono text-[#c4634e] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : jobs.length === 0 ? (
          /* Clean Empty Buffer State */
          <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-[#15171d] border border-[#2a2e38] rounded-[3px] space-y-3">
            <div className="p-3 rounded-full bg-[#1f222a] border border-[#2a2e38] text-[#d4a745]">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4f2ec] uppercase tracking-wider font-mono">
                Discovery Buffer Empty
              </h3>
              <p className="text-xs text-[#a6abbd] max-w-md font-mono">
                No staged job postings pending evaluation in this view. Trigger a feed sync from Settings or adjust search filters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchDiscoveryJobs(1)}
              className="mt-2 px-3.5 py-1.5 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#f4f2ec] text-xs font-mono rounded-[2px] transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#d4a745]" />
              <span>Check for New Feed Jobs</span>
            </button>
          </div>
        ) : (
          /* Staged Job Feed Cards */
          jobs.map((job) => {
            const isSelected = selectedJobIds.has(job.id);
            const isScoring = scoringIds.has(job.id) || batchScoring;
            const isDismissing = dismissingIds.has(job.id) || batchDismissing;
            const isExpanded = expandedJobId === job.id;

            return (
              <div
                key={job.id}
                data-testid={`discovery-card-${job.id}`}
                className={`bg-[#15171d] border rounded-[3px] p-3.5 sm:p-4 transition-all ${
                  isSelected
                    ? "border-[#d4a745]/60 bg-[#171922]"
                    : "border-[#2a2e38] hover:border-[#3d4352]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Select Checkbox */}
                  <button
                    type="button"
                    aria-label={`Select ${job.title} at ${job.company}`}
                    onClick={() => toggleSelectJob(job.id)}
                    className="pt-0.5 text-[#a6abbd] hover:text-[#d4a745] transition-colors shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#d4a745]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#64697b]" />
                    )}
                  </button>

                  {/* Card Content Main */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Header: Title, Company, Source platform badge */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-2">
                      <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                        <h3 className="text-sm font-bold text-[#f4f2ec] tracking-tight font-sans truncate">
                          {job.title}
                        </h3>
                        <span className="text-xs font-mono text-[#d4a745] font-semibold flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-[#d4a745]" />
                          {job.company}
                        </span>
                      </div>

                      {/* Source Platform Badge & Date */}
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd] uppercase">
                          {job.source}
                        </span>
                        <span className="text-[#64697b]">
                          {job.postedAt
                            ? new Date(job.postedAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : new Date(job.discoveredAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                        </span>
                      </div>
                    </div>

                    {/* Deterministic Match Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      {/* Location badge */}
                      {job.location && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#a6abbd]">
                          <MapPin className="w-3 h-3 text-[#64697b]" />
                          {job.location}
                        </span>
                      )}

                      {/* Remote badge */}
                      {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border ${
                            job.remoteStatus === "REMOTE"
                              ? "bg-[#8ab384]/15 border-[#8ab384]/40 text-[#8ab384]"
                              : "bg-[#0d0e12] border-[#2a2e38] text-[#a6abbd]"
                          }`}
                        >
                          <Globe className="w-3 h-3" />
                          {job.remoteStatus}
                        </span>
                      )}

                      {/* Salary badge */}
                      {job.salaryMin !== null && job.salaryMin !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#8ab384]/15 border border-[#8ab384]/40 text-[#8ab384] font-semibold">
                          <DollarSign className="w-3 h-3" />
                          {job.currency} {job.salaryMin.toLocaleString()}
                          {job.salaryMax ? ` - ${job.salaryMax.toLocaleString()}` : "+"}
                        </span>
                      )}

                      {/* Filter evaluation Match Badges from backend */}
                      {job.matchBadges?.map((badge, idx) => {
                        if (badge.type === "source") return null; // already shown above
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border text-[10px] ${
                              badge.matched
                                ? "bg-[#8ab384]/10 border-[#8ab384]/30 text-[#8ab384]"
                                : "bg-[#c4634e]/10 border-[#c4634e]/30 text-[#c4634e]"
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>{badge.label}</span>
                          </span>
                        );
                      })}

                      {/* Staged Buffer Indicator */}
                      <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] bg-[#d4a745]/10 border border-[#d4a745]/30 text-[#d4a745]">
                        FILTER PASSED
                      </span>
                    </div>

                    {/* Expandable Snippet / Full Description */}
                    <div className="pt-1">
                      {isExpanded ? (
                        <div className="mt-2 p-3 bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono text-[#a6abbd] pb-1 border-b border-[#2a2e38]">
                            <span>Full Job Description &amp; Requirements</span>
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#d4a745] hover:underline flex items-center gap-1"
                              >
                                <span>Original Posting</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-[#f4f2ec]/90 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                            {job.description || "No description provided."}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#a6abbd] font-mono line-clamp-2 leading-relaxed">
                          {job.description || "No description provided."}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedJobId(isExpanded ? null : job.id)
                        }
                        className="text-[11px] font-mono text-[#d4a745] hover:underline mt-1 flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            <span>Collapse details</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            <span>Read full description →</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Quick Action Buttons on Right */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 self-center">
                    {/* Dismiss button */}
                    <button
                      type="button"
                      aria-label="Dismiss job from staging"
                      onClick={() => handleDismissSingleJob(job)}
                      disabled={isDismissing || isScoring}
                      className="px-2.5 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#c4634e]/20 hover:border-[#c4634e]/40 text-[#a6abbd] hover:text-[#c4634e] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Dismiss</span>
                    </button>

                    {/* Score with AI button */}
                    <button
                      type="button"
                      aria-label="Score job with AI"
                      onClick={() => handleScoreSingleJob(job)}
                      disabled={isScoring || isDismissing}
                      className="px-3.5 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isScoring ? "animate-spin" : ""}`} />
                      <span>{isScoring ? "Scoring..." : "Score with AI"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="shrink-0 bg-[#15171d] border-t border-[#2a2e38] p-3 flex items-center justify-between font-mono text-xs text-[#a6abbd]">
          <div>
            Page {page} of {totalPages} ({totalCount} total opportunities)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                fetchDiscoveryJobs(prev);
              }}
              className="px-3 py-1 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                fetchDiscoveryJobs(next);
              }}
              className="px-3 py-1 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscoveryInbox;
