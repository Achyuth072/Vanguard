# ADR 0007: Browser Automation UX and Human Handoff Workflow

## Context

Phase 3 implements browser-assisted ATS form filling while enforcing the non-negotiable invariant that the human candidate retains full review authority and executes the final submission. To deliver a frictionless, reliable experience across diverse ATS platforms (Greenhouse, Lever, Ashby, Workday), we must establish:

1. **Browser Process Lifecycle**: How Vanguard opens and coordinates the browser without locking the user's primary browser or losing persistent auth.
2. **Real-time UX Synchronization**: How the Vanguard web application reflects the automation runner's step-by-step progress and handles edge cases (e.g. anti-bot challenges, navigation delays).
3. **In-Browser Visual Inspection**: How filled, ambiguous, or missing fields are made immediately obvious to the candidate inside the open browser window.
4. **Submission Detection & Handoff**: How Vanguard reliably tracks when the user completes the submission on the ATS portal and records the outcome in SQLite.

## Decision

Vanguard adopts a **Coordinated Dual-Interface Handoff Model** backed by Playwright persistent sessions, Server-Sent Events (SSE) progress streaming, in-browser visual inspection styling, and hybrid submission detection.

### 1. Browser Instance Lifecycle
- **Isolated Dedicated Session**: Vanguard launches Playwright using a dedicated persistent profile (`.scratch/browser-profile` / `~/.pulse/browser-profile`) with system Google Chrome (`channel: 'chrome'`). This avoids port conflicts and profile locking with the user's daily Chrome instance while retaining ATS portal logins and cookies.
- **Session Reuse**: If the persistent browser is already open from a prior fill, Vanguard focuses or opens a new tab rather than spawning duplicate windows.

### 2. Step-by-Step User Flow & State Machine
1. **Trigger**: User clicks "Fill Application in Browser" inside the `ApplicationPreparationDrawer` in Vanguard UI.
2. **Status Stream (`/api/automation/stream?jobId=...`)**:
   - `STARTING_BROWSER`: Persistent Chrome window opens headed.
   - `NAVIGATING`: Browser loads the ATS application URL.
   - `SCANNING_DOM`: Form schema is extracted; Tier 1 deterministic matchers and Tier 2 LLM fallbacks run.
   - `FILLING_FIELDS`: Inputs are typed at human cadence, dropdowns selected, and tailored resume PDF attached via `setInputFiles`.
   - `HIGHLIGHTING_INSPECTION`: In-DOM non-destructive CSS highlight badges are injected.
   - `AWAITING_HUMAN_REVIEW`: Runner halts before the submission button and scrolls to the first unmapped/required field or top of form.
3. **Review & Human Action**: Candidate reviews pre-filled answers in the visible browser window, answers any unmapped fields or custom screening questions, completes any interactive CAPTCHA, and clicks the ATS "Submit Application" button.
4. **Outcome Recording**:
   - **Automated Detection**: Playwright monitors for post-submit navigation (e.g. `/confirmation`, `/thank-you`, `/submitted`), success DOM nodes, or 200 responses on submission endpoints. On trigger, it marks the application `APPLIED` and logs an `APPLICATION_SUBMITTED` event.
   - **Manual Fallback**: The Vanguard drawer displays persistent action buttons ("Confirm Applied", "Keep Draft / Re-fill", "Abort") allowing instant manual state reconciliation at any time.

### 3. In-Browser Visual Inspection
- Playwright injects a lightweight, non-destructive stylesheet into the target page:
  - **Green Outline (`rgba(16, 185, 129, 0.4)`)**: Deterministically or semantically populated fields.
  - **Amber Outline (`rgba(245, 158, 11, 0.6)`)**: Low-confidence LLM answers or fields requiring candidate double-checking.
  - **Red Outline (`rgba(239, 68, 68, 0.6)`)**: Required fields where no candidate fact was found.
- The Vanguard UI simultaneously renders an "Inspection Checklist" displaying the exact values populated and flagging any unmapped inputs with quick "Copy to Clipboard" chips.

### 4. Resiliency & Multi-Page Wizards
- For multi-step ATS flows (e.g. Workday multi-step wizards), the runner automates page-by-page filling, pausing with a visible "Next Step" prompt in Vanguard UI or advancing when the user navigates to subsequent steps.
- If anti-bot verification (Cloudflare Turnstile, hCaptcha) appears, the automation state emits `BOT_CHECK_PAUSED`, displaying a banner in Vanguard prompting the user to solve it directly in the headed browser.

## Consequences

- Seamless human-in-the-loop transition with full visibility into what Vanguard automated.
- In-browser styling eliminates the need for users to guess which inputs were filled or missed.
- Hybrid submission detection ensures zero missing state updates even on custom single-page ATS portals.
