import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  generateInPageExtractorScript,
  mapFormFields,
} from "./form-mapper";
import type {
  BrowserRunnerOptions,
  BrowserRunnerOutcome,
  CandidateProfilePayload,
  FieldFillResult,
  FormFieldMapping,
  InspectionHighlightColors,
  NormalizedFormField,
  RunnerProgressEvent,
  RunnerState,
} from "./types";

export const DEFAULT_INSPECTION_COLORS: InspectionHighlightColors = {
  green: "rgba(16, 185, 129, 0.4)",
  amber: "rgba(245, 158, 11, 0.6)",
  red: "rgba(239, 68, 68, 0.6)",
};

export const DEFAULT_BROWSER_PROFILE_DIR = ".scratch/browser-profile";

/**
 * Resolves the persistent browser profile directory.
 */
export function getBrowserProfileDir(customDir?: string): string {
  const profileDir = customDir || path.resolve(process.cwd(), DEFAULT_BROWSER_PROFILE_DIR);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

/**
 * Generates the in-page stylesheet text for non-destructive visual inspection outlines.
 */
export function generateInspectionStylesheet(
  colors: InspectionHighlightColors = DEFAULT_INSPECTION_COLORS
): string {
  return `
    /* Pulse In-DOM Inspection Highlight Styles */
    [data-pulse-highlight="filled"],
    .pulse-highlight-filled {
      outline: 2px solid ${colors.green} !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px ${colors.green} !important;
      background-color: rgba(16, 185, 129, 0.05) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }

    [data-pulse-highlight="review"],
    .pulse-highlight-review {
      outline: 2px solid ${colors.amber} !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px ${colors.amber} !important;
      background-color: rgba(245, 158, 11, 0.05) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }

    [data-pulse-highlight="missing"],
    .pulse-highlight-missing {
      outline: 2px solid ${colors.red} !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px ${colors.red} !important;
      background-color: rgba(239, 68, 68, 0.05) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }

    .pulse-field-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 4px;
      margin-top: 4px;
      margin-bottom: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pulse-field-badge-filled {
      background-color: rgba(16, 185, 129, 0.15);
      color: #065f46;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .pulse-field-badge-review {
      background-color: rgba(245, 158, 11, 0.15);
      color: #92400e;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .pulse-field-badge-missing {
      background-color: rgba(239, 68, 68, 0.15);
      color: #991b1b;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
  `.trim();
}

/**
 * Injects non-destructive in-DOM inspection stylesheet and field highlights into the page.
 */
export async function injectInspectionStyles(
  page: Page,
  fillResults: FieldFillResult[],
  unmappedFields: NormalizedFormField[],
  colors: InspectionHighlightColors = DEFAULT_INSPECTION_COLORS
): Promise<void> {
  const css = generateInspectionStylesheet(colors);

  await page.evaluate(
    ({ stylesheet, results, unmapped }) => {
      // 1. Inject or update style element
      let styleEl = document.getElementById("pulse-inspection-styles");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "pulse-inspection-styles";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = stylesheet;

      // 2. Highlight filled & review fields
      for (const res of results) {
        if (!res.selector) continue;
        try {
          const el = document.querySelector(res.selector);
          if (el) {
            const highlightType = res.tier === 2 ? "review" : "filled";
            el.setAttribute("data-pulse-highlight", highlightType);
            el.classList.add(`pulse-highlight-${highlightType}`);
          }
        } catch {
          // Selector might be custom or invalid for querySelector
        }
      }

      // 3. Highlight unmapped required missing fields
      for (const field of unmapped) {
        if (!field.selector) continue;
        try {
          const el = document.querySelector(field.selector);
          if (el) {
            const highlightType = field.required ? "missing" : "review";
            el.setAttribute("data-pulse-highlight", highlightType);
            el.classList.add(`pulse-highlight-${highlightType}`);
          }
        } catch {
          // Ignore selector errors
        }
      }
    },
    { stylesheet: css, results: fillResults, unmapped: unmappedFields }
  );
}

/**
 * Scrolls the page viewport to the top of the form or the first missing/unmapped required field.
 */
export async function scrollToReviewPosition(
  page: Page,
  unmappedFields: NormalizedFormField[],
  formSelector?: string
): Promise<void> {
  // Find first required unmapped field
  const firstMissing = unmappedFields.find((f) => f.required);

  if (firstMissing?.selector) {
    try {
      const locator = page.locator(firstMissing.selector).first();
      const count = await locator.count();
      if (count > 0) {
        await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
        return;
      }
    } catch {
      // Fall through to form/top scroll
    }
  }

  if (formSelector) {
    try {
      const formLocator = page.locator(formSelector).first();
      const count = await formLocator.count();
      if (count > 0) {
        await formLocator.scrollIntoViewIfNeeded({ timeout: 2000 });
        return;
      }
    } catch {
      // Fall through to window scroll
    }
  }

  // Default: scroll smoothly to top
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/**
 * Attaches a resume PDF file to direct or hidden file inputs.
 */
export async function attachResumeFile(
  page: Page,
  pdfPath: string,
  preferredSelector?: string
): Promise<boolean> {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    return false;
  }

  const resolvedPath = path.resolve(pdfPath);

  // 1. Try preferred selector if provided
  if (preferredSelector) {
    try {
      const fileLocator = page.locator(preferredSelector).first();
      if ((await fileLocator.count()) > 0) {
        await fileLocator.setInputFiles(resolvedPath);
        return true;
      }
    } catch {
      // Fall back to general locator
    }
  }

  // 2. Try standard input[type="file"] selector
  try {
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    if (count > 0) {
      // Attach to the first file input (standard for resume uploads)
      await fileInputs.first().setInputFiles(resolvedPath);
      return true;
    }
  } catch {
    // Fall back to dropzone detection
  }

  // 3. Look for dropzone containers with hidden file input
  try {
    const dropzoneInput = page.locator('[data-testid*="resume" i] input[type="file"], [class*="resume" i] input[type="file"], [id*="resume" i] input[type="file"]').first();
    if ((await dropzoneInput.count()) > 0) {
      await dropzoneInput.setInputFiles(resolvedPath);
      return true;
    }
  } catch {
    // Ignored
  }

  return false;
}

/**
 * Launches persistent browser context using system Google Chrome or Chromium.
 */
export async function launchPersistentBrowserContext(
  options: Partial<BrowserRunnerOptions> = {}
): Promise<BrowserContext> {
  const userDataDir = getBrowserProfileDir(options.userDataDir);
  const headless = options.headless ?? false;
  const channel = options.channel ?? "chrome";
  const slowMo = options.slowMo ?? 0;
  const viewport = options.viewport ?? { width: 1280, height: 900 };

  const launchArgs = [
    "--disable-blink-features=AutomationControlled",
    "--no-default-browser-check",
    "--no-first-run",
    "--disable-infobars",
    "--window-size=1280,900",
  ];

  try {
    // Attempt launching with specified channel (e.g. 'chrome')
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      channel,
      slowMo,
      viewport,
      args: launchArgs,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    return context;
  } catch (error) {
    // If system Chrome channel fails (e.g. running in CI or container without google-chrome binary),
    // fallback gracefully to standard bundled Chromium
    if (channel === "chrome") {
      const fallbackContext = await chromium.launchPersistentContext(userDataDir, {
        headless,
        slowMo,
        viewport,
        args: launchArgs,
        ignoreDefaultArgs: ["--enable-automation"],
      });
      return fallbackContext;
    }
    throw error;
  }
}

/**
 * Emulates human keystrokes when typing into an input field or textarea.
 */
export async function emulateHumanTyping(
  page: Page,
  selector: string,
  value: string,
  typingDelay = 25
): Promise<void> {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await locator.click({ timeout: 2000 }).catch(() => {});
  
  // Clear any existing value
  await locator.fill("");

  if (typingDelay > 0 && typeof locator.pressSequentially === "function") {
    await locator.pressSequentially(value, { delay: typingDelay });
  } else {
    await locator.fill(value);
  }

  // Trigger change event to ensure reactive form listeners (React/Vue/Angular) register the update
  await locator.dispatchEvent("change").catch(() => {});
}

/**
 * Fills mapped form fields into the live page.
 */
export async function fillFormFields(
  page: Page,
  mappedFields: FormFieldMapping[],
  candidateData: CandidateProfilePayload,
  options: Partial<BrowserRunnerOptions> = {}
): Promise<{ results: FieldFillResult[]; resumesUploaded: number }> {
  const results: FieldFillResult[] = [];
  let resumesUploaded = 0;
  const typingDelay = options.humanTypingDelay ?? 20;
  const resumePath = options.resumePath || candidateData.profile.resumePath;

  for (const mapping of mappedFields) {
    const selector = mapping.selector;
    if (!selector) continue;

    try {
      const locator = page.locator(selector).first();
      const exists = (await locator.count()) > 0;

      if (!exists && mapping.field !== "resume") {
        results.push({
          field: mapping.field,
          selector,
          status: "skipped",
          tier: mapping.tier,
          action: mapping.action,
          value: mapping.value,
          error: "Element not found on page",
        });
        continue;
      }

      // 1. File upload
      if (mapping.field === "resume" || mapping.action === "upload") {
        if (resumePath) {
          const uploaded = await attachResumeFile(page, resumePath, selector);
          if (uploaded) {
            resumesUploaded++;
            results.push({
              field: mapping.field,
              selector,
              status: "filled",
              tier: mapping.tier,
              action: "upload",
              value: resumePath,
            });
            continue;
          }
        }
      }

      // 2. Text / Textarea / Email / Tel / Url inputs
      if (
        mapping.action === "fill" ||
        (!mapping.action && mapping.value !== undefined)
      ) {
        const val = mapping.value ?? "";
        await emulateHumanTyping(page, selector, val, typingDelay);

        results.push({
          field: mapping.field,
          selector,
          status: "filled",
          tier: mapping.tier,
          action: "fill",
          value: val,
        });
        continue;
      }

      // 3. Dropdown / Select
      if (mapping.action === "select") {
        const val = mapping.value ?? "";
        let selected = false;

        // Try native select
        try {
          await locator.selectOption({ value: val }, { timeout: 1500 });
          selected = true;
        } catch {
          // Try selecting by label
          try {
            await locator.selectOption({ label: val }, { timeout: 1500 });
            selected = true;
          } catch {
            // Might be custom select / combobox
            try {
              await locator.click({ timeout: 1500 });
              const optionLocator = page.locator(`option:has-text("${val}"), [role="option"]:has-text("${val}"), li:has-text("${val}")`).first();
              if ((await optionLocator.count()) > 0) {
                await optionLocator.click({ timeout: 1500 });
                selected = true;
              }
            } catch {
              // Custom select click failed
            }
          }
        }

        results.push({
          field: mapping.field,
          selector,
          status: selected ? "filled" : "skipped",
          tier: mapping.tier,
          action: "select",
          value: val,
          error: selected ? undefined : "Could not select matching option",
        });
        continue;
      }

      // 4. Checkbox / Radio
      if (mapping.action === "check") {
        try {
          await locator.check({ timeout: 2000 });
        } catch {
          // Fallback to click
          await locator.click({ timeout: 2000 }).catch(() => {});
        }

        results.push({
          field: mapping.field,
          selector,
          status: "filled",
          tier: mapping.tier,
          action: "check",
          value: "checked",
        });
        continue;
      }

      // Fallback
      results.push({
        field: mapping.field,
        selector,
        status: "skipped",
        tier: mapping.tier,
        action: mapping.action,
        value: mapping.value,
        error: "Unhandled action type",
      });
    } catch (err) {
      results.push({
        field: mapping.field,
        selector,
        status: "error",
        tier: mapping.tier,
        action: mapping.action,
        value: mapping.value,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, resumesUploaded };
}

/**
 * Extracts live interactive form schema from a Playwright page using in-page script evaluation.
 */
export async function extractFieldsFromLivePage(page: Page): Promise<NormalizedFormField[]> {
  const script = generateInPageExtractorScript();
  const fields = await page.evaluate<NormalizedFormField[]>(script);
  return fields;
}

/**
 * Core Playwright Automation Orchestrator class.
 */
export class PlaywrightBrowserRunner {
  private context: BrowserContext | null = null;
  private ownContext = false;

  constructor(public defaultOptions: Partial<BrowserRunnerOptions> = {}) {}

  private emitProgress(
    options: BrowserRunnerOptions,
    state: RunnerState,
    step: number,
    totalSteps: number,
    message: string,
    payload?: RunnerProgressEvent["payload"]
  ): void {
    if (options.onProgress) {
      options.onProgress({
        jobId: options.jobId,
        state,
        step,
        totalSteps,
        message,
        timestamp: new Date().toISOString(),
        payload: {
          url: options.url,
          ...payload,
        },
      });
    }
  }

  /**
   * Runs the complete assisted form filling process.
   */
  async run(options: BrowserRunnerOptions): Promise<BrowserRunnerOutcome> {
    const totalSteps = 6;
    let page: Page | null = null;

    try {
      // Step 1: STARTING_BROWSER
      this.emitProgress(
        options,
        "STARTING_BROWSER",
        1,
        totalSteps,
        "Launching persistent Google Chrome session..."
      );

      if (options.browserContext) {
        this.context = options.browserContext;
        this.ownContext = false;
      } else {
        this.context = await launchPersistentBrowserContext(options);
        this.ownContext = true;
      }

      // Step 2: NAVIGATING
      this.emitProgress(
        options,
        "NAVIGATING",
        2,
        totalSteps,
        `Navigating to application page at ${options.url}...`
      );

      const pages = this.context.pages();
      page = pages.length > 0 ? pages[0] : await this.context.newPage();

      await page.goto(options.url, {
        waitUntil: "domcontentloaded",
        timeout: options.timeout ?? 30000,
      });

      // Brief settling time for client-side frameworks (Greenhouse/Lever/Ashby)
      await page.waitForTimeout(1000);

      // Step 3: SCANNING_DOM
      this.emitProgress(
        options,
        "SCANNING_DOM",
        3,
        totalSteps,
        "Scanning interactive ATS form controls and matching candidate profile..."
      );

      const liveFields = await extractFieldsFromLivePage(page);
      const mappingOutcome = await mapFormFields(liveFields, options.candidateData, {
        synthesizeCustomAnswers: true,
      });

      // Step 4: FILLING_FIELDS
      this.emitProgress(
        options,
        "FILLING_FIELDS",
        4,
        totalSteps,
        `Populating ${mappingOutcome.mappedFields.length} mapped form fields with human typing cadence...`,
        {
          platform: mappingOutcome.platform,
          totalFields: liveFields.length,
          filledCount: mappingOutcome.mappedFields.length,
          unmappedCount: mappingOutcome.unmappedFields.length,
        }
      );

      const { results: fillResults, resumesUploaded } = await fillFormFields(
        page,
        mappingOutcome.mappedFields,
        options.candidateData,
        options
      );

      // Also ensure resume attachment if resume file exists and not yet attached
      const resumePath = options.resumePath || options.candidateData.profile.resumePath;
      let finalResumesUploaded = resumesUploaded;
      if (resumePath && finalResumesUploaded === 0) {
        const attached = await attachResumeFile(page, resumePath);
        if (attached) {
          finalResumesUploaded++;
        }
      }

      // Step 5: HIGHLIGHTING_INSPECTION
      if (!options.skipInspectionHighlight) {
        this.emitProgress(
          options,
          "HIGHLIGHTING_INSPECTION",
          5,
          totalSteps,
          "Injecting in-DOM inspection visual highlight outlines (green, amber, red)..."
        );

        await injectInspectionStyles(
          page,
          fillResults,
          mappingOutcome.unmappedFields
        );
      }

      // Step 6: AWAITING_HUMAN_REVIEW
      if (!options.skipScrollToReview) {
        await scrollToReviewPosition(
          page,
          mappingOutcome.unmappedFields,
          mappingOutcome.formSelector
        );
      }

      this.emitProgress(
        options,
        "AWAITING_HUMAN_REVIEW",
        6,
        totalSteps,
        "Form filling complete. Browser ready for candidate review and manual submission.",
        {
          platform: mappingOutcome.platform,
          filledCount: fillResults.filter((r) => r.status === "filled").length,
          unmappedCount: mappingOutcome.unmappedFields.length,
        }
      );

      return {
        jobId: options.jobId,
        url: options.url,
        platform: mappingOutcome.platform,
        status: "awaiting_review",
        filledFields: fillResults,
        unmappedFields: mappingOutcome.unmappedFields,
        totalFields: liveFields.length,
        resumesUploaded: finalResumesUploaded,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emitProgress(
        options,
        "ERROR",
        0,
        totalSteps,
        `Automation error: ${errorMessage}`,
        { error: errorMessage }
      );

      return {
        jobId: options.jobId,
        url: options.url,
        status: "error",
        filledFields: [],
        unmappedFields: [],
        totalFields: 0,
        resumesUploaded: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Closes browser context if owned by this instance.
   */
  async close(): Promise<void> {
    if (this.context && this.ownContext) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}

/**
 * Functional entrypoint for running browser form automation.
 */
export async function runBrowserAutomation(
  options: BrowserRunnerOptions
): Promise<BrowserRunnerOutcome> {
  const runner = new PlaywrightBrowserRunner();
  return runner.run(options);
}
