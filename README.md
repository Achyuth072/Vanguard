# Pulse Career Operations Module

**A local-first, human-in-the-loop Career Operations engine for managing high-stakes job pipelines.**

Pulse is a personal filtering, scoring, and application preparation assistant designed to eliminate the friction of job hunting without relinquishing human agency or generating hallucinated credentials.

---

## Key Principles & System Invariants

- **Local-First Persistence**: SQLite (`pulse.db`) via Prisma 7 + LibSQL adapter is the single source of truth. Zero external database or cloud hosting requirements.
- **Zero-Cost Inference**: AI operates at ₹0/month by routing through OpenRouter free models as primary with automatic fallback to Google Gemini free tier.
- **No Hallucinated Credentials**: All resume tailoring and portal answers strictly project from verified candidate facts.
- **Human-in-the-Loop Execution**: The engine automates ingestion, filtering, scoring, and form preparation; final application submissions remain human-initiated and human-reviewed.

---

## Core Capabilities

### 1. Synchronous Ingestion & Deterministic Filtering
- **Multi-Source Ingestion**: Ingest raw job descriptions via direct text paste or web scraping with HTML stripping.
- **Deduplication**: Deterministic token hashing (`dedupeKey`) prevents duplicate processing across aggregators.
- **Fast Constraint Filtering**: Instant, zero-AI evaluation of hard constraints (minimum salary, remote eligibility, minimum years of experience) short-circuits non-matching roles.

### 2. Multi-Dimensional AI Fit Scoring & Adaptive Feedback
- **Granular Evaluation**: Semantic evaluation across four sub-dimensions: Skills, Experience, Domain, and Location/Logistics.
- **Priority Inbox**: Automated recommendations (`APPLY`, `REVIEW`, `IGNORE`) with explicit strengths and critical gap analysis.
- **Outcome Feedback Loop**: Calibrates scoring weights across candidate lifecycle outcomes with phased guardrails (Phase 0 static, Phase 1 suggestions, Phase 2 clamped automated drift).

### 3. Fact-Grounded Resume Tailoring & Q&A
- **Context-Aware Tailoring**: Generates tailored markdown resumes selecting the most relevant candidate projects and skill highlights.
- **Application Question Answering**: Answers custom and preset portal questions grounded strictly in candidate profile evidence.

### 4. Assisted Browser Automation & Form Mapping
- **Two-Tier ATS Form Mapper**: Heuristic classification with deep fallback to map interactive form fields across modern ATS platforms (Greenhouse, Lever, Workday).
- **Persistent Playwright Runner**: Launches headed browser sessions with automated profile management, keystroke emulation, and PDF resume attachment.
- **Visual Inspection & Takeover**: Injects non-destructive CSS inspection badges, scrolls directly to missing required fields, and hands off control for manual submission.
- **Real-Time Streaming**: Server-Sent Events (SSE) stream progress live to the browser UI with hybrid submission detection.

### 5. Full Lifecycle State Machine & Audit Trail
- **Stage Progression**: State machine tracking `DISCOVERED` &rarr; `FILTERED_OUT` &rarr; `SHORTLISTED` &rarr; `APPLYING` &rarr; `APPLIED` &rarr; `SCREENING` &rarr; `INTERVIEWING` &rarr; `OFFER` / `REJECTED` / `WITHDRAWN`.
- **Metrics & Auditing**: Fractional response time tracking, rejection stage analysis, and immutable event logging.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Styling**: Tailwind CSS v4
- **Database & ORM**: SQLite (`pulse.db`), Prisma 7 with `@prisma/adapter-libsql`
- **AI & LLM**: Vercel AI SDK (`ai`), `@ai-sdk/openai` (OpenRouter router), `@ai-sdk/google` (Gemini fallback)
- **Browser Automation**: Playwright
- **Language & Runtime**: TypeScript 5, Node.js

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-username/pulse-career-module.git
cd pulse-career-module
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your API keys in `.env`:
- `GEMINI_API_KEY`: Google Gemini API key (comma-separated keys supported for automatic rotation and 429 failover)
- `GROQ_API_KEY`: Groq API key for fast Llama 3.3 inference (comma-separated keys supported)
- `OPENROUTER_API_KEY`: OpenRouter API key for free-tier model routing (optional fallback)

### 3. Initialize Database

Generate Prisma client and apply migrations:

```bash
npx prisma db push
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the Pulse Career Ops dashboard.

---

## Quality & Testing

Run lint checks, type verification, and automated tests:

```bash
npm run lint
npx tsc --noEmit
npx tsx --test --test-concurrency=1 $(find lib -name "*.test.ts")
```
