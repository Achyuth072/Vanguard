"use client";

import React, { useState, useMemo } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobStatusAction, autoGhostStaleApplicationsAction } from "../actions";
import { calculateDaysSinceApplied, identifyGhostableJobs } from "@/lib/lifecycle/auto-ghost";
import DraftButton from "./DraftButton";
import EditJobModal from "./EditJobModal";
import { Button } from "@/components/ui/button";
import { getSourceBadgeStyle } from "@/lib/utils/source";
import { compareJobsByScore, compareJobsByRecent } from "@/lib/utils/sorting";
import {
  Ghost,
  Archive,
  RotateCcw,
  Sparkles,
  Edit2,
  Clock,
  MapPin,
  Building2,
  AlertTriangle,
  ArrowUpDown,
  GripVertical,
} from "lucide-react";

export interface ApplicationTrackerProps {
  jobs: EnrichedJob[];
  onStatusUpdated?: () => void;
  onOpenPreparation?: (job: EnrichedJob) => void;
}

interface PipelineStage {
  id: string;
  code: string;
  label: string;
  accentColor: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { id: "SHORTLISTED", code: "01", label: "Shortlisted", accentColor: "#d4a745" },
  { id: "PREPARED", code: "02", label: "Prepared", accentColor: "#d4a745" },
  { id: "APPLIED", code: "03", label: "Applied", accentColor: "#d4a745" },
  { id: "SCREENING", code: "04", label: "Screening", accentColor: "#8ab384" },
  { id: "ASSESSMENT", code: "05", label: "Take-home / OA", accentColor: "#8ab384" },
  { id: "INTERVIEW", code: "06", label: "Interview", accentColor: "#8ab384" },
  { id: "OFFER", code: "07", label: "Offer", accentColor: "#8ab384" },
  { id: "REJECTED", code: "08", label: "Rejected", accentColor: "#c4634e" },
  { id: "GHOSTED", code: "09", label: "Ghosted", accentColor: "#a6abbd" },
];

const ARCHIVED_STAGE: PipelineStage = {
  id: "ARCHIVED",
  code: "10",
  label: "Archived",
  accentColor: "#797f94",
};

export default function ApplicationTracker({
  jobs,
  onStatusUpdated,
  onOpenPreparation,
}: ApplicationTrackerProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [selectedEditJob, setSelectedEditJob] = useState<EnrichedJob | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [isAutoGhosting, setIsAutoGhosting] = useState(false);
  const [sortMode, setSortMode] = useState<"score" | "recent">("score");
  const [isPanning, setIsPanning] = useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);
  const panStartRef = React.useRef<{ startX: number; scrollLeft: number } | null>(null);

  // Global mouse up to clean up panning outside rail
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (panStartRef.current) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Normalize status for grouping (handles INTERVIEW / INTERVIEWING, ASSESSMENT / TAKE_HOME)
  const normalizeStatus = (status: string) => {
    const s = status.toUpperCase();
    if (s === "INTERVIEWING") return "INTERVIEW";
    if (s === "TAKE_HOME" || s === "TAKE_HOME_OA" || s === "OA") return "ASSESSMENT";
    return s;
  };

  const archivedCount = useMemo(
    () => jobs.filter((j) => normalizeStatus(j.status) === "ARCHIVED").length,
    [jobs]
  );

  const displayedStages = useMemo(
    () => (showArchived ? [...PIPELINE_STAGES, ARCHIVED_STAGE] : PIPELINE_STAGES),
    [showArchived]
  );

  const pipelineJobs = useMemo(() => {
    return jobs.filter((job) => {
      const s = normalizeStatus(job.status);
      if (s === "IGNORED" || s === "FILTERED_OUT") return false;
      if (s === "ARCHIVED") return showArchived;
      return PIPELINE_STAGES.some((stage) => stage.id === s) || job.application !== null;
    });
  }, [jobs, showArchived]);

  const sortedPipelineJobs = useMemo(() => {
    const list = [...pipelineJobs];
    if (sortMode === "score") {
      return list.sort(compareJobsByScore);
    }
    return list.sort(compareJobsByRecent);
  }, [pipelineJobs, sortMode]);

  const ghostableList = useMemo(() => identifyGhostableJobs(pipelineJobs, 21), [pipelineJobs]);
  const staleList = useMemo(() => identifyGhostableJobs(pipelineJobs, 14), [pipelineJobs]);

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

  function handleDragStart(e: React.DragEvent<HTMLElement>, jobId: string) {
    setIsPanning(false);
    panStartRef.current = null;
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedJobId(jobId);

    // Set drag preview to the card element for crisp visual feedback
    const cardElem = (e.currentTarget as HTMLElement).closest("[data-card-id]") as HTMLElement;
    if (cardElem && e.dataTransfer.setDragImage) {
      const rect = cardElem.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardElem, Math.min(e.clientX - rect.left, 24), Math.min(e.clientY - rect.top, 24));
    }
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

  // Edge auto-scroll during drag and drop
  const handleRailDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!railRef.current || !draggedJobId) return;
    const rect = railRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const threshold = 90;
    const scrollSpeed = 16;

    if (x < threshold) {
      railRef.current.scrollLeft -= scrollSpeed;
    } else if (x > rect.width - threshold) {
      railRef.current.scrollLeft += scrollSpeed;
    }
  };

  // Mouse hold-and-drag horizontal canvas panning handlers
  const handleRailMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Do not initiate pan if user clicked an interactive control or a draggable card
    const isInteractive = target.closest("button, select, input, textarea, a, option, [role='button']");
    const isDraggableCard = target.closest('[draggable="true"]');
    if (isInteractive || isDraggableCard) {
      return;
    }

    if (railRef.current) {
      panStartRef.current = {
        startX: e.pageX - railRef.current.offsetLeft,
        scrollLeft: railRef.current.scrollLeft,
      };
      setIsPanning(true);
    }
  };

  const handleRailMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current || !railRef.current || draggedJobId) {
      return;
    }
    e.preventDefault();
    const x = e.pageX - railRef.current.offsetLeft;
    const walk = (x - panStartRef.current.startX) * 1.2;
    railRef.current.scrollLeft = panStartRef.current.scrollLeft - walk;
  };

  const handleRailMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const handleRailWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const isInsideVerticalScroll = target?.closest(".overflow-y-auto");
    if (!isInsideVerticalScroll && e.deltaY !== 0 && e.deltaX === 0 && railRef.current) {
      railRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="space-y-3 flex flex-col h-full min-h-0 select-none">
      {/* Tactical Sub-Header & Bulk Action Strip */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0e12] p-2.5 rounded-[3px] border border-[#2a2e38]">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[#f4f2ec] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#d4a745] inline-block animate-pulse" />
            <span>ACTIVE PIPELINE TRACK</span>
          </div>
          <span className="text-[#2a2e38]">|</span>
          <div className="text-[#a6abbd] font-mono text-[11px] flex items-center gap-2">
            <span>
              TRACKED:{" "}
              <strong className="text-[#f4f2ec] tabular-nums font-bold">
                {pipelineJobs.filter((j) => normalizeStatus(j.status) !== "ARCHIVED").length}
              </strong>
            </span>
            {ghostableList.length > 0 && (
              <span className="text-[#c4634e] flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 inline" />
                {ghostableList.length} GHOST CANDIDATES (&gt;21D)
              </span>
            )}
            {archivedCount > 0 && (
              <span className="text-[#797f94]">
                ARCHIVED: <strong className="text-[#a6abbd] tabular-nums">{archivedCount}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pipeline Sort Control (Score by default, Date toggle option) */}
          <button
            type="button"
            onClick={() => setSortMode((prev) => (prev === "score" ? "recent" : "score"))}
            className="h-7 px-2.5 rounded-[2px] text-xs font-mono border border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] hover:border-[#3d4352] text-[#f4f2ec] transition-colors cursor-pointer flex items-center gap-1.5"
            title={`Currently sorted by ${sortMode === "score" ? "Fit Score (Descending)" : "Most Recent Date"}. Click to toggle.`}
            aria-label={`Sort pipeline by ${sortMode === "score" ? "Date" : "Score"}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#d4a745]" />
            <span className="text-[#a6abbd] font-normal">SORT:</span>
            <span className="font-bold text-[#f4f2ec] uppercase">
              {sortMode === "score" ? "SCORE" : "DATE"}
            </span>
          </button>

          {ghostableList.length > 0 && (
            <button
              type="button"
              onClick={handleAutoGhostAll}
              disabled={isAutoGhosting}
              className="h-7 px-2.5 text-xs font-mono font-semibold text-[#f4f2ec] border border-[#c4634e]/60 bg-[#c4634e]/20 hover:bg-[#c4634e]/30 rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Automatically transition applications pending >21 days without updates to GHOSTED"
            >
              <Ghost className="w-3.5 h-3.5 text-[#c4634e]" />
              <span>{isAutoGhosting ? "Ghosting..." : `Auto-Ghost Stale (${ghostableList.length})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`h-7 px-2.5 rounded-[2px] text-xs font-mono border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showArchived
                ? "bg-[#1f222a] border-[#3d4352] text-[#f4f2ec]"
                : "bg-[#0d0e12] border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] hover:border-[#3d4352]"
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-[#797f94]" />
            <span>{showArchived ? "Hide Archived" : `Show Archived (${archivedCount})`}</span>
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Kanban Rail with Tactical Scrollbar & Mouse Drag-to-Pan */}
      <div
        ref={railRef}
        onMouseDown={handleRailMouseDown}
        onMouseMove={handleRailMouseMove}
        onMouseUp={handleRailMouseUp}
        onWheel={handleRailWheel}
        onDragOver={handleRailDragOver}
        className={`flex gap-3 overflow-x-auto pb-3 pt-1 flex-1 min-h-0 ${
          isPanning ? "cursor-grabbing select-none" : "cursor-grab snap-x"
        }`}
      >
        {displayedStages.map((stage) => {
          const stageJobs = sortedPipelineJobs.filter((j) => normalizeStatus(j.status) === stage.id);
          const isTargeted = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                handleDragOver(e, stage.id);
                handleRailDragOver(e);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`w-72 min-w-[288px] max-w-[288px] shrink-0 snap-start bg-[#15171d] border rounded-[3px] p-2.5 flex flex-col h-full min-h-0 transition-all ${
                isTargeted
                  ? "border-2 border-dashed border-[#d4a745] bg-[#1f222a]/60 shadow-[0_0_15px_rgba(212,167,69,0.15)]"
                  : "border-[#2a2e38]"
              }`}
            >
              {/* Column Header: 12px monospace stage code, stage candidate count badge, clean hairline border */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#2a2e38] shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-xs font-bold tracking-wider"
                    style={{ color: stage.accentColor }}
                  >
                    {stage.code} // {stage.label.toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#f4f2ec] font-bold bg-[#0d0e12] px-2 py-0.5 rounded-[2px] border border-[#2a2e38] tabular-nums">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {stageJobs.length === 0 ? (
                  <div
                    className={`h-28 flex flex-col items-center justify-center text-xs font-mono italic border border-dashed rounded-[2px] transition-colors ${
                      isTargeted
                        ? "border-[#d4a745] text-[#d4a745] bg-[#0d0e12]/60"
                        : "border-[#2a2e38] text-[#797f94]"
                    }`}
                  >
                    <span>{isTargeted ? "Drop candidate here" : "Stage Empty"}</span>
                  </div>
                ) : (
                  stageJobs.map((job) => {
                    const isUpdating = updatingId === job.id;
                    const isDragging = draggedJobId === job.id;
                    const score = job.fitScore?.score;

                    const daysApplied = job.application?.appliedAt
                      ? calculateDaysSinceApplied(job.application.appliedAt)
                      : null;
                    const isAppliedStatus = normalizeStatus(job.status) === "APPLIED";
                    const isGhostable = isAppliedStatus && daysApplied !== null && daysApplied >= 21;
                    const isStale = isAppliedStatus && daysApplied !== null && daysApplied >= 14 && daysApplied < 21;

                    return (
                      <div
                        key={job.id}
                        data-card-id={job.id}
                        className={`bg-[#0d0e12] border rounded-[3px] p-2.5 space-y-2 transition-all text-xs group ${
                          isDragging
                            ? "opacity-30 border-[#d4a745] bg-[#1f222a]"
                            : isUpdating
                            ? "opacity-50 pointer-events-none border-[#2a2e38]"
                            : "border-[#2a2e38] hover:border-[#3d4352] hover:bg-[#15171d]/90 shadow-sm"
                        }`}
                      >
                        {/* Card Header: Drag Grip Handle, Title & Score Anchor Box */}
                        <div className="flex items-start gap-1.5 justify-between">
                          <div
                            draggable={!isUpdating}
                            onDragStart={(e) => handleDragStart(e, job.id)}
                            onDragEnd={handleDragEnd}
                            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-[#797f94] hover:text-[#d4a745] transition-colors rounded-[2px] hover:bg-[#1f222a] shrink-0"
                            title="Drag handle to move candidate across pipeline stages"
                            aria-label={`Drag handle for ${job.title}`}
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <h3 className="font-sans font-bold text-[#f4f2ec] text-xs leading-snug line-clamp-2 group-hover:text-[#d4a745] transition-colors">
                              {job.title}
                            </h3>
                          </div>
                          {score !== undefined && score !== null && (
                            <div
                              className={`w-9 h-7 rounded-[2px] flex items-center justify-center font-mono font-bold text-xs tabular-nums border shrink-0 ${
                                score >= 80
                                  ? "bg-[#d4a745]/15 text-[#d4a745] border-[#d4a745]/40"
                                  : score >= 60
                                  ? "bg-[#8ab384]/15 text-[#8ab384] border-[#8ab384]/40"
                                  : "bg-[#c4634e]/15 text-[#c4634e] border-[#c4634e]/40"
                              }`}
                            >
                              {score}
                            </div>
                          )}
                        </div>

                        {/* Middle-dot Metadata: Company · Location · Source */}
                        <div className="flex items-center flex-wrap gap-1 text-[11px] text-[#a6abbd] font-mono leading-tight">
                          <span className="text-[#f4f2ec] font-semibold truncate max-w-[130px]">
                            {job.company}
                          </span>
                          {job.location && (
                            <>
                              <span className="text-[#797f94]">·</span>
                              <span className="text-[#797f94] truncate max-w-[100px] flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 inline shrink-0" />
                                {job.location}
                              </span>
                            </>
                          )}
                          {job.source && (
                            <>
                              <span className="text-[#797f94]">·</span>
                              {(() => {
                                const sourceInfo = getSourceBadgeStyle(job.source);
                                return (
                                  <span className={`inline-flex items-center gap-1 px-1 py-0.2 rounded-[2px] text-[9px] font-semibold border shrink-0 ${sourceInfo.colorClass}`}>
                                    <span className={`w-1 h-1 rounded-full ${sourceInfo.dotColorClass}`} />
                                    <span>{sourceInfo.label}</span>
                                  </span>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        {/* Days Since Applied & Application Telemetry Chips */}
                        {job.application?.appliedAt && (
                          <div className="flex items-center justify-between gap-1 text-[10px] font-mono bg-[#15171d] p-1.5 rounded-[2px] border border-[#2a2e38]">
                            <span className="text-[#797f94] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span className="tabular-nums">
                                {new Date(job.application.appliedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </span>
                            {daysApplied !== null && (
                              <span
                                className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold border tabular-nums ${
                                  isGhostable
                                    ? "bg-[#c4634e]/20 text-[#c4634e] border-[#c4634e]/50"
                                    : isStale
                                    ? "bg-[#d4a745]/20 text-[#d4a745] border-[#d4a745]/50"
                                    : "bg-[#1f222a] text-[#a6abbd] border-[#2a2e38]"
                                }`}
                              >
                                {isGhostable ? `👻 ${daysApplied}d Ghosted?` : isStale ? `⏳ ${daysApplied}d Pending` : `${daysApplied}d ago`}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Badges: Response Time & Rejection */}
                        <div className="flex flex-wrap gap-1.5">
                          {job.application?.responseTimeDays !== null && job.application?.responseTimeDays !== undefined && (
                            <span className="bg-[#1f222a] text-[#d4a745] border border-[#2a2e38] text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-[2px]">
                              ⚡ {job.application.responseTimeDays}d response
                            </span>
                          )}

                          {job.application?.rejectionStage && (
                            <span className="bg-[#c4634e]/15 text-[#c4634e] border border-[#c4634e]/40 text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] truncate">
                              🛑 {job.application.rejectionStage.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>

                        {/* Tactical Action Bar & Accessible Keyboard Stage Selector */}
                        <div className="pt-2 border-t border-[#2a2e38] space-y-1.5">
                          {normalizeStatus(job.status) === "ARCHIVED" && (
                            <button
                              type="button"
                              onClick={() => handleMoveStage(job.id, "DISCOVERED")}
                              disabled={isUpdating}
                              className="w-full h-6 text-[10px] font-mono font-semibold text-[#8ab384] border border-[#8ab384]/40 bg-[#8ab384]/15 hover:bg-[#8ab384]/25 rounded-[2px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restore to Discovered Inbox</span>
                            </button>
                          )}

                          {normalizeStatus(job.status) === "APPLIED" && isGhostable && (
                            <button
                              type="button"
                              onClick={() => handleMoveStage(job.id, "GHOSTED")}
                              disabled={isUpdating}
                              className="w-full h-6 text-[10px] font-mono font-semibold text-[#c4634e] border border-[#c4634e]/50 bg-[#c4634e]/20 hover:bg-[#c4634e]/30 rounded-[2px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                            >
                              <Ghost className="w-3 h-3 text-[#c4634e]" />
                              <span>Mark Ghosted (&gt;3 wks)</span>
                            </button>
                          )}

                          {/* Accessible Keyboard Stage Changer */}
                          <div className="flex items-center gap-1.5">
                            <select
                              value={normalizeStatus(job.status)}
                              onChange={(e) => handleMoveStage(job.id, e.target.value)}
                              aria-label={`Move stage for ${job.title} at ${job.company}`}
                              className="flex-1 bg-[#15171d] border border-[#2a2e38] text-[#f4f2ec] text-[10px] font-mono rounded-[2px] px-2 py-1 outline-none cursor-pointer hover:border-[#3d4352] focus-visible:border-[#d4a745] focus-visible:ring-1 focus-visible:ring-[#d4a745] transition-colors"
                            >
                              <option value="DISCOVERED">Move: Discovered Inbox</option>
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Stage: {s.code} // {s.label}
                                </option>
                              ))}
                              <option value="ARCHIVED">Stage: 10 // Archived</option>
                            </select>

                            {onOpenPreparation && (
                              <button
                                type="button"
                                onClick={() => onOpenPreparation(job)}
                                className="h-6 w-6 rounded-[2px] text-[#d4a745] bg-[#1f222a] hover:bg-[#d4a745]/20 border border-[#2a2e38] hover:border-[#d4a745] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                                title="Deploy Application Dossier & Tailor Resume"
                                aria-label={`Prepare application for ${job.title}`}
                              >
                                <Sparkles className="w-3 h-3 text-[#d4a745]" />
                              </button>
                            )}
                          </div>

                          {/* Bottom controls: Edit Job Modal trigger & Draft Button */}
                          <div className="flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEditJob(job);
                                setIsEditModalOpen(true);
                              }}
                              className="h-6 w-6 rounded-[2px] text-[#a6abbd] hover:text-[#f4f2ec] bg-[#15171d] hover:bg-[#1f222a] border border-[#2a2e38] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                              title="Edit Job Details"
                              aria-label={`Edit ${job.title} details`}
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
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
