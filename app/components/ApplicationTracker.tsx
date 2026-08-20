"use client";

import { useState, useMemo } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction, autoGhostStaleApplicationsAction } from "../actions";
import { calculateDaysSinceApplied, identifyGhostableJobs } from "@/lib/lifecycle/auto-ghost";
import DraftButton from "./DraftButton";
import EditJobModal from "./EditJobModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSourceBadgeStyle } from "@/lib/utils/source";

interface ApplicationTrackerProps {
  jobs: EnrichedJob[];
  onStatusUpdated?: () => void;
  onOpenPreparation?: (job: EnrichedJob) => void;
}

interface PipelineStage {
  id: string;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "emerald" | "amber" | "violet" | "blue";
}

const PIPELINE_STAGES: PipelineStage[] = [
  { id: "SHORTLISTED", label: "Shortlisted", variant: "violet" },
  { id: "PREPARED", label: "Prepared", variant: "blue" },
  { id: "APPLIED", label: "Applied", variant: "blue" },
  { id: "SCREENING", label: "Screening", variant: "blue" },
  { id: "ASSESSMENT", label: "Take-home / OA", variant: "amber" },
  { id: "INTERVIEW", label: "Interview", variant: "violet" },
  { id: "OFFER", label: "Offer", variant: "emerald" },
  { id: "REJECTED", label: "Rejected", variant: "destructive" },
  { id: "GHOSTED", label: "Ghosted", variant: "secondary" },
];

const ARCHIVED_STAGE: PipelineStage = {
  id: "ARCHIVED",
  label: "Archived",
  variant: "outline",
};

export default function ApplicationTracker({ jobs, onStatusUpdated, onOpenPreparation }: ApplicationTrackerProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [selectedEditJob, setSelectedEditJob] = useState<EnrichedJob | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [isAutoGhosting, setIsAutoGhosting] = useState(false);

  // Normalize status for grouping (handles INTERVIEW / INTERVIEWING, ASSESSMENT / TAKE_HOME)
  const normalizeStatus = (status: string) => {
    const s = status.toUpperCase();
    if (s === "INTERVIEWING") return "INTERVIEW";
    if (s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA") return "ASSESSMENT";
    return s;
  };

  const archivedCount = jobs.filter((j) => normalizeStatus(j.status) === "ARCHIVED").length;
  const displayedStages = showArchived ? [...PIPELINE_STAGES, ARCHIVED_STAGE] : PIPELINE_STAGES;

  const pipelineJobs = jobs.filter((job) => {
    const s = normalizeStatus(job.status);
    if (s === "IGNORED" || s === "FILTERED_OUT") return false;
    if (s === "ARCHIVED") return showArchived;
    return PIPELINE_STAGES.some((stage) => stage.id === s) || job.application !== null;
  });

  const ghostableList = useMemo(() => identifyGhostableJobs(pipelineJobs, 21), [pipelineJobs]);

  async function handleAutoGhostAll() {
    if (ghostableList.length === 0 || isAutoGhosting) return;
    setIsAutoGhosting(true);
    try {
      await autoGhostStaleApplicationsAction(21);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error("Auto-ghost error:", err);
    } finally {
      setIsAutoGhosting(false);
    }
  }

  async function handleMoveStage(jobId: string, newStage: string) {
    setUpdatingId(jobId);
    try {
      await updateJobStatusAction(jobId, newStage);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error("Failed to move stage:", err);
    } finally {
      setUpdatingId(null);
      setDraggedJobId(null);
      setDragOverStageId(null);
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, jobId: string) {
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedJobId(jobId);
  }

  function handleDragEnd() {
    setDraggedJobId(null);
    setDragOverStageId(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStageId(null);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, stageId: string) {
    e.preventDefault();
    setDragOverStageId(null);
    const jobId = e.dataTransfer.getData("text/plain") || draggedJobId;
    if (!jobId) return;

    const targetJob = jobs.find((j) => j.id === jobId);
    if (targetJob && normalizeStatus(targetJob.status) !== stageId) {
      handleMoveStage(jobId, stageId);
    }
  }

  return (
    <div className="space-y-3 flex flex-col h-full min-h-0">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Application Pipeline</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active tracking stages with automatic audit event logging. Drag cards between columns to change status. Total active: <span className="tabular-nums font-mono font-medium text-zinc-300">{pipelineJobs.filter(j => normalizeStatus(j.status) !== "ARCHIVED").length}</span>
            {archivedCount > 0 && (
              <span className="ml-2 text-zinc-500">
                • Archived: <span className="tabular-nums font-mono text-zinc-400">{archivedCount}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ghostableList.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoGhostAll}
              disabled={isAutoGhosting}
              className="h-8 text-xs font-semibold text-amber-300 border-amber-800/80 bg-amber-950/40 hover:bg-amber-900/60 hover:text-amber-200 cursor-pointer flex items-center gap-1.5"
            >
              <span>👻</span>
              <span>{isAutoGhosting ? "Ghosting..." : `Auto-Ghost Stale (${ghostableList.length})`}</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              showArchived
                ? "bg-zinc-800 border-zinc-600 text-zinc-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span>{showArchived ? "Hide Archived Column" : `Show Archived (${archivedCount})`}</span>
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Kanban Rail */}
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x select-none flex-1 min-h-0">
        {displayedStages.map((stage) => {
          const stageJobs = pipelineJobs.filter((j) => normalizeStatus(j.status) === stage.id);
          const isTargeted = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`w-72 min-w-[288px] max-w-[288px] shrink-0 snap-start bg-zinc-900 border rounded-lg p-3 flex flex-col h-full min-h-0 transition-colors ${
                isTargeted
                  ? "border-violet-500 bg-zinc-800/90 ring-1 ring-violet-400/50"
                  : "border-zinc-800"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800 shrink-0">
                <Badge variant={stage.variant} className="text-[10px] uppercase tracking-wider font-semibold">
                  {stage.label}
                </Badge>
                <span className="text-xs font-mono text-zinc-400 font-semibold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 tabular-nums">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {stageJobs.length === 0 ? (
                  <div
                    className={`h-32 flex flex-col items-center justify-center text-xs italic border border-dashed rounded-md transition-colors ${
                      isTargeted
                        ? "border-violet-500/50 text-violet-300 bg-zinc-950/40"
                        : "border-zinc-800/80 text-zinc-600"
                    }`}
                  >
                    <span>{isTargeted ? "Drop to move here" : "No jobs"}</span>
                  </div>
                ) : (
                  stageJobs.map((job) => {
                    const isUpdating = updatingId === job.id;
                    const isDragging = draggedJobId === job.id;
                    const score = job.fitScore?.score;

                    return (
                      <div
                        key={job.id}
                        draggable={!isUpdating}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-zinc-950 border rounded-md p-3 space-y-2.5 transition-colors text-xs cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? "opacity-40 border-violet-500/50 bg-zinc-900"
                            : isUpdating
                            ? "opacity-50 pointer-events-none border-zinc-800"
                            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-zinc-100 tracking-tight line-clamp-2 leading-snug">
                            {job.title}
                          </div>
                          {score !== undefined && score !== null && (
                            <Badge
                              variant={score >= 80 ? "emerald" : score >= 60 ? "amber" : "secondary"}
                              className="px-1.5 py-0 text-[10px] font-bold shrink-0 font-mono tabular-nums"
                            >
                              {score}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 text-zinc-400 font-medium text-xs">
                          <span className="truncate">{job.company}</span>
                          {job.source && (
                            (() => {
                              const sourceInfo = getSourceBadgeStyle(job.source);
                              return (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border shrink-0 ${sourceInfo.colorClass}`}>
                                  <span className={`w-1 h-1 rounded-full ${sourceInfo.dotColorClass}`} />
                                  <span>{sourceInfo.label}</span>
                                </span>
                              );
                            })()
                          )}
                        </div>

                        {job.location && (
                          <div className="text-zinc-500 text-[10px] flex items-center gap-1 font-mono">
                            <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}

                        {job.application?.appliedAt && (() => {
                          const days = calculateDaysSinceApplied(job.application.appliedAt);
                          const isAppliedStatus = normalizeStatus(job.status) === "APPLIED";
                          const isGhostable = isAppliedStatus && days !== null && days >= 21;
                          const isStale = isAppliedStatus && days !== null && days >= 14 && days < 21;

                          return (
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                              <span className="text-zinc-500">
                                Applied: <span className="tabular-nums">{new Date(job.application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              </span>
                              {days !== null && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border tabular-nums ${
                                    isGhostable
                                      ? "bg-rose-950/60 text-rose-300 border-rose-800/80"
                                      : isStale
                                      ? "bg-amber-950/60 text-amber-300 border-amber-800/80"
                                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                  }`}
                                >
                                  {isGhostable ? `👻 ${days}d (Ghosted?)` : isStale ? `⏳ ${days}d pending` : `${days}d ago`}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        <div className="flex flex-wrap gap-1.5">
                          {job.application?.responseTimeDays !== null && job.application?.responseTimeDays !== undefined && (
                            <Badge variant="blue" className="text-[10px] font-mono tabular-nums px-1.5 py-0">
                              ⚡ {job.application.responseTimeDays}d response
                            </Badge>
                          )}

                          {job.application?.rejectionStage && (
                            <Badge variant="destructive" className="text-[10px] font-mono px-1.5 py-0 truncate">
                              🛑 {job.application.rejectionStage.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        {/* Stage Selector, Prep Trigger & Draft Button */}
                        <div className="pt-2.5 border-t border-zinc-800/80 space-y-2">
                          {normalizeStatus(job.status) === "ARCHIVED" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleMoveStage(job.id, "DISCOVERED")}
                              disabled={isUpdating}
                              className="w-full h-6 text-[10px] font-semibold text-emerald-400 border-emerald-800/80 bg-emerald-950/30 hover:bg-emerald-900/50 hover:text-emerald-300 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Restore to Inbox</span>
                            </Button>
                          )}

                          {normalizeStatus(job.status) === "APPLIED" && (() => {
                            const days = calculateDaysSinceApplied(job.application?.appliedAt);
                            if (days !== null && days >= 21) {
                              return (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMoveStage(job.id, "GHOSTED")}
                                  disabled={isUpdating}
                                  className="w-full h-6 text-[10px] font-semibold text-rose-300 border-rose-800/80 bg-rose-950/40 hover:bg-rose-900/60 hover:text-rose-200 cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <span>👻</span>
                                  <span>Mark Ghosted (&gt; 3 wks)</span>
                                </Button>
                              );
                            }
                            return null;
                          })()}

                          <div className="flex items-center gap-1.5">
                            <select
                              value={normalizeStatus(job.status)}
                              onChange={(e) => handleMoveStage(job.id, e.target.value)}
                              aria-label={`Move stage for ${job.title}`}
                              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none cursor-pointer hover:border-zinc-600 focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 transition-colors"
                            >
                              <option value="DISCOVERED">Stage: Inbox (Discovered)</option>
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Stage: {s.label}
                                </option>
                              ))}
                              <option value="ARCHIVED">Stage: Archived</option>
                            </select>

                            {onOpenPreparation && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => onOpenPreparation(job)}
                                className="h-7 w-7 text-violet-400 hover:text-violet-300 hover:bg-zinc-800 shrink-0 border-zinc-700"
                                title="Open Tailored Resume & Screening Answers"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </Button>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedEditJob(job);
                                setIsEditModalOpen(true);
                              }}
                              className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0 border border-zinc-800"
                              title="Edit Job Details"
                              aria-label={`Edit ${job.title} details`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                            <DraftButton company={job.company} role={job.title} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EditJobModal
        job={selectedEditJob}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEditJob(null);
        }}
        onSuccess={onStatusUpdated}
      />
    </div>
  );
}


