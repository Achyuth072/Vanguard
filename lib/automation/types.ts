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
