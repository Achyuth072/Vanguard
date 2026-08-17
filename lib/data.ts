import { db } from "@/lib/db";

export interface EnrichedFitScore {
  id: string;
  score: number;
  recommendation: string;
  strengths: string[];
  gaps: string[];
  risks: string[];
  reasoning: string;
}

export interface EnrichedApplication {
  id: string;
  status: string;
  appliedAt: Date | null;
  resumeVersion: string;
  tailoredNotes: string;
  tailoredResume?: string;
  questionAnswers?: string;
  followUpAt: Date | null;
}

export interface EnrichedJob {
  id: string;
  dedupeKey: string;
  title: string;
  company: string;
  location: string;
  remoteStatus: string;
  salaryMin: number | null;
  salaryMax: number | null;
  employmentType: string;
  description: string;
  url: string;
  source: string;
  status: string;
  postedAt: Date | null;
  discoveredAt: Date;
  companyName: string;
  role: string;
  dateApplied: Date;
  aiAnalysis: string | null;
  fitScore: EnrichedFitScore | null;
  application: EnrichedApplication | null;
}

function safeParseJsonArray(jsonStr?: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getJobs(): Promise<EnrichedJob[]> {
  const jobs = await db.job.findMany({
    include: {
      fitScore: true,
      application: true,
    },
    orderBy: {
      discoveredAt: "desc",
    },
  });

  return jobs.map((job) => {
    const fitScore: EnrichedFitScore | null = job.fitScore
      ? {
          id: job.fitScore.id,
          score: job.fitScore.score,
          recommendation: job.fitScore.recommendation,
          strengths: safeParseJsonArray(job.fitScore.strengths),
          gaps: safeParseJsonArray(job.fitScore.gaps),
          risks: safeParseJsonArray(job.fitScore.risks),
          reasoning: job.fitScore.reasoning,
        }
      : null;

    const application: EnrichedApplication | null = job.application
      ? {
          id: job.application.id,
          status: job.application.status,
          appliedAt: job.application.appliedAt,
          resumeVersion: job.application.resumeVersion,
          tailoredNotes: job.application.tailoredNotes,
          tailoredResume: job.application.tailoredResume,
          questionAnswers: job.application.questionAnswers,
          followUpAt: job.application.followUpAt,
        }
      : null;

    return {
      id: job.id,
      dedupeKey: job.dedupeKey,
      title: job.title,
      company: job.company,
      location: job.location,
      remoteStatus: job.remoteStatus,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      employmentType: job.employmentType,
      description: job.description,
      url: job.url,
      source: job.source,
      status: job.status,
      postedAt: job.postedAt,
      discoveredAt: job.discoveredAt,
      companyName: job.company,
      role: job.title,
      dateApplied: job.application?.appliedAt || job.discoveredAt,
      aiAnalysis: job.fitScore?.reasoning || (job.description ? job.description.slice(0, 150) : null),
      fitScore,
      application,
    };
  });
}

export async function updateJobStatus(
  jobId: string,
  newStatus: string,
  payload?: Record<string, unknown>,
  prisma: typeof db = db
) {
  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: { application: true },
  });

  if (!currentJob) {
    throw new Error(`Job not found with id: ${jobId}`);
  }

  const previousStatus = currentJob.status;

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: { status: newStatus },
  });

  const applicationStatuses = [
    "SHORTLISTED",
    "PREPARED",
    "APPLIED",
    "INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
  ];

  if (applicationStatuses.includes(newStatus.toUpperCase())) {
    const normalizedStatus = newStatus.toUpperCase();
    const isApplied = normalizedStatus === "APPLIED";

    await prisma.application.upsert({
      where: { jobId },
      create: {
        jobId,
        status: normalizedStatus,
        appliedAt: isApplied ? new Date() : null,
      },
      update: {
        status: normalizedStatus,
        ...(isApplied && !currentJob.application?.appliedAt ? { appliedAt: new Date() } : {}),
      },
    });
  }

  await prisma.event.create({
    data: {
      entityType: "Job",
      entityId: jobId,
      eventType: "STATUS_TRANSITION",
      payload: JSON.stringify({
        previousStatus,
        newStatus,
        ...(payload || {}),
      }),
    },
  });

  return updatedJob;
}

export async function addJob(job: {
  companyName: string;
  role: string;
  status?: string;
  aiAnalysis?: string;
}) {
  const dedupeKey = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return await db.job.create({
    data: {
      dedupeKey,
      company: job.companyName,
      title: job.role,
      status: job.status || "DISCOVERED",
      description: job.aiAnalysis || "Manual entry",
    },
  });
}

