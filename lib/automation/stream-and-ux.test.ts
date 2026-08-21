import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type BrowserContext, type Page } from "playwright";
import { db } from "@/lib/db";
import {
  checkForBotChallenge,
  checkForSubmissionSuccess,
  setupSubmissionMonitoring,
  PlaywrightBrowserRunner,
} from "./browser-runner";
import { buildCandidateProfilePayload, splitFullName } from "./payload-builder";
import type { RunnerProgressEvent } from "./types";
import { updateJobStatusAction } from "@/app/actions";

describe("Assisted Application UX, SSE Progress Stream & Hybrid Submission Detection", () => {
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    // Reset test job and candidate state in DB
    await db.event.deleteMany({
      where: { entityType: "Job", entityId: "test-job-stream-1" },
    });
    await db.application.deleteMany({
      where: { jobId: "test-job-stream-1" },
    });
    await db.job.deleteMany({
      where: { id: "test-job-stream-1" },
    });

    await db.job.create({
      data: {
        id: "test-job-stream-1",
        dedupeKey: "test_job_stream_1",
        title: "Senior AI Platform Engineer",
        company: "Stripe",
        location: "San Francisco, CA",
        remoteStatus: "HYBRID",
        description: "Build intelligent automation platforms.",
        url: "https://stripe.com/jobs/apply/123",
        status: "PREPARED",
      },
    });

    await db.application.create({
      data: {
        id: "test-app-stream-1",
        jobId: "test-job-stream-1",
        status: "PREPARED",
        questionAnswers: JSON.stringify([
          { question: "Why Stripe?", answer: "I love developer infrastructure and high reliability systems." },
          { question: "Years with TypeScript?", answer: "6 years building scalable web applications." },
        ]),
      },
    });
  });

  it("splitFullName and buildCandidateProfilePayload extract structured candidate data", () => {
    const split = splitFullName("Alex Morgan Builder");
    assert.strictEqual(split.firstName, "Alex");
    assert.strictEqual(split.lastName, "Morgan Builder");

    const payload = buildCandidateProfilePayload(
      {
        id: "candidate-default",
        name: "Alex Builder",
        location: "San Francisco, CA",
        targetRole: "Staff Engineer",
        minSalary: 190000,
        currency: "USD",
        yearsOfExperience: 7,
        remotePreference: "REMOTE_ONLY",
        preferredLocations: ["Remote", "New York, NY"],
        skills: [],
        projects: [],
        experiences: [
          {
            id: "exp-1",
            company: "Pulse Systems",
            title: "Lead Architect",
            location: "San Francisco, CA",
            isCurrent: true,
            highlights: [],
            remoteStatus: "REMOTE",
          },
        ],
        resumeText: "# Alex Builder\nalex.builder@example.com\n+1 (555) 234-5678",
      },
      {
        questionAnswers: JSON.stringify([
          { question: "What is your primary language?", answer: "TypeScript" },
        ]),
      }
    );

    assert.strictEqual(payload.profile.firstName, "Alex");
    assert.strictEqual(payload.profile.lastName, "Builder");
    assert.strictEqual(payload.profile.email, "alex.builder@example.com");
    assert.strictEqual(payload.profile.phone, "+1 (555) 234-5678");
    assert.strictEqual(payload.profile.currentCompany, "Pulse Systems");
    assert.strictEqual(payload.profile.currentTitle, "Lead Architect");
    assert.ok(payload.profile.links?.linkedIn?.includes("alexbuilder"));
    assert.strictEqual(payload.tailoredAnswers?.length, 1);
    assert.strictEqual(payload.tailoredAnswers?.[0].answer, "TypeScript");
  });

  it("checkForBotChallenge detects Cloudflare Turnstile and challenge banners in DOM", async () => {
    context = await chromium.launchPersistentContext("", { headless: true });
    page = await context.newPage();

    // Standard non-challenge page
    await page.setContent("<html><body><h1>Job Application</h1></body></html>");
    assert.strictEqual(await checkForBotChallenge(page), false);

    // Page with Cloudflare turnstile element
    await page.setContent(`
      <html>
        <head><title>Verify you are human</title></head>
        <body>
          <div class="cf-turnstile" data-sitekey="test-key"></div>
        </body>
      </html>
    `);
    assert.strictEqual(await checkForBotChallenge(page), true);

    // Page with hCaptcha iframe
    await page.setContent(`
      <html>
        <body>
          <iframe src="https://newassets.hcaptcha.com/captcha/v1/test"></iframe>
        </body>
      </html>
    `);
    assert.strictEqual(await checkForBotChallenge(page), true);

    await context.close();
  });

  it("checkForSubmissionSuccess detects confirmation URLs and in-DOM confirmation text", async () => {
    context = await chromium.launchPersistentContext("", { headless: true });
    page = await context.newPage();

    // Standard application form page
    await page.setContent("<html><body><form><button>Submit</button></form></body></html>");
    assert.strictEqual(await checkForSubmissionSuccess(page), false);

    // Success text in DOM
    await page.setContent(`
      <html>
        <body>
          <h1>Thank you for applying!</h1>
          <p>Your application has been received. Our team will review your profile.</p>
        </body>
      </html>
    `);
    assert.strictEqual(await checkForSubmissionSuccess(page), true);

    await context.close();
  });

  it("setupSubmissionMonitoring detects post-submission and auto-updates database to APPLIED", async () => {
    context = await chromium.launchPersistentContext("", { headless: true });
    page = await context.newPage();

    await page.setContent(`
      <html>
        <body>
          <form id="app-form">
            <input id="name" name="name" value="Alex Builder" />
            <button id="submit-btn" type="button" onclick="document.body.innerHTML='<h1>Application submitted</h1><p>Thank you for applying.</p>'">
              Submit Application
            </button>
          </form>
        </body>
      </html>
    `);

    const emittedEvents: RunnerProgressEvent[] = [];
    const monitoring = setupSubmissionMonitoring(
      page,
      {
        jobId: "test-job-stream-1",
        url: "https://stripe.com/jobs/apply/123",
        candidateData: {
          profile: { firstName: "Alex", lastName: "Builder", email: "alex@example.com" },
        },
        autoMarkApplied: true,
        onProgress: (evt) => emittedEvents.push(evt),
      }
    );

    // Trigger submission on the page
    await page.click("#submit-btn");

    // Allow brief event loop tick for detection
    await page.waitForTimeout(500);

    // Verify submission detection
    const isSubmitted = await checkForSubmissionSuccess(page);
    assert.strictEqual(isSubmitted, true);

    // Verify DB was automatically updated to APPLIED
    const updatedJob = await db.job.findUnique({
      where: { id: "test-job-stream-1" },
      include: { application: true },
    });
    assert.strictEqual(updatedJob?.status, "APPLIED");
    assert.strictEqual(updatedJob?.application?.status, "APPLIED");
    assert.ok(updatedJob?.application?.appliedAt, "appliedAt timestamp must be set");

    monitoring.cleanup();
    await context.close();
  });

  it("PlaywrightBrowserRunner emits all sequential progress states and handles candidate payload", async () => {
    context = await chromium.launchPersistentContext("", { headless: true });
    page = await context.newPage();

    await page.setContent(`
      <html>
        <body>
          <form id="application-form">
            <label for="first_name">First Name</label>
            <input id="first_name" name="first_name" required />
            <label for="last_name">Last Name</label>
            <input id="last_name" name="last_name" required />
            <label for="email">Email</label>
            <input id="email" type="email" name="email" required />
          </form>
        </body>
      </html>
    `);

    const emittedEvents: RunnerProgressEvent[] = [];
    const runner = new PlaywrightBrowserRunner();

    const outcome = await runner.run({
      jobId: "test-job-stream-1",
      url: "about:blank",
      browserContext: context,
      candidateData: {
        profile: {
          firstName: "Alex",
          lastName: "Builder",
          email: "alex.builder@example.com",
        },
      },
      onProgress: (evt) => emittedEvents.push(evt),
    });

    assert.strictEqual(outcome.status, "awaiting_review");

    // Verify emitted state progression
    const states = emittedEvents.map((e) => e.state);
    assert.ok(states.includes("STARTING_BROWSER"));
    assert.ok(states.includes("NAVIGATING"));
    assert.ok(states.includes("SCANNING_DOM"));
    assert.ok(states.includes("FILLING_FIELDS"));
    assert.ok(states.includes("HIGHLIGHTING_INSPECTION"));
    assert.ok(states.includes("AWAITING_HUMAN_REVIEW"));

    await runner.close();
    await context.close();
  });

  it("Manual reconciliation updateJobStatusAction transitions job to APPLIED or PREPARED", async () => {
    // 1. Transition PREPARED -> APPLIED
    const applyResult = await updateJobStatusAction("test-job-stream-1", "APPLIED");
    assert.strictEqual(applyResult.success, true);
    assert.strictEqual(applyResult.job.status, "APPLIED");

    const appliedJob = await db.job.findUnique({
      where: { id: "test-job-stream-1" },
      include: { application: true },
    });
    assert.strictEqual(appliedJob?.status, "APPLIED");
    assert.strictEqual(appliedJob?.application?.status, "APPLIED");
    assert.ok(appliedJob?.application?.appliedAt);

    // 2. Create another job in SHORTLISTED and transition to PREPARED (Keep Draft)
    await db.job.create({
      data: {
        id: "test-job-stream-2",
        dedupeKey: "test_job_stream_2",
        title: "Staff Systems Engineer",
        company: "Figma",
        status: "SHORTLISTED",
        description: "Systems and performance.",
      },
    });

    const draftResult = await updateJobStatusAction("test-job-stream-2", "PREPARED");
    assert.strictEqual(draftResult.success, true);
    assert.strictEqual(draftResult.job.status, "PREPARED");

    // Clean up
    await db.job.deleteMany({ where: { id: "test-job-stream-2" } });
  });

  after(async () => {
    await db.event.deleteMany({
      where: {
        entityId: { in: ["test-job-stream-1", "test-job-stream-2", "test-app-stream-1"] },
      },
    });
    await db.application.deleteMany({
      where: {
        jobId: { in: ["test-job-stream-1", "test-job-stream-2"] },
      },
    });
    await db.job.deleteMany({
      where: {
        id: { in: ["test-job-stream-1", "test-job-stream-2"] },
      },
    });
  });
});
