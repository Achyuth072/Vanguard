"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedJob } from "@/lib/data";
import { TelemetryStrip, type TelemetryTab } from "@/components/ui/TelemetryStrip";
import { JobListTable } from "./JobListTable";
import { JobIntelligenceView } from "./JobIntelligenceView";
import ApplicationTracker from "./ApplicationTracker";
import ApplicationPreparationDrawer from "./ApplicationPreparationDrawer";
import IngestModal from "./IngestModal";
import { updateJobStatusAction, rescoreJobAction } from "@/app/actions";
import { PlusCircle } from "lucide-react";

export interface VanguardCockpitProps {
  initialJobs: EnrichedJob[];
}

export function VanguardCockpit({ initialJobs }: VanguardCockpitProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TelemetryTab>("inbox");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Modals & drawers
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState<"paste" | "url" | "manual">("paste");
  const [selectedPrepJob, setSelectedPrepJob] = useState<EnrichedJob | null>(null);
  const [isPrepDrawerOpen, setIsPrepDrawerOpen] = useState(false);

  // Listen for global command palette trigger
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

  // Categorize jobs for the active view tab
  const tabJobs = useMemo(() => {
    if (activeTab === "inbox") {
      return initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return score !== undefined && score !== null && score >= 80;
      });
    }

    if (activeTab === "review") {
      return initialJobs.filter((job) => {
        const s = job.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = job.fitScore?.score;
        return score !== undefined && score !== null && score >= 60 && score < 80;
      });
    }

    if (activeTab === "pipeline") {
      return initialJobs.filter((job) => {
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
    }

    // "all" tab
    return initialJobs.filter((j) => {
      const s = j.status.toUpperCase();
      return s !== "ARCHIVED" && s !== "IGNORED" && s !== "FILTERED_OUT";
    });
  }, [initialJobs, activeTab]);

  // Derive selectedJob without cascading setState effect
  const selectedJob = useMemo(() => {
    if (tabJobs.length === 0) return null;
    if (selectedJobId) {
      const match = tabJobs.find((j) => j.id === selectedJobId);
      if (match) return match;
    }
    return tabJobs[0] || null;
  }, [tabJobs, selectedJobId]);

  function handleDataRefreshed() {
    router.refresh();
  }

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

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 font-sans">
      {/* Header telemetry strip and quick ingest */}
      <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1">
          <TelemetryStrip
            jobs={initialJobs}
            activeTab={activeTab}
            onTabSelect={(tab) => setActiveTab(tab)}
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
            className="px-3.5 py-2 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-sans uppercase tracking-wider rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <PlusCircle className="w-4 h-4 stroke-[2]" />
            <span>Ingest Target</span>
          </button>
        </div>
      </div>

      {/* Main split cockpit or Kanban board */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {activeTab === "pipeline" ? (
          /* When in pipeline tab, show the Kanban Application Tracker */
          <div className="col-span-12 h-full min-h-0 bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-3.5 overflow-hidden flex flex-col">
            <div className="px-2 py-2 border-b border-[#2a2e38] text-xs font-mono uppercase tracking-wider text-[#a6abbd] flex items-center justify-between shrink-0 mb-3 font-semibold">
              <span>Active Application Pipeline · Interactive Kanban</span>
              <span className="text-[#d4a745]">DRAG & DROP READY</span>
            </div>
            <div className="flex-1 min-h-0 overflow-x-auto">
              <ApplicationTracker
                jobs={initialJobs}
                onStatusUpdated={handleDataRefreshed}
                onOpenPreparation={handleDeploy}
              />
            </div>
          </div>
        ) : (
          /* Master-Detail Split Cockpit */
          <>
            {/* Left pane: Dense Job Table (5 cols on lg) */}
            <div className="lg:col-span-5 h-[400px] lg:h-full min-h-0">
              <JobListTable
                jobs={tabJobs}
                selectedJobId={selectedJob?.id || null}
                onSelectJob={(job) => setSelectedJobId(job.id)}
              />
            </div>

            {/* Right pane: Field Intelligence Brief (7 cols on lg) */}
            <div className="lg:col-span-7 h-[500px] lg:h-full min-h-0">
              <JobIntelligenceView
                job={selectedJob}
                onDeployApplication={handleDeploy}
                onStatusChange={handleStatusChange}
                onRescore={handleRescore}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={handleDataRefreshed}
        initialMode={ingestMode}
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
