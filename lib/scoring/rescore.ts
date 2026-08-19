import { db } from "@/lib/db";
import {
  evaluateDeterministicFilters,
  type CandidateFilterCriteria,
  type JobFilterInput,
  type DeterministicFilterOptions,
  type DeterministicFilterResult,
} from "@/lib/filters/deterministic";
import {
  scoreJobFit,
  type AIRouterOptions,
  type CandidateContext,
  type JobContext,
  type FitScore,
} from "@/lib/ai/router";
import { FeedbackLoopService } from "./feedback-loop";

export interface RescoreOptions {
  candidateId?: string;
  prismaClient?: typeof db;
  aiOptions?: AIRouterOptions;
  filterOptions?: DeterministicFilterOptions;
}

export interface RescoreResult {
  jobId: string;
  status: string;
  fitScore: FitScore | null;
  filterResult: DeterministicFilterResult | null;
}

const IMMUTABLE_DOWNSTREAM_STATUSES = new Set([
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "GHOSTED",
  "WITHDRAWN",
]);

export async function rescoreJob(
  jobId: string,
  options?: RescoreOptions
): Promise<RescoreResult> {
  const prisma = options?.prismaClient || db;

  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
  });

  // Fetch Candidate Profile
  const candidateId = options?.candidateId || "candidate-default";
  let candidateRecord = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidateRecord) {
    candidateRecord = await prisma.candidate.findFirst();
  }

  const candidateCriteria: CandidateFilterCriteria = {
    minSalary: candidateRecord?.minSalary ?? 0,
    yearsOfExperience: candidateRecord?.yearsOfExperience ?? 0,
    remotePreference: candidateRecord?.remotePreference ?? "ANY",
    preferredLocations: candidateRecord?.preferredLocations,
  };

  const jobFilterInput: JobFilterInput = {
    title: job.title,
    company: job.company,
    location: job.location,
    remoteStatus: job.remoteStatus,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    employmentType: job.employmentType,
    description: job.description,
  };

  // Evaluate Deterministic Filters (Zero AI)
  const filterResult = evaluateDeterministicFilters(
    candidateCriteria,
    jobFilterInput,
    options?.filterOptions
  );

  if (!filterResult.passed) {
    let updatedStatus = job.status;
    if (!IMMUTABLE_DOWNSTREAM_STATUSES.has(job.status.toUpperCase())) {
      updatedStatus = "FILTERED_OUT";
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "FILTERED_OUT" },
      });
    }

    await prisma.event.create({
      data: {
        entityType: "Job",
        entityId: jobId,
        eventType: "FILTERED_OUT",
        payload: JSON.stringify({
          reasons: filterResult.reasons,
          dedupeKey: job.dedupeKey,
        }),
      },
    });

    return {
      jobId,
      status: updatedStatus,
      fitScore: null,
      filterResult,
    };
  }

  // Passed filters -> AI Fit Scoring
  const candidateContext: CandidateContext = {
    targetRole: candidateRecord?.targetRole,
    minSalary: candidateRecord?.minSalary,
    yearsOfExperience: candidateRecord?.yearsOfExperience,
    remotePreference: candidateRecord?.remotePreference,
    preferredLocations: candidateRecord?.preferredLocations,
    skills: candidateRecord?.skills,
    projects: candidateRecord?.projects,
    experiences: candidateRecord?.experiences,
    resumeText: candidateRecord?.resumeText,
  };

  const jobContext: JobContext = {
    title: job.title,
    company: job.company,
    location: job.location,
    remoteStatus: job.remoteStatus,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    employmentType: job.employmentType,
    description: job.description,
  };

  const aiOptions: AIRouterOptions = { ...(options?.aiOptions || {}) };
  if (!aiOptions.weights || !aiOptions.conversionInsights) {
    try {
      const activeWeights = await FeedbackLoopService.getActiveWeights(prisma);
      aiOptions.weights = aiOptions.weights || activeWeights.weights;
      const insights = await FeedbackLoopService.getConversionInsights(prisma);
      aiOptions.conversionInsights = aiOptions.conversionInsights || insights;
    } catch {
      // Fallback gracefully
    }
  }

  const fitScore = await scoreJobFit(candidateContext, jobContext, aiOptions);

  let newStatus = job.status;
  if (job.status === "FILTERED_OUT") {
    newStatus = "DISCOVERED";
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "DISCOVERED" },
    });
  }

  await prisma.fitScore.upsert({
    where: { jobId },
    create: {
      jobId,
      score: fitScore.score,
      recommendation: fitScore.recommendation,
      skillsFit: fitScore.skillsFit,
      experienceFit: fitScore.experienceFit,
      domainFit: fitScore.domainFit,
      trajectoryFit: fitScore.trajectoryFit,
      strengths: JSON.stringify(fitScore.strengths),
      gaps: JSON.stringify(fitScore.gaps),
      risks: JSON.stringify(fitScore.risks),
      reasoning: fitScore.reasoning,
    },
    update: {
      score: fitScore.score,
      recommendation: fitScore.recommendation,
      skillsFit: fitScore.skillsFit,
      experienceFit: fitScore.experienceFit,
      domainFit: fitScore.domainFit,
      trajectoryFit: fitScore.trajectoryFit,
      strengths: JSON.stringify(fitScore.strengths),
      gaps: JSON.stringify(fitScore.gaps),
      risks: JSON.stringify(fitScore.risks),
      reasoning: fitScore.reasoning,
    },
  });

  await prisma.event.create({
    data: {
      entityType: "Job",
      entityId: jobId,
      eventType: "SCORED",
      payload: JSON.stringify({
        score: fitScore.score,
        recommendation: fitScore.recommendation,
        status: newStatus,
      }),
    },
  });

  return {
    jobId,
    status: newStatus,
    fitScore,
    filterResult,
  };
}
