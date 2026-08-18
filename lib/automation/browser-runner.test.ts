import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  DEFAULT_INSPECTION_COLORS,
  getBrowserProfileDir,
  generateInspectionStylesheet,
  injectInspectionStyles,
  scrollToReviewPosition,
  attachResumeFile,
  emulateHumanTyping,
  extractFieldsFromLivePage,
  PlaywrightBrowserRunner,
  runBrowserAutomation,
} from "./browser-runner";
import type {
  CandidateProfilePayload,
  FieldFillResult,
  NormalizedFormField,
  RunnerProgressEvent,
} from "./types";

test("Playwright Persistent Browser Automation & PDF Upload Engine", async (t) => {
  const fixturesDir = path.resolve(process.cwd(), ".scratch/phase-3/fixtures");
  const greenhouseHtml = fs.readFileSync(
    path.join(fixturesDir, "greenhouse-application.html"),
    "utf-8"
  );
  const leverHtml = fs.readFileSync(
    path.join(fixturesDir, "lever-application.html"),
    "utf-8"
  );
  const ashbyHtml = fs.readFileSync(
    path.join(fixturesDir, "ashby-application.html"),
    "utf-8"
  );
  const candidatePayload: CandidateProfilePayload = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "candidate-profile.json"), "utf-8")
  );

  // Ensure dummy test PDF exists for attachment testing
  const dummyPdfPath = path.join(fixturesDir, "test-resume.pdf");
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4 sample resume content");
  }

  await t.test("Browser profile directory resolution", () => {
    const defaultDir = getBrowserProfileDir();
    assert.ok(defaultDir.includes(".scratch/browser-profile"));
    assert.ok(fs.existsSync(defaultDir));

    const customDir = path.resolve(process.cwd(), ".scratch/test-profile-dir");
    const resolved = getBrowserProfileDir(customDir);
    assert.equal(resolved, customDir);
    assert.ok(fs.existsSync(customDir));
  });

  await t.test("Inspection stylesheet generator and color tokens", () => {
    const css = generateInspectionStylesheet(DEFAULT_INSPECTION_COLORS);
    assert.ok(css.includes("data-pulse-highlight=\"filled\""));
    assert.ok(css.includes("rgba(16, 185, 129, 0.4)"));
    assert.ok(css.includes("data-pulse-highlight=\"review\""));
    assert.ok(css.includes("rgba(245, 158, 11, 0.6)"));
    assert.ok(css.includes("data-pulse-highlight=\"missing\""));
    assert.ok(css.includes("rgba(239, 68, 68, 0.6)"));
    assert.ok(css.includes(".pulse-field-badge-filled"));
  });

  // Browser-based headless integration tests
  let browserContext: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const tempProfileDir = path.resolve(process.cwd(), ".scratch/test-headless-profile");
    browserContext = await chromium.launchPersistentContext(tempProfileDir, {
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1280, height: 900 },
    });
    page = await browserContext.newPage();
  } catch (err) {
    // If persistent context cannot launch in environment, log and continue
    console.warn("Headless browser init warning:", err);
  }

  if (page && browserContext) {
    await t.test("Extracts interactive field schema from live loaded HTML page", async () => {
      await page!.setContent(greenhouseHtml);
      const fields = await extractFieldsFromLivePage(page!);

      assert.ok(fields.length > 5);
      const firstField = fields.find((f) => f.name === "first_name" || f.id === "first_name");
      assert.ok(firstField);
      assert.equal(firstField?.required, true);
    });

    await t.test("Emulates human typing with keystroke delay", async () => {
      await page!.setContent(`
        <form>
          <input id="first_name" name="first_name" type="text" />
        </form>
      `);

      await emulateHumanTyping(page!, "#first_name", "Jane", 5);
      const value = await page!.$eval("#first_name", (el) => (el as HTMLInputElement).value);
      assert.equal(value, "Jane");
    });

    await t.test("Direct file input attachment via setInputFiles on hidden and visible dropzones", async () => {
      // 1. Standard file input
      await page!.setContent(`
        <form>
          <input id="resume-upload" type="file" name="resume" />
        </form>
      `);

      const attached = await attachResumeFile(page!, dummyPdfPath, "#resume-upload");
      assert.equal(attached, true);

      const filesCount = await page!.$eval(
        "#resume-upload",
        (el) => (el as HTMLInputElement).files?.length ?? 0
      );
      assert.equal(filesCount, 1);

      // 2. Hidden file input inside custom dropzone
      await page!.setContent(`
        <div data-testid="resume-dropzone" class="resume-container">
          <div class="dropzone-label">Upload Resume</div>
          <input type="file" style="display: none;" />
        </div>
      `);

      const attachedHidden = await attachResumeFile(page!, dummyPdfPath);
      assert.equal(attachedHidden, true);
    });

    await t.test("In-DOM non-destructive CSS inspection highlight injection", async () => {
      await page!.setContent(`
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="linkedin" name="linkedin" type="text" />
          <input id="required_unmapped" name="custom_req" type="text" required />
        </form>
      `);

      const fillResults: FieldFillResult[] = [
        {
          field: "firstName",
          selector: "#first_name",
          status: "filled",
          tier: 1,
          action: "fill",
          value: "Jane",
        },
        {
          field: "linkedIn",
          selector: "#linkedin",
          status: "filled",
          tier: 2,
          action: "fill",
          value: "https://linkedin.com/in/janedoe",
        },
      ];

      const unmappedFields: NormalizedFormField[] = [
        {
          id: "required_unmapped",
          selector: "#required_unmapped",
          label: "Custom Required Field",
          type: "text",
          required: true,
        },
      ];

      await injectInspectionStyles(page!, fillResults, unmappedFields);

      // Verify style tag was injected
      const styleInjected = await page!.$eval("#pulse-inspection-styles", (el) => !!el);
      assert.equal(styleInjected, true);

      // Verify data-pulse-highlight attributes
      const firstNameHighlight = await page!.$eval(
        "#first_name",
        (el) => el.getAttribute("data-pulse-highlight")
      );
      assert.equal(firstNameHighlight, "filled");

      const linkedinHighlight = await page!.$eval(
        "#linkedin",
        (el) => el.getAttribute("data-pulse-highlight")
      );
      assert.equal(linkedinHighlight, "review");

      const unmappedHighlight = await page!.$eval(
        "#required_unmapped",
        (el) => el.getAttribute("data-pulse-highlight")
      );
      assert.equal(unmappedHighlight, "missing");
    });

    await t.test("Scrolls to review position (first missing required field)", async () => {
      await page!.setContent(`
        <div style="height: 1500px;">Spacing</div>
        <input id="missing_field" type="text" required />
      `);

      const unmappedFields: NormalizedFormField[] = [
        {
          id: "missing_field",
          selector: "#missing_field",
          label: "Missing Field",
          type: "text",
          required: true,
        },
      ];

      await scrollToReviewPosition(page!, unmappedFields);
      // Ensure function executes without throwing
      assert.ok(true);
    });

    await t.test("Orchestrator populates form and emits sequential progress states", async () => {
      const events: RunnerProgressEvent[] = [];
      const runner = new PlaywrightBrowserRunner();

      // Create a test page route / data URL with Greenhouse form
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(greenhouseHtml)}`;

      const outcome = await runner.run({
        jobId: "test-job-123",
        url: dataUri,
        candidateData: {
          ...candidatePayload,
          profile: {
            ...candidatePayload.profile,
            resumePath: dummyPdfPath,
          },
        },
        browserContext,
        headless: true,
        humanTypingDelay: 0,
        onProgress: (evt) => {
          events.push(evt);
        },
      });

      assert.equal(outcome.status, "awaiting_review");
      assert.equal(outcome.jobId, "test-job-123");
      assert.ok(outcome.filledFields.length > 0);
      assert.equal(outcome.resumesUploaded, 1);

      // Verify sequence of emitted events
      const stateSequence = events.map((e) => e.state);
      assert.ok(stateSequence.includes("STARTING_BROWSER"));
      assert.ok(stateSequence.includes("NAVIGATING"));
      assert.ok(stateSequence.includes("SCANNING_DOM"));
      assert.ok(stateSequence.includes("FILLING_FIELDS"));
      assert.ok(stateSequence.includes("HIGHLIGHTING_INSPECTION"));
      assert.ok(stateSequence.includes("AWAITING_HUMAN_REVIEW"));
    });

    await t.test("runBrowserAutomation functional wrapper populates Lever form", async () => {
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(leverHtml)}`;

      const outcome = await runBrowserAutomation({
        jobId: "test-job-lever",
        url: dataUri,
        candidateData: {
          ...candidatePayload,
          profile: {
            ...candidatePayload.profile,
            resumePath: dummyPdfPath,
          },
        },
        browserContext,
        headless: true,
        humanTypingDelay: 0,
      });

      assert.equal(outcome.status, "awaiting_review");
      assert.ok(outcome.filledFields.length > 0);
      assert.equal(outcome.resumesUploaded, 1);
    });

    await t.test("runBrowserAutomation functional wrapper populates Ashby form", async () => {
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(ashbyHtml)}`;

      const outcome = await runBrowserAutomation({
        jobId: "test-job-ashby",
        url: dataUri,
        candidateData: {
          ...candidatePayload,
          profile: {
            ...candidatePayload.profile,
            resumePath: dummyPdfPath,
          },
        },
        browserContext,
        headless: true,
        humanTypingDelay: 0,
      });

      assert.equal(outcome.status, "awaiting_review");
      assert.ok(outcome.filledFields.length > 0);
      assert.equal(outcome.resumesUploaded, 1);
    });

    // Cleanup browser context
    await browserContext.close().catch(() => {});
  }
});
