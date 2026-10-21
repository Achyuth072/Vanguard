"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  Trash2,
  Search,
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
  Layers,
  Coins,
  CheckSquare,
  Square,
  X,
  Check,
} from "lucide-react";
import type { DiscoveryJobItem } from "@/lib/discovery";

export interface DiscoveryInboxProps {
  className?: string;
  onJobIngested?: (jobId?: string) => void;
  onClose?: () => void;
}

// Estimated tokens consumed per AI fit scoring evaluation
const TOKENS_PER_JOB_ESTIMATE = 800;

interface DiscoveryCacheEntry {
  jobs: DiscoveryJobItem[];
  totalCount: number;
  totalPages: number;
  timestamp: number;
}

// In-memory query cache for discovery filter combinations
const discoveryCache = new Map<string, DiscoveryCacheEntry>();

export function clearDiscoveryCache() {
  discoveryCache.clear();
}

export function DiscoveryInbox({
  className = "",
  onJobIngested,
  onClose,
}: DiscoveryInboxProps) {
  const [rawJobs, setRawJobs] = useState<DiscoveryJobItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
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
  const querySeqRef = React.useRef<number>(0);

  // Synchronously compute filtered and sorted jobs in 0ms (Zero network delay, zero UI flash)
  const jobs = useMemo(() => {
    let list = [...rawJobs];

    if (selectedSource !== "ALL") {
      const srcUpper = selectedSource.toUpperCase();
      list = list.filter((j) => {
        const js = (j.source || "").toUpperCase();
        return js === srcUpper || js.includes(srcUpper);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          (j.location && j.location.toLowerCase().includes(q)) ||
          (j.description && j.description.toLowerCase().includes(q))
      );
    }

    if (sortBy === "discoveredAt:desc") {
      list.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());
    } else if (sortBy === "postedAt:desc") {
      list.sort((a, b) => new Date(b.postedAt || b.discoveredAt).getTime() - new Date(a.postedAt || a.discoveredAt).getTime());
    } else if (sortBy === "company:asc") {
      list.sort((a, b) => a.company.localeCompare(b.company));
    } else if (sortBy === "title:asc") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [rawJobs, selectedSource, searchQuery, sortBy]);

  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return jobs.slice(start, start + pageSize);
  }, [jobs, currentPage, pageSize]);

  const totalCount = jobs.length;

  const fetchDiscoveryJobs = useCallback(
    async (force = false) => {
      if (!force && rawJobs.length > 0) {
        return;
      }

      if (rawJobs.length === 0) {
        setLoading(true);
      }
      setIsFetching(true);
      setError(null);
      const currentSeq = ++querySeqRef.current;

      try {
        const res = await fetch("/api/discovery?limit=100");
        const json = await res.json();

        if (currentSeq !== querySeqRef.current) return;

        if (json.success && json.data) {
          const newJobs: DiscoveryJobItem[] = json.data.jobs || [];
          setRawJobs(newJobs);
        } else {
          throw new Error(json.error || "Failed to load discovery jobs");
        }
      } catch (err) {
        if (currentSeq === querySeqRef.current) {
          console.error("Error loading discovery jobs:", err);
          setError(err instanceof Error ? err.message : "Error fetching discovery jobs");
        }
      } finally {
        if (currentSeq === querySeqRef.current) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    },
    [rawJobs.length]
  );

  useEffect(() => {
    fetchDiscoveryJobs();
  }, [fetchDiscoveryJobs]);

  useEffect(() => {
    setPage(1);
    setSelectedJobIds(new Set());
  }, [selectedSource, searchQuery, sortBy]);

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
        discoveryCache.clear();
        const ingestedItem = json.data?.ingestedJobs?.[0];
        const scoreVal = ingestedItem?.score ?? 80;
        showToast(
          `Scored & Transferred: ${job.company} — ${job.title} (${scoreVal}/100 Fit Score) moved to Priority Inbox!`,
          "success"
        );

        // Remove from local list
        setRawJobs((prev) => prev.filter((j) => j.id !== job.id));
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
        discoveryCache.clear();
        showToast(`Dismissed ${job.company} posting`, "info");
        setRawJobs((prev) => prev.filter((j) => j.id !== job.id));
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
        discoveryCache.clear();
        const count = json.data?.ingestedCount ?? idsToScore.length;
        showToast(
          `Batch AI Scoring Complete: ${count} postings scored and promoted to Priority Inbox!`,
          "success"
        );
        setSelectedJobIds(new Set());
        fetchDiscoveryJobs(true);
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
        discoveryCache.clear();
        const count = json.data?.dismissedCount ?? idsToDismiss.length;
        showToast(`Dismissed ${count} postings from buffer`, "info");
        setSelectedJobIds(new Set());
        fetchDiscoveryJobs(true);
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
    { value: "HIRINGCAFE", label: "HiringCafe" },
    { value: "WWR", label: "We Work Remotely" },
    { value: "WELLFOUND", label: "Wellfound" },
    { value: "INDEED", label: "Indeed RSS" },
    { value: "YC", label: "YC" },
    { value: "MANUAL", label: "Manual / Paste" },
  ];

  return (
    <div
      className={`h-full flex flex-col bg-[#0d0e12] text-[#f4f2ec] font-sans ${className}`}
      data-testid="discovery-inbox-view"
    >
      {/* Top Header & Telemetry Bar */}
      <div className="shrink-0 bg-[#15171d] border-b border-[#2a2e38] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/30 shrink-0">
                <Sparkles className="w-4 h-4 text-[#d4a745]" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#f4f2ec] tracking-tight truncate">
                Discovery<span className="hidden sm:inline"> Staging</span> Inbox
              </h2>
              <span className="px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-mono font-bold tracking-widest bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745] shrink-0 whitespace-nowrap">
                {totalCount} PENDING
              </span>
            </div>
            <p className="hidden sm:flex text-xs text-[#a6abbd] font-mono mt-1 items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8ab384] animate-pulse" />
              Pre-filtered feed opportunities awaiting on-demand AI Fit Scoring
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchDiscoveryJobs(true)}
              disabled={loading || isFetching}
              className="px-2.5 sm:px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#d4a745] ${(loading || isFetching) ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 sm:px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] text-xs font-mono transition-colors"
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
          <div className="mt-3 p-2.5 bg-[#1f222a] border border-[#d4a745]/40 rounded-[2px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono">
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
                className="flex-1 sm:flex-none justify-center px-3 py-1.5 min-h-[36px] rounded-[2px] border border-[#c4634e]/40 bg-[#c4634e]/10 hover:bg-[#c4634e]/20 text-[#c4634e] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{batchDismissing ? "Dismissing..." : `Dismiss (${selectedJobIds.size})`}</span>
              </button>

              <button
                type="button"
                onClick={handleBatchScore}
                disabled={batchScoring || batchDismissing}
                className="flex-1 sm:flex-none justify-center px-3.5 py-1.5 min-h-[36px] rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${batchScoring ? "animate-spin" : ""}`} />
                <span>{batchScoring ? "AI Scoring..." : `Score (${selectedJobIds.size})`}</span>
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

      {/* Top Background Ingest/Fetch Bar */}
      {isFetching && (
        <div className="h-0.5 w-full bg-[#1f222a] overflow-hidden shrink-0">
          <div className="h-full bg-[#d4a745] animate-pulse w-full" />
        </div>
      )}

      {/* Main Staged Job Card Feed */}
      <div className={`flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 transition-opacity ${isFetching ? "opacity-80" : "opacity-100"}`}>
        {loading && jobs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs font-mono text-[#a6abbd] gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#d4a745]" />
            <span>Scanning discovery buffer &amp; evaluating match criteria...</span>
          </div>
        ) : error && jobs.length === 0 ? (
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
              onClick={() => fetchDiscoveryJobs(true)}
              className="mt-2 px-3.5 py-1.5 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#f4f2ec] text-xs font-mono rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#d4a745]" />
              <span>Check for New Feed Jobs</span>
            </button>
          </div>
        ) : (
          /* Staged Job Feed Cards */
          paginatedJobs.map((job) => {
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
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Main Job Information */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#f4f2ec] tracking-tight">
                          {job.title}
                        </h4>
                        <span className="text-xs text-[#a6abbd] font-semibold flex items-center gap-1 font-mono">
                          <Building2 className="w-3 h-3 text-[#d4a745]" />
                          <span>{job.company}</span>
                        </span>
                      </div>

                      {/* Discovered timestamp badge */}
                      <span className="text-[11px] font-mono text-[#a6abbd] shrink-0">
                        Discovered {new Date(job.discoveredAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Metadata Badges Strip */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-[11px]">
                      {/* Platform / Adapter source badge */}
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#d4a745] font-bold uppercase tracking-wider">
                        {job.source || "UNKNOWN"}
                      </span>

                      {/* Remote Status Badge */}
                      {job.remoteStatus && (
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#8ab384] flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span>{job.remoteStatus}</span>
                        </span>
                      )}

                      {/* Location Badge */}
                      {job.location && (
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[160px]">{job.location}</span>
                        </span>
                      )}

                      {/* Salary / Comp Badge */}
                      {(job.salaryMin || job.salaryMax) && (
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#d4a745] flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          <span>
                            {job.salaryMin && job.salaryMax
                              ? `${job.currency || "$"} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
                              : job.salaryMin
                              ? `${job.currency || "$"} ${job.salaryMin.toLocaleString()}+`
                              : `${job.currency || "$"} Up to ${job.salaryMax?.toLocaleString()}`}
                          </span>
                        </span>
                      )}

                      {/* Deterministic Pre-filter Badges */}
                      {job.matchBadges &&
                        job.matchBadges.map((badge, bIdx) => (
                          <span
                            key={bIdx}
                            className={`px-1.5 py-0.5 rounded-[2px] border text-[10px] font-bold flex items-center gap-1 ${
                              badge.matched
                                ? "bg-[#8ab384]/15 border-[#8ab384]/30 text-[#8ab384]"
                                : "bg-[#c4634e]/15 border-[#c4634e]/30 text-[#c4634e]"
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>{badge.label}</span>
                          </span>
                        ))}
                    </div>

                    {/* Collapsible snippet / full job description view */}
                    {job.description && (
                      <div className="mt-2.5 font-mono text-xs text-[#a6abbd] bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38]">
                        <div
                          className={`leading-relaxed whitespace-pre-wrap ${
                            isExpanded ? "" : "line-clamp-2"
                          }`}
                        >
                          {job.description}
                        </div>
                        {job.description.length > 180 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedJobId(isExpanded ? null : job.id)
                            }
                            className="mt-1 text-[11px] text-[#d4a745] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                          >
                            <span>{isExpanded ? "Collapse preview" : "Expand full listing preview"}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Action Trigger Buttons (Desktop) */}
                  <div className="hidden sm:flex sm:flex-row items-center gap-2 shrink-0 self-start">
                    {/* View Original External Posting URL */}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open original job posting in new tab"
                        className="p-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      aria-label="Dismiss job from staging inbox"
                      onClick={() => handleDismissSingleJob(job)}
                      disabled={isDismissing || isScoring}
                      className="px-2.5 py-1.5 rounded-[2px] border border-[#c4634e]/40 bg-[#c4634e]/10 hover:bg-[#c4634e]/20 text-[#c4634e] text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {isDismissing ? "Dismissing..." : "Dismiss"}
                      </span>
                    </button>

                    {/* Score with AI Button */}
                    <button
                      type="button"
                      aria-label="Trigger AI scoring and promote to Priority Inbox"
                      onClick={() => handleScoreSingleJob(job)}
                      disabled={isScoring || isDismissing}
                      className="px-3 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isScoring ? "animate-spin" : ""}`} />
                      <span>{isScoring ? "Scoring..." : "Score with AI"}</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Bottom Action Bar */}
                <div className="flex sm:hidden items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-[#2a2e38]">
                  <div className="flex items-center gap-2">
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open original job posting in new tab"
                        className="p-2 min-h-[36px] min-w-[36px] rounded-[2px] border border-[#2a2e38] bg-[#1f222a] text-[#a6abbd] hover:text-[#f4f2ec] transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      aria-label="Dismiss job from staging inbox"
                      onClick={() => handleDismissSingleJob(job)}
                      disabled={isDismissing || isScoring}
                      className="px-2.5 py-1.5 min-h-[36px] rounded-[2px] border border-[#c4634e]/40 bg-[#c4634e]/10 text-[#c4634e] text-xs font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#c4634e]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDismissing ? "Dismissing..." : "Dismiss"}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Score job fit with AI and move to priority inbox"
                    onClick={() => handleScoreSingleJob(job)}
                    disabled={isScoring || isDismissing}
                    className="px-3 py-1.5 min-h-[36px] rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isScoring ? "animate-spin" : ""}`} />
                    <span>{isScoring ? "Scoring..." : "+ Ingest"}</span>
                  </button>
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
            Page {currentPage} of {totalPages} ({totalCount} total opportunities)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => {
                const prev = Math.max(1, currentPage - 1);
                setPage(prev);
              }}
              className="px-3 py-1 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => {
                const next = Math.min(totalPages, currentPage + 1);
                setPage(next);
              }}
              className="px-3 py-1 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] disabled:opacity-40 cursor-pointer"
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
