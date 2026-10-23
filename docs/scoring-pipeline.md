# Scoring & Pre-Filter Pipeline

How Vanguard decides which jobs reach the Priority Inbox, and how much (often
zero) inference that costs. Summarized in the [README](../README.md); the
underlying decisions live in
[ADR 0008](adr/0008-scoring-feedback-loop-and-weight-optimization.md),
[ADR 0012](adr/0012-multi-tier-cascading-ai-inference-engine-and-circuit-breaker.md),
and [ADR 0015](adr/0015-hybrid-semantic-matching-and-rate-limit-resilience.md).

## 1. Zero-token pre-filter

Before any model is called, incoming jobs pass strict deterministic regex
constraints:

- **Salary floor** — normalized compensation ceilings are compared against the
  candidate minimum, with cross-currency conversion.
- **Location & remote policy** — domestic roles may be remote, hybrid, or onsite;
  international postings must be unrestricted/worldwide remote. International
  onsite/hybrid roles and explicit restrictions such as "US Only" are rejected.
- **YOE & seniority bounds** — required experience is compared against the
  candidate with tolerance bounds; excessive-experience roles are rejected, and
  Senior/Staff/Lead titles are filtered out for junior and mid-level candidates
  (≤ 3 years).
- **Role precision ("to a T")** — target-role keyword matching, domain
  blacklist rejection, and a minimum tech-stack keyword density (≥ 2 matching
  skills).
- **Discovery staging** — jobs that pass are held in an in-memory staging
  buffer with synchronous source filtering and non-destructive transitions.
  AI scoring never runs on raw batches; it triggers on demand when staging jobs
  into the Priority Inbox.

## 2. Three-tier hybrid funnel

Scoring maximizes precision while keeping token cost at zero for clear matches
and mismatches:

| Tier | Engine | Latency | Token cost | Role |
| :--- | :--- | :--- | :--- | :--- |
| **1: Lexical** | Okapi BM25 (`k1=1.5`, `b=0.75`) | < 1 ms | 0 | Symbol-preserving technical tokenization (`C++`, `.NET`, `Node.js`, `TypeScript`, `Go`, `Rust`) |
| **2: Dense semantic** | Edge ONNX embeddings (`bge-small-en-v1.5`) | ~15 ms | 0 | 384-dimensional vectors embedded 100% locally in Node.js |
| **3: Selective LLM** | Workload-cascading AI router | 1–3 s | Free-tier pool | 4-dimensional reasoning (skills, experience, domain, trajectory) for borderline roles |

### Routing thresholds

Implemented in `classifyFunnelAction()` in `lib/scoring/hybrid.ts`:

| Score | Action | Effect |
| :--- | :--- | :--- |
| < 55 | `AUTO_IGNORE` | Discarded immediately at 0 token cost |
| 55–81 | `SELECTIVE_LLM_DEEP_INSPECTION` | Routed to the LLM for full reasoning |
| ≥ 82 | `AUTO_STAGE_HIGH_MATCH` | Staged immediately at 0 token cost |

## 3. Token optimization & feedback

- **Deterministic tier caching** — content-addressed SHA-256 L1 cache with a
  7-day TTL; re-evaluations return in 0 ms at 0 tokens.
- **Boilerplate distillation** — strips 60–70% non-functional text (EEO
  statements, legal disclaimers) before prompts are built.
- **Adaptive outcome feedback** — calibrates scoring weights against lifecycle
  outcomes behind phased Bayesian guardrails: Phase 0 static, Phase 1
  suggestions, Phase 2 clamped automated drift.
