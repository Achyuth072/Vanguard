export const APPLICATION_STATUSES = [
  "DRAFT",
  "SHORTLISTED",
  "PREPARED",
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "GHOSTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const REJECTION_STAGES = [
  "RESUME_SCREEN",
  "ASSESSMENT",
  "PHONE_SCREEN",
  "TECHNICAL_INTERVIEW",
  "FINAL_ROUND",
  "OFFER_STAGE",
  "POSITION_CANCELLED",
] as const;

export type RejectionStage = (typeof REJECTION_STAGES)[number];

export const REJECTION_REASONS = [
  "SKILLS_GAP",
  "EXPERIENCE_MISMATCH",
  "LOCATION_POLICY",
  "COMPENSATION_MISMATCH",
  "VISA_RESTRICTION",
  "CANDIDATE_WITHDREW",
  "UNKNOWN",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export interface TransitionOptions {
  rejectionStage?: RejectionStage | string;
  rejectionReason?: RejectionReason | string;
  note?: string;
  appliedAt?: Date;
  firstResponseAt?: Date;
  metadata?: Record<string, unknown>;
  force?: boolean;
}

export interface TransitionResult {
  jobId: string;
  previousStatus: string;
  newStatus: string;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  responseTimeDays: number | null;
  rejectionStage: string | null;
  rejectionReason: string | null;
}
