# ADR 0004: Resume Tailoring and Grounded Application Answers

## Context

Job applications require customized resumes and tailored answers to portal-specific screening questions. Mass-generating generic AI resumes leads to low application quality and high hallucination risk (inventing technologies, metrics, or experiences not possessed by the candidate). Furthermore, candidates need both structured resume data (selected projects, key matching points) and a clean, editable, copyable Markdown resume representation alongside instant answers to custom portal questions.

## Decision

Implement AI Resume Tailoring and Application Answering in `lib/ai/router.ts` and `lib/tailoring/` using a two-stage factual grounding pipeline:

1. **Structured Candidate Selection**: The AI router evaluates the candidate's master factual repository (`projects`, `experiences`, `skills`) against the target job description to select the 2–3 most relevant projects and prioritizes matching skills without altering source facts.
2. **Grounded Drafting**: Generates a tailored executive summary, aligned bullet points, and a full Markdown resume document grounded exclusively in candidate profile data. Inventing unevidenced metrics, skills, or titles is prohibited via strict system invariants and Zod schema validation.
3. **Application Entity Extensions**: Store tailored assets directly on the `Application` model via strongly-typed JSON columns (`tailoredResume` and `questionAnswers`), maintaining local SQLite simplicity per ADR 0001 without extra relational table overhead.
4. **Interactive Question Answering**: Provide both automated preset answer generation (role motivation, technical fit, work model/compensation) and an ad-hoc custom question solver allowing candidates to paste portal prompts and receive instant fact-grounded responses with 1-click clipboard copying.

## Consequences

- Applications receive high-signal, role-specific materials in seconds without hallucination risk.
- The candidate remains the final editor and submitter with live Markdown editing and copy tools.
- Single-user local database structure remains simple and fully exportable.
- Automated feed scrapers and browser autofill remain isolated to subsequent milestones.
