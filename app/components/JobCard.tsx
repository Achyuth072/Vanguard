"use client";

import { useState } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction } from "../actions";
import DraftButton from "./DraftButton";

interface JobCardProps {
  job: EnrichedJob;
  onStatusUpdated?: () => void;
  onOpenPreparation?: (job: EnrichedJob) => void;
}

export default function JobCard({ job, onStatusUpdated, onOpenPreparation }: JobCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fitScore = job.fitScore;
  const score = fitScore?.score ?? null;

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true);
    setActionError(null);
    try {
      await updateJobStatusAction(job.id, newStatus);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: unknown) {
      console.error("Status update error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  }

  // Determine badge colors based on score
  const getScoreBadge = () => {
    if (score === null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-400">
          Unscored
        </span>
      );
    }

    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{score}/100</span>
          <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono">APPLY</span>
        </span>
      );
    }

    if (score >= 60) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 border border-amber-800/80 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{score}/100</span>
          <span className="text-[10px] uppercase tracking-wider text-amber-300 font-mono">REVIEW</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-900 border border-neutral-800 text-neutral-400">
        <span>{score}/100</span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">IGNORE</span>
      </span>
    );
  };

  const getStatusBadge = () => {
    const s = job.status.toUpperCase();
    let style = "bg-neutral-900 text-neutral-400 border-neutral-800";

    if (s === "SHORTLISTED") style = "bg-indigo-950/50 text-indigo-300 border-indigo-800";
    else if (s === "PREPARED") style = "bg-cyan-950/50 text-cyan-300 border-cyan-800";
    else if (s === "APPLIED") style = "bg-blue-950/50 text-blue-300 border-blue-800";
    else if (s === "INTERVIEW" || s === "INTERVIEWING") style = "bg-purple-950/50 text-purple-300 border-purple-800";
    else if (s === "OFFER") style = "bg-emerald-950/50 text-emerald-300 border-emerald-800 font-bold";
    else if (s === "REJECTED") style = "bg-rose-950/50 text-rose-400 border-rose-900";
    else if (s === "ARCHIVED" || s === "IGNORED") style = "bg-neutral-900/80 text-neutral-500 border-neutral-800";
    else if (s === "FILTERED_OUT") style = "bg-red-950/30 text-red-400 border-red-950";

    return (
      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${style}`}>
        {job.status}
      </span>
    );
  };

  return (
    <div className="bg-[#0A0A0A] border border-neutral-800/80 hover:border-neutral-700 transition-all rounded-xl p-5 shadow-sm group">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-neutral-900">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
              {job.title}
            </h3>
            {getStatusBadge()}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 font-medium">
            <span className="text-neutral-200 font-semibold">{job.company}</span>
            {job.location && (
              <>
                <span className="text-neutral-700">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              </>
            )}
            {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
              <>
                <span className="text-neutral-700">•</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono">
                  {job.remoteStatus}
                </span>
              </>
            )}
            {(job.salaryMin || job.salaryMax) && (
              <>
                <span className="text-neutral-700">•</span>
                <span className="text-emerald-400 font-mono">
                  ${job.salaryMin ? `${(job.salaryMin / 1000).toFixed(0)}k` : "0"}
                  {job.salaryMax ? ` – $${(job.salaryMax / 1000).toFixed(0)}k` : "+"}
                </span>
              </>
            )}
            {job.url && (
              <>
                <span className="text-neutral-700">•</span>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-sans"
                >
                  <span>Link</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Fit Score Badge & Draft Button */}
        <div className="flex items-center gap-2 self-start">
          {getScoreBadge()}
          <DraftButton company={job.company} role={job.title} />
        </div>
      </div>

      {/* Reasoning Snippet */}
      {fitScore?.reasoning && (
        <div className="mt-3 text-xs text-neutral-300 leading-relaxed bg-[#111] p-3 rounded-lg border border-neutral-800/60">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <span className="font-semibold text-neutral-200">Fit Reasoning: </span>
              <span className="text-neutral-300">{fitScore.reasoning}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable AI Breakdown Accordion */}
      {fitScore && (fitScore.strengths.length > 0 || fitScore.gaps.length > 0 || fitScore.risks.length > 0) && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-purple-400 transition-colors font-medium"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90 text-purple-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span>{isExpanded ? "Hide AI Breakdown" : "View AI Strengths, Gaps & Risks"}</span>
          </button>

          {isExpanded && (
            <div className="mt-3 p-4 rounded-lg bg-[#121212] border border-neutral-800 space-y-3.5 text-xs animate-in fade-in duration-150">
              {/* Strengths */}
              {fitScore.strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Key Strengths</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fitScore.strengths.map((str, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/70 text-emerald-300 text-[11px]">
                        {str}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {fitScore.gaps.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Identified Gaps</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fitScore.gaps.map((gap, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/70 text-amber-300 text-[11px]">
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {fitScore.risks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold mb-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span>Potential Risks & Red Flags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fitScore.risks.map((risk, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/70 text-rose-300 text-[11px]">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <p className="mt-2 text-xs text-red-400">{actionError}</p>
      )}

      {/* Action Progression Toolbar */}
      <div className="mt-4 pt-3 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-neutral-500 font-mono">
          Discovered: {new Date(job.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {job.status !== "SHORTLISTED" && job.status !== "APPLIED" && job.status !== "INTERVIEW" && job.status !== "OFFER" && (
            <button
              onClick={() => handleStatusChange("SHORTLISTED")}
              disabled={isUpdating}
              className="px-2.5 py-1.5 rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              Shortlist
            </button>
          )}

          {job.status !== "PREPARED" && job.status !== "APPLIED" && job.status !== "INTERVIEW" && job.status !== "OFFER" ? (
            <button
              onClick={() => {
                if (onOpenPreparation) {
                  onOpenPreparation(job);
                } else {
                  handleStatusChange("PREPARED");
                }
              }}
              disabled={isUpdating}
              className="px-2.5 py-1.5 rounded-md border border-cyan-900/60 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Prepare Application</span>
            </button>
          ) : (
            onOpenPreparation && (
              <button
                onClick={() => onOpenPreparation(job)}
                className="px-2.5 py-1.5 rounded-md border border-purple-900/60 bg-purple-950/30 hover:bg-purple-900/50 text-purple-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Tailored Materials</span>
              </button>
            )
          )}

          {job.status !== "APPLIED" && job.status !== "INTERVIEW" && job.status !== "OFFER" && (
            <button
              onClick={() => handleStatusChange("APPLIED")}
              disabled={isUpdating}
              className="px-2.5 py-1.5 rounded-md bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              Mark Applied
            </button>
          )}

          {job.status !== "ARCHIVED" && job.status !== "IGNORED" && (
            <button
              onClick={() => handleStatusChange("ARCHIVED")}
              disabled={isUpdating}
              className="px-2.5 py-1.5 rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 text-xs transition-all disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
