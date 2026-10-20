import {
  generateStructuredWithFallback,
  buildCandidateFactSheet,
  type CandidateContext,
  type JobContext,
  type AIRouterOptions,
} from "../ai/router";
import {
  TailoredResumeSchema,
  type TailoredResume,
} from "../../types/tailoring";

export async function tailorResume(
  candidate: CandidateContext,
  job: JobContext,
  options?: AIRouterOptions
): Promise<TailoredResume> {
  const system = `You are an expert career strategist and technical resume tailoring assistant for Vanguard.
Your task is to tailor a candidate's resume and highlight their most relevant qualifications for a specific target job posting.

CRITICAL ANTI-HALLUCINATION INVARIANTS:
1. Ground all generated content STRICTLY and EXCLUSIVELY in the provided candidate facts (skills, projects, experiences, resume text).
2. NEVER invent, fabricate, extrapolate, or assume skills, technologies, companies, dates, or metrics not present in the candidate facts.
3. For 'selectedProjects', select ONLY projects that exist in the candidate's projects record. Use their exact existing 'id' and 'title'. Provide a clear 'relevanceRationale' explaining why each project was chosen for this role, and formulate factual 'bulletPoints' reflecting the candidate's actual contributions and technologies.
4. For 'matchingSkills', include ONLY skills that appear both in the candidate's profile and are relevant to the target job. Do NOT invent new skills.
5. For 'experienceHighlights', summarize the candidate's actual work experience aligned to the job, retaining true company names, roles, and verified accomplishments.
6. For 'markdownContent', generate a complete, professional, clean Markdown resume containing:
   - Header (Candidate Name / Role)
   - Professional Summary
   - Core Skills (grouped or listed)
   - Relevant Work Experience
   - Selected Key Projects
   - Education / Certifications (if present in facts)`;

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

Generate a tailored resume adhering strictly to the schema and anti-hallucination invariants.`;

  return generateStructuredWithFallback({
    schema: TailoredResumeSchema,
    system,
    prompt,
    options: {
      workload: "RESUME_TAILORING",
      ...options,
    },
  });
}
