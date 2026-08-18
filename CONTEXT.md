# Pulse Domain Context

## Ubiquitous Language & Glossary

### Core Entities

- **Candidate**: The single-user profile representing the job seeker. Holds scalar filter preferences (minimum salary, years of experience, remote requirement, preferred locations) and rich structured JSON history (projects, employment records, skills, master resume sections).
- **Job**: A single job opportunity discovered or imported into the system. Identified uniquely across aggregators via a computed `dedupeKey`. Contains raw and normalized metadata (role title, company name, location, remote classification, salary range, job description text, status).
- **JobSource**: The origin mechanism and metadata of a job listing (such as manual paste, direct URL import, or future feed/API integrations).
- **FitScore**: The evaluation record of a job against the candidate profile. Consists of a normalized score (0–100), explicit categorization (`APPLY`, `REVIEW`, `IGNORE`), identified strengths, critical gaps, risk flags, and concise structured reasoning.
- **Application**: The record of engagement for a shortlisted job. Tracks application lifecycle states, attached tailored resume version, generated question answers, notes, and submission timestamps.
- **TailoredResume**: The customized resume document and structured section selection (highlighted skills, selected master projects with relevance rationale, and tailored executive summary) generated specifically for a targeted job while strictly adhering to verified candidate facts.
- **ApplicationAnswer**: A generated answer to a specific application form question (either standard preset or custom user-submitted prompt), grounded exclusively in candidate facts with linked supporting evidence.
- **Event**: An immutable historical audit entry tracking state changes, status transitions, and actions performed on jobs and applications.

### Pipeline Stages

1. **Ingestion**: Adding raw job descriptions into the staging layer via manual paste or URL scraping.
2. **Deduplication**: Computing a deterministic `dedupeKey` from normalized company, title, and URL tokens to eliminate duplicate listings before expensive processing.
3. **Deterministic Filtering**: Fast, zero-AI evaluation of hard constraints (minimum salary, remote eligibility, minimum experience) rejecting non-viable jobs instantly.
4. **AI Fit Scoring**: Provider-agnostic semantic evaluation generating structured scores and gap analysis.
5. **Priority Inbox**: The primary decision interface presenting high-value jobs requiring human attention.
6. **Application Preparation**: Generating role-specific tailored resumes, project recommendations, and grounded question answers from verified candidate facts.
7. **Human Approval & Assisted Submission**: The human-controlled step where the user reviews tailored assets and submits the application.
8. **Automatic Event Tracking**: Recording submission state and timestamp into the local audit trail without manual CRM updates.

### System Principles & Invariants

- **Local-First Persistence**: SQLite (`pulse.db`) via Prisma is the sole source of truth. No hosted remote database or cloud backend is required.
- **Zero-Cost Inference**: AI consumption operates at ₹0/month by utilizing OpenRouter free models as primary with automatic failover to Google Gemini free tier.
- **No Hallucinated Credentials**: AI tailoring must never invent skills, metrics, experiences, or credentials not present in the candidate profile.
- **Human-in-the-Loop Execution**: The agent automates administrative ingestion, filtering, scoring, and drafting; final submission remains strictly human-initiated.
- **Interactive Kanban Pipeline**: Active tracking stages are rendered as fixed-width, horizontally scrollable columns with native Drag-and-Drop stage transitions and audit event logging.

### Terminology Rules & Avoided Synonyms

- Use **Candidate**, never *Lead* or *User Account*.
- Use **Job**, never *Posting Lead* or *CRM Opportunity*.
- Use **Fit Score**, never *Match Percentage* or *AI Rating*.
- Use **Priority Inbox**, never *Job Feed* or *Search Results*.
- Avoid **Auto-apply** or **Mass Submission**: Pulse is a personal filtering and preparation assistant, not an automated submission bot.
