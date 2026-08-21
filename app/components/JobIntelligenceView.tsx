"use client";

import React, { useState } from "react";
import type { EnrichedJob } from "@/lib/data";
import { ReticleGauge } from "@/components/ui/ReticleGauge";
import { formatSalaryRange } from "@/lib/utils/currency";
import { normalizeSource } from "@/lib/utils/source";
import {
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Send,
  Edit2,
} from "lucide-react";

export interface JobIntelligenceViewProps {
  job: EnrichedJob | null;
  onDeployApplication?: (job: EnrichedJob) => void;
  onStatusChange?: (jobId: string, newStatus: string) => void;
  onRescore?: (jobId: string) => void;
  onEdit?: (job: EnrichedJob) => void;
  className?: string;
}

export function JobIntelligenceView({
  job,
  onDeployApplication,
  onStatusChange,
  onRescore,
  onEdit,
  className = "",
}: JobIntelligenceViewProps) {
  const [activeTab, setActiveTab] = useState<"brief" | "description">("brief");
  const [isRescoring, setIsRescoring] = useState(false);

  if (!job) {
    return (
      <div
        className={`bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-8 flex flex-col items-center justify-center text-center text-[#a6abbd] font-mono text-xs ${className}`}
      >
        SELECT A TARGET FROM THE INBOX TO VIEW INTELLIGENCE ASSESSMENT
      </div>
    );
  }

  const fitScore = job.fitScore;
  const score = fitScore?.score ?? 0;
  const sourceName = normalizeSource(job.source, job.url);
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax, job.currency);

  async function handleRescoreClick() {
    if (!job || !onRescore) return;
    setIsRescoring(true);
    try {
      await onRescore(job.id);
    } finally {
      setIsRescoring(false);
    }
  }

  return (
    <div
      className={`bg-[#15171d] border border-[#2a2e38] rounded-[3px] flex flex-col h-full overflow-hidden ${className}`}
    >
      {/* Top Header Brief */}
      <div className="p-4 sm:p-5 border-b border-[#2a2e38] bg-[#101114] shrink-0">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Metadata eyebrows */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wide text-[#a6abbd] mb-2">
              <span className="text-[#d4a745] font-bold text-sm">{job.company}</span>
              <span>·</span>
              <span className="text-[#f4f2ec]">{sourceName}</span>
              {job.location && (
                <>
                  <span>·</span>
                  <span>{job.location}</span>
                </>
              )}
              {job.remoteStatus && (
                <>
                  <span>·</span>
                  <span className="text-[#8ab384] font-semibold">{job.remoteStatus}</span>
                </>
              )}
              {salary && (
                <>
                  <span>·</span>
                  <span className="text-[#d4a745] font-bold">{salary}</span>
                </>
              )}
            </div>

            {/* Target Title */}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f4f2ec] font-sans">
              {job.title}
            </h1>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Status Change Selector */}
            {onStatusChange && (
              <select
                value={job.status}
                onChange={(e) => onStatusChange(job.id, e.target.value)}
                aria-label="Target status"
                className="px-2.5 py-2 bg-[#1f222a] border border-[#2a2e38] text-xs font-mono font-semibold text-[#f4f2ec] rounded-[2px] focus:outline-none focus:border-[#d4a745] cursor-pointer"
              >
                <option value="DISCOVERED">DISCOVERED</option>
                <option value="SHORTLISTED">SHORTLISTED</option>
                <option value="PREPARED">PREPARED</option>
                <option value="APPLIED">APPLIED</option>
                <option value="SCREENING">SCREENING</option>
                <option value="ASSESSMENT">ASSESSMENT</option>
                <option value="INTERVIEW">INTERVIEW</option>
                <option value="OFFER">OFFER</option>
                <option value="REJECTED">REJECTED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            )}

            {onDeployApplication && (
              <button
                type="button"
                onClick={() => onDeployApplication(job)}
                className="px-4 py-2 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-sans uppercase tracking-wider rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4 stroke-[2]" />
                <span>Deploy Application</span>
              </button>
            )}

            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-xs font-mono font-medium text-[#f4f2ec] rounded-[2px] transition-colors inline-flex items-center gap-1.5"
              >
                <span>Link Out</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#a6abbd]" />
              </a>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(job)}
                title="Edit Target Details"
                aria-label="Edit Target Details"
                className="p-2 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] rounded-[2px] transition-colors cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            {onRescore && (
              <button
                type="button"
                onClick={handleRescoreClick}
                disabled={isRescoring}
                title="Re-run AI evaluation"
                className="p-2 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] rounded-[2px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRescoring ? "animate-spin text-[#d4a745]" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* View mode toggle tabs */}
        <div className="mt-4 flex items-center gap-5 border-t border-[#2a2e38] pt-3 text-xs font-mono uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setActiveTab("brief")}
            className={`pb-1 transition-colors cursor-pointer relative font-semibold ${
              activeTab === "brief"
                ? "text-[#d4a745]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            }`}
          >
            01 · Field Intelligence Brief
            {activeTab === "brief" && (
              <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("description")}
            className={`pb-1 transition-colors cursor-pointer relative font-semibold ${
              activeTab === "description"
                ? "text-[#d4a745]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            }`}
          >
            02 · Target Description
            {activeTab === "description" && (
              <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {activeTab === "brief" ? (
          <>
            {/* Section 1: Evaluation Dimensions (4-up Reticles) */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wide font-semibold text-[#a6abbd] mb-3 flex items-center justify-between">
                <span>Evaluation Dimensions</span>
                <span className="text-[#d4a745] font-bold">Overall Fit: {score}/100</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 bg-[#101114] p-4 border border-[#2a2e38] rounded-[2px]">
                <ReticleGauge
                  score={fitScore?.skillsFit ?? score}
                  label="Skills Fit"
                  weight="35%"
                  size="md"
                />
                <ReticleGauge
                  score={fitScore?.experienceFit ?? score}
                  label="Experience"
                  weight="30%"
                  size="md"
                />
                <ReticleGauge
                  score={fitScore?.domainFit ?? score}
                  label="Domain Fit"
                  weight="20%"
                  size="md"
                />
                <ReticleGauge
                  score={fitScore?.trajectoryFit ?? score}
                  label="Trajectory"
                  weight="15%"
                  size="md"
                />
              </div>
            </div>

            {/* Section 2: AI Fit Synthesis */}
            {fitScore?.reasoning && (
              <div>
                <div className="text-xs font-mono uppercase tracking-wide font-semibold text-[#a6abbd] mb-2">
                  Synthesis & Strategic Assessment
                </div>
                <div className="p-4 bg-[#101114] border border-[#2a2e38] rounded-[2px] text-sm leading-relaxed text-[#f4f2ec] font-sans">
                  {fitScore.reasoning}
                </div>
              </div>
            )}

            {/* Section 3: Signals & Watchpoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Positive Signals */}
              <div className="bg-[#101114] border border-[#2a2e38] border-l-[3px] border-l-[#8ab384] p-4 rounded-[2px]">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[#8ab384] mb-3 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmed Signals & Strengths</span>
                </div>
                {fitScore?.strengths && fitScore.strengths.length > 0 ? (
                  <ul className="space-y-2 text-sm text-[#f4f2ec] font-sans">
                    {fitScore.strengths.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="text-[#8ab384] font-mono font-bold leading-tight">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-[#a6abbd] font-mono">No strengths parsed</div>
                )}
              </div>

              {/* Watchpoints & Gaps */}
              <div className="bg-[#101114] border border-[#2a2e38] border-l-[3px] border-l-[#c4634e] p-4 rounded-[2px]">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[#c4634e] mb-3 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Watchpoints & Vulnerabilities</span>
                </div>
                {fitScore?.gaps && fitScore.gaps.length > 0 ? (
                  <ul className="space-y-2 text-sm text-[#f4f2ec] font-sans">
                    {fitScore.gaps.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="text-[#c4634e] font-mono font-bold leading-tight">!</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-[#a6abbd] font-mono">No critical watchpoints flagged</div>
                )}
              </div>
            </div>

            {/* Section 4: Risk Flags if present */}
            {fitScore?.risks && fitScore.risks.length > 0 && (
              <div className="bg-[#101114] border border-[#c4634e]/50 p-3.5 rounded-[2px] flex items-start gap-3 text-sm text-[#c4634e]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono font-bold uppercase tracking-wider text-xs block mb-1">
                    Direct Risk Factors
                  </span>
                  <ul className="list-disc list-inside space-y-1">
                    {fitScore.risks.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Raw Description Tab */
          <div className="bg-[#101114] border border-[#2a2e38] p-4 rounded-[2px] space-y-3">
            <div className="text-xs font-mono uppercase tracking-wide font-semibold text-[#a6abbd]">
              Raw Target Intelligence Record
            </div>
            <div className="text-sm text-[#f4f2ec] leading-relaxed whitespace-pre-wrap font-sans">
              {job.description || "No full job description stored for this target."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobIntelligenceView;
