import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("Export API Route Handler", () => {
  it("returns JSON snapshot with application/json header when format is json", async () => {
    const req = new NextRequest("http://localhost:3000/api/export?format=json");
    const res = await GET(req);

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("Content-Type")?.includes("application/json"));
    assert.ok(res.headers.get("Content-Disposition")?.includes('attachment; filename="pulse-backup-'));
    assert.ok(res.headers.get("Content-Disposition")?.endsWith('.json"'));

    const text = await res.text();
    const data = JSON.parse(text);
    assert.equal(data.version, "1.0");
    assert.equal(data.database, "pulse.db");
    assert.ok(Array.isArray(data.data.candidates));
    assert.ok(Array.isArray(data.data.jobs));
  });

  it("returns Applications CSV with text/csv header when format is applications", async () => {
    const req = new NextRequest("http://localhost:3000/api/export?format=applications");
    const res = await GET(req);

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("Content-Type")?.includes("text/csv"));
    assert.ok(res.headers.get("Content-Disposition")?.includes('attachment; filename="pulse-applications-'));
    assert.ok(res.headers.get("Content-Disposition")?.endsWith('.csv"'));

    const text = await res.text();
    assert.ok(text.startsWith("Application ID,Job ID,Company,Title,Status"));
  });

  it("returns Jobs CSV with text/csv header when format is jobs", async () => {
    const req = new NextRequest("http://localhost:3000/api/export?format=jobs");
    const res = await GET(req);

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("Content-Type")?.includes("text/csv"));
    assert.ok(res.headers.get("Content-Disposition")?.includes('attachment; filename="pulse-jobs-'));
    assert.ok(res.headers.get("Content-Disposition")?.endsWith('.csv"'));

    const text = await res.text();
    assert.ok(text.startsWith("Job ID,Dedupe Key,Company,Title,Location"));
  });

  it("returns 400 error for unsupported format", async () => {
    const req = new NextRequest("http://localhost:3000/api/export?format=unsupported_format");
    const res = await GET(req);

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Unsupported export format"));
  });
});
