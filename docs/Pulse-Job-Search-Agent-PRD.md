# Pulse — Personal Job Search Agent
## Product Requirements Document

**Status:** Proposed  
**Scope:** Personal/local-first job search and application workflow  
**Primary goal:** Reduce the time spent on job-search administration without turning applications into low-quality mass submissions.

---

## 1. Problem

The current job-search workflow is too manual:

1. Find a job.
2. Read and evaluate the JD.
3. Decide whether it is a good fit.
4. Tailor a resume/application.
5. Submit.
6. Manually record everything in Notion.
7. Update the status later.

The administrative work around the application is becoming almost as expensive as the application itself.

The current `pulse-career-module` already provides a foundation for career/job tracking, but it behaves primarily as a **career CRM** rather than an **active job-search system**.

### Core insight

The goal is not:

> Apply to as many jobs as possible.

The goal is:

> Automatically eliminate poor-fit jobs and reduce a strong application to a few minutes of human attention.

The system should optimize **quality × relevant volume × time saved**.

---

## 2. Product Vision

Turn Pulse into a **local-first personal job-search agent**.

Pulse should continuously move jobs through this pipeline:

```text
Job Sources
    ↓
Ingest
    ↓
Normalize + Deduplicate
    ↓
Rule-based Filtering
    ↓
AI Fit Scoring
    ↓
Prioritized Inbox
    ↓
Resume / Answer Preparation
    ↓
Human Review
    ↓
Browser-Assisted Application
    ↓
Automatic Tracking
    ↓
Follow-up / Analytics
```

The user remains the decision-maker for actual submissions.

---

## 3. Goals

### Primary goals

- Eliminate manual Notion-based application tracking.
- Reduce the time required to evaluate jobs.
- Surface high-fit opportunities automatically.
- Avoid wasting AI requests on unqualified jobs.
- Generate tailored application material only for worthwhile applications.
- Make application tracking automatic.
- Run primarily on the user's machine with no always-on hosted backend.
- Keep AI usage at **₹0/month** using free tiers and free models.
- Make the AI provider replaceable.

### Secondary goals

- Maintain a clean searchable history of jobs and applications.
- Measure which job types and sources actually produce interviews.
- Make backups/export trivial.
- Leave room for future native/browser automation.

---

## 4. Non-Goals

Pulse is **not** intended to:

- Submit hundreds of generic applications automatically.
- Spam job boards.
- Guarantee interviews.
- Depend on a single AI provider.
- Require Supabase or a continuously running cloud database.
- Replace human judgment for important applications.
- Become a multi-user SaaS product initially.

---

# 5. Product Principles

## 5.1 Quality over blind volume

Every job should pass through filtering before expensive AI work.

A candidate should not spend time on a job simply because it exists.

## 5.2 Automate administration, not judgment

Pulse should automate repetitive work such as:

- ingestion
- deduplication
- extraction
- filtering
- scoring
- drafting
- tracking

The user should still approve the final application.

## 5.3 Local-first

The career database should work without an external hosted database.

The system should continue functioning if:

- Supabase is unavailable
- the internet is temporarily unavailable
- an AI provider changes its limits
- an external service disappears

## 5.4 Provider-agnostic AI

No major feature should depend on one model vendor.

The AI layer must allow models/providers to be swapped without changing application logic.

## 5.5 Spend intelligence before spend inference

Use deterministic rules for simple facts and AI only where semantic reasoning provides value.

---

# 6. Target Workflow

The ideal workflow becomes:

```text
Open Pulse
    ↓
See 5–10 high-value jobs
    ↓
Review recommendation
    ↓
Approve
    ↓
Tailored resume + answers prepared
    ↓
Open application
    ↓
Submit
    ↓
Pulse records it automatically
```

The desired result is that **the user spends time deciding and applying, not maintaining the database**.

---

# 7. Architecture

## 7.1 High-level architecture

```text
                         ┌──────────────────┐
                         │   Job Sources     │
                         │ APIs / feeds /    │
                         │ browser imports   │
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │  Job Ingestion   │
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │ Normalize / Dedupe│
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │ Rule-based Filter│
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │   AI Evaluation  │
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │ Priority Inbox   │
                         └────────┬─────────┘
                                  ↓
                       ┌──────────────────────┐
                       │ Tailoring / Answers  │
                       └──────────┬───────────┘
                                  ↓
                         ┌──────────────────┐
                         │ Human Approval   │
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │ Browser-assisted │
                         │ application      │
                         └────────┬─────────┘
                                  ↓
                         ┌──────────────────┐
                         │ SQLite / Prisma  │
                         └──────────────────┘
```

---

# 8. Storage

## Decision

Use:

**SQLite + Prisma**

instead of Supabase/Postgres as the primary datastore.

### Why

- local and fast
- zero hosting cost
- no database pausing
- no auth infrastructure required
- easy backup
- easy migration
- works naturally with a single-user application

The primary database can simply be:

```text
pulse.db
```

### Export formats

Support:

```text
SQLite → primary source of truth
JSON   → complete backup/export
CSV    → interoperability and spreadsheets
```

CSV should **not** be the primary database.

---

# 9. AI Architecture

## 9.1 AI router

Pulse should expose a single internal interface:

```text
AIProvider
├── OpenRouterProvider
├── GeminiProvider
├── GroqProvider
└── LocalProvider (future)
```

Application features should call tasks rather than vendor-specific APIs:

```text
extractJob()
scoreJob()
tailorResume()
generateAnswers()
analyzeOutcome()
```

This makes the model interchangeable.

---

# 10. Recommended Initial AI Stack

The initial target is **₹0/month**.

## Primary: OpenRouter

OpenRouter provides access to multiple models through a common API and has a free-model pool.

Initial candidate:

```text
GPT-OSS-120B
```

Use it primarily for:

- job fit scoring
- JD interpretation
- semantic matching
- application-answer drafting
- resume tailoring

OpenRouter's free account limits are finite, so Pulse should aggressively reduce unnecessary requests.

## Secondary: Gemini API

Use the Gemini free tier as a fallback/secondary provider.

Good uses include:

- extraction
- scoring
- drafting
- semantic comparisons

Exact free-tier limits vary by model and can change, so Pulse should treat provider limits as runtime configuration rather than hard-coded assumptions.

## Tertiary: Groq

Use Groq as another fallback, particularly where fast inference is useful.

Potential uses:

- classification
- extraction
- quick scoring
- lightweight transformations

## Future: Local models

Add a local provider later using tools such as Ollama.

This can eventually make some workflows completely independent of hosted AI APIs.

---

# 11. AI Usage Strategy

The system should **not** send every job through a large model.

Instead:

```text
100 discovered jobs
        ↓
Rule filters
        ↓
30 plausible jobs
        ↓
Cheap / lightweight extraction
        ↓
15 strong candidates
        ↓
AI semantic scoring
        ↓
5–10 worthy applications
        ↓
Tailoring only for approved jobs
```

This keeps free-tier usage manageable and improves speed.

---

# 12. Deterministic Filtering

Use ordinary code for facts that do not require an LLM.

Examples:

- location
- remote/hybrid/onsite
- years of experience
- salary range
- employment type
- required technology
- prohibited technologies
- visa requirements
- company restrictions
- duplicate URLs
- duplicate company/title combinations

Example:

```text
if remote_required and job.is_remote == false:
    reject

if required_years > candidate_years:
    lower_score

if salary_max < candidate.minimum_salary:
    reject
```

AI should handle the things that require interpretation.

---

# 13. AI Fit Scoring

Each job receives a normalized score, for example:

```text
0–100 Fit Score
```

Suggested factors:

| Factor | Weight |
|---|---:|
| Skills match | 30% |
| Relevant experience | 25% |
| Seniority match | 15% |
| Project/domain relevance | 15% |
| Location/work model | 10% |
| Compensation | 5% |

The exact weighting should be configurable.

### Output

The AI should return structured data such as:

```json
{
  "score": 84,
  "recommendation": "apply",
  "strengths": [],
  "gaps": [],
  "risks": [],
  "reasoning": ""
}
```

The model should not control the final state transition.

---

# 14. Application Tiers

Pulse should classify jobs into three broad categories:

```text
80–100 → APPLY / HIGH PRIORITY
60–79  → REVIEW
0–59   → IGNORE
```

Thresholds must be configurable.

### Important

A high score does **not** automatically mean submit.

It means:

> This job deserves the user's attention.

---

# 15. Resume and Application Tailoring

For approved jobs Pulse can generate:

- tailored resume version
- short professional summary
- cover letter where useful
- application answers
- project-selection recommendations
- talking points for interviews

The system should always preserve the difference between:

**candidate facts** and **AI-generated wording**.

The AI must not invent:

- experience
- achievements
- employment
- education
- metrics
- technologies
- responsibilities

---

# 16. Candidate Profile

Pulse should maintain a structured source of truth for the candidate.

Example:

```text
Candidate
├── Profile
├── Experience
├── Education
├── Skills
├── Projects
├── Achievements
├── Preferences
├── Salary expectations
└── Resume versions
```

Projects should contain rich descriptions so the AI can select the most relevant projects for a specific JD.

---

# 17. Job Data Model

Core entities:

```text
Candidate
Job
Company
Application
Resume
ApplicationAnswer
JobScore
JobSource
Event
```

### Job

Minimum fields:

```text
id
title
company
location
remoteStatus
employmentType
salary
description
url
source
postedAt
discoveredAt
dedupeKey
status
```

### Application

```text
id
jobId
status
appliedAt
resumeVersion
notes
followUpAt
lastUpdated
```

---

# 18. Application Status

Recommended states:

```text
DISCOVERED
REVIEW
SHORTLISTED
PREPARED
APPLYING
APPLIED
INTERVIEW
OFFER
REJECTED
WITHDRAWN
ARCHIVED
```

State changes should be recorded in an event/history table.

---

# 19. Job Sources

Start with sources that are easy and reliable to ingest.

Potential mechanisms:

- RSS/Atom feeds
- public APIs
- saved searches
- browser extension/manual import
- URL import
- pasted job description

Avoid designing the first version around aggressive scraping of sites that actively prevent automation.

The ingestion layer should be abstract:

```text
JobSource
├── RSSSource
├── API Source
├── BrowserImportSource
└── ManualSource
```

---

# 20. Browser-Assisted Applications

Phase 1:

**Open the application and help the user complete it.**

Pulse can:

- open the application
- provide generated answers
- provide the selected resume
- show required fields
- track progress

Phase 2:

**Automate repetitive form filling where technically and contractually appropriate.**

The submit action should initially remain human-controlled.

---

# 21. Dashboard

The main screen should prioritize action rather than CRM management.

### Inbox

```text
High-fit jobs requiring attention
```

Each card should show:

- company
- role
- fit score
- salary
- remote/location
- why it matches
- major concerns
- application deadline if known

### Applications

Kanban or list:

```text
Shortlisted
→ Prepared
→ Applied
→ Interview
→ Offer
```

### Analytics

Focus on useful feedback:

```text
Jobs discovered
Jobs reviewed
Applications
Interviews
Interview rate
Source performance
Role performance
```

The purpose is to learn:

> Which applications are actually worth my time?

---

# 22. Backups

The local database is the source of truth.

Recommended backup strategy:

```text
Daily / on-change
    ↓
SQLite backup
    ↓
JSON export
    ↓
Optional user-selected backup directory/cloud sync
```

The application should never require cloud backup.

---

# 23. Security and Privacy

Because the system contains personal career data:

- keep the primary DB local
- do not expose the local server publicly by default
- store API keys outside the database where possible
- minimize data sent to AI providers
- allow AI provider selection
- show which provider is being used
- never silently upload the whole career database
- redact unnecessary personal information from AI requests

---

# 24. Cost Model

Target operating cost:

```text
₹0/month
```

### Infrastructure

```text
SQLite              ₹0
Local application   ₹0
Notion              ₹0 required
Supabase             ₹0 required
```

### AI

Use free tiers/models:

```text
OpenRouter free models
Gemini free tier
Groq free tier
```

The design must assume quotas can change.

Therefore:

- provider limits are configurable
- fallback providers exist
- AI calls are minimized
- deterministic processing happens first

---

# 25. MVP

The MVP should focus on the biggest time savings.

### Phase 1

1. Replace remote DB with SQLite.
2. Import existing jobs/application history from the current system.
3. Build candidate profile.
4. Add job URL/JD import.
5. Normalize and deduplicate jobs.
6. Add deterministic filters.
7. Add AI fit scoring.
8. Create a prioritized inbox.
9. Add application tracking.
10. Add CSV/JSON export.

At this stage Pulse already removes most of the Notion maintenance problem.

### Phase 2

1. Automated job ingestion.
2. AI resume tailoring.
3. AI application-answer generation.
4. Browser-assisted application flow.
5. Follow-up reminders.
6. Analytics and source performance.

### Phase 3

1. Browser automation.
2. Local model provider.
3. Smarter feedback loops.
4. Automatic optimization of scoring.
5. Optional native desktop/mobile client.

---

# 26. Success Metrics

The most important metrics are not number of applications.

Track:

### Time saved

```text
Average minutes from job discovery → tracked application
```

Target:

**<5 minutes of active user time for a strong application.**

### Relevance

```text
% of shortlisted jobs that user actually considers worth applying to
```

### Conversion

```text
Applications → Interviews
Interviews → Offers
```

### Administrative burden

```text
Manual database updates / week
```

Target:

**Near zero.**

---

# 27. Example End-to-End Scenario

```text
8:00 AM

Pulse discovers 60 new jobs.

60
↓
18 fail deterministic filters

42 remain

↓
AI scoring

42
↓
31 low-fit
11 high/reasonable fit

↓
User sees:

1. AI Product Engineer — 91
2. Product Engineer — 87
3. Frontend Engineer — 84
4. Full-stack Engineer — 82
...

User opens #1.

Pulse explains:
- Strong React/TypeScript match
- Relevant AI project experience
- Remote compatible
- Minor gap: production Python depth

User clicks:
"Prepare application"

Pulse generates:
- tailored resume
- short answer set
- relevant projects

User clicks:
"Apply"

Browser opens.

User reviews and submits.

Pulse automatically records:

APPLIED
2026-08-17
Resume: AI Product Engineer v3
```

The user never opens Notion.

---

# 28. Key Product Decision

Pulse should **not** become an autonomous spam bot.

Its value is:

> **Turn job hunting into a filtered, assisted workflow where the machine does the repetitive work and the human makes the important decisions.**

The product should optimize for **high-quality applications per hour of user attention**, not raw application count.

---

# 29. Recommended Technical Direction

Use the existing Pulse codebase rather than starting another project.

### Retain

- existing career-domain concepts
- existing resume/profile logic
- existing UI where useful
- Prisma patterns where applicable
- current project structure

### Change

```text
Supabase/Postgres
        ↓
SQLite

Notion tracking
        ↓
Pulse database

CRM-first
        ↓
Workflow-first

Manual job entry
        ↓
Job ingestion

Manual evaluation
        ↓
Rules + AI scoring

Manual drafting
        ↓
AI-assisted tailoring

Manual status updates
        ↓
Automatic event tracking
```

---

# 30. Final Product Definition

**Pulse is a local-first personal job-search agent that discovers, filters, ranks, prepares, and tracks job applications while keeping the final decision in the user's hands.**

The system's north-star outcome is:

> **Spend less time managing the job search and more time applying to jobs that are actually worth applying to.**
