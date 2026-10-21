import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  DEFAULT_INSPECTION_COLORS,
  getBrowserProfileDir,
  resolveBrowserProfileDir,
  resolveCdpEndpoint,
  connectCdpBrowserContext,
  launchBrowserContext,
  generateInspectionStylesheet,
  injectInspectionStyles,
  scrollToReviewPosition,
  attachResumeFile,
  emulateHumanTyping,
  extractFieldsFromLivePage,
  checkForSubmissionSuccess,
  setupSubmissionMonitoring,
  fillFormFields,
  PlaywrightBrowserRunner,
  runBrowserAutomation,
} from "./browser-runner";
import type {
  CandidateProfilePayload,
  FieldFillResult,
  FormFieldMapping,
  NormalizedFormField,
  RunnerProgressEvent,
} from "./types";

function createFakePage(): Page {
  return {
    isClosed: () => false,
    url: () => "about:blank",
  } as unknown as Page;
}

function createFakeBrowserContext(page: Page = createFakePage()): BrowserContext {
  return {
    pages: () => [page],
    newPage: async () => page,
  } as unknown as BrowserContext;
}

function createFakeBrowser(context: BrowserContext): Browser {
  return {
    contexts: () => [context],
    newContext: async () => context,
    close: async () => {},
  } as unknown as Browser;
}

interface MockableChromium {
  connectOverCDP: (endpoint: string) => Promise<Browser>;
  launchPersistentContext: (
    userDataDir: string,
    options?: Record<string, unknown>
  ) => Promise<BrowserContext>;
}

function mockConnectOverCDP(
  t: TestContext,
  implementation: (endpoint: string) => Promise<Browser>
) {
  return t.mock.method(
    chromium as unknown as MockableChromium,
    "connectOverCDP",
    implementation
  );
}

function mockLaunchPersistentContext(
  t: TestContext,
  implementation: (userDataDir: string) => Promise<BrowserContext>
) {
  return t.mock.method(
    chromium as unknown as MockableChromium,
    "launchPersistentContext",
    implementation
  );
}

async function withEnv<T>(
  key: string,
  value: string | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const previous = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

test("Host CDP browser automation adapter", async (t) => {
  await t.test("resolves CDP endpoint precedence and browser profile overrides", () => {
    assert.equal(
      resolveCdpEndpoint(
        { cdpEndpoint: "http://localhost:9222" },
        { PLAYWRIGHT_CDP_ENDPOINT: "http://env-host:9222" }
      ),
      "http://localhost:9222"
    );
    assert.equal(
      resolveCdpEndpoint({}, { PLAYWRIGHT_CDP_ENDPOINT: "  http://env-host:9222  " }),
      "http://env-host:9222"
    );
    assert.equal(resolveCdpEndpoint({}, { PLAYWRIGHT_CDP_ENDPOINT: "   " }), undefined);
    assert.equal(resolveCdpEndpoint({}, {}), undefined);

    assert.equal(
      resolveBrowserProfileDir(undefined, { BROWSER_PROFILE_DIR: "/data/browser-profile" }),
      "/data/browser-profile"
    );
    assert.equal(
      resolveBrowserProfileDir(".scratch/explicit-profile", {
        BROWSER_PROFILE_DIR: "/data/browser-profile",
      }),
      path.resolve(".scratch/explicit-profile")
    );
    assert.ok(
      resolveBrowserProfileDir(undefined, {}).includes(".scratch/browser-profile")
    );
  });

  await t.test("connects over CDP and reuses the default context and active page", async (t) => {
    const page = createFakePage();
    const context = createFakeBrowserContext(page);
    const browser = createFakeBrowser(context);
    let connectedEndpoint: string | undefined;

    const connectMock = mockConnectOverCDP(t, async (endpoint: string) => {
      connectedEndpoint = endpoint;
      return browser;
    });

    const launched = await launchBrowserContext({
      cdpEndpoint: "http://host.docker.internal:9222",
    });

    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(connectedEndpoint, "http://host.docker.internal:9222");
    assert.equal(launched.mode, "cdp");
    assert.equal(launched.context, context);
    assert.equal(launched.page, page);
    assert.equal(launched.browser, browser);
    assert.equal(launched.cdpEndpoint, "http://host.docker.internal:9222");
    assert.equal(launched.fallbackReason, undefined);
  });

  await t.test("honors PLAYWRIGHT_CDP_ENDPOINT when no option is provided", async (t) => {
    const browser = createFakeBrowser(createFakeBrowserContext());
    let connectedEndpoint: string | undefined;
    mockConnectOverCDP(t, async (endpoint: string) => {
      connectedEndpoint = endpoint;
      return browser;
    });

    const launched = await withEnv("PLAYWRIGHT_CDP_ENDPOINT", "http://env-host:9222", () =>
      launchBrowserContext({})
    );

    assert.equal(connectedEndpoint, "http://env-host:9222");
    assert.equal(launched.mode, "cdp");
    assert.equal(launched.cdpEndpoint, "http://env-host:9222");
  });

  await t.test("creates a context and page when the CDP browser has none", async (t) => {
    const page = createFakePage();
    const context = {
      pages: () => [] as Page[],
      newPage: async () => page,
    } as unknown as BrowserContext;
    let newContextCalls = 0;
    const browser = {
      contexts: () => [] as BrowserContext[],
      newContext: async () => {
        newContextCalls++;
        return context;
      },
    } as unknown as Browser;

    mockConnectOverCDP(t, async () => browser);

    const connection = await connectCdpBrowserContext("http://localhost:9222");

    assert.equal(newContextCalls, 1);
    assert.equal(connection.context, context);
    assert.equal(connection.page, page);
  });

  await t.test("uses a local persistent context when no CDP endpoint is configured", async (t) => {
    const context = createFakeBrowserContext();
    const launchedDirs: string[] = [];

    mockLaunchPersistentContext(t, async (userDataDir: string) => {
      launchedDirs.push(userDataDir);
      return context;
    });
    mockConnectOverCDP(t, async () => {
      throw new Error("CDP must not be used without an endpoint");
    });

    const launched = await withEnv("PLAYWRIGHT_CDP_ENDPOINT", undefined, () =>
      launchBrowserContext({
        userDataDir: path.resolve(process.cwd(), ".scratch/test-cdp-persistent-profile"),
        headless: true,
      })
    );

    assert.equal(launched.mode, "persistent");
    assert.equal(launched.browser, null);
    assert.equal(launched.page, null);
    assert.equal(launched.context, context);
    assert.equal(launchedDirs.length, 1);
    assert.ok(launchedDirs[0].includes(".scratch/test-cdp-persistent-profile"));
  });

  await t.test("falls back to a persistent context when the CDP connection fails", async (t) => {
    const context = createFakeBrowserContext();
    let persistentLaunchCount = 0;

    t.mock.method(console, "warn", () => {});
    mockConnectOverCDP(t, async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9222");
    });
    mockLaunchPersistentContext(t, async () => {
      persistentLaunchCount++;
      return context;
    });

    const launched = await launchBrowserContext({
      cdpEndpoint: "http://host.docker.internal:9222",
      userDataDir: path.resolve(process.cwd(), ".scratch/test-cdp-fallback-profile"),
      headless: true,
    });

    assert.equal(persistentLaunchCount, 1);
    assert.equal(launched.mode, "persistent");
    assert.equal(launched.context, context);
    assert.equal(launched.cdpEndpoint, "http://host.docker.internal:9222");
    assert.match(launched.fallbackReason ?? "", /ECONNREFUSED/);
  });

  await t.test("runner consumes the CDP context, reports the mode, and disconnects without closing Chrome", async (t) => {
    const profileDir = path.resolve(process.cwd(), ".scratch/test-cdp-runner-profile");
    const context = await chromium.launchPersistentContext(profileDir, { headless: true });
    const page = (await context.pages())[0] ?? (await context.newPage());
    let browserClosed = false;

    const browser = {
      contexts: () => [context],
      newContext: async () => context,
      close: async () => {
        browserClosed = true;
      },
    } as unknown as Browser;

    const connectMock = mockConnectOverCDP(t, async () => browser);

    await context.addCookies([
      {
        name: "pulse_cdp_session",
        value: "existing-login",
        url: "https://example.com",
        expires: Math.floor(Date.now() / 1000) + 3600,
      },
    ]);

    const runner = new PlaywrightBrowserRunner();
    try {
      const events: RunnerProgressEvent[] = [];
      const outcome = await runner.run({
        jobId: "test-job-cdp",
        url: `data:text/html;charset=utf-8,${encodeURIComponent(`
          <form id="application-form">
            <label for="first_name">First Name</label>
            <input id="first_name" name="first_name" required />
            <label for="email">Email</label>
            <input id="email" type="email" name="email" required />
          </form>
        `)}`,
        cdpEndpoint: "http://localhost:9222",
        candidateData: {
          profile: {
            firstName: "Jane",
            email: "jane.doe@example.com",
          },
        },
        humanTypingDelay: 0,
        onProgress: (event) => events.push(event),
      });

      assert.equal(outcome.status, "awaiting_review");
      assert.ok(outcome.filledFields.length >= 2);
      assert.equal(connectMock.mock.callCount(), 1);

      const startEvent = events
        .filter((event) => event.state === "STARTING_BROWSER")
        .find((event) => event.payload?.connectionMode);
      assert.equal(startEvent?.payload?.connectionMode, "cdp");
      assert.equal(startEvent?.payload?.cdpEndpoint, "http://localhost:9222");

      // The candidate's pre-existing session cookies survive the fill.
      const cookies = await context.cookies("https://example.com");
      assert.ok(
        cookies.some((cookie) => cookie.name === "pulse_cdp_session" && cookie.value === "existing-login"),
        "CDP attachment must reuse the host context's cookies"
      );

      await runner.close();
      assert.equal(browserClosed, true);
      assert.equal(page.isClosed(), false, "candidate Chrome context must remain open");
    } finally {
      await runner.close().catch(() => {});
      await context.close().catch(() => {});
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  });
});

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

    await t.test("checkForSubmissionSuccess detects confirmation headings and thank-you DOM elements", async () => {
      await page!.setContent(`
        <div class="confirmation-page">
          <h1>Thank you for applying!</h1>
          <p>We have received your application and will review it shortly.</p>
        </div>
      `);

      const isSuccess = await checkForSubmissionSuccess(page!);
      assert.equal(isSuccess, true);

      // Negative check on form page
      await page!.setContent(`
        <form>
          <input name="name" type="text" />
          <button type="submit">Submit Application</button>
        </form>
      `);

      const notSuccess = await checkForSubmissionSuccess(page!);
      assert.equal(notSuccess, false);
    });

    await t.test("setupSubmissionMonitoring detects DOM confirmation and triggers callback", async () => {
      await page!.setContent(`
        <form id="job-form">
          <input name="email" type="email" value="jane@example.com" />
        </form>
      `);

      let emittedSubmitted = false;
      const monitoring = setupSubmissionMonitoring(
        page!,
        {
          jobId: "test-monitored-job",
          url: "https://example.com/apply",
          candidateData: candidatePayload,
          autoMarkApplied: false,
          onProgress: (evt) => {
            if (evt.state === "SUBMITTED") {
              emittedSubmitted = true;
            }
          },
        },
        () => {
          emittedSubmitted = true;
        }
      );

      // Simulate submission landing on confirmation page
      await page!.setContent(`
        <div class="application-success">
          <h2>Application successfully submitted</h2>
        </div>
      `);

      // Wait a moment for monitoring check
      await new Promise((resolve) => setTimeout(resolve, 350));

      assert.equal(emittedSubmitted, true);
      assert.equal(monitoring.isSubmitted(), true);
      monitoring.cleanup();
    });

    await t.test("fillFormFields uses fast-path instantaneous fill for Tier 1 deterministic fields", async () => {
      await page!.setContent(`
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
        </form>
      `);

      const mappings: FormFieldMapping[] = [
        {
          field: "firstName",
          selector: "#first_name",
          confidence: 1.0,
          tier: 1,
          matchType: "label-regex",
          action: "fill",
          value: "Jane",
        },
        {
          field: "email",
          selector: "#email",
          confidence: 1.0,
          tier: 1,
          matchType: "autocomplete",
          action: "fill",
          value: "jane.doe@example.com",
        },
      ];

      const startTime = Date.now();
      const { results } = await fillFormFields(page!, mappings, candidatePayload, {
        humanTypingDelay: 10, // Even with delay requested, tier 1 fast path should fill instantly
      });
      const elapsed = Date.now() - startTime;

      assert.equal(results.length, 2);
      assert.equal(results[0].status, "filled");
      assert.equal(results[1].status, "filled");

      const firstNameVal = await page!.$eval("#first_name", (el) => (el as HTMLInputElement).value);
      const emailVal = await page!.$eval("#email", (el) => (el as HTMLInputElement).value);

      assert.equal(firstNameVal, "Jane");
      assert.equal(emailVal, "jane.doe@example.com");
      assert.ok(elapsed < 500, `Expected fast fill elapsed time < 500ms, got ${elapsed}ms`);
    });

    // Cleanup browser context
    await browserContext.close().catch(() => {});
  }

  await t.test("Persistent context retains cookies across re-instantiation in the same profile directory", async () => {
    const sessionProfileDir = path.resolve(process.cwd(), ".scratch/test-session-profile");
    if (!fs.existsSync(sessionProfileDir)) {
      fs.mkdirSync(sessionProfileDir, { recursive: true });
    }

    try {
      // 1. Launch first session, navigate or set a cookie with explicit url
      const ctx1 = await chromium.launchPersistentContext(sessionProfileDir, {
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      await ctx1.addCookies([
        {
          name: "pulse_session_test",
          value: "auth_token_xyz123",
          url: "https://example.com",
          expires: Math.floor(Date.now() / 1000) + 3600,
        },
      ]);

      const cookies1 = await ctx1.cookies("https://example.com");
      assert.ok(cookies1.some((c) => c.name === "pulse_session_test" && c.value === "auth_token_xyz123"));
      await ctx1.close();

      // 2. Launch second session with the same profile directory and assert cookie persists
      const ctx2 = await chromium.launchPersistentContext(sessionProfileDir, {
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      const cookies2 = await ctx2.cookies("https://example.com");
      assert.ok(
        cookies2.some((c) => c.name === "pulse_session_test" && c.value === "auth_token_xyz123"),
        "Expected persistent profile cookies to survive across browser sessions"
      );
      await ctx2.close();
    } finally {
      try {
        fs.rmSync(sessionProfileDir, { recursive: true, force: true });
      } catch {}
    }
  });
});
