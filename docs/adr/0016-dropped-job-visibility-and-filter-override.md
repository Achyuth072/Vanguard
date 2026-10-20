# ADR 0016: Dropped Job Visibility, Ingestion Warning Feedback, and Human-in-the-Loop Filter Override

## Context

Vanguard's ingestion and filtering pipeline executes deterministic filtering (`evaluateDeterministicFilters`) and hybrid/AI fit scoring (`scoreJobFit`) to reject non-viable jobs without burdening the candidate.

However, when a job fails deterministic hard constraints (salary floor, remote restrictions, YOE ceiling, role title/skills mismatches) or receives an `AUTO_IGNORE` recommendation:
1. **Silent Rejection During Ingestion**: `IngestModal` previously displayed an unconditional `"✓ Successfully ingested..."` green message even when the job was marked `status: "FILTERED_OUT"`. The user was misled into believing the job entered their active pipeline.
2. **Invisible in Cockpit**: Active views (`ApplicationTracker`, `VanguardCockpit`) filter out any job where `status === "FILTERED_OUT"` or `status === "IGNORED"`. Dropped jobs completely disappeared from the candidate's view without any trace or notification.
3. **No Recourse for False Rejections**: Parsing heuristics or deterministic rules may occasionally misclassify salary numbers (e.g. hourly vs annual, equity-heavy packages), mistag hybrid vs remote roles, or overly penalize non-standard title conventions. Candidates had no interface to inspect rejection rationale or rescue the job.

## Decision

Implement explicit dropped job visibility, instant ingestion warning feedback with 1-click rescue, and a dedicated Filtered/Dropped view in Vanguard Cockpit:

### 1. Ingestion Warning Feedback & 1-Click Rescue (`IngestModal.tsx`)
- When `ingestJob` returns `status: "FILTERED_OUT"` or recommendation `"IGNORE"`:
  - Do not show the green success checkmark or auto-close the modal immediately.
  - Render a high-visibility amber warning card detailing the exact rejection reasons (`filterResult.reasons` or `fitScore.reasoning`).
  - Provide an inline **"Rescue & Move to Priority Inbox"** button that immediately overrides the filter, transitioning the job to `SHORTLISTED` status.

### 2. Dedicated Filtered / Dropped Jobs Telemetry Tab (`TelemetryStrip.tsx` & `VanguardCockpit.tsx`)
- Add a new tab in `TelemetryStrip`: `06 · Filtered Out` displaying the count of `FILTERED_OUT` and `IGNORED` jobs.
- When selected, `VanguardCockpit` displays the list of dropped jobs with:
  - Failure reasons breakdown badges (e.g., `Salary below minimum`, `Role title mismatch`).
  - Fit score details (if scored before rejection).
  - An **"Override / Rescue"** button on each card/row.

### 3. Human-in-the-Loop Filter Override Server Action (`app/actions.ts` & `lib/lifecycle/service.ts`)
- Implement `overrideJobFilterAction(jobId: string, targetStatus?: "SHORTLISTED" | "REVIEW")`.
- Updates the job status to `SHORTLISTED` (or `REVIEW`).
- Appends an immutable audit event (`eventType: "FILTER_OVERRIDDEN"`) with the prior filter reasons and candidate override intent.
- Feeds into `FeedbackLoopService` to ensure future scoring calibrations account for false positive rejections.

## Consequences

- **Transparency & Trust**: Candidates are never left wondering why a submitted or scraped job failed to appear in their Priority Inbox.
- **Human-in-the-Loop Authority**: Invariants are preserved—the system automates filtering, but the candidate maintains ultimate veto power over rejection decisions.
- **Feedback Loop Quality**: Explicit override events provide concrete ground-truth training signals for adjusting deterministic thresholds and scoring weights.
