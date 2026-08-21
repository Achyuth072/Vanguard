# Vanguard Domain Context

## Ubiquitous Language & Glossary

### Core Entities

- **Candidate**: The single-user profile representing the job seeker. Holds scalar filter preferences (minimum salary, currency preference, years of experience, remote requirement, preferred locations) and rich structured JSON history (projects, employment records, skills, master resume sections).
- **Job**: A single job opportunity discovered or imported into the system. Identified uniquely across aggregators via a computed `dedupeKey`. Contains raw and normalized metadata (role title, company name, location, remote classification, salary range and currency, employment type, job description text, status).
- **JobSource**: The origin mechanism and metadata of a job listing (such as manual text paste, direct URL import, or structured feeds).
- **FitScore**: The evaluation record of a job against the candidate profile. Consists of a normalized composite score (0–100), four-dimensional sub-scores (`skillsFit`, `experienceFit`, `domainFit`, `trajectoryFit`), explicit categorization (`APPLY`, `REVIEW`, `IGNORE`), identified strengths, critical gaps, risk flags, and concise structured reasoning.
- **Application**: The record of engagement for a shortlisted job. Tracks application lifecycle states (`DRAFT`, `SHORTLISTED`, `APPLYING`, `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, `GHOSTED`), attached tailored resume version, generated question answers, notes, response metrics (`appliedAt`, `firstResponseAt`, `responseTimeDays`), rejection attributes (`rejectionStage`, `rejectionReason`), and follow-up deadlines.
- **TailoredResume**: The customized resume document and structured section selection (highlighted skills, selected master projects with relevance rationale, and tailored executive summary) generated specifically for a targeted job while strictly adhering to verified candidate facts.
- **ApplicationAnswer**: A generated answer to a specific application form question (either standard preset or custom user-submitted prompt), grounded exclusively in candidate facts with linked supporting evidence.
- **Event**: An immutable historical audit entry tracking state changes, status transitions, and actions performed on jobs and applications.

### Pipeline Stages

1. **Ingestion & Parsing**: Adding raw job descriptions via manual paste or URL scraping (with AI metadata extraction and LPA/symbol currency normalization), or importing candidate resumes via dual-mode parsing (Deterministic Markdown AST parser with AI fallback).
2. **Deduplication**: Computing a deterministic `dedupeKey` from normalized company, title, and URL tokens to eliminate duplicate listings before expensive processing.
3. **Deterministic Filtering**: Fast, zero-AI evaluation of hard constraints (minimum salary with cross-currency conversion normalization, remote eligibility, minimum experience) rejecting non-viable jobs instantly.
4. **Multi-Dimensional AI Fit Scoring**: 4-dimensional semantic evaluation (`skills`, `experience`, `domain`, `trajectory`) via task-specific workload routing, producing composite scores and gap analysis.
5. **Priority Inbox & Kanban Pipeline**: The primary decision interface presenting high-value jobs requiring human attention, with native Drag-and-Drop stage progression and audit event logging.
6. **Application Preparation**: Generating role-specific tailored resumes, project recommendations, and grounded question answers from verified candidate facts.
7. **Assisted Browser Automation**: Headed Playwright automation with persistent user context, two-tier heuristic ATS form mapping (Greenhouse, Lever, Ashby, Workday), direct PDF resume attachment, and visual takeover inspection badges.
8. **Human Approval & Assisted Submission**: The human-controlled step where the user reviews filled fields, solves any CAPTCHA, and completes the submission.
9. **Lifecycle Tracking & Auto-Ghosting**: Recording submission timestamps, calculating response latencies, and automatically transitioning silent applications to `GHOSTED` after 21 days of inactivity.
10. **Outcome Feedback Loop**: Calibrating scoring weights across lifecycle outcomes with phased Bayesian guardrails (Phase 0 static, Phase 1 suggestions, Phase 2 clamped drift).

### System Principles & Invariants

- **Local-First Persistence**: SQLite (`pulse.db`) via Prisma is the sole source of truth. No hosted remote database or cloud backend is required.
- **Zero-Cost Cascading Inference**: AI operates at ₹0/month via a 6-tier cascading architecture (Google Gemini free pool `3.7-flash` → `3.6-flash` → `3.5-flash` → `3.5-flash-lite` → `3.1-flash-lite` → NVIDIA NIM → Ollama Cloud → OpenRouter → OpenCode Zen → Groq) with in-memory zero-latency circuit breakers and task-specific Workload Profiles.
- **No Hallucinated Credentials**: AI tailoring and portal answers must never invent skills, metrics, experiences, or credentials not present in the candidate profile.
- **Human-in-the-Loop Execution**: The agent automates administrative ingestion, filtering, scoring, drafting, and form mapping; final submission remains strictly human-initiated.
- **Interactive Kanban Pipeline**: Active tracking stages are rendered as fixed-width, horizontally scrollable columns with native HTML5 Drag-and-Drop stage transitions and audit event logging.

### Terminology Rules & Avoided Synonyms

- Use **Candidate**, never *Lead* or *User Account*.
- Use **Job**, never *Posting Lead* or *CRM Opportunity*.
- Use **Fit Score**, never *Match Percentage* or *AI Rating*.
- Use **Priority Inbox**, never *Job Feed* or *Search Results*.
- Avoid **Auto-apply** or **Mass Submission**: Vanguard is a personal filtering, preparation, and assisted application cockpit, not an unattended mass-submission bot.
