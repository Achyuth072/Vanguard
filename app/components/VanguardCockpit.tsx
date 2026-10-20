"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedJob } from "@/lib/data";
import { TelemetryStrip, type TelemetryTab } from "@/components/ui/TelemetryStrip";
import { JobListTable } from "./JobListTable";
import { JobIntelligenceView } from "./JobIntelligenceView";
import ApplicationTracker from "./ApplicationTracker";
import ApplicationPreparationDrawer from "./ApplicationPreparationDrawer";
import IngestModal, { type IngestSuccessTarget } from "./IngestModal";
import EditJobModal from "./EditJobModal";
import DiscoveryInbox from "@/components/discovery/DiscoveryInbox";
import { updateJobStatusAction, rescoreJobAction, deleteJobAction, overrideJobFilterAction } from "@/app/actions";
import { compareJobsByRelevance } from "@/lib/utils/sorting";
import { PlusCircle } from "lucide-react";

export interface VanguardCockpitProps {
  initialJobs: EnrichedJob[];
}

export function VanguardCockpit({ initialJobs }: VanguardCockpitProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TelemetryTab>("inbox");
  const [selectedJobIdByTab, setSelectedJobIdByTab] = useState<Partial<Record<TelemetryTab, string>>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [autoScrollTargetId, setAutoScrollTargetId] = useState<string | null>(null);
  const [discoveryCount, setDiscoveryCount] = useState<number>(0);

  // Fetch staged discovery count
  const fetchDiscoveryCount = useCallback(async () => {
    try {
      const res = await fetch("/api/discovery?limit=1");
      const json = await res.json();
      if (json.success && json.data?.pagination?.total !== undefined) {
        setDiscoveryCount(json.data.pagination.total);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!ignore) {
        await fetchDiscoveryCount();
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [initialJobs, fetchDiscoveryCount]);

  // Modals & drawers
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState<"paste" | "url" | "manual">("paste");
  const [selectedPrepJob, setSelectedPrepJob] = useState<EnrichedJob | null>(null);
  const [isPrepDrawerOpen, setIsPrepDrawerOpen] = useState(false);
  const [selectedEditJob, setSelectedEditJob] = useState<EnrichedJob | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Listen for global command palette triggers
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

    const handleSetFilter = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: string }>;
      const tab = customEvent.detail?.tab;
      if (tab === "priority" || tab === "inbox") {
        setActiveTab("inbox");
      } else if (tab === "review" || tab === "shortlisted") {
        setActiveTab("review");
      } else if (tab === "pipeline" || tab === "applied" || tab === "prepared") {
        setActiveTab("pipeline");
      } else if (tab === "discovery" || tab === "feeds" || tab === "staged") {
        setActiveTab("discovery");
      } else if (tab === "all") {
        setActiveTab("all");
      }
    };

    window.addEventListener("open-ingest-modal", handleOpenIngest);
    window.addEventListener("set-cockpit-filter", handleSetFilter);
    return () => {
      window.removeEventListener("open-ingest-modal", handleOpenIngest);
      window.removeEventListener("set-cockpit-filter", handleSetFilter);
    };
  }, []);

  // Categorize jobs for the active view tab
  const tabJobs = useMemo(() => {
    let result: EnrichedJob[] = [];
    if (activeTab === "inbox") {
      result = initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return (score !== undefined && score !== null && score >= 80) || s === "SHORTLISTED";
      });
    } else if (activeTab === "review") {
      result = initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return score !== undefined && score !== null && score >= 60 && score < 80;
      });
    } else if (activeTab === "pipeline") {
      result = initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        return (
          s === "SHORTLISTED" ||
          s === "PREPARED" ||
          s === "APPLIED" ||
          s === "SCREENING" ||
          s === "ASSESSMENT" ||
          s === "INTERVIEW" ||
          s === "INTERVIEWING" ||
          s === "OFFER" ||
          job.application !== null
        );
      });
    } else if (activeTab === "filtered") {
      result = initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        return s === "FILTERED_OUT" || s === "IGNORED";
      });
    } else {
      // "all" tab
      result = initialJobs.filter((j) => {
        const s = j.status.toUpperCase();
        return s !== "ARCHIVED" && s !== "IGNORED" && s !== "FILTERED_OUT";
      });
    }

    return [...result].sort(compareJobsByRelevance);
  }, [initialJobs, activeTab]);

  // Derive selectedJob without cascading setState effect
  const selectedJob = useMemo(() => {
    if (tabJobs.length === 0) return null;
    const tabSelectedId = selectedJobIdByTab[activeTab] || (selectedJobId && tabJobs.some((j) => j.id === selectedJobId) ? selectedJobId : null);
    if (tabSelectedId) {
      const match = tabJobs.find((j) => j.id === tabSelectedId);
      if (match) return match;
    }
    return tabJobs[0] || null;
  }, [tabJobs, selectedJobId, selectedJobIdByTab, activeTab]);

  function handleDataRefreshed() {
    router.refresh();
  }

  const handleIngestSuccess = useCallback((target?: IngestSuccessTarget) => {
    router.refresh();
    if (!target) return;

    const score = target.fitScore?.score;
    const status = target.status?.toUpperCase();

    // No navigation if it is dropped (FILTERED_OUT or IGNORED or score < 60)
    if (!target.isRescue && (status === "FILTERED_OUT" || status === "IGNORED" || (score !== undefined && score !== null && score < 60))) {
      return;
    }

    const nextTab: TelemetryTab = (!target.isRescue && score !== undefined && score !== null && score >= 60 && score < 80) ? "review" : "inbox";
    setActiveTab(nextTab);
    setSelectedJobId(target.id);
    setSelectedJobIdByTab((prev) => ({ ...prev, [nextTab]: target.id }));
    setAutoScrollTargetId(target.id);
  }, [router]);

  function handleDeploy(job: EnrichedJob) {
    setSelectedPrepJob(job);
    setIsPrepDrawerOpen(true);
  }

  async function handleStatusChange(jobId: string, newStatus: string) {
    try {
      await updateJobStatusAction(jobId, newStatus);
      handleDataRefreshed();
    } catch (err) {
      console.error("Status update error:", err);
    }
  }

  async function handleRescore(jobId: string) {
    try {
      await rescoreJobAction(jobId);
      handleDataRefreshed();
    } catch (err) {
      console.error("Rescore error:", err);
    }
  }

  async function handleDeleteJob(job: EnrichedJob) {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;
    try {
      await deleteJobAction(job.id);
      if (selectedJobId === job.id) {
        setSelectedJobId(null);
      }
      setSelectedJobIdByTab((prev) => {
        const next = { ...prev };
        for (const tab of Object.keys(next) as TelemetryTab[]) {
          if (next[tab] === job.id) {
            delete next[tab];
          }
        }
        return next;
      });
      handleDataRefreshed();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleOverrideFilter(jobId: string) {
    try {
      await overrideJobFilterAction(jobId, "SHORTLISTED", "Candidate override from cockpit");
      handleDataRefreshed();
    } catch (err) {
      console.error("Filter override error:", err);
      alert(err instanceof Error ? err.message : "Failed to override filter");
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 font-sans">
      {/* Header telemetry strip and quick ingest */}
      <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1">
          <TelemetryStrip
            jobs={initialJobs}
            activeTab={activeTab}
            onTabSelect={(tab) => {
              setAutoScrollTargetId(null);
              setActiveTab(tab);
            }}
            discoveryCount={discoveryCount}
          />
        </div>

        {/* Ingest Target Action */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              setIngestMode("paste");
              setIsIngestOpen(true);
            }}
            className="px-3.5 py-2 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-sans uppercase tracking-wider rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
          >
            <PlusCircle className="w-4 h-4 stroke-[2]" />
            <span>Ingest Target</span>
          </button>
        </div>
      </div>

      {/* Main split cockpit, Kanban board, or Discovery Inbox */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Discovery Inbox View */}
        <div className={`col-span-12 h-full min-h-0 bg-[#15171d] border border-[#2a2e38] rounded-[3px] overflow-hidden flex flex-col ${activeTab === "discovery" ? "flex" : "hidden"}`}>
          <DiscoveryInbox
            onJobIngested={() => {
              handleDataRefreshed();
              fetchDiscoveryCount();
            }}
          />
        </div>

        {/* Kanban Application Tracker */}
        <div className={`col-span-12 h-full min-h-0 bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-3.5 overflow-hidden flex flex-col ${activeTab === "pipeline" ? "flex" : "hidden"}`}>
          <div className="px-2 py-2 border-b border-[#2a2e38] text-xs font-mono uppercase tracking-wider text-[#a6abbd] flex items-center justify-between shrink-0 mb-3 font-semibold">
            <span>Active Application Pipeline · Interactive Kanban</span>
            <span className="text-[#d4a745]">DRAG &amp; DROP READY</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ApplicationTracker
              jobs={initialJobs}
              onStatusUpdated={handleDataRefreshed}
              onOpenPreparation={handleDeploy}
            />
          </div>
        </div>

        {/* Master-Detail Split Cockpit */}
        {activeTab !== "discovery" && activeTab !== "pipeline" && (
          <>
            {/* Left pane: Dense Job Table (5 cols on lg) */}
            <div className="lg:col-span-5 h-[400px] lg:h-full min-h-0">
              <JobListTable
                activeTab={activeTab}
                jobs={tabJobs}
                selectedJobId={selectedJob?.id || null}
                autoScrollTargetId={autoScrollTargetId}
                onSelectJob={(job) => {
                  setAutoScrollTargetId(null);
                  setSelectedJobId(job.id);
                  setSelectedJobIdByTab((prev) => ({ ...prev, [activeTab]: job.id }));
                }}
              />
            </div>

            {/* Right pane: Field Intelligence Brief (7 cols on lg) */}
            <div className="lg:col-span-7 h-[500px] lg:h-full min-h-0">
              <JobIntelligenceView
                job={selectedJob}
                onDeployApplication={handleDeploy}
                onStatusChange={handleStatusChange}
                onRescore={handleRescore}
                onEdit={(job) => {
                  setSelectedEditJob(job);
                  setIsEditModalOpen(true);
                }}
                onDelete={handleDeleteJob}
                onOverrideFilter={handleOverrideFilter}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={handleIngestSuccess}
        initialMode={ingestMode}
      />

      <EditJobModal
        job={selectedEditJob}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEditJob(null);
        }}
        onSuccess={handleDataRefreshed}
      />

      {selectedPrepJob && (
        <ApplicationPreparationDrawer
          job={selectedPrepJob}
          isOpen={isPrepDrawerOpen}
          onClose={() => setIsPrepDrawerOpen(false)}
          onUpdate={handleDataRefreshed}
        />
      )}
    </div>
  );
}

export default VanguardCockpit;
