import {
  generateStructuredWithFallback,
  buildCandidateFactSheet,
  type CandidateContext,
  type JobContext,
  type AIRouterOptions,
} from "../ai/router";
import {
  ApplicationAnswerSchema,
  ApplicationAnswersBatchSchema,
  type ApplicationAnswer,
} from "../../types/tailoring";

export const STANDARD_APPLICATION_QUESTIONS = [
  "Why are you interested in this role and company?",
  "What relevant project or technical challenge best demonstrates your fit for this role?",
  "What are your salary expectations, notice period, and work authorization status?",
] as const;

export async function generateApplicationAnswers(
  candidate: CandidateContext,
  job: JobContext,
  questions?: string[],
  options?: AIRouterOptions
): Promise<ApplicationAnswer[]> {
  const targetQuestions =
    questions && questions.length > 0 ? questions : [...STANDARD_APPLICATION_QUESTIONS];

  const system = `You are an expert career advisor and technical application answering assistant for Pulse.
Your task is to generate high-signal, compelling, fact-grounded responses to job application screening questions for a specific target job.

CRITICAL ANTI-HALLUCINATION INVARIANTS:
1. Ground all answers STRICTLY and EXCLUSIVELY in the provided candidate facts (skills, projects, experiences, metrics, resume text).
2. NEVER invent, fabricate, extrapolate, or assume skills, technologies, companies, dates, metrics, or personal circumstances not present in the candidate facts.
3. If a question asks about details not present in the candidate profile (such as exact notice period or visa details if unstated), state the known preferences honestly or frame professionally without making up false credentials or commitments.
4. For each question, formulate a thorough, professional, and targeted answer.
5. In 'keyPointsUsed', list the specific verified candidate facts, project names, or metrics directly cited in the answer.
6. Provide a unique string 'id' (e.g. slug or uuid) and valid ISO timestamp 'createdAt' for each answer.`;

  const prompt = `CANDIDATE FACTS:
${buildCandidateFactSheet(candidate)}

TARGET JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Remote Status: ${job.remoteStatus || "UNKNOWN"}
Employment Type: ${job.employmentType || "FULL_TIME"}
Description:
${job.description}

QUESTIONS TO ANSWER:
${targetQuestions.map((q, idx) => `${idx + 1}. ${q}`).join("\n")}

Generate grounded application answers adhering strictly to the schema and anti-hallucination invariants.`;

  const result = await generateStructuredWithFallback({
    schema: ApplicationAnswersBatchSchema,
    system,
    prompt,
    options,
  });

  return result.answers;
}

export async function answerCustomQuestion(
  candidate: CandidateContext,
  job: JobContext,
  question: string,
  options?: AIRouterOptions
): Promise<ApplicationAnswer> {
  const system = `You are an expert career advisor and technical application answering assistant for Pulse.
Your task is to answer a single job application screening or portal question grounded strictly in candidate facts.

CRITICAL ANTI-HALLUCINATION INVARIANTS:
1. Ground all answers STRICTLY and EXCLUSIVELY in the provided candidate facts (skills, projects, experiences, metrics, resume text).
2. NEVER invent, fabricate, extrapolate, or assume skills, technologies, companies, dates, metrics, or credentials not present in candidate facts.
3. In 'keyPointsUsed', list the specific verified candidate facts, project names, or metrics directly cited in the answer.
4. Provide a unique string 'id' and valid ISO timestamp 'createdAt'.`;

  const prompt = `CANDIDATE FACTS:
${buildCandidateFactSheet(candidate)}

TARGET JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Remote Status: ${job.remoteStatus || "UNKNOWN"}
Description:
${job.description}

QUESTION:
${question}

Generate a grounded answer adhering strictly to the schema and anti-hallucination invariants.`;

  return generateStructuredWithFallback({
    schema: ApplicationAnswerSchema,
    system,
    prompt,
    options,
  });
}
