# ADR 0014: Application Lifecycle State Machine and Auto-Ghosting Engine

## Context

Job applications frequently stall without explicit rejection emails from recruiters. Leaving silent applications perpetually in `APPLIED` or `SCREENING` stages distorts response rate analytics, clutters the Kanban pipeline, and prevents accurate feedback loop calibration (ADR 0008).

## Decision

Implement an **Application Lifecycle Service and Auto-Ghosting Engine** in `lib/lifecycle/`:

1. **Explicit Lifecycle States**:
   - `DRAFT` &rarr; `SHORTLISTED` &rarr; `APPLYING` &rarr; `APPLIED` &rarr; `SCREENING` &rarr; `INTERVIEW` &rarr; `OFFER`.
   - Terminal negative states: `REJECTED`, `WITHDRAWN`, `GHOSTED`.

2. **Automated Aging & Ghosting Rules (`auto-ghost.ts`)**:
   - `calculateDaysSinceApplied`: Computes elapsed calendar days between `appliedAt` timestamp and current date.
   - **Stale Threshold (14 days)**: An application in `APPLIED` stage without `firstResponseAt` is flagged as stale (`isApplicationStale = true`) for candidate visual attention.
   - **Ghost Threshold (21 days)**: Applications remaining in `APPLIED` or `SCREENING` after 21 calendar days without response qualify for auto-ghosting (`isApplicationGhosted = true`).
   - `runAutoGhostCheck`: Background batch service that identifies all silent jobs past threshold and transitions them to `GHOSTED` with an immutable `APPLICATION_AUTO_GHOSTED` event log entry.

3. **Response Time Tracking**:
   - When an application transitions to `SCREENING`, `INTERVIEW`, or `REJECTED`, the system records `firstResponseAt` and computes `responseTimeDays = (firstResponseAt - appliedAt) / 86400000`.

## Consequences

- Pipeline remains clean and actionable without manual cleanup of forgotten applications.
- Response rate and turnaround analytics reflect true recruiter engagement timelines.
- Ghosted applications correctly feed negative signal into the scoring feedback loop (ADR 0008) to improve future recommendations.
