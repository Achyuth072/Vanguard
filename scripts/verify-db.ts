import { db } from "../lib/db";

async function verifyDatabase() {
  console.log("Starting SQLite database verification...");

  // 1. Verify Candidate
  const candidate = await db.candidate.upsert({
    where: { id: "test-candidate-1" },
    update: {},
    create: {
      id: "test-candidate-1",
      name: "Test Engineer",
      targetRole: "Senior Fullstack Engineer",
      minSalary: 120000,
      yearsOfExperience: 5,
      remotePreference: "REMOTE_ONLY",
      preferredLocations: JSON.stringify(["Remote"]),
      skills: JSON.stringify(["TypeScript", "Next.js", "Node.js", "SQLite"]),
      projects: JSON.stringify([{ name: "Pulse", role: "Author" }]),
      experiences: JSON.stringify([{ company: "Acme", title: "SWE" }]),
      resumeText: "Experienced engineer with fullstack skills.",
    },
  });
  console.log("✓ Candidate created/verified:", candidate.id, candidate.name);

  // 2. Verify Job
  const testDedupeKey = `test_job_${Date.now()}`;
  const job = await db.job.create({
    data: {
      dedupeKey: testDedupeKey,
      title: "Founding Engineer",
      company: "Startup AI",
      location: "San Francisco, CA",
      remoteStatus: "REMOTE",
      salaryMin: 130000,
      salaryMax: 160000,
      employmentType: "FULL_TIME",
      description: "Build AI-powered productivity tools.",
      url: "https://example.com/jobs/123",
      source: "MANUAL",
      status: "DISCOVERED",
    },
  });
  console.log("✓ Job created:", job.id, job.title, job.company);

  // 3. Verify FitScore
  const fitScore = await db.fitScore.create({
    data: {
      jobId: job.id,
      score: 92,
      recommendation: "APPLY",
      strengths: JSON.stringify(["Direct match on TypeScript", "Strong startup alignment"]),
      gaps: JSON.stringify([]),
      risks: JSON.stringify([]),
      reasoning: "Exceptional alignment with core competencies.",
    },
  });
  console.log("✓ FitScore created:", fitScore.id, `Score: ${fitScore.score}`, fitScore.recommendation);

  // 4. Verify Application
  const application = await db.application.create({
    data: {
      jobId: job.id,
      status: "SHORTLISTED",
      resumeVersion: "v1.2",
      tailoredNotes: "Focus on AI integration experience.",
    },
  });
  console.log("✓ Application created:", application.id, application.status);

  // 5. Verify Event
  const event = await db.event.create({
    data: {
      entityType: "Job",
      entityId: job.id,
      eventType: "STATUS_CHANGED",
      payload: JSON.stringify({ previous: "DISCOVERED", next: "SHORTLISTED" }),
    },
  });
  console.log("✓ Event created:", event.id, event.eventType);

  // 6. Verify Relations and Query
  const fetchedJob = await db.job.findUnique({
    where: { id: job.id },
    include: {
      fitScore: true,
      application: true,
    },
  });

  if (!fetchedJob || !fetchedJob.fitScore || !fetchedJob.application) {
    throw new Error("Relational query verification failed");
  }
  console.log("✓ Relational fetch verified for job and related fitScore/application");

  // Cleanup test records
  await db.job.delete({ where: { id: job.id } });
  await db.candidate.delete({ where: { id: candidate.id } });
  await db.event.delete({ where: { id: event.id } });
  console.log("✓ Cleanup completed successfully");
}

verifyDatabase()
  .then(() => {
    console.log("All database verification checks passed!");
  })
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
