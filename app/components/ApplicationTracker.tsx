"use client";

import { useState } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction } from "../actions";
import DraftButton from "./DraftButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  { id: "INTERVIEW", label: "Interview", variant: "violet" },
  { id: "OFFER", label: "Offer", variant: "emerald" },
  { id: "REJECTED", label: "Rejected", variant: "destructive" },
  { id: "GHOSTED", label: "Ghosted", variant: "secondary" },
];

export default function ApplicationTracker({ jobs, onStatusUpdated, onOpenPreparation }: ApplicationTrackerProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Normalize status for grouping (handles INTERVIEW / INTERVIEWING)
  const normalizeStatus = (status: string) => {
    const s = status.toUpperCase();
    if (s === "INTERVIEWING") return "INTERVIEW";
    return s;
  };

  // Filter jobs that belong in the application pipeline
  const pipelineJobs = jobs.filter((job) => {
    const s = normalizeStatus(job.status);
    return PIPELINE_STAGES.some((stage) => stage.id === s) || job.application !== null;
  });

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Application Pipeline</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active tracking stages with automatic audit event logging. Drag cards between columns to change status. Total active: <span className="tabular-nums font-mono font-medium text-zinc-300">{pipelineJobs.length}</span>
          </p>
        </div>
      </div>

      {/* Horizontally Scrollable Kanban Rail */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x select-none">
        {PIPELINE_STAGES.map((stage) => {
          const stageJobs = pipelineJobs.filter((j) => normalizeStatus(j.status) === stage.id);
          const isTargeted = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`w-72 min-w-[288px] max-w-[288px] shrink-0 snap-start bg-zinc-900 border rounded-lg p-3 flex flex-col min-h-[460px] transition-colors ${
                isTargeted
                  ? "border-violet-500 bg-zinc-800/90 ring-1 ring-violet-400/50"
                  : "border-zinc-800"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <Badge variant={stage.variant} className="text-[10px] uppercase tracking-wider font-semibold">
                  {stage.label}
                </Badge>
                <span className="text-xs font-mono text-zinc-400 font-semibold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 tabular-nums">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
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

                        <div className="text-zinc-400 font-medium text-xs truncate">
                          {job.company}
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

                        {job.application?.appliedAt && (
                          <div className="text-zinc-500 text-[10px] font-mono">
                            Applied: <span className="tabular-nums">{new Date(job.application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        )}

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
                          <div className="flex items-center gap-1.5">
                            <select
                              value={normalizeStatus(job.status)}
                              onChange={(e) => handleMoveStage(job.id, e.target.value)}
                              aria-label={`Move stage for ${job.title}`}
                              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none cursor-pointer hover:border-zinc-600 focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 transition-colors"
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Stage: {s.label}
                                </option>
                              ))}
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

                          <div className="flex justify-end">
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
    </div>
  );
}

