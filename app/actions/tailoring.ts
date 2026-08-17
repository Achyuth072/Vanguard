"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { tailorResume } from "@/lib/tailoring/resume";
import {
  generateApplicationAnswers,
  answerCustomQuestion,
} from "@/lib/tailoring/answers";
import type {
  TailoredResume,
  ApplicationAnswer,
} from "@/types/tailoring";
import {
  CandidateContext,
  JobContext,
  AIRouterOptions,
} from "@/lib/ai/router";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignored in non-request contexts like node unit tests
  }
}

async function getCandidateContext(): Promise<CandidateContext> {
  const candidate = await db.candidate.findFirst({
    where: { id: "candidate-default" },
  }) || (await db.candidate.findFirst());

  if (!candidate) {
    return {
      name: "Default Candidate",
      targetRole: "Software Engineer",
      minSalary: 0,
      yearsOfExperience: 0,
      remotePreference: "ANY",
      skills: [],
      projects: [],
      experiences: [],
      resumeText: "",
    };
  }

  return {
    name: candidate.name,
    targetRole: candidate.targetRole,
    minSalary: candidate.minSalary,
    yearsOfExperience: candidate.yearsOfExperience,
    remotePreference: candidate.remotePreference,
    preferredLocations: candidate.preferredLocations,
    skills: candidate.skills,
    projects: candidate.projects,
    experiences: candidate.experiences,
    resumeText: candidate.resumeText,
  };
}

export async function prepareApplication(
  jobId: string,
  options?: AIRouterOptions
): Promise<{
  success: boolean;
  application: { id: string; jobId: string; status: string };
  tailoredResume: TailoredResume;
  questionAnswers: ApplicationAnswer[];
}> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { fitScore: true, application: true },
  });

  if (!job) {
    throw new Error(`Job not found with id: ${jobId}`);
  }

  const candidateCtx = await getCandidateContext();
  const jobCtx: JobContext = {
    title: job.title,
    company: job.company,
    location: job.location,
    remoteStatus: job.remoteStatus,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    employmentType: job.employmentType,
    description: job.description,
  };

  const [tailoredResume, questionAnswers] = await Promise.all([
    tailorResume(candidateCtx, jobCtx, options),
    generateApplicationAnswers(candidateCtx, jobCtx, undefined, options),
  ]);

  const serializedResume = JSON.stringify(tailoredResume);
  const serializedAnswers = JSON.stringify(questionAnswers);

  const application = await db.application.upsert({
    where: { jobId },
    create: {
      jobId,
      status: "PREPARED",
      tailoredResume: serializedResume,
      questionAnswers: serializedAnswers,
    },
    update: {
      status: "PREPARED",
      tailoredResume: serializedResume,
      questionAnswers: serializedAnswers,
    },
  });

  await db.job.update({
    where: { id: jobId },
    data: { status: "PREPARED" },
  });

  await db.event.create({
    data: {
      entityType: "Application",
      entityId: application.id,
      eventType: "APPLICATION_PREPARED",
      payload: JSON.stringify({
        jobId,
        selectedProjectsCount: tailoredResume.selectedProjects.length,
        answersCount: questionAnswers.length,
      }),
    },
  });

  safeRevalidatePath("/");

  return {
    success: true,
    application: {
      id: application.id,
      jobId: application.jobId,
      status: application.status,
    },
    tailoredResume,
    questionAnswers,
  };
}

export async function askCustomApplicationQuestion(
  jobId: string,
  question: string,
  options?: AIRouterOptions
): Promise<{
  success: boolean;
  answer: ApplicationAnswer;
  questionAnswers: ApplicationAnswer[];
}> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question cannot be empty");
  }

  const job = await db.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Job not found with id: ${jobId}`);
  }

  const candidateCtx = await getCandidateContext();
  const jobCtx: JobContext = {
    title: job.title,
    company: job.company,
    location: job.location,
    remoteStatus: job.remoteStatus,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    employmentType: job.employmentType,
    description: job.description,
  };

  const newAnswer = await answerCustomQuestion(candidateCtx, jobCtx, trimmedQuestion, options);

  const currentApp = await db.application.findUnique({
    where: { jobId },
  });

  let existingAnswers: ApplicationAnswer[] = [];
  if (currentApp?.questionAnswers) {
    try {
      const parsed = JSON.parse(currentApp.questionAnswers);
      if (Array.isArray(parsed)) {
        existingAnswers = parsed;
      }
    } catch {
      existingAnswers = [];
    }
  }

  const updatedAnswers = [...existingAnswers, newAnswer];
  const serialized = JSON.stringify(updatedAnswers);

  const application = await db.application.upsert({
    where: { jobId },
    create: {
      jobId,
      status: "PREPARED",
      questionAnswers: serialized,
    },
    update: {
      questionAnswers: serialized,
    },
  });

  await db.event.create({
    data: {
      entityType: "Application",
      entityId: application.id,
      eventType: "CUSTOM_QUESTION_ANSWERED",
      payload: JSON.stringify({
        jobId,
        question: trimmedQuestion,
        answerId: newAnswer.id,
      }),
    },
  });

  safeRevalidatePath("/");

  return {
    success: true,
    answer: newAnswer,
    questionAnswers: updatedAnswers,
  };
}

export async function updateTailoredResume(
  applicationOrJobId: string,
  markdownContent: string
): Promise<{
  success: boolean;
  tailoredResume: TailoredResume;
}> {
  let app = await db.application.findUnique({
    where: { id: applicationOrJobId },
  });

  if (!app) {
    app = await db.application.findUnique({
      where: { jobId: applicationOrJobId },
    });
  }

  if (!app) {
    throw new Error(`Application not found for identifier: ${applicationOrJobId}`);
  }

  let parsedResume: Partial<TailoredResume> = {};
  if (app.tailoredResume) {
    try {
      parsedResume = JSON.parse(app.tailoredResume);
    } catch {
      parsedResume = {};
    }
  }

  parsedResume.markdownContent = markdownContent;
  const updatedResume = parsedResume as TailoredResume;
  const serialized = JSON.stringify(updatedResume);

  await db.application.update({
    where: { id: app.id },
    data: {
      tailoredResume: serialized,
    },
  });

  safeRevalidatePath("/");

  return {
    success: true,
    tailoredResume: updatedResume,
  };
}

export async function getApplicationData(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      fitScore: true,
      application: true,
    },
  });

  if (!job) {
    return {
      job: null,
      application: null,
      tailoredResume: null,
      questionAnswers: [],
    };
  }

  let tailoredResume: TailoredResume | null = null;
  let questionAnswers: ApplicationAnswer[] = [];

  if (job.application?.tailoredResume) {
    try {
      const parsed = JSON.parse(job.application.tailoredResume);
      if (parsed && typeof parsed === "object" && parsed.summary) {
        tailoredResume = parsed as TailoredResume;
      }
    } catch {}
  }

  if (job.application?.questionAnswers) {
    try {
      const parsed = JSON.parse(job.application.questionAnswers);
      if (Array.isArray(parsed)) {
        questionAnswers = parsed as ApplicationAnswer[];
      }
    } catch {}
  }

  return {
    job,
    application: job.application,
    tailoredResume,
    questionAnswers,
  };
}
