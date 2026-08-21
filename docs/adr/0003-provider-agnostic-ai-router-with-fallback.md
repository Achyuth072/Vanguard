# ADR 0003: Provider-Agnostic AI Router with Fallback

> [!NOTE]
> **Status**: Superseded by [ADR 0012: Multi-Tier Cascading AI Inference Engine & In-Flight Circuit Breaker](0012-multi-tier-cascading-ai-inference-engine-and-circuit-breaker.md).
>
> This ADR documented the initial Phase 1 two-provider fallback design (OpenRouter → Google Gemini). The architecture has since evolved into a 6-tier cascading matrix with in-flight circuit breakers and workload profiles.

## Context

Running personal job search workflows requires structured AI evaluation (fit scoring, strengths, gaps, risks, reasoning) without incurring monthly subscription fees. Relying on a single free-tier provider creates availability risks when quotas or limits fluctuate.

## Decision

Implement an internal `AIProvider` router utilizing the Vercel AI SDK (`ai` package) with Zod schema validation (`generateObject`).

The router defaults to OpenRouter (`@ai-sdk/openai`) targeting free model pools (such as `GPT-OSS-120B` or equivalents). When rate-limit status codes or quota exceptions occur, the router automatically fails over to the Google Gemini free tier (`@ai-sdk/google`). Application features call task abstractions (`scoreJob`, `extractJob`, `tailorApplication`) rather than provider-specific APIs.

## Consequences

- Zero-cost operation matching the ₹0/month requirement.
- High resilience against individual provider downtime or rate limits.
- Guaranteed strongly typed JSON outputs validated via Zod schemas across all models.
- Easily extensible to local providers (e.g. Ollama) in future phases.
