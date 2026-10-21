import fs from "node:fs";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";

const DUMMY_DB_PATH = "/tmp/pulse-dummy.db";
const PORT = 3005;

async function seedDummyDb() {
  if (fs.existsSync(DUMMY_DB_PATH)) {
    fs.unlinkSync(DUMMY_DB_PATH);
  }
  fs.copyFileSync("pulse-test.db", DUMMY_DB_PATH);

  const db = createClient({ url: `file:${DUMMY_DB_PATH}` });
  await db.execute("DELETE FROM Event");
  await db.execute("DELETE FROM FitScore");
  await db.execute("DELETE FROM Application");
  await db.execute("DELETE FROM Job");
  await db.execute("DELETE FROM FeedSource");
  await db.execute("DELETE FROM Candidate");

  const now = new Date();
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

  // 1. Candidate Alex Rivers
  await db.execute({
    sql: `INSERT INTO Candidate (id, name, location, targetRole, minSalary, currency, yearsOfExperience, remotePreference, preferredLocations, skills, projects, experiences, resumeText, targetRoleKeywords, techStack, companyStageBlacklist, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "candidate-default",
      "Alex Rivers",
      "Remote / Worldwide",
      "Staff Software Engineer (Distributed Systems)",
      180000,
      "USD",
      8,
      "REMOTE_ONLY",
      JSON.stringify(["Remote", "San Francisco, CA", "New York, NY", "Worldwide"]),
      JSON.stringify([
        { name: "TypeScript", level: "EXPERT" },
        { name: "Rust", level: "PROFICIENT" },
        { name: "Go", level: "PROFICIENT" },
        { name: "Distributed Systems", level: "EXPERT" },
        { name: "PostgreSQL", level: "PROFICIENT" },
        { name: "Docker", level: "EXPERT" },
        { name: "Kubernetes", level: "PROFICIENT" },
        { name: "Next.js", level: "EXPERT" },
      ]),
      JSON.stringify([
        {
          name: "NexusKV",
          description: "High-throughput distributed key-value store with Raft consensus and LSM-tree storage engine in Rust.",
          technologies: ["Rust", "Raft", "gRPC", "LSM-Tree"],
          metrics: "Sub-millisecond p99 read latency under 100k QPS load",
        },
        {
          name: "PulseStream",
          description: "Real-time edge event routing engine using TypeScript and WebSockets.",
          technologies: ["TypeScript", "Node.js", "Redis", "WebSockets"],
          metrics: "2M concurrent connections across 6 global edge POPs",
        },
      ]),
      JSON.stringify([
        {
          company: "Aether Cloud Infrastructure",
          title: "Staff Software Engineer",
          startDate: "2022-01",
          endDate: "Present",
          highlights: [
            "Architected distributed replication engine across 4 global regions, reducing cross-region sync lag by 45%",
            "Mentored team of 12 distributed systems engineers on concurrency patterns and reliability",
          ],
        },
        {
          company: "Vortex Labs",
          title: "Senior Backend Engineer",
          startDate: "2019-06",
          endDate: "2021-12",
          highlights: [
            "Engineered event ingestion pipeline streaming 40B events daily with Go and Kafka",
            "Optimized query planners and indexing, reducing p95 execution time by 60%",
          ],
        },
      ]),
      "Alex Rivers - Staff Software Engineer resume...",
      JSON.stringify(["Staff Engineer", "Distributed Systems", "Backend Engineer", "Platform Engineer", "Systems Architect"]),
      JSON.stringify(["Rust", "Go", "TypeScript", "Node.js", "Kubernetes", "PostgreSQL", "Docker", "Kafka"]),
      JSON.stringify([]),
      d(30),
      d(1),
    ],
  });

  // 2. Feed sources
  const feedSources = [
    { id: "feed-ashby", name: "Ashby Portals", type: "ASHBY", url: "https://jobs.ashbyhq.com", disc: 48, pass: 32 },
    { id: "feed-gh", name: "Greenhouse Direct", type: "GREENHOUSE", url: "https://boards.greenhouse.io", disc: 94, pass: 61 },
    { id: "feed-hn", name: "Hacker News Hiring", type: "HN", url: "https://news.ycombinator.com", disc: 142, pass: 89 },
    { id: "feed-remoteok", name: "RemoteOK Sync", type: "REMOTEOK", url: "https://remoteok.com", disc: 35, pass: 22 },
  ];
  for (const f of feedSources) {
    await db.execute({
      sql: `INSERT INTO FeedSource (id, name, type, url, config, enabled, autoPoll, lastPolledAt, lastCursor, nextPollAt, pollIntervalMs, consecutiveEmpty, jobsDiscovered, jobsPassed, errorCount, lastError, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 1, 0, ?, '', ?, 14400000, 0, ?, ?, 0, '', ?, ?)`,
      args: [f.id, f.name, f.type, f.url, "{}", d(0.2), d(-0.5), f.disc, f.pass, d(2), d(0.2)],
    });
  }

  // 3. Jobs, FitScores, and Applications
  interface JobSeed {
    id: string;
    title: string;
    company: string;
    location: string;
    remoteStatus: string;
    salaryMin: number;
    salaryMax: number;
    currency: string;
    description: string;
    url: string;
    source: string;
    status: string;
    isStaged: boolean;
    daysAgo: number;
    fitScore?: {
      score: number;
      recommendation: string;
      skillsFit: number;
      experienceFit: number;
      domainFit: number;
      trajectoryFit: number;
      strengths: string[];
      gaps: string[];
      risks: string[];
      reasoning: string;
    };
    application?: {
      status: string;
      appliedAt?: string;
      resumeVersion: string;
      tailoredNotes: string;
    };
  }

  const jobsData: JobSeed[] = [
    {
      id: "job-1",
      title: "Staff Distributed Systems Engineer",
      company: "Nova Cloud",
      location: "Worldwide Remote",
      remoteStatus: "REMOTE",
      salaryMin: 195000,
      salaryMax: 240000,
      currency: "USD",
      description: `Nova Cloud is engineering the next-generation global storage fabric. We are looking for a Staff Distributed Systems Engineer to design, implement, and operate our fault-tolerant consensus layer and edge data engines.\n\nKey Responsibilities:\n- Architect high-throughput distributed state machines using Raft/Paxos in Rust.\n- Optimize sub-millisecond p99 latencies across geo-distributed clusters.\n- Collaborate on storage tiering, LSM-trees, and zero-copy network serialization.\n\nQualifications:\n- 7+ years building high-concurrency distributed systems.\n- Production experience in Rust or Go.\n- Deep understanding of consensus, replication, and distributed transactions.`,
      url: "https://novacloud.io/careers/staff-systems-engineer",
      source: "ASHBY",
      status: "SHORTLISTED",
      isStaged: false,
      daysAgo: 1,
      fitScore: {
        score: 94,
        recommendation: "STRONG_MATCH",
        skillsFit: 96,
        experienceFit: 92,
        domainFit: 95,
        trajectoryFit: 93,
        strengths: [
          "Extensive production experience with Raft consensus and distributed storage engines",
          "Demonstrated mastery of Rust and Go in high-throughput environments",
          "Track record of reducing p99 latency under heavy concurrent loads",
        ],
        gaps: [
          "Job notes familiarity with eBPF kernel profiling; candidate background is primarily user-space systems",
        ],
        risks: [],
        reasoning: "Candidate's open-source Raft key-value engine (NexusKV) and 8 years in high-concurrency cloud infrastructure directly map to Nova Cloud's core data plane requirements.",
      },
      application: {
        status: "SHORTLISTED",
        resumeVersion: "v1-distributed",
        tailoredNotes: "Targeting consensus protocol depth and sub-millisecond latency metrics from NexusKV.",
      },
    },
    {
      id: "job-2",
      title: "Principal Platform Architect",
      company: "Solaris Tech",
      location: "Remote (US / EU)",
      remoteStatus: "REMOTE",
      salaryMin: 210000,
      salaryMax: 260000,
      currency: "USD",
      description: `Solaris Tech is scaling its sovereign cloud infrastructure. Looking for a Principal Platform Architect to lead our multi-region Kubernetes control planes and edge orchestration.`,
      url: "https://solaristech.internal/jobs/arch-1",
      source: "GREENHOUSE",
      status: "INTERVIEW",
      isStaged: false,
      daysAgo: 6,
      fitScore: {
        score: 91,
        recommendation: "STRONG_MATCH",
        skillsFit: 94,
        experienceFit: 92,
        domainFit: 90,
        trajectoryFit: 88,
        strengths: ["Kubernetes operator development", "Multi-region architecture leadership"],
        gaps: [],
        risks: [],
        reasoning: "Outstanding alignment with multi-region platform scale and Kubernetes control plane leadership.",
      },
      application: {
        status: "INTERVIEW",
        appliedAt: d(5),
        resumeVersion: "v1-platform",
        tailoredNotes: "Highlighted Aether multi-region replication fabric.",
      },
    },
    {
      id: "job-3",
      title: "Senior Backend Engineer (Go/Rust)",
      company: "Nexus Systems",
      location: "Worldwide Remote",
      remoteStatus: "REMOTE",
      salaryMin: 180000,
      salaryMax: 215000,
      currency: "USD",
      description: `High-frequency event streaming platform processing billions of telemetry points. Seeking senior systems engineer with Go and Rust expertise.`,
      url: "https://nexussystems.dev/careers/backend",
      source: "HN",
      status: "APPLIED",
      isStaged: false,
      daysAgo: 3,
      fitScore: {
        score: 88,
        recommendation: "STRONG_MATCH",
        skillsFit: 90,
        experienceFit: 86,
        domainFit: 88,
        trajectoryFit: 88,
        strengths: ["Kafka event streaming pipelines", "Low-latency Go microservices"],
        gaps: ["GraphQL knowledge not evident"],
        risks: [],
        reasoning: "Direct match on concurrent backend architecture and high-volume data stream processing.",
      },
      application: {
        status: "APPLIED",
        appliedAt: d(3),
        resumeVersion: "v1",
        tailoredNotes: "Emphasized 40B events/day Vortex Labs streaming telemetry.",
      },
    },
    {
      id: "job-4",
      title: "Lead Systems Architect",
      company: "Apex Compute",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 185000,
      salaryMax: 225000,
      currency: "USD",
      description: `Apex Compute builds accelerated runtime environments for high-performance ML workloads. Leading our core virtualization and compute runtime team.`,
      url: "https://apexcompute.ai/careers/lead-architect",
      source: "ASHBY",
      status: "PREPARED",
      isStaged: false,
      daysAgo: 4,
      fitScore: {
        score: 92,
        recommendation: "STRONG_MATCH",
        skillsFit: 95,
        experienceFit: 90,
        domainFit: 91,
        trajectoryFit: 92,
        strengths: ["Bare-metal performance profiling", "Runtime optimization"],
        gaps: [],
        risks: [],
        reasoning: "Exceptional systems programming and bare-metal runtime engineering fit.",
      },
      application: {
        status: "PREPARED",
        resumeVersion: "v1-systems",
        tailoredNotes: "Prepared tailored resume highlighting Raft and memory optimizations.",
      },
    },
    {
      id: "job-5",
      title: "Senior Systems Engineer",
      company: "Aether Networks",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 175000,
      salaryMax: 210000,
      currency: "USD",
      description: `Designing programmable network data planes and edge routing fabrics with Envoy and WebAssembly.`,
      url: "https://aethernet.io/careers/systems",
      source: "REMOTEOK",
      status: "SCREENING",
      isStaged: false,
      daysAgo: 8,
      fitScore: {
        score: 86,
        recommendation: "STRONG_MATCH",
        skillsFit: 88,
        experienceFit: 85,
        domainFit: 85,
        trajectoryFit: 86,
        strengths: ["Envoy proxy plugins", "Network data planes"],
        gaps: [],
        risks: [],
        reasoning: "Solid match for programmable edge networking and proxy infrastructure.",
      },
      application: {
        status: "SCREENING",
        appliedAt: d(7),
        resumeVersion: "v1",
        tailoredNotes: "Screening call scheduled with Engineering Director.",
      },
    },
    {
      id: "job-6",
      title: "Staff Distributed Compute Engineer",
      company: "Meridian Distributed",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 220000,
      salaryMax: 270000,
      currency: "USD",
      description: `Next-gen distributed scheduler for massive compute grids. Building consensus, failover, and task allocation algorithms.`,
      url: "https://meridiandistributed.com/careers/staff-compute",
      source: "GREENHOUSE",
      status: "OFFER",
      isStaged: false,
      daysAgo: 16,
      fitScore: {
        score: 95,
        recommendation: "STRONG_MATCH",
        skillsFit: 97,
        experienceFit: 94,
        domainFit: 95,
        trajectoryFit: 94,
        strengths: ["Distributed scheduler design", "Consensus algorithms", "Fault tolerance"],
        gaps: [],
        risks: [],
        reasoning: "Outstanding alignment with distributed scheduler architecture and consensus protocols.",
      },
      application: {
        status: "OFFER",
        appliedAt: d(15),
        resumeVersion: "v1-scheduler",
        tailoredNotes: "Received formal offer. Evaluating terms.",
      },
    },
    {
      id: "job-7",
      title: "Core Protocols Engineer",
      company: "Horizon Labs",
      location: "Worldwide Remote",
      remoteStatus: "REMOTE",
      salaryMin: 165000,
      salaryMax: 195000,
      currency: "USD",
      description: `Researching and implementing cryptographic peer-to-peer protocols and asynchronous state replication.`,
      url: "https://horizonlabs.org/careers/protocols",
      source: "HN",
      status: "DISCOVERED",
      isStaged: false,
      daysAgo: 2,
      fitScore: {
        score: 78,
        recommendation: "BORDERLINE_REVIEW",
        skillsFit: 80,
        experienceFit: 76,
        domainFit: 78,
        trajectoryFit: 77,
        strengths: ["Network protocol design", "Async I/O event loops"],
        gaps: ["Zero-knowledge cryptography proofs"],
        risks: [],
        reasoning: "Strong systems foundation; requires human review of cryptographic protocol depth.",
      },
    },
    {
      id: "job-8",
      title: "Staff Full-Stack Engineer",
      company: "Prism Interactive",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 170000,
      salaryMax: 205000,
      currency: "USD",
      description: `Interactive developer tools and spatial canvases built with Next.js, WebGL, and WebSockets.`,
      url: "https://prisminteractive.com/careers/staff-fullstack",
      source: "ASHBY",
      status: "DISCOVERED",
      isStaged: false,
      daysAgo: 3,
      fitScore: {
        score: 74,
        recommendation: "BORDERLINE_REVIEW",
        skillsFit: 78,
        experienceFit: 72,
        domainFit: 74,
        trajectoryFit: 72,
        strengths: ["TypeScript & React mastery", "Real-time canvas synchronization"],
        gaps: ["WebGL shader programming"],
        risks: [],
        reasoning: "Strong web performance background; review balance of front-end graphics vs systems architecture.",
      },
    },
    // Discovery Staged Jobs
    {
      id: "job-staged-1",
      title: "Database Kernel Developer",
      company: "ByteScale Systems",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 200000,
      salaryMax: 245000,
      currency: "USD",
      description: "Developing storage engine internals and concurrency controls for distributed SQL engine.",
      url: "https://bytescale.io/jobs/kernel",
      source: "GREENHOUSE",
      status: "DISCOVERED",
      isStaged: true,
      daysAgo: 0.5,
    },
    {
      id: "job-staged-2",
      title: "Systems Performance Engineer",
      company: "Kestrel Computing",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 190000,
      salaryMax: 230000,
      currency: "USD",
      description: "Linux kernel profiling, CPU cache optimization, and high-performance network IO.",
      url: "https://kestrel.tech/careers/perf",
      source: "HN",
      status: "DISCOVERED",
      isStaged: true,
      daysAgo: 0.3,
    },
    {
      id: "job-staged-3",
      title: "Edge Platform Architect",
      company: "Orbit Data",
      location: "Worldwide Remote",
      remoteStatus: "REMOTE",
      salaryMin: 180000,
      salaryMax: 215000,
      currency: "USD",
      description: "Global CDN edge compute routing and low-latency proxy infrastructure.",
      url: "https://orbitdata.net/jobs/edge",
      source: "ASHBY",
      status: "DISCOVERED",
      isStaged: true,
      daysAgo: 0.2,
    },
    {
      id: "job-staged-4",
      title: "Senior Infrastructure Engineer",
      company: "Veritas AI",
      location: "Remote",
      remoteStatus: "REMOTE",
      salaryMin: 175000,
      salaryMax: 210000,
      currency: "USD",
      description: "Kubernetes GPU cluster provisioning, automated node scheduling, and telemetry.",
      url: "https://veritas.ai/jobs/infra",
      source: "REMOTEOK",
      status: "DISCOVERED",
      isStaged: true,
      daysAgo: 0.1,
    },
  ];

  for (const j of jobsData) {
    const dedupeKey = `dedupe-${j.id}`;
    const clusterKey = `cluster-${j.company.toLowerCase()}-${j.title.toLowerCase()}`;
    await db.execute({
      sql: `INSERT INTO Job (id, dedupeKey, clusterKey, sourceExternalId, title, company, location, remoteStatus, salaryMin, salaryMax, currency, employmentType, description, url, source, isStaged, status, postedAt, discoveredAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FULL_TIME', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        j.id,
        dedupeKey,
        clusterKey,
        `ext-${j.id}`,
        j.title,
        j.company,
        j.location,
        j.remoteStatus,
        j.salaryMin,
        j.salaryMax,
        j.currency,
        j.description,
        j.url,
        j.source,
        j.isStaged ? 1 : 0,
        j.status,
        d(j.daysAgo + 1),
        d(j.daysAgo),
      ],
    });

    if (j.fitScore) {
      await db.execute({
        sql: `INSERT INTO FitScore (id, jobId, score, recommendation, skillsFit, experienceFit, domainFit, trajectoryFit, strengths, gaps, risks, reasoning, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `fit-${j.id}`,
          j.id,
          j.fitScore.score,
          j.fitScore.recommendation,
          j.fitScore.skillsFit,
          j.fitScore.experienceFit,
          j.fitScore.domainFit,
          j.fitScore.trajectoryFit,
          JSON.stringify(j.fitScore.strengths),
          JSON.stringify(j.fitScore.gaps),
          JSON.stringify(j.fitScore.risks),
          j.fitScore.reasoning,
          d(j.daysAgo),
        ],
      });
    }

    if (j.application) {
      await db.execute({
        sql: `INSERT INTO Application (id, jobId, status, appliedAt, resumeVersion, tailoredNotes, tailoredResume, questionAnswers, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, '{}', '[]', ?, ?)`,
        args: [
          `app-${j.id}`,
          j.id,
          j.application.status,
          j.application.appliedAt || null,
          j.application.resumeVersion,
          j.application.tailoredNotes,
          d(j.daysAgo),
          d(j.daysAgo),
        ],
      });
    }
  }

  console.log("Successfully seeded dummy database at /tmp/pulse-dummy.db");
}

function waitForHttp(url: string, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", () => retry());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

async function main() {
  await seedDummyDb();

  console.log(`Starting Next.js on port ${PORT} with dummy database...`);
  const serverProcess: ChildProcess = spawn(
    "npx",
    ["next", "dev", "-p", String(PORT)],
    {
      env: {
        ...process.env,
        DATABASE_URL: `file:${DUMMY_DB_PATH}`,
        PORT: String(PORT),
      },
      stdio: "pipe",
      detached: true,
    }
  );

  serverProcess.stdout?.on("data", (data) => {
    // console.log(`[Next] ${data}`);
  });
  serverProcess.stderr?.on("data", (data) => {
    // console.error(`[Next ERR] ${data}`);
  });

  try {
    await waitForHttp(`http://localhost:${PORT}/`, 40000);
    console.log("Next.js dev server is ready!");

    fs.mkdirSync("docs/screenshots", { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    // 1. Desktop Screenshots
    console.log("Capturing Desktop Cockpit...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1560, height: 960 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await desktopPage.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await desktopPage.waitForTimeout(1000);

    // Save Desktop Cockpit
    await desktopPage.screenshot({
      path: "docs/screenshots/desktop-cockpit.png",
      fullPage: false,
    });
    console.log("Saved docs/screenshots/desktop-cockpit.png");

    // Click Pipeline tab for Desktop Pipeline view
    const pipelineTab = desktopPage.locator('button:has-text("Pipeline")').first();
    if (await pipelineTab.isVisible()) {
      await pipelineTab.click({ force: true });
      await desktopPage.waitForTimeout(800);
      await desktopPage.screenshot({
        path: "docs/screenshots/desktop-pipeline.png",
        fullPage: false,
      });
      console.log("Saved docs/screenshots/desktop-pipeline.png");
    }

    await desktopContext.close();

    // 2. Mobile Screenshots
    console.log("Capturing Mobile Cockpit...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await mobilePage.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await mobilePage.waitForTimeout(1200);

    await mobilePage.screenshot({
      path: "docs/screenshots/mobile-cockpit.png",
      fullPage: false,
    });
    console.log("Saved docs/screenshots/mobile-cockpit.png");

    // Mobile Pipeline View via bottom action bar
    const mobilePipelineNav = mobilePage.locator('[data-testid="mobile-action-bar"] button:has-text("Pipeline")');
    if (await mobilePipelineNav.isVisible()) {
      await mobilePipelineNav.evaluate((el) => (el as HTMLElement).click());
      await mobilePage.waitForTimeout(1000);
      await mobilePage.screenshot({
        path: "docs/screenshots/mobile-pipeline.png",
        fullPage: false,
      });
      console.log("Saved docs/screenshots/mobile-pipeline.png");
    }

    await mobileContext.close();
    await browser.close();
    console.log("All screenshots successfully captured!");
  } finally {
    console.log("Shutting down Next.js dev server...");
    if (serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
    }
    if (fs.existsSync(DUMMY_DB_PATH)) {
      try {
        fs.unlinkSync(DUMMY_DB_PATH);
      } catch {}
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error capturing screenshots:", err);
    process.exit(1);
  });
