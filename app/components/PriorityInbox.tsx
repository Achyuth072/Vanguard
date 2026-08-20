"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedJob } from "@/lib/data";
import ApplicationTracker from "./ApplicationTracker";
import IngestModal from "./IngestModal";
import ApplicationPreparationDrawer from "./ApplicationPreparationDrawer";
import SubDimensionScores from "./SubDimensionScores";
import DraftButton from "./DraftButton";
import EditJobModal from "./EditJobModal";
import { updateJobStatusAction, rescoreJobAction, deleteJobAction } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSalaryCompact } from "@/lib/utils/currency";
import {
  Sparkles,
  MapPin,
  ExternalLink,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Briefcase,
  Building2,
  ChevronRight,
  Search,
  PlusCircle,
  TrendingUp,
  FileText,
  Layers,
  ArrowUpDown,
} from "lucide-react";

interface PriorityInboxProps {
  initialJobs: EnrichedJob[];
}

type TabType = "inbox" | "review" | "applications" | "all";

export default function PriorityInbox({ initialJobs }: PriorityInboxProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [allJobsStatusFilter, setAllJobsStatusFilter] = useState<string>("ALL");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobs[0]?.id || null);

  // Modals & drawers
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState<"paste" | "url" | "manual">("paste");
  const [selectedPrepJob, setSelectedPrepJob] = useState<EnrichedJob | null>(null);
  const [isPrepDrawerOpen, setIsPrepDrawerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"analysis" | "description">("analysis");

  // State mutations
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  // Global command palette listener
  useEffect(() => {
    const handleOpenIngest = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode?: "paste" | "url" | "manual" }>;
      if (customEvent.detail?.mode) {
        setIngestMode(customEvent.detail.mode);
      } else {
        setIngestMode("paste");
      }
      setIsIngestOpen(true);
    };

    window.addEventListener("open-ingest-modal", handleOpenIngest);
    return () => window.removeEventListener("open-ingest-modal", handleOpenIngest);
  }, []);

  // Categorize jobs
  const inboxJobs = useMemo(
    () =>
      initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return score !== undefined && score !== null && score >= 80;
      }),
    [initialJobs]
  );

  const reviewJobs = useMemo(
    () =>
      initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return score !== undefined && score !== null && score >= 60 && score < 80;
      }),
    [initialJobs]
  );

  const applicationJobs = useMemo(
    () =>
      initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        return (
          s === "SHORTLISTED" ||
          s === "PREPARED" ||
          s === "APPLIED" ||
          s === "SCREENING" ||
          s === "ASSESSMENT" ||
          s === "TAKE_HOME" ||
          s === "TAKE_HOME_OA" ||
          s === "OA" ||
          s === "INTERVIEW" ||
          s === "INTERVIEWING" ||
          s === "OFFER" ||
          s === "REJECTED" ||
          s === "GHOSTED" ||
          job.application !== null
        );
      }),
    [initialJobs]
  );

  // Top metric calculations
  const avgScore = useMemo(() => {
    const scored = initialJobs.filter((j) => j.fitScore?.score !== undefined && j.fitScore?.score !== null);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((acc, j) => acc + (j.fitScore?.score || 0), 0);
    return Math.round(sum / scored.length);
  }, [initialJobs]);

  // Filter jobs based on active tab and search query
  const displayedJobs = useMemo(() => {
    let list: EnrichedJob[] = [];
    if (activeTab === "inbox") list = inboxJobs;
    else if (activeTab === "review") list = reviewJobs;
    else if (activeTab === "applications") list = applicationJobs;
    else {
      if (allJobsStatusFilter === "ARCHIVED") {
        list = initialJobs.filter((j) => j.status.toUpperCase() === "ARCHIVED");
      } else if (allJobsStatusFilter === "ACTIVE") {
        list = initialJobs.filter((j) => {
          const s = j.status.toUpperCase();
          return s !== "ARCHIVED" && s !== "IGNORED" && s !== "FILTERED_OUT";
        });
      } else if (allJobsStatusFilter === "SHORTLISTED") {
        list = initialJobs.filter((j) => j.status.toUpperCase() === "SHORTLISTED");
      } else if (allJobsStatusFilter === "APPLIED") {
        list = initialJobs.filter((j) => j.status.toUpperCase() === "APPLIED");
      } else {
        list = initialJobs;
      }
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter((job) => {
      const titleMatch = job.title.toLowerCase().includes(query);
      const companyMatch = job.company.toLowerCase().includes(query);
      const locationMatch = job.location.toLowerCase().includes(query);
      const reasoningMatch = job.fitScore?.reasoning?.toLowerCase().includes(query);
      return titleMatch || companyMatch || locationMatch || reasoningMatch;
    });
  }, [activeTab, allJobsStatusFilter, searchQuery, inboxJobs, reviewJobs, applicationJobs, initialJobs]);

  // Active selected job in detail view
  const selectedJob = useMemo(() => {
    return displayedJobs.find((j) => j.id === selectedJobId) || displayedJobs[0] || initialJobs[0] || null;
  }, [displayedJobs, selectedJobId, initialJobs]);

  function handleDataRefreshed() {
    router.refresh();
  }

  function handleOpenPreparation(job: EnrichedJob) {
    setSelectedPrepJob(job);
    setIsPrepDrawerOpen(true);
  }

  async function handleStatusChange(jobId: string, newStatus: string) {
    setIsUpdating(true);
    try {
      await updateJobStatusAction(jobId, newStatus);
      handleDataRefreshed();
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRescore(jobId: string) {
    setIsRescoring(true);
    try {
      await rescoreJobAction(jobId);
      handleDataRefreshed();
    } catch (err) {
      console.error("Rescore error:", err);
    } finally {
      setIsRescoring(false);
    }
  }

  async function handleDelete(jobId: string) {
    if (!window.confirm("Are you sure you want to permanently delete this job?")) return;
    try {
      await deleteJobAction(jobId);
      handleDataRefreshed();
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  const getScoreBadge = (score?: number | null) => {
    if (score === null || score === undefined) {
      return (
        <Badge variant="secondary" className="font-mono text-zinc-400">
          Unscored
        </Badge>
      );
    }

    if (score >= 80) {
      return (
        <Badge variant="emerald" className="gap-1.5 font-bold font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{score}/100</span>
          <span className="text-[9px] uppercase tracking-wider text-emerald-300">APPLY</span>
        </Badge>
      );
    }

    if (score >= 60) {
      return (
        <Badge variant="amber" className="gap-1.5 font-bold font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>{score}/100</span>
          <span className="text-[9px] uppercase tracking-wider text-amber-300">REVIEW</span>
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1 font-bold font-mono text-zinc-400">
        <span>{score}/100</span>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">IGNORE</span>
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    let variant: "default" | "secondary" | "destructive" | "outline" | "emerald" | "amber" | "violet" | "blue" = "secondary";

    if (s === "SHORTLISTED" || s === "DRAFT") variant = "violet";
    else if (s === "PREPARED" || s === "APPLIED" || s === "SCREENING") variant = "blue";
    else if (s === "ASSESSMENT" || s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA") variant = "amber";
    else if (s === "INTERVIEW" || s === "INTERVIEWING") variant = "violet";
    else if (s === "OFFER") variant = "emerald";
    else if (s === "REJECTED" || s === "FILTERED_OUT") variant = "destructive";

    return (
      <Badge variant={variant} className="text-[10px] uppercase font-semibold tracking-wider">
        {s === "ASSESSMENT" || s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA" ? "Take-home" : status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Priority (≥80)</span>
            <span className="p-1 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{inboxJobs.length}</span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {initialJobs.length > 0 ? Math.round((inboxJobs.length / initialJobs.length) * 100) : 0}% of total
            </span>
          </div>
        </Card>

        <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Review (60-79)</span>
            <span className="p-1 rounded-md bg-amber-950/60 border border-amber-800/50 text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono">{reviewJobs.length}</span>
            <span className="text-[11px] text-zinc-500 font-mono">Needs triage</span>
          </div>
        </Card>

        <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">In Pipeline</span>
            <span className="p-1 rounded-md bg-violet-950/60 border border-violet-800/50 text-violet-400">
              <Briefcase className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-violet-400 font-mono">{applicationJobs.length}</span>
            <span className="text-[11px] text-zinc-500 font-mono">In-flight</span>
          </div>
        </Card>

        <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Avg Fit Score</span>
            <span className="p-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100 font-mono">{avgScore}/100</span>
            <span className="text-[11px] text-zinc-500 font-mono">{initialJobs.length} jobs</span>
          </div>
        </Card>
      </div>

      {/* Action Header / Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "inbox"
                ? "bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Priority Inbox</span>
            <Badge variant="emerald" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {inboxJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "review"
                ? "bg-zinc-800 text-amber-400 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Review</span>
            <Badge variant="amber" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {reviewJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "applications"
                ? "bg-zinc-800 text-violet-400 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>Pipeline Kanban</span>
            <Badge variant="violet" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {applicationJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span>All Jobs</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {initialJobs.length}
            </Badge>
          </button>
        </div>

        {/* Search & Ingest Action Button */}
        <div className="flex items-center gap-2.5">
          {activeTab !== "applications" && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                placeholder="Filter company, title, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs bg-zinc-950 border-zinc-800 w-48 sm:w-64 h-8"
              />
            </div>
          )}

          <Button
            type="button"
            onClick={() => {
              setIngestMode("paste");
              setIsIngestOpen(true);
            }}
            size="sm"
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Ingest Job</span>
          </Button>
        </div>
      </div>

      {/* Main Surface: Kanban View vs 2-Column Split Cockpit */}
      {activeTab === "applications" ? (
        <ApplicationTracker
          jobs={initialJobs}
          onStatusUpdated={handleDataRefreshed}
          onOpenPreparation={handleOpenPreparation}
        />
      ) : (
        <div className="space-y-4">
          {activeTab === "all" && (
            <div className="flex items-center gap-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60 text-xs">
              <span className="text-zinc-400 font-medium ml-2">Status filter:</span>
              <select
                value={allJobsStatusFilter}
                onChange={(e) => setAllJobsStatusFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1 font-mono"
              >
                <option value="ALL">All ({initialJobs.length})</option>
                <option value="ACTIVE">Active</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="APPLIED">Applied</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          )}

          {/* Master-Detail 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: Master Job List (35-40% / 4-5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {displayedJobs.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  No jobs found matching your criteria.
                </div>
              ) : (
                displayedJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const score = job.fitScore?.score;

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all relative ${
                        isSelected
                          ? "bg-zinc-900 border-violet-500/80 shadow-md shadow-violet-950/20 ring-1 ring-violet-500/40"
                          : "bg-zinc-950/80 hover:bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                            {job.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium truncate">
                            <span className="text-zinc-200 font-semibold">{job.company}</span>
                            {job.location && (
                              <>
                                <span>•</span>
                                <span className="truncate">{job.location}</span>
                              </>
                            )}
                            {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-300 font-mono text-[10px]">{job.remoteStatus}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">{getScoreBadge(score)}</div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(job.status)}
                          {(job.salaryMin || job.salaryMax) && (
                            <span className="text-emerald-400 font-mono text-[10px]">
                              {job.salaryMin ? formatSalaryCompact(job.salaryMin, job.currency) : "0"}
                              {job.salaryMax ? `–${formatSalaryCompact(job.salaryMax, job.currency)}` : "+"}
                            </span>
                          )}
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected ? "text-violet-400 translate-x-0.5" : "text-zinc-600"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT COLUMN: Active Job Evaluation & Action Cockpit (60-65% / 7-8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8">
              {selectedJob ? (
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-5 sticky top-5 max-h-[calc(100vh-140px)] overflow-y-auto shadow-xl">
                  {/* Selected Job Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-zinc-800">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-lg sm:text-xl font-bold text-zinc-100 tracking-tight">
                          {selectedJob.title}
                        </h2>
                        {getStatusBadge(selectedJob.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                        <span className="text-zinc-200 font-semibold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                          {selectedJob.company}
                        </span>
                        {selectedJob.location && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                              {selectedJob.location}
                            </span>
                          </>
                        )}
                        {selectedJob.remoteStatus && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {selectedJob.remoteStatus}
                            </Badge>
                          </>
                        )}
                        {(selectedJob.salaryMin || selectedJob.salaryMax) && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="text-emerald-400 font-mono font-semibold">
                              {selectedJob.salaryMin ? formatSalaryCompact(selectedJob.salaryMin, selectedJob.currency) : "0"}
                              {selectedJob.salaryMax ? ` – ${formatSalaryCompact(selectedJob.salaryMax, selectedJob.currency)}` : "+"}
                            </span>
                          </>
                        )}
                        {selectedJob.url && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <a
                              href={selectedJob.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-400 hover:text-violet-300 flex items-center gap-1 hover:underline font-mono text-[11px]"
                            >
                              <span>Original Posting</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {getScoreBadge(selectedJob.fitScore?.score)}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleRescore(selectedJob.id)}
                        disabled={isRescoring}
                        title="Re-score with AI"
                        className="border-zinc-700 text-zinc-300 hover:text-white"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRescoring ? "animate-spin text-violet-400" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setIsEditOpen(true)}
                        title="Edit Details"
                        className="border-zinc-700 text-zinc-300 hover:text-white"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleDelete(selectedJob.id)}
                        title="Delete Job"
                        className="border-zinc-700 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedPrepJob(selectedJob);
                          setIsPrepDrawerOpen(true);
                        }}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Prepare Application</span>
                      </Button>

                      <DraftButton company={selectedJob.company} role={selectedJob.title} />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 font-medium">Stage:</span>
                      <select
                        value={selectedJob.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(selectedJob.id, e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-md px-2.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="DISCOVERED">Discovered</option>
                        <option value="SHORTLISTED">Shortlisted</option>
                        <option value="PREPARED">Prepared</option>
                        <option value="APPLIED">Applied</option>
                        <option value="SCREENING">Screening</option>
                        <option value="ASSESSMENT">Take-home / OA</option>
                        <option value="INTERVIEW">Interview</option>
                        <option value="OFFER">Offer</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="GHOSTED">Ghosted</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>

                  {/* Detail Navigation (Analysis vs Job Description) */}
                  <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("analysis")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        activeDetailTab === "analysis"
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      AI Match Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("description")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        activeDetailTab === "description"
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Job Description
                    </button>
                  </div>

                  {/* Content Body */}
                  {activeDetailTab === "analysis" ? (
                    <div className="space-y-4">
                      {/* Fit Dimension Breakdown */}
                      {selectedJob.fitScore && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                            Evaluation Dimensions
                          </h3>
                          <SubDimensionScores
                            skillsFit={selectedJob.fitScore.skillsFit}
                            experienceFit={selectedJob.fitScore.experienceFit}
                            domainFit={selectedJob.fitScore.domainFit}
                            trajectoryFit={selectedJob.fitScore.trajectoryFit}
                          />
                        </div>
                      )}

                      {/* AI Reasoning */}
                      {selectedJob.fitScore?.reasoning && (
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-violet-400 text-xs font-semibold">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Fit Synthesis</span>
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                            {selectedJob.fitScore.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Strengths, Gaps & Risks */}
                      {selectedJob.fitScore && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                          <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-lg space-y-1.5">
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Strengths
                            </span>
                            <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                              {selectedJob.fitScore.strengths?.length > 0 ? (
                                selectedJob.fitScore.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                              ) : (
                                <li className="text-zinc-500 italic list-none">None noted</li>
                              )}
                            </ul>
                          </div>

                          <div className="bg-amber-950/20 border border-amber-900/50 p-3 rounded-lg space-y-1.5">
                            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                              Key Gaps
                            </span>
                            <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                              {selectedJob.fitScore.gaps?.length > 0 ? (
                                selectedJob.fitScore.gaps.map((g, idx) => <li key={idx}>{g}</li>)
                              ) : (
                                <li className="text-zinc-500 italic list-none">None noted</li>
                              )}
                            </ul>
                          </div>

                          <div className="bg-rose-950/20 border border-rose-900/50 p-3 rounded-lg space-y-1.5">
                            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                              Risks / Flags
                            </span>
                            <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                              {selectedJob.fitScore.risks?.length > 0 ? (
                                selectedJob.fitScore.risks.map((r, idx) => <li key={idx}>{r}</li>)
                              ) : (
                                <li className="text-zinc-500 italic list-none">None noted</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2 text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans max-h-96 overflow-y-auto whitespace-pre-wrap">
                      {selectedJob.description || "No full job description available."}
                    </div>
                  )}

                  {/* Edit Modal */}
                  <EditJobModal
                    job={selectedJob}
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    onSuccess={handleDataRefreshed}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  Select a job to view details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preparation Drawer & Ingest Modal */}
      <ApplicationPreparationDrawer
        job={selectedPrepJob}
        isOpen={isPrepDrawerOpen}
        onClose={() => {
          setIsPrepDrawerOpen(false);
          setSelectedPrepJob(null);
        }}
        onStatusUpdated={handleDataRefreshed}
      />

      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={handleDataRefreshed}
        initialMode={ingestMode}
      />
    </div>
  );
}
