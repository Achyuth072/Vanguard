# ADR 0013: Dual-Mode Deterministic AST & AI Candidate Resume Parser

## Context

Candidates need to import and update their master profiles by uploading or pasting Markdown/text resumes. A robust candidate parser must extract:
- Scalar metadata: Name, Target Role, Minimum Salary, Currency, Years of Experience, Remote Preference, Preferred Locations.
- Categorized Skills: Array of `{ name, category, yearsOfExperience, highlighted }`.
- Structured Projects: Array of `{ name, description, role, technologies, highlights, metrics, liveUrl, githubUrl, relevanceRationale }`.
- Employment Records: Array of `{ company, role, location, remoteStatus, startDate, endDate, current, description, achievements, technologies }`.

Relying solely on LLM extraction introduces token costs, non-deterministic structuring, and potential failure during offline operation. Relying solely on regex/AST parsing fails when users supply non-standard Markdown layouts.

## Decision

Implement a **Dual-Mode Candidate Resume Parser** in `lib/candidate-parser.ts`:

1. **Deterministic AST Markdown Parser (`parseResumeMarkdownToProfile`)**:
   - Uses regex-driven Markdown AST parsing to detect standard headings (`# Skills`, `## Projects`, `## Experience`, `## Preferences`).
   - Parses inline key-value pairs (`Salary:`, `Currency:`, `Experience:`, `Locations:`).
   - Extracts nested sub-bullets for project metrics, technologies, and achievements.
   - Operates in 0ms with 100% deterministic fidelity and zero LLM calls.

2. **AI-Assisted Structured Fallback (`parseResumeMarkdownWithAI`)**:
   - When deterministic parsing produces an empty profile or when unstructured resume text is provided, invokes `generateStructuredWithFallback` under the `RESUME_PARSING` workload profile.
   - Validates extraction strictly against `CandidateResumeExtractionSchema`.
   - If AI candidate inference is completely exhausted, gracefully falls back to the deterministic AST parser output to ensure user workflows are never blocked.

## Consequences

- Instantaneous zero-cost parsing for well-formed Markdown resumes.
- High resilience for loosely formatted or pasted text resumes via AI fallback.
- Guaranteed schema validation ensuring the candidate database model is always populated cleanly.
