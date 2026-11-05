import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ingestJob } from "../actions";

describe("ingestJob Server Action — Seam 3", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns { success: false, error: string } instead of throwing uncaught exceptions on URL import failure", async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 202,
      statusText: "Accepted",
      headers: new Headers({ "x-amzn-waf-action": "challenge" }),
      text: async () => "JavaScript is disabled In order to continue, we need to verify that you're not a robot.",
    })) as unknown as typeof fetch;

    const result = await ingestJob({
      url: "https://pwcta.phenompro.com/global/en/job/",
    });

    assert.strictEqual(result.success, false);
    assert.ok(typeof result.error === "string");
    assert.match(
      result.error,
      /Failed to fetch job posting|protected by anti-bot verification|requires JavaScript/i
    );
  });

  it("returns { success: true, ... } and does not fail when manual title and company are provided", async () => {
    const result = await ingestJob({
      title: "Senior Reliability Engineer",
      company: "Acme Cloud",
      description: "Looking for an SRE with 5+ years experience.",
      remoteStatus: "REMOTE",
      salaryMin: 150000,
      salaryMax: 200000,
      currency: "USD",
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.job);
    assert.strictEqual(result.job.title, "Senior Reliability Engineer");
    assert.strictEqual(result.job.company, "Acme Cloud");
  });

  it("returns { success: true, ... } when ingesting a URL with Cloudflare telemetry and valid job content", async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => `<!DOCTYPE html><html><head>
        <title>Founding Engineer at Acme</title>
        <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
        <script>turnstileLoad = function() {};</script>
      </head><body>
        <h1>Founding Engineer</h1>
        <p>Company: Acme AI. Location: Remote. Requirements: 5 years of fullstack TypeScript and Node.js.</p>
      </body></html>`,
    })) as unknown as typeof fetch;

    const result = await ingestJob({
      url: "https://wellfound.com/jobs/acme-founding-engineer",
      title: "Founding Engineer",
      company: "Acme AI",
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.job);
    assert.strictEqual(result.job.title, "Founding Engineer");
    assert.strictEqual(result.job.company, "Acme AI");
  });
});
