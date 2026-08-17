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
  { id: "INTERVIEW", label: "Interview", color: "border-purple-800 text-purple-400 bg-purple-950/30" },
  { id: "OFFER", label: "Offer", color: "border-emerald-800 text-emerald-400 bg-emerald-950/30" },
  { id: "REJECTED", label: "Rejected", color: "border-rose-900 text-rose-400 bg-rose-950/30" },
];

export default function ApplicationTracker({ jobs, onStatusUpdated, onOpenPreparation }: ApplicationTrackerProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Application Pipeline</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Active tracking stages with automatic audit event logging. Total active: {pipelineJobs.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageJobs = pipelineJobs.filter((j) => normalizeStatus(j.status) === stage.id);

          return (
            <div
              key={stage.id}
              className="bg-[#0D0D0D] border border-neutral-900 rounded-xl p-3.5 flex flex-col min-h-[380px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800/80">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${stage.color}`}>
                  {stage.label}
                </span>
                <span className="text-xs font-mono text-neutral-500 font-bold bg-neutral-900 px-2 py-0.5 rounded-full">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {stageJobs.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-neutral-700 text-xs italic border border-dashed border-neutral-900 rounded-lg">
                    No jobs
                  </div>
                ) : (
                  stageJobs.map((job) => {
                    const isUpdating = updatingId === job.id;
                    const score = job.fitScore?.score;

                    return (
                      <div
                        key={job.id}
                        className={`bg-[#141414] border border-neutral-800/90 rounded-lg p-3 space-y-2.5 shadow-sm hover:border-neutral-700 transition-all text-xs ${
                          isUpdating ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-white tracking-tight line-clamp-1">
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

                        <div className="text-neutral-400 font-medium text-[11px] line-clamp-1">
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

                        {/* Stage Selector, Prep Trigger & Draft Button */}
                        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-1.5">
                          <div className="relative flex-1">
                            <select
                              value={normalizeStatus(job.status)}
                              onChange={(e) => handleMoveStage(job.id, e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-neutral-700 text-neutral-300 text-[10px] rounded px-1.5 py-1 outline-none cursor-pointer"
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Move: {s.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {onOpenPreparation && (
                            <button
                              type="button"
                              onClick={() => onOpenPreparation(job)}
                              className="p-1 rounded bg-[#1c1c1c] border border-neutral-700 text-purple-400 hover:text-purple-300 hover:bg-neutral-800 transition-colors"
                              title="Open Tailored Resume & Screening Answers"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </button>
                          )}

                          <DraftButton company={job.company} role={job.title} />
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
