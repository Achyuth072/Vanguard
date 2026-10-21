export interface PipelineStage {
  id: string;
  code: string;
  label: string;
  accentColor: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
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

export const ARCHIVED_STAGE: PipelineStage = {
  id: "ARCHIVED",
  code: "10",
  label: "Archived",
  accentColor: "#797f94",
};

export function normalizePipelineStatus(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "INTERVIEWING") return "INTERVIEW";
  if (normalized === "TAKE_HOME" || normalized === "TAKE_HOME_OA" || normalized === "OA") {
    return "ASSESSMENT";
  }
  return normalized;
}

export function resolvePipelineStages(showArchived: boolean): PipelineStage[] {
  return showArchived ? [...PIPELINE_STAGES, ARCHIVED_STAGE] : PIPELINE_STAGES;
}

export function isKnownPipelineStage(stageId: string): boolean {
  return stageId === ARCHIVED_STAGE.id || PIPELINE_STAGES.some((stage) => stage.id === stageId);
}

export interface StageSelection {
  activeStageId: string;
  showArchived: boolean;
}

export function resolveStageSelection(
  showArchived: boolean,
  requestedStageId: string
): StageSelection | null {
  if (!isKnownPipelineStage(requestedStageId)) return null;
  return {
    activeStageId: requestedStageId,
    showArchived: showArchived || requestedStageId === ARCHIVED_STAGE.id,
  };
}

export interface PipelineStageEvent {
  name: string;
  detail?: Record<string, unknown>;
}

export function buildStageFilterEvents(stageId: string): PipelineStageEvent[] {
  return [
    { name: "set-cockpit-filter", detail: { tab: "pipeline" } },
    { name: "set-pipeline-stage", detail: { stageId } },
  ];
}
