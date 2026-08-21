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

export const BANNED_AI_CLICHES = [
  "delve",
  "spearhead",
  "testament to",
  "pivotal role",
  "beacon",
  "tapestry",
  "seamlessly",
  "synergy",
  "foster",
  "holistic",
  "multifaceted",
  "passionate about leveraging",
  "thrilled to apply",
] as const;

export async function generateApplicationAnswers(
  candidate: CandidateContext,
  job: JobContext,
  questions?: string[],
  options?: AIRouterOptions
): Promise<ApplicationAnswer[]> {
  const targetQuestions =
    questions && questions.length > 0 ? questions : [...STANDARD_APPLICATION_QUESTIONS];

  const system = `You are generating job application screening responses in the authentic first-person voice ("I") of the candidate.

VOICE, TONE & STYLE GUIDELINES:
1. PRACTITIONER PERSONA: Write like an experienced, pragmatic practitioner speaking peer-to-peer to a team lead or hiring manager. Sound direct, thoughtful, and grounded—never like marketing copy or an obsequious applicant.
2. BANNED AI CLICHÉS & BUZZWORDS: Do NOT use corporate AI tropes such as "thrilled to apply", "delve", "spearhead", "testament to", "pivotal role", "beacon", "tapestry", "seamlessly", "synergy", "foster", "holistic", "multifaceted", or "passionate about leveraging".
3. NO THROAT-CLEARING: Never open with meta-announcements or introductory fluff (e.g. "As a seasoned engineer...", "Throughout my professional journey...", "In response to your inquiry..."). Jump straight into the concrete experience, project context, or direct answer.
4. RHYTHMIC VARIANCE & BURSTINESS: Vary sentence lengths naturally. Combine crisp, punchy statements with descriptive technical specifics. Avoid rigid uniform sentence lengths and formulaic 3-part bullet structures.
5. CONTEXT-WEAVING: Connect candidate facts to real-world engineering constraints, trade-offs, and outcomes rather than reciting an isolated checklist of tools.
6. CONCISE PROPORTIONALITY: Match response length to the question type. Answer logistical questions (salary, notice period, authorization) directly in 1-2 factual sentences; use focused technical narratives for project and fit questions.

CRITICAL ANTI-HALLUCINATION INVARIANTS:
1. Ground all answers STRICTLY and EXCLUSIVELY in the provided candidate facts (skills, projects, experiences, metrics, resume text).
2. NEVER invent, fabricate, extrapolate, or assume skills, technologies, companies, dates, metrics, or personal circumstances not present in the candidate facts.
3. If a question asks about details not present in the candidate profile (such as exact notice period or visa details if unstated), state the known preferences honestly or frame neutrally without fabricating credentials or commitments.
4. In 'keyPointsUsed', list the specific verified candidate facts, project names, or metrics directly cited in the answer.
5. Provide a unique string 'id' (e.g. slug or uuid) and valid ISO timestamp 'createdAt' for each answer.`;

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

Generate grounded, authentic application answers adhering strictly to the schema, voice guidelines, and anti-hallucination invariants.`;

  const result = await generateStructuredWithFallback({
    schema: ApplicationAnswersBatchSchema,
    system,
    prompt,
    options: {
      workload: "SCREENING_QA",
      ...options,
    },
  });

  return result.answers;
}

export async function answerCustomQuestion(
  candidate: CandidateContext,
  job: JobContext,
  question: string,
  options?: AIRouterOptions
): Promise<ApplicationAnswer> {
  const system = `You are generating a job application screening response in the authentic first-person voice ("I") of the candidate.

VOICE, TONE & STYLE GUIDELINES:
1. PRACTITIONER PERSONA: Write like an experienced, pragmatic practitioner speaking peer-to-peer to a team lead or hiring manager. Sound direct, thoughtful, and grounded—never like marketing copy or an obsequious applicant.
2. BANNED AI CLICHÉS & BUZZWORDS: Do NOT use corporate AI tropes such as "thrilled to apply", "delve", "spearhead", "testament to", "pivotal role", "beacon", "tapestry", "seamlessly", "synergy", "foster", "holistic", "multifaceted", or "passionate about leveraging".
3. NO THROAT-CLEARING: Never open with meta-announcements or introductory fluff (e.g. "As a seasoned engineer...", "Throughout my professional journey..."). Jump straight into the substance.
4. RHYTHMIC VARIANCE & BURSTINESS: Vary sentence lengths naturally. Combine crisp, punchy statements with descriptive technical specifics.
5. CONTEXT-WEAVING: Connect candidate facts to real-world problem constraints, trade-offs, and outcomes rather than reciting an isolated checklist of tools.

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

Generate a grounded, authentic answer adhering strictly to the schema, voice guidelines, and anti-hallucination invariants.`;

  return generateStructuredWithFallback({
    schema: ApplicationAnswerSchema,
    system,
    prompt,
    options: {
      workload: "SCREENING_QA",
      ...options,
    },
  });
}
