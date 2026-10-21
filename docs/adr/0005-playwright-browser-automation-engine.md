# ADR 0005: Playwright Browser Automation Engine for Assisted Applications

## Context

Phase 3 introduces browser automation to populate complex job application forms across ATS platforms (Greenhouse, Lever, Ashby, Workday, SmartRecruiters) using pre-generated candidate facts and tailored answers. Key challenges include:

1. Seamlessly uploading tailored resume PDF documents without OS file-dialog blocking.
2. Preserving session cookies and logins across portal visits without locking the user's primary daily browser.
3. Avoiding anti-bot triggers (Cloudflare Turnstile, DataDome, PerimeterX) during automated form filling.
4. Keeping the browser window open and visible for the candidate to review entries, answer unmapped fields, solve CAPTCHAs, and execute the final submission manually.

Alternative approaches considered:
- **Chrome Extension**: Rejected because Chrome's web security sandbox prevents content scripts from programmatically attaching local file paths to `<input type="file">` without user file picker interaction, and extension-to-Next.js IPC adds unnecessary packaging and maintenance overhead.
- **Puppeteer with Community Stealth**: Rejected due to reliance on fragile third-party patches and less capable auto-waiting / multi-frame locators.
- **Raw Chrome DevTools Protocol (CDP)**: Rejected due to high development overhead of building a custom DOM automation driver from scratch.

## Decision

Adopt **Playwright (Node.js)** with persistent browser contexts and system Google Chrome (`channel: 'chrome'`):

1. **Persistent Browser Context**: Launch browser via `playwright.chromium.launchPersistentContext(userDataDir, { headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] })` pointing to `.scratch/browser-profile` or `~/.pulse/browser-profile`. This preserves login sessions (Workday, Google, LinkedIn) without interfering with the user's daily Chrome profile.
2. **Native File Uploads**: Use Playwright's `locator('input[type="file"]').setInputFiles(pdfPath)` to directly attach tailored resume PDFs even when the underlying input is hidden behind custom ATS dropzone UI.
3. **Anti-Bot Resistance**: Utilize the local Google Chrome binary (real user-agent, WebGL, fonts, and codecs) with `AutomationControlled` disabled, and emulate human typing cadences for open-ended textareas.
4. **Human-in-the-Loop Handoff**: Form filling stops at the review stage before the final submit button. The browser window remains visible, headed, and interactive for the user to inspect, solve any interactive CAPTCHA, and complete the application.
5. **Local-First Integration**: Place automation orchestration under `lib/automation/` invoked directly within Next.js API routes or Server Actions in the local Node runtime.

> **Update (2026-10-20) — Host Chrome attachment for containerized runs.** The self-hosted Docker runtime (see `.scratch/self-host-mobile/`) ships no Chrome binary, so the persistent-context launch above cannot run in-container. When `PLAYWRIGHT_CDP_ENDPOINT` is set, `lib/automation/browser-runner.ts` instead attaches to an already-running headed host Chrome with `chromium.connectOverCDP()`, reusing that browser's default context (cookies, logins) and window for human-in-the-loop review. Playwright still performs all DOM automation, so this does not revisit the "Raw Chrome DevTools Protocol" rejection in the Context above. When the endpoint is unset or unreachable, the runner falls back to the persistent context described in Decision 1.

## Consequences

- Full automation of repetitive ATS form filling and document attachment while preserving the human-in-the-loop invariant.
- Resume PDFs attach programmatically without OS file picker friction.
- No external browser cloud service or remote infrastructure required, preserving zero-cost inference and local-first persistence.
