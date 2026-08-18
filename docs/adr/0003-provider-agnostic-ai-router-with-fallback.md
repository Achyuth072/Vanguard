# ADR 0003: Provider-Agnostic AI Router with Fallback

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
