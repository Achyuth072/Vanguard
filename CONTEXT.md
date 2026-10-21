# Vanguard Domain Context

**A local-first, human-in-the-loop Developer Career Cockpit for software engineers.**

Vanguard is a personal filtering, scoring, and application preparation assistant designed specifically for software engineers and technical practitioners managing high-stakes engineering job pipelines.

## Ubiquitous Language & Glossary

### Core Entities

- **Candidate**: The single-user profile representing the software engineer / technical job seeker. Holds scalar filter preferences (minimum salary, currency preference, years of experience, remote requirement, preferred locations) and rich structured JSON history (repositories, projects, employment records, categorized skills, and master resume sections).
- **Job**: A single job opportunity discovered or imported into the system. Identified uniquely across aggregators via a computed `dedupeKey` and grouped across boards via `clusterKey`. Tracks metadata (role title, company name, location, remote classification, salary range and currency, employment type, job description text, status, and buffer state `isStaged`).
- **FeedSource**: A configured job feed origin (such as Ashby, Greenhouse, Lever, Himalayas, RemoteOK, Jobicy, Hacker News, HiringCafe, We Work Remotely, Wellfound, Indeed RSS, SmartRecruiters, Remotive, or manual paste) with endpoint URL, target board slugs, polling cadence, pagination cursor, and ingestion health telemetry.
- **FitScore**: The evaluation record of a job against the candidate profile. Consists of a normalized composite score (0–100), four-dimensional sub-scores (`skillsFit`, `experienceFit`, `domainFit`, `trajectoryFit`), explicit categorization (`APPLY`, `REVIEW`, `IGNORE`), identified strengths, critical gaps, risk flags, and concise structured reasoning. Produced by the 3-tier hybrid scoring engine (BM25 + Edge ONNX embeddings) or LLM cascading inference.
- **Application**: The record of engagement for a shortlisted job. Tracks application lifecycle states (`DRAFT`, `SHORTLISTED`, `PREPARED`, `APPLIED`, `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, `GHOSTED`), attached tailored resume version, generated question answers, notes, response metrics (`appliedAt`, `firstResponseAt`, `responseTimeDays`), rejection attributes (`rejectionStage`, `rejectionReason`), and follow-up deadlines.
- **TailoredResume**: The customized resume document and structured section selection (highlighted skills, selected master projects with relevance rationale, and tailored executive summary) generated specifically for a targeted job while strictly adhering to verified candidate facts.
- **ApplicationAnswer**: A generated answer to a specific application form question (either standard preset or custom user-submitted prompt), grounded exclusively in candidate facts with linked supporting evidence.
- **Event**: An immutable historical audit entry tracking state changes, status transitions, and actions performed on jobs and applications.

### Pipeline Stages

1. **Ingestion & Parsing**: Adding raw job descriptions via manual paste, direct URL import, or structured multi-source feeds (Ashby, Greenhouse, Lever, HiringCafe, Wellfound, Himalayas, RemoteOK, Jobicy, We Work Remotely, Indeed RSS, SmartRecruiters, Remotive, and top-level Hacker News "Who is hiring?" posts).
2. **Deduplication**: Computing a deterministic `dedupeKey` from normalized company, title, and URL tokens, plus a cross-aggregator `clusterKey` from normalized company and title to group identical postings cross-posted across boards.
3. **Deterministic Filtering**: Fast, zero-AI evaluation of hard constraints rejecting non-viable jobs at 0 AI token cost:
   - **Salary Floor**: Cross-currency normalized compensation ceiling check against candidate minimum.
   - **Location & Remote Policy**: Domestic jobs (in candidate's home country/region) allow `REMOTE`, `HYBRID`, and `ONSITE`; international jobs strictly reject onsite/hybrid, reject explicit foreign geo-restrictions ("US Only", "EMEA Only"), and accept worldwide or unrestricted `REMOTE` when the candidate prefers remote.
   - **YOE & Seniority Bounds**: Evaluates candidate experience ($C$) against job bounds ($[min, max]$) with tolerance ($T$), rejecting roles requiring $min > C + T$ and auto-rejecting Senior/Staff/Lead titles for junior/mid candidates ($C \le 3$).
   - **Skills & Role Precision ("To a T")**: Enforces target role keyword matching, domain blacklist rejection, and minimum tech stack keyword density ($\ge 2$ matching skills) before staging.
4. **Discovery Staging Buffer**: Filter-passing discovered jobs are staged in a fast-access buffer (`isStaged: true`). AI Fit Scoring is never triggered automatically on feed batches; scoring runs on-demand when the user chooses to ingest into the Priority Inbox, or via the local hybrid scoring funnel.
5. **Multi-Dimensional AI & Hybrid Fit Scoring**: 4-dimensional semantic evaluation (`skills`, `experience`, `domain`, `trajectory`) via a 3-tier hybrid scoring funnel blending zero-token Okapi BM25 lexical precision with local Edge ONNX dense embeddings (`bge-small-en-v1.5`) and LLM cascading inference fallback (`AUTO_IGNORE` [<55], `AUTO_STAGE_HIGH_MATCH` [>=82], `SELECTIVE_LLM_DEEP_INSPECTION` [55–81]), producing composite scores and gap analysis.
6. **Priority Inbox & Kanban Pipeline**: The primary decision interface presenting high-value jobs requiring human attention, with native Drag-and-Drop stage progression (Shortlisted, Prepared, Applied, Screening, Assessment, Interview, Offer, Rejected, Ghosted, Archived) on desktop and a mobile segmented stage switcher (`<sm`) with live counts and touch-friendly stage advancement, plus audit event logging.
7. **Application Preparation**: Generating role-specific tailored resumes, project recommendations, and grounded question answers from verified candidate facts.
8. **Assisted Browser Automation**: Headed Playwright automation with a persistent user context (local profile, or attachment to the host's existing Chrome over CDP in containerized runs), two-tier heuristic ATS form mapping (Greenhouse, Lever, Ashby, Workday), direct PDF resume attachment, and visual takeover inspection badges.
9. **Human Approval & Assisted Submission**: The human-controlled step where the user reviews filled fields, solves any CAPTCHA, and completes the submission.
10. **Lifecycle Tracking & Auto-Ghosting**: Recording submission timestamps, calculating response latencies, and automatically transitioning silent applications to `GHOSTED` after 21 days of inactivity.
11. **Outcome Feedback Loop**: Calibrating scoring weights across lifecycle outcomes with phased Bayesian guardrails (Phase 0 static, Phase 1 suggestions, Phase 2 clamped drift).
12. **Filter Override & Job Rescue**: The human-in-the-loop mechanism allowing candidate inspection of rejected (`FILTERED_OUT` or `IGNORED`) jobs with exact failure reasons, granting 1-click rescue to the Priority Inbox and logging audit events for scoring calibration.

### System Principles & Invariants

- **Local-First Persistence**: SQLite (`pulse.db`) via Prisma is the sole source of truth. No hosted remote database or cloud backend is required.
- **Zero-Cost Cascading Inference**: AI operates at ₹0/month via a 7-tier cascading architecture (Gemini Pro/Paid, Gemini Free Multi-Model Cascade, NVIDIA NIM, Ollama Cloud, OpenRouter Free Ranked, Groq Fallback, OpenRouter Global Free Router) with in-flight circuit breakers, P2C multi-key pool balancing, proactive rate-limit header tracking, and task-specific Workload Profiles.
- **Zero-Token Local Hybrid Scoring**: Edge ONNX dense embeddings and BM25 ranking run entirely in-process with 0 API tokens and zero external network latency.
- **Zero-Token Raw Discovery**: Ingestion, deduplication, and multi-dimensional pre-filtering consume 0 AI tokens.
- **No Hallucinated Credentials**: AI tailoring and portal answers must never invent skills, metrics, experiences, or credentials not present in the candidate profile.
- **Human-in-the-Loop Execution**: The agent automates administrative ingestion, filtering, scoring, drafting, and form mapping; final submission remains strictly human-initiated.
- **Developer-First Precision**: Lexical tokenizers, dense embeddings, and regex pre-filters are tuned specifically for engineering tech stacks (`C++`, `.NET`, `Node.js`, `TypeScript`, `Go`, `Rust`) and software engineering tracks (`SDE 1/2/3`, `Staff`, `Principal`), rejecting non-technical roles and enforcing tech stack keyword density.
- **Interactive Kanban Pipeline**: On `sm+` viewports, active tracking stages render as fixed-width, horizontally scrollable columns with native HTML5 Drag-and-Drop stage transitions and audit event logging. Below `sm`, the board adapts to a segmented stage switcher with full-width touch cards and a safe-area-aware floating action bar; drag handles are suppressed on coarse-pointer devices so vertical swipes scroll the stage feed.

### Terminology Rules & Avoided Synonyms

- Use **Candidate**, never *Lead* or *User Account*.
- Use **Job**, never *Posting Lead* or *CRM Opportunity*.
- Use **FeedSource**, never *Source Connector*, *Job Channel*, or *Scraper*.
- Use **Fit Score**, never *Match Percentage* or *AI Rating*.
- Use **Priority Inbox**, never *Job Feed* or *Search Results*.
- Use **Prepared**, never *Applying* or *Ready to Apply*.
- Use **Assessment** or **Take-home / OA**, never *Coding Test* or *Quiz*.
- Use **Filtered Out / Dropped Jobs**, never *Discarded Leads* or *Dead Postings*.
- Use **Filter Override / Job Rescue**, never *Unban* or *Force Add*.
- Avoid **Auto-apply** or **Mass Submission**: Vanguard is a personal filtering, preparation, and assisted application cockpit, not an unattended mass-submission bot.


