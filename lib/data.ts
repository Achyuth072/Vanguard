import { db } from "@/lib/db";
import { transitionApplicationStatus, type TransitionOptions } from "@/lib/lifecycle/service";

export interface EnrichedFitScore {
  id: string;
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
}

export interface EnrichedApplication {
  id: string;
  status: string;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  responseTimeDays: number | null;
  rejectionStage: string | null;
  rejectionReason: string | null;
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
          skillsFit: job.fitScore.skillsFit ?? job.fitScore.score,
          experienceFit: job.fitScore.experienceFit ?? job.fitScore.score,
          domainFit: job.fitScore.domainFit ?? job.fitScore.score,
          trajectoryFit: job.fitScore.trajectoryFit ?? job.fitScore.score,
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
          firstResponseAt: job.application.firstResponseAt,
          responseTimeDays: job.application.responseTimeDays,
          rejectionStage: job.application.rejectionStage,
          rejectionReason: job.application.rejectionReason,
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
  const options: TransitionOptions = {
    rejectionStage: payload?.rejectionStage as string | undefined,
    rejectionReason: payload?.rejectionReason as string | undefined,
    note: payload?.note as string | undefined,
    appliedAt: payload?.appliedAt as Date | undefined,
    firstResponseAt: payload?.firstResponseAt as Date | undefined,
    metadata: payload,
  };

  await transitionApplicationStatus(jobId, newStatus, options, prisma);
  return await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
}

export interface UpdateJobInput {
  title?: string;
  company?: string;
  location?: string;
  remoteStatus?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string;
  description?: string;
  url?: string;
}

export async function updateJob(
  jobId: string,
  input: UpdateJobInput,
  prisma: typeof db = db
) {
  const updateData: Partial<UpdateJobInput> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.company !== undefined) updateData.company = input.company;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.remoteStatus !== undefined) updateData.remoteStatus = input.remoteStatus;
  if (input.salaryMin !== undefined) updateData.salaryMin = input.salaryMin;
  if (input.salaryMax !== undefined) updateData.salaryMax = input.salaryMax;
  if (input.employmentType !== undefined) updateData.employmentType = input.employmentType;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.url !== undefined) updateData.url = input.url;

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: updateData,
  });

  try {
    await prisma.event.create({
      data: {
        entityType: "JOB",
        entityId: jobId,
        eventType: "DETAILS_UPDATED",
        payload: JSON.stringify(updateData),
      },
    });
  } catch (err) {
    console.error("Failed to log DETAILS_UPDATED event:", err);
  }

  return updated;
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

export async function deleteJob(jobId: string, prisma: typeof db = db) {
  await prisma.event.deleteMany({ where: { entityId: jobId } });
  await prisma.fitScore.deleteMany({ where: { jobId } });
  await prisma.application.deleteMany({ where: { jobId } });
  await prisma.job.delete({ where: { id: jobId } });
}


