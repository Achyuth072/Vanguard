import type { BrowserContext } from "playwright";

export interface FormFieldOption {
  value: string;
  label: string;
  selector?: string;
}

export interface NormalizedFormField {
  id: string;
  selector: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "file"
    | "textarea"
    | "select"
    | "radio"
    | "checkbox"
    | "combobox"
    | "hidden"
    | "other";
  required: boolean;
  options?: FormFieldOption[];
  name?: string;
  autocomplete?: string;
  placeholder?: string;
  testId?: string;
  value?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export interface CandidateDemographics {
  gender?: string;
  genderGreenhouse?: string;
  genderLever?: string;
  genderAshby?: string;
  race?: string;
  raceGreenhouse?: string;
  raceLever?: string;
  raceAshby?: string;
  veteranStatus?: string;
  veteranGreenhouse?: string;
  veteranLever?: string;
  veteranAshby?: string;
  disabilityStatus?: string;
  disabilityGreenhouse?: string;
  disabilityLever?: string;
  disabilityAshby?: string;
}

export interface CandidateWorkAuthorization {
  authorizedInUS?: boolean;
  requiresSponsorship?: boolean;
}

export interface CandidateSocialLinks {
  linkedIn?: string;
  gitHub?: string;
  portfolio?: string;
  other?: string;
  [key: string]: string | undefined;
}

export interface FormCandidateProfile {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  currentCompany?: string;
  currentTitle?: string;
  links?: CandidateSocialLinks;
  workAuthorization?: CandidateWorkAuthorization;
  demographics?: CandidateDemographics;
  resumePath?: string;
}

export interface TailoredAnswerPattern {
  questionPattern: string;
  answer: string;
}

export interface CandidateProfilePayload {
  profile: FormCandidateProfile;
  tailoredAnswers?: TailoredAnswerPattern[];
}

export type MappingTier = 1 | 2;

export type MatchType =
  | "autocomplete"
  | "platform-attribute"
  | "label-regex"
  | "test-id"
  | "llm-semantic";

export type FormActionType = "fill" | "check" | "select" | "upload";

export interface FormFieldMapping {
  field: string;
  selector: string;
  tier: MappingTier;
  matchType: MatchType;
  value?: string;
  expectedValue?: string;
  action?: FormActionType;
  expectedAction?: FormActionType;
  confidence: number;
  expectedAnswerCategory?: string;
}

export interface FormMappingOutcome {
  platform?: "greenhouse" | "lever" | "ashby" | "unknown";
  formSelector?: string;
  mappedFields: FormFieldMapping[];
  unmappedFields: NormalizedFormField[];
  tier1Count: number;
  tier2Count: number;
  totalInteractiveFields: number;
  overallConfidence: number;
}

export interface FormMapperOptions {
  platformHint?: "greenhouse" | "lever" | "ashby" | "unknown";
  synthesizeCustomAnswers?: boolean;
}

export type RunnerState =
  | "STARTING_BROWSER"
  | "NAVIGATING"
  | "SCANNING_DOM"
  | "FILLING_FIELDS"
  | "HIGHLIGHTING_INSPECTION"
  | "AWAITING_HUMAN_REVIEW"
  | "BOT_CHECK_PAUSED"
  | "SUBMITTED"
  | "ERROR";

export type BrowserConnectionMode = "cdp" | "persistent";
export type RunnerConnectionMode = BrowserConnectionMode | "provided";

export interface RunnerProgressEvent {
  jobId?: string;
  state: RunnerState;
  step: number;
  totalSteps?: number;
  message: string;
  timestamp: string;
  payload?: {
    url?: string;
    platform?: string;
    filledCount?: number;
    totalFields?: number;
    unmappedCount?: number;
    error?: string;
    field?: string;
    mappedFields?: FormFieldMapping[];
    unmappedFields?: NormalizedFormField[];
    submissionDetected?: boolean;
    submissionUrl?: string;
    botCheckDetected?: boolean;
    connectionMode?: RunnerConnectionMode;
    cdpEndpoint?: string;
    fallbackReason?: string;
    [key: string]: unknown;
  };
}

export interface FieldFillResult {
  field: string;
  selector: string;
  status: "filled" | "skipped" | "error";
  tier: MappingTier;
  action?: FormActionType;
  value?: string;
  error?: string;
}

export interface BrowserRunnerOptions {
  jobId?: string;
  url: string;
  candidateData: CandidateProfilePayload;
  userDataDir?: string;
  /**
   * Chrome DevTools Protocol endpoint of an already-running host Chrome
   * instance (e.g. `http://host.docker.internal:9222`). Defaults to the
   * `PLAYWRIGHT_CDP_ENDPOINT` environment variable when omitted.
   */
  cdpEndpoint?: string;
  channel?: string;
  headless?: boolean;
  slowMo?: number;
  humanTypingDelay?: number;
  viewport?: { width: number; height: number };
  timeout?: number;
  resumePath?: string;
  onProgress?: (event: RunnerProgressEvent) => void;
  browserContext?: BrowserContext;
  skipInspectionHighlight?: boolean;
  skipScrollToReview?: boolean;
  autoMarkApplied?: boolean;
  onSubmitted?: (details: { jobId?: string; url: string; timestamp: string }) => Promise<void> | void;
  waitForSubmissionTimeout?: number;
}

export interface BrowserRunnerOutcome {
  jobId?: string;
  url: string;
  platform?: "greenhouse" | "lever" | "ashby" | "unknown";
  status: "awaiting_review" | "submitted" | "error";
  filledFields: FieldFillResult[];
  unmappedFields: NormalizedFormField[];
  totalFields: number;
  resumesUploaded: number;
  submissionDetected?: boolean;
  error?: string;
}

export interface InspectionHighlightColors {
  green: string;
  amber: string;
  red: string;
}

