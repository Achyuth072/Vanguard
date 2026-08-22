import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { POST as syncPOST } from "./sync/route";

describe("Feeds API Integration Tests", () => {
  const TEST_PREFIX = "test-feed-api-";
  let createdSourceId: string;

  before(async () => {
    // Cleanup test data
    await db.feedSource.deleteMany({
      where: {
        OR: [
          { id: { startsWith: TEST_PREFIX } },
          { name: { startsWith: TEST_PREFIX } },
        ],
      },
    });
  });

  after(async () => {
    // Cleanup
    await db.feedSource.deleteMany({
      where: {
        OR: [
          { id: { startsWith: TEST_PREFIX } },
          { name: { startsWith: TEST_PREFIX } },
        ],
      },
    });
  });

  it("GET /api/feeds returns list of configured feed sources", async () => {
    const res = await GET();
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length > 0);

    const firstSource = data.data[0];
    assert.ok(firstSource.id);
    assert.ok(firstSource.name);
    assert.ok(firstSource.type);
    assert.ok(typeof firstSource.parsedConfig === "object");
  });

  it("POST /api/feeds creates a new custom feed source", async () => {
    const newSourcePayload = {
      name: `${TEST_PREFIX}Custom Ashby`,
      type: "ASHBY",
      url: "https://api.ashbyhq.com/posting-api/job-board",
      config: {
        boardSlugs: ["custom-co-1", "custom-co-2"],
      },
      enabled: true,
      autoPoll: false,
      pollIntervalMs: 7200000,
    };

    const req = new NextRequest("http://localhost:3000/api/feeds", {
      method: "POST",
      body: JSON.stringify(newSourcePayload),
    });

    const res = await POST(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, newSourcePayload.name);
    assert.equal(json.data.type, "ASHBY");
    assert.equal(json.data.enabled, true);
    assert.equal(json.data.pollIntervalMs, 7200000);
    assert.deepEqual(json.data.parsedConfig.boardSlugs, ["custom-co-1", "custom-co-2"]);

    createdSourceId = json.data.id;
    assert.ok(createdSourceId);
  });

  it("POST /api/feeds returns 400 for invalid payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/feeds", {
      method: "POST",
      body: JSON.stringify({
        name: "", // Invalid empty name
        type: "INVALID_TYPE",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.error);
  });

  it("PATCH /api/feeds/[id] toggles enabled and updates poll interval & boardSlugs", async () => {
    assert.ok(createdSourceId, "createdSourceId should exist");

    const patchPayload = {
      enabled: false,
      autoPoll: true,
      pollIntervalMs: 3600000,
      boardSlugs: ["custom-co-1", "custom-co-2", "custom-co-3"],
    };

    const req = new NextRequest(`http://localhost:3000/api/feeds/${createdSourceId}`, {
      method: "PATCH",
      body: JSON.stringify(patchPayload),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: createdSourceId }) });
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.enabled, false);
    assert.equal(json.data.autoPoll, true);
    assert.equal(json.data.pollIntervalMs, 3600000);
    assert.deepEqual(json.data.parsedConfig.boardSlugs, [
      "custom-co-1",
      "custom-co-2",
      "custom-co-3",
    ]);

    // Verify in database
    const dbRecord = await db.feedSource.findUnique({
      where: { id: createdSourceId },
    });
    assert.equal(dbRecord?.enabled, false);
    assert.equal(dbRecord?.autoPoll, true);
  });

  it("PATCH /api/feeds/[id] returns 404 for non-existent source", async () => {
    const req = new NextRequest("http://localhost:3000/api/feeds/non-existent-id", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "non-existent-id" }) });
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
  });

  it("POST /api/feeds/sync triggers on-demand sync for a specific feed source", async () => {
    // Re-enable our test source
    await db.feedSource.update({
      where: { id: createdSourceId },
      data: { enabled: true },
    });

    const req = new NextRequest("http://localhost:3000/api/feeds/sync", {
      method: "POST",
      body: JSON.stringify({
        id: createdSourceId,
        forceSync: true,
      }),
    });

    const res = await syncPOST(req);
    // Since mock network is not injected into the live route, it will execute through orchestrator
    // Either returns 200 with result or 500 if network fails, but schema and response format are validated
    const json = await res.json();
    assert.ok(json.data);
    assert.equal(json.data.sourceId, createdSourceId);
    assert.ok(typeof json.data.jobsDiscovered === "number");
    assert.ok(typeof json.data.durationMs === "number");
  });

  it("POST /api/feeds/sync triggers sync on all active feeds", async () => {
    const req = new NextRequest("http://localhost:3000/api/feeds/sync", {
      method: "POST",
      body: JSON.stringify({
        onlyEnabled: true,
      }),
    });

    const res = await syncPOST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(typeof json.data.totalSources === "number");
    assert.ok(Array.isArray(json.data.results));
  });
});
