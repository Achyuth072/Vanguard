import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PlaywrightBrowserRunner } from "@/lib/automation/browser-runner";
import { buildCandidateProfilePayload } from "@/lib/automation/payload-builder";
import type { RunnerProgressEvent } from "@/lib/automation/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const overrideUrl = searchParams.get("url");
  const headlessParam = searchParams.get("headless");
  const headless = headlessParam !== null ? headlessParam === "true" : undefined;
  const resumePath = searchParams.get("resumePath") || undefined;
  const channel = searchParams.get("channel") || undefined;

  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId query parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch job with application context
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { application: true },
  });

  if (!job) {
    return new Response(JSON.stringify({ error: `Job not found with id: ${jobId}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetUrl = overrideUrl || job.url;
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Job does not have an application URL and no override URL was provided" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Fetch candidate profile
  const candidate = (await db.candidate.findFirst({
    where: { id: "candidate-default" },
  })) || (await db.candidate.findFirst());

  const candidateData = buildCandidateProfilePayload(
    candidate,
    job.application,
    resumePath
  );

  const encoder = new TextEncoder();
  const runner = new PlaywrightBrowserRunner();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: RunnerProgressEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed by client
        }
      };

      // Handle client disconnect / cancellation
      request.signal.addEventListener("abort", () => {
        // Stream aborted by client
      });

      try {
        await runner.run({
          jobId,
          url: targetUrl,
          candidateData,
          headless: headless ?? false,
          channel: channel || "chrome",
          resumePath,
          autoMarkApplied: true,
          onProgress: sendEvent,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent({
          jobId,
          state: "ERROR",
          step: 0,
          totalSteps: 6,
          message: `Browser stream failed: ${errorMsg}`,
          timestamp: new Date().toISOString(),
          payload: { error: errorMsg },
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : undefined;
  const overrideUrl = typeof body.url === "string" ? body.url : undefined;
  const headless = typeof body.headless === "boolean" ? body.headless : undefined;
  const resumePath = typeof body.resumePath === "string" ? body.resumePath : undefined;
  const channel = typeof body.channel === "string" ? body.channel : undefined;

  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { application: true },
  });

  if (!job) {
    return new Response(JSON.stringify({ error: `Job not found with id: ${jobId}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetUrl = overrideUrl || job.url;
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Job does not have an application URL and no override URL was provided" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const candidate = (await db.candidate.findFirst({
    where: { id: "candidate-default" },
  })) || (await db.candidate.findFirst());

  const candidateData = buildCandidateProfilePayload(
    candidate,
    job.application,
    resumePath
  );

  const encoder = new TextEncoder();
  const runner = new PlaywrightBrowserRunner();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: RunnerProgressEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {}
      };

      try {
        await runner.run({
          jobId,
          url: targetUrl,
          candidateData,
          headless: headless ?? false,
          channel: channel || "chrome",
          resumePath,
          autoMarkApplied: true,
          onProgress: sendEvent,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent({
          jobId,
          state: "ERROR",
          step: 0,
          totalSteps: 6,
          message: `Browser stream failed: ${errorMsg}`,
          timestamp: new Date().toISOString(),
          payload: { error: errorMsg },
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
