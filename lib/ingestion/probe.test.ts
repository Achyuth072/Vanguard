import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  probeFeedSource,
  probeAllSources,
  type FeedSourceProbeResult,
} from "./probe";
import type { FeedSource } from "../../types/feed-source";

function createMockFetch(responses: Record<string, { status?: number; data?: unknown; text?: string; delayMs?: number; throwError?: Error }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const urlStr = input.toString();

    for (const [pattern, res] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        if (res.delayMs) {
          await new Promise((r) => setTimeout(r, res.delayMs));
        }
        if (res.throwError) {
          throw res.throwError;
        }

        const statusCode = res.status ?? 200;
        const textBody = res.text ?? (typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? {}));

        return {
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: statusCode === 200 ? "OK" : "Error",
          json: async () => (res.data ? res.data : JSON.parse(textBody)),
          text: async () => textBody,
        } as unknown as Response;
      }
    }

    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "Not Found" }),
      text: async () => "Not Found",
    } as unknown as Response;
  }) as typeof fetch;
}

const mockAshbySource: FeedSource = {
  id: "test-ashby",
  name: "Ashby Test",
  type: "ASHBY",
  url: "https://api.ashbyhq.com/posting-api/job-board",
  config: JSON.stringify({ boardSlugs: ["acme"] }),
  enabled: true,
  autoPoll: false,
  lastCursor: "",
  pollIntervalMs: 14400000,
  consecutiveEmpty: 0,
  jobsDiscovered: 0,
  jobsPassed: 0,
  errorCount: 0,
  lastError: "",
};

describe("Feed Source Probe Engine", () => {
  it("probes a healthy feed source and returns validated sample jobs and latency", async () => {
    const mockFetch = createMockFetch({
      "api.ashbyhq.com": {
        data: {
          apiVersion: "1",
          jobs: [
            {
              id: "ashby-123",
              title: "Staff Systems Engineer",
              department: "Infrastructure",
              jobUrl: "https://jobs.ashbyhq.com/acme/ashby-123",
              isListed: true,
              descriptionPlain: "Build resilient distributed data pipelines.",
            },
          ],
        },
      },
    });

    const result: FeedSourceProbeResult = await probeFeedSource(mockAshbySource, {
      fetchFn: mockFetch,
      sampleLimit: 1,
    });

    assert.equal(result.status, "HEALTHY");
    assert.equal(result.sourceType, "ASHBY");
    assert.equal(result.jobsSampleCount, 1);
    assert.ok(result.latencyMs >= 0);
    assert.ok(result.sampleJob);
    assert.equal(result.sampleJob?.title, "Staff Systems Engineer");
    assert.equal(result.sampleJob?.company, "Acme");
    assert.equal(result.sampleJob?.url, "https://jobs.ashbyhq.com/acme/ashby-123");
    assert.equal(result.schemaErrors.length, 0);
  });

  it("identifies DEGRADED status when source returns empty job array or missing fields", async () => {
    const mockFetch = createMockFetch({
      "api.ashbyhq.com": {
        data: {
          apiVersion: "1",
          jobs: [],
        },
      },
    });

    const result = await probeFeedSource(mockAshbySource, {
      fetchFn: mockFetch,
    });

    assert.equal(result.status, "DEGRADED");
    assert.equal(result.jobsSampleCount, 0);
    assert.match(result.notes || "", /0 jobs discovered/i);
  });

  it("identifies UNREACHABLE status with error details on network failure or HTTP errors", async () => {
    const mockFetch = createMockFetch({
      "api.ashbyhq.com": {
        status: 403,
        text: "Cloudflare Access Denied",
      },
    });

    const result = await probeFeedSource(mockAshbySource, {
      fetchFn: mockFetch,
    });

    assert.equal(result.status, "UNREACHABLE");
    assert.ok(result.error);
    assert.equal(result.jobsSampleCount, 0);
  });

  it("detects schema validation errors when returned jobs lack required properties", async () => {
    // Malformed Ashby response missing required url/jobUrl and title
    const mockFetch = createMockFetch({
      "api.ashbyhq.com": {
        data: {
          apiVersion: "1",
          jobs: [
            {
              id: "broken-1",
              descriptionPlain: "Missing title and url",
            },
          ],
        },
      },
    });

    const result = await probeFeedSource(mockAshbySource, {
      fetchFn: mockFetch,
    });

    assert.ok(result.schemaErrors.length > 0 || result.status !== "HEALTHY");
  });

  it("probes multiple sources concurrently and aggregates summary metrics", async () => {
    const mockHimalayasSource: FeedSource = {
      id: "test-himalayas",
      name: "Himalayas Test",
      type: "HIMALAYAS",
      url: "https://himalayas.app/jobs/api",
      config: JSON.stringify({}),
      enabled: true,
      autoPoll: false,
      lastCursor: "",
      pollIntervalMs: 14400000,
      consecutiveEmpty: 0,
      jobsDiscovered: 0,
      jobsPassed: 0,
      errorCount: 0,
      lastError: "",
    };

    const mockFetch = createMockFetch({
      "api.ashbyhq.com": {
        data: {
          jobs: [
            { id: "1", title: "Job A", jobUrl: "https://jobs.ashbyhq.com/acme/1", descriptionPlain: "Desc A" },
          ],
        },
      },
      "himalayas.app": {
        data: {
          data: [
            { id: 2, title: "Job B", applicationLink: "https://himalayas.app/jobs/2", companyName: "Beta Corp", excerpt: "Desc B" },
          ],
        },
      },
    });

    const summary = await probeAllSources([mockAshbySource, mockHimalayasSource], {
      fetchFn: mockFetch,
      sampleLimit: 1,
    });

    assert.equal(summary.totalSources, 2);
    assert.equal(summary.healthyCount, 2);
    assert.equal(summary.unreachableCount, 0);
    assert.equal(summary.results.length, 2);
  });
});
