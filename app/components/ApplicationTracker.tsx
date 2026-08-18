"use client";

import { useState } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction } from "../actions";
import DraftButton from "./DraftButton";

interface ApplicationTrackerProps {
  jobs: EnrichedJob[];
  onStatusUpdated?: () => void;
  onOpenPreparation?: (job: EnrichedJob) => void;
}

const PIPELINE_STAGES = [
  { id: "SHORTLISTED", label: "Shortlisted", color: "border-indigo-800 text-indigo-400 bg-indigo-950/30" },
  { id: "PREPARED", label: "Prepared", color: "border-cyan-800 text-cyan-400 bg-cyan-950/30" },
  { id: "APPLIED", label: "Applied", color: "border-blue-800 text-blue-400 bg-blue-950/30" },
  { id: "SCREENING", label: "Screening", color: "border-sky-800 text-sky-400 bg-sky-950/30" },
  { id: "INTERVIEW", label: "Interview", color: "border-purple-800 text-purple-400 bg-purple-950/30" },
  { id: "OFFER", label: "Offer", color: "border-emerald-800 text-emerald-400 bg-emerald-950/30" },
  { id: "REJECTED", label: "Rejected", color: "border-rose-900 text-rose-400 bg-rose-950/30" },
  { id: "GHOSTED", label: "Ghosted", color: "border-neutral-800 text-neutral-400 bg-neutral-950/40" },
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
          <h2 className="text-xl font-bold tracking-tight text-white">Application Pipeline</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Active tracking stages with automatic audit event logging. Drag cards between columns to change status. Total active: {pipelineJobs.length}
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
              className={`w-72 min-w-[288px] max-w-[288px] shrink-0 snap-start bg-[#0D0D0D] border rounded-xl p-3 flex flex-col min-h-[440px] transition-all duration-150 ${
                isTargeted
                  ? "border-purple-500/80 bg-purple-950/20 ring-2 ring-purple-500/30"
                  : "border-neutral-900"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800/80">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${stage.color}`}>
                  {stage.label}
                </span>
                <span className="text-xs font-mono text-neutral-400 font-bold bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
                {stageJobs.length === 0 ? (
                  <div
                    className={`h-32 flex flex-col items-center justify-center text-xs italic border border-dashed rounded-lg transition-colors ${
                      isTargeted
                        ? "border-purple-500/50 text-purple-300 bg-purple-950/10"
                        : "border-neutral-900 text-neutral-700"
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
                        className={`bg-[#141414] border rounded-lg p-3 space-y-2.5 shadow-sm transition-all text-xs cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? "opacity-40 scale-[0.98] border-purple-500/50 bg-[#1a1625]"
                            : isUpdating
                            ? "opacity-50 pointer-events-none border-neutral-800"
                            : "border-neutral-800/90 hover:border-neutral-700 hover:bg-[#171717]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-white tracking-tight line-clamp-2 leading-snug">
                            {job.title}
                          </div>
                          {score !== undefined && score !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 font-mono ${
                              score >= 80 ? "text-emerald-400 bg-emerald-950/60" : "text-amber-400 bg-amber-950/60"
                            }`}>
                              {score}
                            </span>
                          )}
                        </div>

                        <div className="text-neutral-400 font-medium text-[11px] truncate">
                          {job.company}
                        </div>

                        {job.location && (
                          <div className="text-neutral-500 text-[10px] flex items-center gap-1 font-mono">
                            <span>📍</span>
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}

                        {job.application?.appliedAt && (
                          <div className="text-neutral-500 text-[10px] font-mono">
                            Applied: {new Date(job.application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {job.application?.responseTimeDays !== null && job.application?.responseTimeDays !== undefined && (
                            <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/50">
                              ⚡ {job.application.responseTimeDays}d response
                            </div>
                          )}

                          {job.application?.rejectionStage && (
                            <div className="text-[10px] font-mono text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50 truncate">
                              🛑 {job.application.rejectionStage.replace(/_/g, " ")}
                            </div>
                          )}
                        </div>

                        {/* Stage Selector, Prep Trigger & Draft Button */}
                        <div className="pt-2.5 border-t border-neutral-800/80 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={normalizeStatus(job.status)}
                              onChange={(e) => handleMoveStage(job.id, e.target.value)}
                              aria-label={`Move stage for ${job.title}`}
                              className="flex-1 bg-[#1c1c1c] border border-neutral-700 text-neutral-300 text-[10px] rounded px-2 py-1 outline-none cursor-pointer hover:border-neutral-600 transition-colors"
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Stage: {s.label}
                                </option>
                              ))}
                            </select>

                            {onOpenPreparation && (
                              <button
                                type="button"
                                onClick={() => onOpenPreparation(job)}
                                className="p-1.5 rounded bg-[#1c1c1c] border border-neutral-700 text-purple-400 hover:text-purple-300 hover:bg-neutral-800 hover:border-neutral-600 transition-colors shrink-0"
                                title="Open Tailored Resume & Screening Answers"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </button>
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

