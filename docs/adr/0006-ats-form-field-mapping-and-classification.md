# ADR 0006: ATS Form Schema Classification and Field Mapping Engine

## Context

Phase 3 implements browser automation to assist candidates in filling out job application forms across major Applicant Tracking Systems (ATS) — including Greenhouse, Lever, Ashby, Workday, and SmartRecruiters. 

Job application forms present significant DOM heterogeneity:
1. **DOM Diversity**: Different ATS platforms use varying attribute patterns (`id`, `name`, `data-automation-id`, `data-test`, `autocomplete`, ARIA attributes).
2. **Form Control Variety**: Controls range from standard HTML `<input>`/`<select>` elements to custom JavaScript/React single/multi-select comboboxes, custom radio pill groups, and masked file upload zones.
3. **Custom Screening Questions**: Employers attach free-form behavioral questions, salary expectations, notice periods, and work authorization inquiries.
4. **Reliability & Latency**: Deterministic matching must run instantaneously (<50ms) without consuming AI tokens, while open-ended or ambiguous questions require semantic LLM understanding grounded in candidate facts.

Alternative approaches considered:
- **Purely Deterministic Regex/Selector Scraping**: Fails on custom employer questions, dynamic React SPAs with hashed IDs (Ashby), and non-standard dropdowns.
- **Full-Page Vision / Raw Screenshot LLM Agents**: Slow (10-30s per action), expensive, prone to coordinate hallucinations, and unnecessary when DOM access is directly available via Playwright.
- **Pure DOM-to-LLM on every field**: Introduces unnecessary LLM latency and rate-limit consumption for standard demographic fields (first name, email, phone).

## Decision

Adopt a **Two-Tiered Hybrid Form Mapping Engine** combining a deterministic fast-path heuristic with an LLM-assisted semantic classifier:

### Tier 1: Deterministic Heuristic Matcher (Fast Path)
1. **Standard Demographic & Link Resolution**:
   - Primary matching on standard `autocomplete` tokens (`given-name`, `family-name`, `name`, `email`, `tel`, `address-line1`, `address-level2`, `postal-code`, `country-name`, `url`).
   - Platform-specific attribute catalogs (e.g. Lever `input[name="name"]`, `input[name="urls[LinkedIn]"]`; Greenhouse `job_application[first_name]`; Workday `[data-automation-id="legalNameSection_firstName"]`).
   - Standard HTML `<label for="...">`, `aria-label`, and placeholder regex matching.
2. **Deterministic Data Transformations**:
   - Automatic name composition (`${profile.name}`) for single-field forms (Lever) vs first/last splitting for multi-field forms (Greenhouse, Workday).
   - E.164 phone formatting and URL protocol normalization.
   - Standard EEO / Demographics auto-mapping (defaulting to "Decline to self-identify" / candidate preferences).

### Tier 2: LLM-Assisted Semantic Schema Classifier (Fallback & Custom Questions)
1. **Lightweight DOM Schema Extraction**:
   - In-page Playwright evaluator inspects all visible unmapped interactive form controls and extracts a sanitized schema (`{ id, selector, label, type, required, options? }`).
2. **Context-Grounded Inference**:
   - Sends unmapped fields along with Candidate Facts and pre-generated `ApplicationAnswer[]` to `AIRouter` (OpenRouter/Groq/Gemini free tier).
   - Dynamically synthesizes answers for unmapped custom screening questions using `answerCustomQuestion()`.
3. **Structured Mapping Output**:
   - Returns structured field-to-value assignments (`{ [fieldId]: string | boolean | string[] }`).

### Field Interaction & File Upload Layer (Playwright Automation)
1. **Text & Textareas**: `locator.fill(value)` with optional human-typing cadence emulation for long textareas.
2. **Dropdowns & Comboboxes**: Native `<select>` via `locator.selectOption()` and ARIA `[role="combobox"]` via click-to-open and option selection.
3. **Radios & Checkboxes**: Exact and fuzzy label matching with `locator.check()`.
4. **Resume Attachment**: Programmatic upload via `locator('input[type="file"]').setInputFiles(tailoredPdfPath)`.

## Consequences

- 90%+ of standard fields fill instantaneously (<50ms) without consuming AI tokens or hitting rate limits.
- Custom employer questions, complex dropdowns, and dynamic React forms are mapped with high semantic accuracy grounded in candidate facts.
- Zero-cost inference invariant preserved via selective fallback to free cloud AI providers.
- Strict human-in-the-loop invariant preserved: browser pauses prior to submission for human review and approval.
