# ADR 0012: Multi-Tier Cascading AI Inference Engine and Circuit Breaker

## Context

All core intelligence workloads in Vanguard—job metadata extraction, candidate fit scoring, tailored resume generation, screening Q&A synthesis, and resume parsing—depend on `lib/ai/router.ts`.

Under production conditions and high-throughput batch ingestion, relying on a simple two-provider fallback (as described in ADR 0003) encountered critical failure modes:
1. **Per-Model Quota Limits on Free Tiers**: Google AI Studio enforces tight burst and daily limits on flagship models (`gemini-3.7-flash` and `gemini-3.6-flash`), whereas stable models (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) offer 15–30 RPM and 1,500 RPD.
2. **Independent Quota Scopes**: Google quotas are tracked per `[Project + Model]`. A 429 quota error on `gemini-3.7-flash` does not block `gemini-3.5-flash` or `gemini-3.5-flash-lite` on the same key.
3. **Serial Retrying Latency Stalls**: Blindly retrying the same exhausted key/model 3 times consecutively caused ~90s user-facing delays and immediate pool exhaustion.
4. **Unused High-Throughput Free Endpoints**: High-capacity zero-cost endpoints (NVIDIA NIM at 40 RPM, Ollama Cloud, OpenCode Zen, Groq) were left unused.

## Decision

Implement a **6-Tier Multi-Provider Cascading Inference Engine** with **Zero-Latency In-Flight Circuit Breakers** in `lib/ai/router.ts`:

### 1. Multi-Tier Provider Cascade Matrix

Requests traverse through 6 priority tiers:
- **Tier 0**: Primary Google Gemini Pro / Paid Key (if configured).
- **Tier 1**: Google Gemini Free Multi-Model Cascade (`gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`).
- **Tier 2**: NVIDIA NIM High-Performance Free Tier (40 RPM) (`z-ai/glm-5.2`, `deepseek-ai/deepseek-v4-flash`, `minimaxai/minimax-m3`, `moonshotai/kimi-k2.6`).
- **Tier 3**: Ollama Cloud Hosted Open Models (`minimax-m3`, `nemotron-3-ultra`, `gpt-oss:120b`, `gpt-oss:20b`).
- **Tier 4**: OpenRouter Free Ranked Models (`nvidia/nemotron-3-ultra:free`, `google/gemma-4-31b:free`, `poolside/laguna-s-2.1:free`).
- **Tier 5**: OpenCode Zen & Alternative Free Endpoints (`nemotron-3-ultra-free`, `mimo-v2.5-free`, Groq `llama-3.3-70b-versatile`).
- **Tier 6**: OpenRouter Global Free Router (`openrouter/free`).

### 2. Multi-Key and Multi-Model Matrix Expansion

Configuration supports comma-separated keys and models in `.env` (e.g. `GEMINI_API_KEY="KEY1,KEY2"`, `GEMINI_MODEL="gemini-3.7-flash,gemini-3.5-flash"`). The router dynamically expands candidate tuples:
$$\text{Candidates} = \text{Keys in order} \times \text{Models in order}$$

### 3. In-Flight Circuit Breaker & Cooldown Cache

Each execution candidate is keyed by a compound tuple: `${providerName}:${keyMask}:${modelName}`.
- Upon receiving an HTTP 429 / Rate Limit error:
  - If a `retry-after` header is present, duration is set accordingly plus random jitter.
  - Default rate limit cooldown: 60 seconds.
  - Default daily quota exhaustion cooldown: 300 seconds (5 minutes).
- Upon receiving an HTTP 503 / Overloaded error: 30-second cooldown.
- **Zero-Latency Bypass**: Active candidates filter out any entry where `Date.now() < record.expiresAt`. Cooled candidates are skipped immediately with 0ms execution penalty.
- **Success Reset**: A successful response clears any prior cooldown record for that candidate.

### 4. Workload-Specific Routing Profiles

The router exposes 5 specialized workload profiles with tailored latency, token output, and reasoning cascades:
- `FAST_INGESTION`: Low-latency schema extraction (`gemini-3.5-flash-lite` → `gemini-3.5-flash` → `deepseek-v4-flash`).
- `FIT_SCORING`: Deep 4-dimensional reasoning (`gemini-3.7-flash` → `gemini-3.6-flash` → `z-ai/glm-5.2` → `gemini-3.5-flash`).
- `RESUME_TAILORING`: High output context window (`gemini-3.7-flash` → `z-ai/glm-5.2` → `gemini-3.6-flash` → `minimax-m3`).
- `SCREENING_QA`: Natural, non-cliché candidate voice (`gemini-3.7-flash` → `z-ai/glm-5.2` → `moonshotai/kimi-k2.6` → `gemini-3.5-flash`).
- `RESUME_PARSING`: Structured JSON parsing with AST fallback (`gemini-3.7-flash` → `gemini-3.5-flash` → `deepseek-v4-flash`).

## Consequences

- >99.99% operational uptime without user-facing disruption during API quota spikes.
- True zero-dollar inference by orchestrating multiple free-tier allocations.
- Immediate failover without 90s retry blocking.
- Preserves strong typing via Zod schema enforcement across all provider endpoints.
