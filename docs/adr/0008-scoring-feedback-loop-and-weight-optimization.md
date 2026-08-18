# ADR 0008: Scoring Optimization and Outcome Feedback Loop Model

## Context

Pulse's Priority Inbox relies on semantic FitScore evaluation to triage and rank incoming job postings. In earlier phases, FitScore was generated as a single composite score (0–100) using a static prompt rubric. However, real-world job search outcomes (`APPLIED` → `SCREENING` → `INTERVIEW` → `OFFER` vs `REJECTED` / `GHOSTED`) produce rich conversion signals about which attributes of a job listing actually result in candidate traction.

To establish a closed feedback loop that sharpens future job recommendations without inflating LLM API costs or causing erratic score swings, we must resolve:
1. **Outcome Data Schema**: What granular transition attributes, stages, and rejection reasons must be captured across application lifecycles.
2. **Scoring Optimization Architecture**: How outcome signals feed back into scoring—whether via mathematical weight calibration, dynamic LLM prompt context injection, or a hybrid model.
3. **Sample Size & Cold-Start Guardrails**: How to prevent high-variance early outcomes from over-fitting or degrading recommendations.

## Decision

Pulse adopts a **Hybrid Decomposed Scoring & Calibrated Weight Feedback Architecture** combining four-dimensional structured FitScore evaluations, bounded Bayesian weight adjustment, and periodic high-signal conversion prompt annotations.

### 1. Granular Outcome & Application Lifecycle Schema

The `Application` and `Event` models are expanded to record precise lifecycle transitions:

- **Application Statuses**: `DRAFT`, `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, `GHOSTED`.
- **Rejection Stages**:
  - `RESUME_SCREEN`: Rejected prior to human recruiter or hiring manager contact (signals keyword/domain/seniority mismatch).
  - `ASSESSMENT`: Rejected after online technical assessment or take-home challenge.
  - `PHONE_SCREEN`: Rejected after initial recruiter/HR conversation.
  - `TECHNICAL_INTERVIEW`: Rejected after live technical / portfolio rounds.
  - `FINAL_ROUND`: Rejected after executive/panel round.
  - `OFFER_STAGE`: Candidate or employer declined at compensation/offer negotiation.
  - `POSITION_CANCELLED`: Role frozen or closed without candidate evaluation.
- **Rejection Reasons**: `SKILLS_GAP`, `EXPERIENCE_MISMATCH`, `LOCATION_POLICY`, `COMPENSATION_MISMATCH`, `VISA_RESTRICTION`, `CANDIDATE_WITHDREW`, `UNKNOWN`.
- **Response Metrics**:
  - `appliedAt`: Timestamp of submission.
  - `firstResponseAt`: Timestamp of first recruiter outreach or rejection notice.
  - `responseTimeDays`: Computed latency between submission and first response.

### 2. Decomposed FitScore Dimensions

Instead of a single monolithic score, `FitScore` evaluates four orthogonal sub-dimensions:

1. **`skillsFit` (0–100)**: Alignment between verified candidate technical/soft skills and mandatory job requirements.
2. **`experienceFit` (0–100)**: Alignment of seniority, years of relevant experience, and scope of past responsibilities.
3. **`domainFit` (0–100)**: Industry vertical alignment (e.g. Fintech, Healthcare, Developer Tools, E-Commerce).
4. **`trajectoryFit` (0–100)**: Growth suitability (e.g. natural career step vs lateral vs overqualified).

**Composite Score Calculation**:
$$\text{FitScore} = w_{\text{skills}} \cdot \text{skillsFit} + w_{\text{exp}} \cdot \text{experienceFit} + w_{\text{domain}} \cdot \text{domainFit} + w_{\text{traj}} \cdot \text{trajectoryFit}$$

**Default Baseline Weights**:
- $w_{\text{skills}} = 0.35$
- $w_{\text{exp}} = 0.30$
- $w_{\text{domain}} = 0.20$
- $w_{\text{traj}} = 0.15$
- Invariant: $\sum w_i = 1.0$, with hard bounds $0.10 \le w_i \le 0.50$.

### 3. Feedback Loop & Optimization Mechanics

#### A. Mathematical Weight Drift (Deterministic & Zero-Cost)
When an application reaches a terminal or positive milestone (`INTERVIEW` / `OFFER` as positive; `RESUME_SCREEN` rejection as negative):
- Each dimension $i$ calculates its conversion delta:
  $$\Delta_i = \text{SubScore}_i - \text{BaselineScore}$$
- Weights adjust via regularized Bayesian drift:
  - If jobs with high `domainFit` consistently convert to `INTERVIEW` while low `domainFit` jobs fail at `RESUME_SCREEN`, $w_{\text{domain}}$ increases incrementally.
  - Weight updates are clamped to a maximum step change of $\pm 0.03$ per batch update to prevent oscillation.

#### B. Cold-Start & Sample Size Thresholds
- **Phase 0 ($N < 10$ terminal outcomes)**: Static baseline weights. No automated adjustment.
- **Phase 1 ($10 \le N < 25$ terminal outcomes)**: Conservative damping factor ($\lambda = 0.2$). Suggestions displayed in UI for candidate confirmation before applying.
- **Phase 2 ($N \ge 25$ terminal outcomes)**: Automated calibration enabled with continuous bounding and manual reset option in Settings.

#### C. System Prompt Signal Ingestion (Qualitative Context)
When statistically significant clustering is detected across $\ge 15$ applications (e.g. 80%+ interview rate in "B2B SaaS / TypeScript", 0% in "Hardware / Embedded"):
- The scoring engine injects a compact 2-line "Calibrated Conversion Signals" block into the LLM system prompt for `scoreJobFit`:
  ```
  CALIBRATED CONVERSION INSIGHTS:
  - Candidate demonstrates strong market conversion in: B2B SaaS, TypeScript, Distributed Systems.
  - Low conversion / recurring resume screen drop-off in: Embedded firmware, Monolithic Java enterprise.
  ```
- This guides the LLM's qualitative `reasoning`, `strengths`, and `gaps` extraction without polluting token limits.

### 4. Transparency & Candidate Control

- **Explainable Weight Breakdown**: Candidate can view current scoring weights and historical evolution in the Settings/Analytics view.
- **Manual Lock & Reset**: Candidate can pin specific weights or reset to system defaults at any time.

## Consequences

- Objective, mathematically grounded ranking optimization that improves with usage.
- Zero extra LLM API calls or overhead; sub-score weighting and drift are computed locally in SQLite / Node.js.
- Clean separation between qualitative reasoning (LLM) and quantitative ranking weights (deterministic engine).
