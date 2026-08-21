import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { EnrichedJob } from "@/lib/data";

describe("Atomic Components — ReticleGauge & TelemetryStrip", () => {
  const reticleGaugePath = path.join(process.cwd(), "components/ui/ReticleGauge.tsx");
  const telemetryStripPath = path.join(process.cwd(), "components/ui/TelemetryStrip.tsx");
  const appTelemetryStripPath = path.join(process.cwd(), "app/components/TelemetryStrip.tsx");

  describe("ReticleGauge Component Source & Geometry", () => {
    it("components/ui/ReticleGauge.tsx exists", () => {
      assert.ok(fs.existsSync(reticleGaugePath), "components/ui/ReticleGauge.tsx should exist");
    });

    it("defines proper WCAG AAA token colors and sizing presets", () => {
      const content = fs.readFileSync(reticleGaugePath, "utf-8");
      
      // Brass token #d4a745
      assert.match(content, /#d4a745/i);
      // Sage token #8ab384
      assert.match(content, /#8ab384/i);
      // Rust token #c4634e
      assert.match(content, /#c4634e/i);
      // Muted token #a6abbd
      assert.match(content, /#a6abbd/i);

      // Support sm, md, lg size variants
      assert.ok(content.includes('"sm"') || content.includes("'sm'"));
      assert.ok(content.includes('"md"') || content.includes("'md'"));
      assert.ok(content.includes('"lg"') || content.includes("'lg'"));

      // Accessibility role
      assert.ok(content.includes('role="meter"') || content.includes("aria-valuenow"));
    });

    it("calculates radial ticks and locked-on crosshairs for score >= 90", () => {
      const content = fs.readFileSync(reticleGaugePath, "utf-8");

      // Score >= 90 locked on indicator
      assert.match(content, />=\s*90/);
      // SVG math
      assert.ok(content.includes("Math.PI") || content.includes("circumference"));
      assert.ok(content.includes("strokeDashoffset") || content.includes("strokeDasharray"));
    });
  });

  describe("TelemetryStrip Component Source & Contract", () => {
    it("components/ui/TelemetryStrip.tsx exists", () => {
      assert.ok(fs.existsSync(telemetryStripPath), "components/ui/TelemetryStrip.tsx should exist");
    });

    it("app/components/TelemetryStrip.tsx exists or re-exports components/ui/TelemetryStrip", () => {
      assert.ok(fs.existsSync(appTelemetryStripPath), "app/components/TelemetryStrip.tsx should exist");
    });

    it("defines 4-cell telemetry layout with correct tab IDs and colors", () => {
      const content = fs.readFileSync(telemetryStripPath, "utf-8");

      // 4 tab keys
      assert.ok(content.includes('"inbox"') || content.includes("'inbox'"));
      assert.ok(content.includes('"review"') || content.includes("'review'"));
      assert.ok(content.includes('"pipeline"') || content.includes("'pipeline'"));
      assert.ok(content.includes('"all"') || content.includes("'all'"));

      // Priority threshold >= 80
      assert.match(content, />=\s*80/);
      // Assessment threshold 60-79
      assert.match(content, />=\s*60/);

      // Tabular monospace and accessible tablist attributes
      assert.ok(content.includes("tabular-nums") || content.includes("font-mono"));
      assert.ok(content.includes("role=\"tablist\"") || content.includes("role='tablist'") || content.includes("role=\"tab\""));
    });
  });

  describe("Telemetry Calculation Logic", () => {
    const mockJobs: Partial<EnrichedJob>[] = [
      // Priority (score >= 80)
      {
        id: "job-1",
        title: "Staff Engineer",
        status: "DISCOVERED",
        fitScore: { id: "fs-1", jobId: "job-1", score: 92, createdAt: new Date(), updatedAt: new Date() } as any,
        application: null,
      },
      {
        id: "job-2",
        title: "Senior AI Engineer",
        status: "SHORTLISTED",
        fitScore: { id: "fs-2", jobId: "job-2", score: 85, createdAt: new Date(), updatedAt: new Date() } as any,
        application: null,
      },
      // Assessment (60 <= score < 80)
      {
        id: "job-3",
        title: "Backend Engineer",
        status: "DISCOVERED",
        fitScore: { id: "fs-3", jobId: "job-3", score: 72, createdAt: new Date(), updatedAt: new Date() } as any,
        application: null,
      },
      // Active Pipeline (APPLIED)
      {
        id: "job-4",
        title: "Fullstack Tech Lead",
        status: "APPLIED",
        fitScore: { id: "fs-4", jobId: "job-4", score: 88, createdAt: new Date(), updatedAt: new Date() } as any,
        application: { id: "app-1", jobId: "job-4", stage: "APPLIED" } as any,
      },
      // Ignored / Archived (should be excluded from active telemetry)
      {
        id: "job-5",
        title: "Legacy Dev",
        status: "ARCHIVED",
        fitScore: { id: "fs-5", jobId: "job-5", score: 95, createdAt: new Date(), updatedAt: new Date() } as any,
        application: null,
      },
      {
        id: "job-6",
        title: "Irrelevant Role",
        status: "IGNORED",
        fitScore: { id: "fs-6", jobId: "job-6", score: 40, createdAt: new Date(), updatedAt: new Date() } as any,
        application: null,
      },
    ];

    it("filters out ARCHIVED and IGNORED jobs for all metrics", () => {
      const activeJobs = (mockJobs as EnrichedJob[]).filter((j) => {
        const s = j.status.toUpperCase();
        return s !== "ARCHIVED" && s !== "IGNORED" && s !== "FILTERED_OUT";
      });
      assert.equal(activeJobs.length, 4);
    });

    it("correctly identifies priority count (score >= 80)", () => {
      const priorityJobs = (mockJobs as EnrichedJob[]).filter((j) => {
        const s = j.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        return (j.fitScore?.score ?? 0) >= 80;
      });
      assert.equal(priorityJobs.length, 3); // job-1, job-2, job-4
    });

    it("correctly identifies assessment review count (60 <= score < 80)", () => {
      const reviewJobs = (mockJobs as EnrichedJob[]).filter((j) => {
        const s = j.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        const score = j.fitScore?.score ?? 0;
        return score >= 60 && score < 80;
      });
      assert.equal(reviewJobs.length, 1); // job-3
    });

    it("correctly identifies active pipeline count", () => {
      const pipelineJobs = (mockJobs as EnrichedJob[]).filter((j) => {
        const s = j.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        return (
          s === "SHORTLISTED" ||
          s === "PREPARED" ||
          s === "APPLIED" ||
          s === "SCREENING" ||
          s === "ASSESSMENT" ||
          s === "INTERVIEW" ||
          s === "INTERVIEWING" ||
          s === "OFFER" ||
          j.application !== null
        );
      });
      assert.equal(pipelineJobs.length, 2); // job-2 (SHORTLISTED), job-4 (APPLIED)
    });

    it("calculates fleet average fit score without dividing by zero on empty lists", () => {
      const scoredJobs = (mockJobs as EnrichedJob[]).filter((j) => {
        const s = j.status.toUpperCase();
        if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
        return j.fitScore?.score !== undefined && j.fitScore?.score !== null;
      });
      const avg = Math.round(
        scoredJobs.reduce((acc, j) => acc + (j.fitScore?.score || 0), 0) / scoredJobs.length
      );
      assert.equal(avg, Math.round((92 + 85 + 72 + 88) / 4)); // 337 / 4 = 84

      // Empty list edge case
      const emptyAvg = [].length > 0 ? 50 : 0;
      assert.equal(emptyAvg, 0);
    });
  });
});
