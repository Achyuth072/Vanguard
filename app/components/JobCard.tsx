"use client";

import { useState } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction, rescoreJobAction, deleteJobAction } from "../actions";
import DraftButton from "./DraftButton";
import SubDimensionScores from "./SubDimensionScores";
import EditJobModal from "./EditJobModal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSalaryCompact } from "@/lib/utils/currency";
import { getSourceBadgeStyle } from "@/lib/utils/source";

interface JobCardProps {
  job: EnrichedJob;
  onStatusUpdated?: () => void;
  onOpenPreparation?: (job: EnrichedJob) => void;
}

export default function JobCard({ job, onStatusUpdated, onOpenPreparation }: JobCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fitScore = job.fitScore;
  const score = fitScore?.score ?? null;

  async function handleRescore() {
    setIsRescoring(true);
    setActionError(null);
    try {
      await rescoreJobAction(job.id);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: unknown) {
      console.error("Rescore error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to re-evaluate job");
    } finally {
      setIsRescoring(false);
    }
  }

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


  const getScoreBadge = () => {
    if (score === null) {
      return (
        <Badge variant="secondary" className="gap-1.5 font-semibold text-zinc-400">
          Unscored
        </Badge>
      );
    }

    if (score >= 80) {
      return (
        <Badge variant="emerald" className="gap-1.5 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="tabular-nums font-mono">{score}/100</span>
          <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono">APPLY</span>
        </Badge>
      );
    }

    if (score >= 60) {
      return (
        <Badge variant="amber" className="gap-1.5 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="tabular-nums font-mono">{score}/100</span>
          <span className="text-[10px] uppercase tracking-wider text-amber-300 font-mono">REVIEW</span>
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1.5 font-bold text-zinc-400">
        <span className="tabular-nums font-mono">{score}/100</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">IGNORE</span>
      </Badge>
    );
  };

  const getStatusBadge = () => {
    const s = job.status.toUpperCase();
    let variant: "default" | "secondary" | "destructive" | "outline" | "emerald" | "amber" | "violet" | "blue" = "secondary";

    if (s === "SHORTLISTED" || s === "DRAFT") variant = "violet";
    else if (s === "PREPARED") variant = "blue";
    else if (s === "APPLIED" || s === "SCREENING") variant = "blue";
    else if (s === "ASSESSMENT" || s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA") variant = "amber";
    else if (s === "INTERVIEW" || s === "INTERVIEWING") variant = "violet";
    else if (s === "OFFER") variant = "emerald";
    else if (s === "REJECTED" || s === "FILTERED_OUT") variant = "destructive";

    const displayLabel = s === "ASSESSMENT" || s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA"
      ? "Take-home / OA"
      : job.status;

    return (
      <Badge variant={variant} className="text-[10px] uppercase tracking-wider font-semibold">
        {displayLabel}
      </Badge>
    );
  };

  return (
    <Card className="p-5 transition-colors hover:border-zinc-700 group">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight group-hover:text-violet-300 transition-colors">
              {job.title}
            </h3>
            {getStatusBadge()}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className="text-zinc-200 font-semibold">{job.company}</span>
            {job.source && (
              <>
                <span className="text-zinc-700">•</span>
                {(() => {
                  const sourceInfo = getSourceBadgeStyle(job.source);
                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sourceInfo.colorClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sourceInfo.dotColorClass}`} />
                      <span>{sourceInfo.label}</span>
                    </span>
                  );
                })()}
              </>
            )}
            {job.location && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              </>
            )}
            {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
              <>
                <span className="text-zinc-700">•</span>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-mono tabular-nums px-1.5 py-0 text-zinc-300">
                  {job.remoteStatus}
                </Badge>
              </>
            )}
            {(job.salaryMin || job.salaryMax) && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-emerald-400 font-mono tabular-nums">
                  {job.salaryMin ? formatSalaryCompact(job.salaryMin, job.currency) : "0"}
                  {job.salaryMax ? ` – ${formatSalaryCompact(job.salaryMax, job.currency)}` : "+"}
                </span>
              </>
            )}
            {job.url && (
              <>
                <span className="text-zinc-700">•</span>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 hover:underline flex items-center gap-1 font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
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

        {/* Fit Score Badge, Re-evaluate Button, Edit Button & Draft Button */}
        <div className="flex items-center gap-2 self-start">
          {getScoreBadge()}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRescore}
            disabled={isRescoring}
            className="h-8 w-8 text-zinc-400 hover:text-violet-300 hover:bg-zinc-800/80 border border-zinc-800 shrink-0"
            title="Re-evaluate Fit Score with AI"
            aria-label="Re-evaluate Fit Score with AI"
          >
            <svg className={`w-3.5 h-3.5 ${isRescoring ? "animate-spin text-violet-400" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditOpen(true)}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800 shrink-0"
            title="Edit Job Details"
            aria-label="Edit Job Details"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <DraftButton company={job.company} role={job.title} />
        </div>
      </div>



      {/* Sub-Dimension Score Visual Breakdown */}
      {fitScore && (
        <SubDimensionScores
          skillsFit={fitScore.skillsFit}
          experienceFit={fitScore.experienceFit}
          domainFit={fitScore.domainFit}
          trajectoryFit={fitScore.trajectoryFit}
          className="mt-3"
        />
      )}

      {/* Reasoning Snippet */}
      {fitScore?.reasoning && (
        <div className="mt-3 text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <span className="font-semibold text-zinc-200">Fit Reasoning: </span>
              <span className="text-zinc-300">{fitScore.reasoning}</span>
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
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-violet-400 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90 text-violet-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span>{isExpanded ? "Hide AI Breakdown" : "View AI Strengths, Gaps & Risks"}</span>
          </button>

          {isExpanded && (
            <div className="mt-3 p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3.5 text-xs animate-in fade-in duration-150">
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
                      <Badge key={idx} variant="emerald" className="text-[11px] font-normal">
                        {str}
                      </Badge>
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
                      <Badge key={idx} variant="amber" className="text-[11px] font-normal">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {fitScore.risks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-red-400 font-semibold mb-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span>Potential Risks & Red Flags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fitScore.risks.map((risk, idx) => (
                      <Badge key={idx} variant="destructive" className="text-[11px] font-normal">
                        {risk}
                      </Badge>
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
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-zinc-500 font-mono">
          Discovered: <span className="tabular-nums">{new Date(job.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Stage Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">Move:</span>
            <select
              value={job.status.toUpperCase()}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isUpdating}
              aria-label={`Move stage for ${job.title}`}
              className="h-7 bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded px-2 outline-none cursor-pointer hover:border-zinc-500 focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 transition-colors"
            >
              <option value="DISCOVERED">Inbox (Discovered)</option>
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

          {job.status === "ARCHIVED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("DISCOVERED")}
              disabled={isUpdating}
              className="h-7 px-2.5 text-xs font-semibold text-emerald-400 border-emerald-800/80 bg-emerald-950/30 hover:bg-emerald-900/50 hover:text-emerald-300 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restore to Inbox</span>
            </Button>
          )}

          {job.status !== "SHORTLISTED" && job.status !== "APPLIED" && job.status !== "ASSESSMENT" && job.status !== "INTERVIEW" && job.status !== "OFFER" && job.status !== "ARCHIVED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("SHORTLISTED")}
              disabled={isUpdating}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Shortlist
            </Button>
          )}

          {job.status !== "PREPARED" && job.status !== "APPLIED" && job.status !== "ASSESSMENT" && job.status !== "INTERVIEW" && job.status !== "OFFER" && job.status !== "ARCHIVED" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (onOpenPreparation) {
                  onOpenPreparation(job);
                } else {
                  handleStatusChange("PREPARED");
                }
              }}
              disabled={isUpdating}
              className="h-7 px-2.5 text-xs font-medium text-blue-300 border-blue-900/60 bg-blue-950/30 hover:bg-blue-900/50 hover:text-blue-200 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Prepare Application</span>
            </Button>
          ) : (
            onOpenPreparation && job.status !== "ARCHIVED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenPreparation(job)}
                className="h-7 px-2.5 text-xs font-medium text-purple-300 border-purple-900/60 bg-purple-950/30 hover:bg-purple-900/50 hover:text-purple-200 cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Tailored Materials</span>
              </Button>
            )
          )}

          {job.status !== "APPLIED" && job.status !== "ASSESSMENT" && job.status !== "INTERVIEW" && job.status !== "OFFER" && job.status !== "ARCHIVED" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleStatusChange("APPLIED")}
              disabled={isUpdating}
              className="h-7 px-2.5 text-xs font-semibold"
            >
              Mark Applied
            </Button>
          )}

          {job.status !== "ARCHIVED" && job.status !== "IGNORED" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange("ARCHIVED")}
              disabled={isUpdating}
              className="h-7 px-2.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Archive
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;
              setIsUpdating(true);
              setActionError(null);
              try {
                await deleteJobAction(job.id);
                onStatusUpdated?.();
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Delete failed");
              } finally {
                setIsUpdating(false);
              }
            }}
            disabled={isUpdating}
            className="h-7 px-2.5 text-xs text-red-500/70 hover:text-red-400 hover:bg-red-950/30"
          >
            Delete
          </Button>
        </div>
      </div>

      <EditJobModal
        job={job}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={onStatusUpdated}
      />
    </Card>
  );
}


