# Vanguard

**A local-first, human-in-the-loop Career Scouting & Application Cockpit for managing high-stakes job pipelines.**

Vanguard is a personal filtering, scoring, and application preparation assistant designed to eliminate the friction of job hunting without relinquishing human agency or generating hallucinated credentials.

---

## Key Principles & System Invariants

- **Local-First Persistence**: SQLite (`pulse.db`) via Prisma 7 + LibSQL adapter is the single source of truth. Zero external database or cloud hosting requirements.
- **Zero-Cost Cascading Inference**: AI operates at ₹0/month through a 6-tier multi-provider cascading architecture (Google Gemini free pool, NVIDIA NIM, Ollama Cloud, OpenRouter, OpenCode Zen, Groq) with in-flight zero-latency circuit breakers.
- **No Hallucinated Credentials**: All resume tailoring and portal answers strictly project from verified candidate facts.
- **Human-in-the-Loop Execution**: The engine automates ingestion, filtering, scoring, and form preparation; final application submissions remain human-initiated and human-reviewed.

---

## Core Capabilities

### 1. Ingestion & Deterministic Filtering
- **Multi-Source Ingestion**: Ingest raw job descriptions via direct text paste or web scraping with automated compensation/currency extraction (normalizing LPA and symbols).
- **Dual-Mode Candidate Parser**: Import candidate resumes via deterministic Markdown AST parsing with structured AI fallback.
- **Deduplication**: Deterministic token hashing (`dedupeKey`) prevents duplicate processing across aggregators.
- **Fast Constraint Filtering**: Instant, zero-AI evaluation of hard constraints (minimum salary with cross-currency conversion, remote eligibility, minimum years of experience) short-circuits non-matching roles.

### 2. Multi-Dimensional AI Fit Scoring & Adaptive Feedback
- **Granular Evaluation**: Semantic evaluation across four sub-dimensions: Skills, Experience, Domain, and Trajectory.
- **Workload Routing Profiles**: Dynamic candidate cascades optimized per task (`FAST_INGESTION`, `FIT_SCORING`, `RESUME_TAILORING`, `SCREENING_QA`, `RESUME_PARSING`).
- **Priority Inbox & Kanban**: Automated recommendations (`APPLY`, `REVIEW`, `IGNORE`) with native HTML5 Drag-and-Drop stage progression.
- **Outcome Feedback Loop**: Calibrates scoring weights across candidate lifecycle outcomes with phased Bayesian guardrails (Phase 0 static, Phase 1 suggestions, Phase 2 clamped automated drift).

### 3. Fact-Grounded Resume Tailoring & Q&A
- **Context-Aware Tailoring**: Generates tailored markdown resumes selecting the most relevant candidate projects and skill highlights.
- **Application Question Answering**: Answers custom and preset portal questions grounded strictly in candidate profile evidence.

### 4. Assisted Browser Automation & Form Mapping
- **Two-Tier ATS Form Mapper**: Heuristic classification with deep fallback to map interactive form fields across modern ATS platforms (Greenhouse, Lever, Ashby, Workday).
- **Persistent Playwright Runner**: Launches headed browser sessions with automated profile management, keystroke emulation, and direct PDF resume attachment.
- **Visual Inspection & Takeover**: Injects non-destructive CSS inspection badges, scrolls directly to missing required fields, and hands off control for manual submission.
- **Real-Time Streaming**: Server-Sent Events (SSE) stream progress live to the browser UI with hybrid submission detection.

### 5. Full Lifecycle State Machine & Auto-Ghosting
- **Stage Progression**: State machine tracking `DRAFT` &rarr; `SHORTLISTED` &rarr; `APPLYING` &rarr; `APPLIED` &rarr; `SCREENING` &rarr; `INTERVIEW` &rarr; `OFFER` / `REJECTED` / `WITHDRAWN` / `GHOSTED`.
- **Metrics & Latency Tracking**: Submission timestamping, first response latency tracking (`responseTimeDays`), and granular rejection stage/reason tracking.
- **Automated Ghost Detection**: Identifies stale applications (14 days) and automatically transitions unresponded applications to `GHOSTED` after 21 days.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Styling**: Tailwind CSS v4, Lucide Icons, Radix UI Primitives
- **Database & ORM**: SQLite (`pulse.db`), Prisma 7 with `@prisma/adapter-libsql`
- **AI & LLM**: Vercel AI SDK (`ai`), `@ai-sdk/google` (Gemini), `@ai-sdk/openai` (NVIDIA NIM, Ollama Cloud, OpenRouter, OpenCode Zen, Groq)
- **Browser Automation**: Playwright (headed persistent contexts)
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

Configure your API keys in `.env` (supports comma-separated keys and models for automatic matrix rotation and 429 failover):

```env
# Google Gemini (Tier 0 & Tier 1)
GEMINI_API_KEY="AIzaSy_KEY1,AIzaSy_KEY2"
GEMINI_MODEL="gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite"

# NVIDIA NIM (Tier 2 - 40 RPM Free)
NVIDIA_API_KEY="nvapi-..."
NVIDIA_MODEL="z-ai/glm-5.2,deepseek-ai/deepseek-v4-flash,minimaxai/minimax-m3,moonshotai/kimi-k2.6"

# Ollama Cloud (Tier 3 - Hosted Open Models Pool)
OLLAMA_API_KEY="ollama_..."
OLLAMA_MODEL="minimax-m3,nemotron-3-ultra,gpt-oss:120b,gpt-oss:20b"

# OpenRouter (Tier 4 & Tier 6 - Free Models & Global Free Router)
OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_MODEL="nvidia/nemotron-3-ultra:free,google/gemma-4-31b:free,poolside/laguna-s-2.1:free,openrouter/free"

# OpenCode Zen (Tier 5 - Free Coding Gateway)
OPENCODE_API_KEY="zen_..."
OPENCODE_MODEL="nemotron-3-ultra-free,mimo-v2.5-free"

# Groq (Fast Fallback)
GROQ_API_KEY="gsk_..."
GROQ_MODEL="llama-3.3-70b-versatile"
```

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

Open [http://localhost:3001](http://localhost:3001) to access the Vanguard dashboard.

---

## Quality & Testing

Run lint checks, type verification, and automated tests:

```bash
npm run lint
npx tsc --noEmit
npm test
```
