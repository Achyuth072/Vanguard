#!/usr/bin/env tsx

import { DEFAULT_BASELINE_FEED_SOURCES, type FeedSource, type FeedSourceType } from "../types/feed-source";
import { probeFeedSource, type FeedSourceProbeResult } from "../lib/ingestion/probe";

function parseArgs(): {
  sourceType?: FeedSourceType;
  slug?: string;
  limit: number;
  timeoutMs: number;
  probeAll: boolean;
} {
  const args = process.argv.slice(2);
  let sourceType: FeedSourceType | undefined;
  let slug: string | undefined;
  let limit = 2;
  let timeoutMs = 12_000;
  let probeAll = false;

  for (const arg of args) {
    if (arg === "--all") {
      probeAll = true;
    } else if (arg.startsWith("--source=")) {
      sourceType = arg.slice(9).toUpperCase() as FeedSourceType;
    } else if (arg.startsWith("--slug=")) {
      slug = arg.slice(7);
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.slice(8), 10) || 2;
    } else if (arg.startsWith("--timeout=")) {
      timeoutMs = parseInt(arg.slice(10), 10) || 12_000;
    }
  }

  return { sourceType, slug, limit, timeoutMs, probeAll };
}

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

function formatStatus(status: FeedSourceProbeResult["status"]): string {
  switch (status) {
    case "HEALTHY":
      return "\x1b[32m✔ HEALTHY\x1b[0m   ";
    case "DEGRADED":
      return "\x1b[33m▲ DEGRADED\x1b[0m  ";
    case "UNREACHABLE":
      return "\x1b[31m✖ UNREACHABLE\x1b[0m";
  }
}

async function main() {
  const { sourceType, slug, limit, timeoutMs, probeAll } = parseArgs();

  console.log("\x1b[1m\x1b[33m=== VANGUARD FEED SOURCE PROBE RUNNER (DRY RUN) ===\x1b[0m");
  console.log(`Config: sampleLimit=${limit}, timeoutMs=${timeoutMs}${sourceType ? `, filterType=${sourceType}` : ""}${slug ? `, slug=${slug}` : ""}${probeAll ? ", scope=ALL" : ", scope=ACTIVE_ONLY"}\n`);

  const sourcesToProbe: FeedSource[] = DEFAULT_BASELINE_FEED_SOURCES
    .filter((def) => {
      if (sourceType) return def.type === sourceType;
      if (!probeAll) return def.enabled;
      return true;
    })
    .map((def) => ({
      id: def.id,
      name: def.name,
      type: def.type,
      url: def.url,
      config: JSON.stringify(def.config),
      enabled: def.enabled,
      autoPoll: def.autoPoll,
      lastCursor: "",
      pollIntervalMs: def.pollIntervalMs,
      consecutiveEmpty: 0,
      jobsDiscovered: 0,
      jobsPassed: 0,
      errorCount: 0,
      lastError: "",
    }));

  if (sourcesToProbe.length === 0) {
    console.error(`No baseline sources matched filter '${sourceType}'. Available: ASHBY, GREENHOUSE, LEVER, HIMALAYAS, REMOTEOK, JOBICY, HN, HIRINGCAFE, WWR, WELLFOUND, INDEED`);
    process.exit(1);
  }

  const results: FeedSourceProbeResult[] = [];

  for (const source of sourcesToProbe) {
    process.stdout.write(`Probing ${source.name.padEnd(20)} [${source.type.padEnd(10)}] ... `);
    const res = await probeFeedSource(source, {
      sampleLimit: limit,
      timeoutMs,
      boardSlugOverride: slug,
    });
    results.push(res);
    console.log(`${formatStatus(res.status)} (${res.latencyMs}ms) - ${res.jobsSampleCount} job(s)`);
    if (res.sampleJob) {
      console.log(`   └─ Sample: "${truncate(res.sampleJob.title, 40)}" @ ${res.sampleJob.company} (${truncate(res.sampleJob.url, 45)})`);
    }
    if (res.error) {
      console.log(`   └─ Error: \x1b[31m${res.error}\x1b[0m`);
    }
    if (res.schemaErrors && res.schemaErrors.length > 0) {
      console.log(`   └─ Schema warnings: ${res.schemaErrors.join(", ")}`);
    }
  }

  // Telemetry Summary
  const healthyCount = results.filter((r) => r.status === "HEALTHY").length;
  const degradedCount = results.filter((r) => r.status === "DEGRADED").length;
  const unreachableCount = results.filter((r) => r.status === "UNREACHABLE").length;
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length);

  console.log("\n\x1b[1m=== SUMMARY ===\x1b[0m");
  console.log(`Total Sources: ${results.length}`);
  console.log(`Healthy:       \x1b[32m${healthyCount}\x1b[0m`);
  console.log(`Degraded:      \x1b[33m${degradedCount}\x1b[0m`);
  console.log(`Unreachable:   \x1b[31m${unreachableCount}\x1b[0m`);
  console.log(`Avg Latency:   ${avgLatency}ms\n`);

  if (unreachableCount > 0) {
    console.error(`\x1b[31mProbe failed: ${unreachableCount} source(s) were unreachable.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll probed sources reachable.\x1b[0m`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal probe runner error:", err);
  process.exit(1);
});
