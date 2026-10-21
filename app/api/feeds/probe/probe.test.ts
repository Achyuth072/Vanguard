import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";

describe("Feeds Probe API Route", () => {
  it("probes an Ashby source via type parameter and returns status and sample jobs", async () => {
    const request = new Request("http://localhost:3000/api/feeds/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ASHBY",
        boardSlug: "ramp",
      }),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const json = await response.json();
    assert.equal(json.success, true);
    assert.ok(json.probe);
    assert.equal(json.probe.sourceType, "ASHBY");
    assert.equal(json.probe.status, "HEALTHY");
    assert.ok(json.probe.sampleJob);
  });

  it("returns 400 when type or sourceId is missing", async () => {
    const request = new Request("http://localhost:3000/api/feeds/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);

    const json = await response.json();
    assert.equal(json.success, false);
    assert.match(json.error, /sourceId or type is required/i);
  });
});
