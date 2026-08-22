import { z } from "zod";
import {
  CandidateProfileSchema,
  MasterSkillSchema,
  MasterProjectSchema,
  MasterExperienceSchema,
  type CandidateProfile,
  type MasterExperience,
  type MasterProject,
  type MasterSkill,
  type MasterSkillCategory,
  type RemoteStatus,
} from "../types/candidate";
import {
  generateStructuredWithFallback,
  type AIRouterOptions,
} from "./ai/router";

export const CandidateResumeExtractionSchema = z.object({
  name: z.string().default("Default Candidate"),
  location: z.string().default(""),
  targetRole: z.string().default("Software Engineer"),
  minSalary: z.number().int().nonnegative().default(0),
  currency: z.string().default("INR"),
  yearsOfExperience: z.number().int().nonnegative().default(0),
  remotePreference: z.enum(["ANY", "REMOTE_ONLY", "HYBRID", "ONSITE"]).default("ANY"),
  preferredLocations: z.array(z.string()).default([]),
  skills: z.array(MasterSkillSchema).default([]),
  projects: z.array(MasterProjectSchema).default([]),
  experiences: z.array(MasterExperienceSchema).default([]),
  targetRoleKeywords: z.array(z.string()).default([]),
  techStack: z.array(z.string()).default([]),
  companyStageBlacklist: z.array(z.string()).default([]),
});

export type CandidateResumeExtraction = z.infer<typeof CandidateResumeExtractionSchema>;


const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function parseDateStringToIsoMonth(dateStr: string): string | null {
  const cleaned = dateStr.trim().toLowerCase();
  if (!cleaned || cleaned === "present" || cleaned === "current") return null;

  const match = cleaned.match(/([a-z]+)\s+(\d{4})/);
  if (match) {
    const month = MONTH_MAP[match[1]] || "01";
    return `${match[2]}-${month}`;
  }

  const yearMatch = cleaned.match(/(\d{4})/);
  if (yearMatch) {
    return `${yearMatch[1]}-01`;
  }

  return null;
}

function categorizeSkill(skillName: string): MasterSkillCategory {
  const lower = skillName.toLowerCase();

  if (
    [
      "react",
      "next.js",
      "nextjs",
      "node.js",
      "nodejs",
      "express",
      "tailwind",
      "spring",
      "vue",
      "angular",
      "svelte",
      "django",
      "flask",
      "fastapi",
      "framer motion",
      "zustand",
      "tanstack",
      "remix",
    ].some((k) => lower.includes(k))
  ) {
    return "FRAMEWORK";
  }

  if (
    [
      "postgres",
      "mysql",
      "sqlite",
      "mongo",
      "redis",
      "prisma",
      "supabase",
      "indexeddb",
      "ms sql",
      "mssql",
      "cassandra",
      "dynamodb",
      "sql server",
    ].some((k) => lower.includes(k))
  ) {
    return "DATABASE";
  }

  if (
    [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "golang",
      "rust",
      "c++",
      "c#",
      "ruby",
      "php",
      "swift",
      "kotlin",
      "sql",
      "html",
    ].some((k) => lower.includes(k)) || /\bcss\b/.test(lower)
  ) {
    return "LANGUAGE";
  }

  if (
    ["aws", "gcp", "azure", "docker", "kubernetes", "vercel", "cloudflare"].some(
      (k) => lower.includes(k)
    )
  ) {
    return "CLOUD";
  }

  if (
    ["git", "github", "linux", "webpack", "vite", "figma", "jest", "playwright", "gemini", "openai", "dnd-kit"].some(
      (k) => lower.includes(k)
    )
  ) {
    return "TOOL";
  }

  return "DOMAIN";
}

function calculateTenureMonths(startDateStr?: string | null, endDateStr?: string | null, isCurrent?: boolean): number {
  if (!startDateStr) return 0;
  const [startYear, startMonth] = startDateStr.split("-").map(Number);
  let endYear: number;
  let endMonth: number;

  if (isCurrent || !endDateStr) {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  } else {
    const [y, m] = endDateStr.split("-").map(Number);
    endYear = y;
    endMonth = m;
  }

  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return Math.max(1, months);
}

export function parseResumeMarkdownToProfile(
  markdown: string,
  candidateId: string = "candidate-default"
): CandidateProfile {
  if (!markdown || !markdown.trim()) {
    return CandidateProfileSchema.parse({
      id: candidateId,
      name: "Default Candidate",
      location: "",
      targetRole: "Software Engineer",
      minSalary: 0,
      yearsOfExperience: 0,
      remotePreference: "ANY",
      preferredLocations: ["Remote"],
      skills: [],
      projects: [],
      experiences: [],
      resumeText: "",
    });
  }

  // 1. Extract Name
  const nameMatch = markdown.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "Default Candidate";

  // 2. Extract Sections
  const sections = markdown.split(/\n##\s+/);
  const rawSkills: string[] = [];
  const experiences: MasterExperience[] = [];
  const projects: MasterProject[] = [];

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const header = lines[0].toLowerCase();

    if (header.includes("technical skill") || header.includes("skills")) {
      for (const line of lines.slice(1)) {
        // e.g. **Languages & Frameworks:** JavaScript (ES6+), TypeScript...
        const colonIdx = line.indexOf(":");
        const content = colonIdx !== -1 ? line.slice(colonIdx + 1) : line;
        const cleaned = content.replace(/\*\*/g, "");
        const items = cleaned.split(/[,|•]/).map((s) => s.trim()).filter(Boolean);
        for (const item of items) {
          // Check for parenthesized tech like (PostgreSQL)
          const parenMatch = item.match(/\(([^)]+)\)/);
          const baseName = item.replace(/\s*\([^)]*\)/g, "").trim();
          if (baseName && !rawSkills.some((s) => s.toLowerCase() === baseName.toLowerCase())) {
            rawSkills.push(baseName);
          }
          if (parenMatch && parenMatch[1]) {
            const parenTech = parenMatch[1].trim();
            // If the paren content is a recognized tech or not just versioning/options
            if (
              !parenTech.toLowerCase().startsWith("es") &&
              !parenTech.toLowerCase().includes("router") &&
              !rawSkills.some((s) => s.toLowerCase() === parenTech.toLowerCase())
            ) {
              rawSkills.push(parenTech);
            }
          }
        }
      }
    } else if (header.includes("experience")) {
      const expBlocks = section.split(/\n###\s+/).slice(1);
      for (let i = 0; i < expBlocks.length; i++) {
        const blockLines = expBlocks[i].split("\n").map((l) => l.trim()).filter(Boolean);
        if (blockLines.length === 0) continue;

        // Title and Company from "### Title — Company" or "### Title - Company"
        const titleCompanyLine = blockLines[0];
        const parts = titleCompanyLine.split(/—|-/).map((p) => p.trim());
        const title = parts[0] || "Software Engineer";
        const company = parts[1] || "Company";

        // Date range from "*May 2025 -- Nov 2025*" or similar
        let startDate: string | null = null;
        let endDate: string | null = null;
        let isCurrent = false;
        const highlights: string[] = [];

        for (const line of blockLines.slice(1)) {
          const dateMatch = line.match(/\*([^*]+)\*/);
          if (dateMatch && !startDate) {
            const dateParts = dateMatch[1].split(/--|–|-|to/).map((p) => p.trim());
            if (dateParts[0]) startDate = parseDateStringToIsoMonth(dateParts[0]);
            if (dateParts[1]) {
              if (dateParts[1].toLowerCase().includes("present") || dateParts[1].toLowerCase().includes("current")) {
                isCurrent = true;
                endDate = null;
              } else {
                endDate = parseDateStringToIsoMonth(dateParts[1]);
              }
            }
          } else if (line.startsWith("-") || line.startsWith("*")) {
            const bullet = line.replace(/^[-*]\s+/, "").trim();
            if (bullet) highlights.push(bullet);
          }
        }

        const remoteStatus: RemoteStatus = title.toLowerCase().includes("remote") || highlights.some((h) => h.toLowerCase().includes("remote"))
          ? "REMOTE"
          : "UNKNOWN";

        experiences.push({
          id: `exp-${company.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${i + 1}`,
          company,
          title,
          location: remoteStatus === "REMOTE" ? "Remote" : "",
          remoteStatus,
          startDate,
          endDate,
          isCurrent,
          highlights,
        });
      }
    } else if (header.includes("project")) {
      const projBlocks = section.split(/\n###\s+/).slice(1);
      for (let i = 0; i < projBlocks.length; i++) {
        const blockLines = projBlocks[i].split("\n").map((l) => l.trim()).filter(Boolean);
        if (blockLines.length === 0) continue;

        const headerLine = blockLines[0];
        const parts = headerLine.split(/—|-/).map((p) => p.trim());
        const title = parts[0] || "Project";
        const techList = parts[1] ? parts[1].split(",").map((t) => t.trim()).filter(Boolean) : [];

        let startDate: string | null = null;
        let endDate: string | null = null;
        const highlights: string[] = [];
        const metrics: string[] = [];

        for (const line of blockLines.slice(1)) {
          const dateMatch = line.match(/\*([^*]+)\*/);
          if (dateMatch && !startDate) {
            const dateParts = dateMatch[1].split(/--|–|-|to/).map((p) => p.trim());
            if (dateParts[0]) startDate = parseDateStringToIsoMonth(dateParts[0]);
            if (dateParts[1]) {
              if (dateParts[1].toLowerCase().includes("present")) {
                endDate = null;
              } else {
                endDate = parseDateStringToIsoMonth(dateParts[1]);
              }
            }
          } else if (line.startsWith("-") || line.startsWith("*")) {
            const bullet = line.replace(/^[-*]\s+/, "").trim();
            if (bullet) {
              highlights.push(bullet);
              if (bullet.includes("fps") || bullet.includes("%") || bullet.includes("reduced") || bullet.includes("optimized") || bullet.includes("O(N")) {
                metrics.push(bullet);
              }
            }
          }
        }

        projects.push({
          id: `proj-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${i + 1}`,
          title,
          company: "Independent",
          role: "Developer",
          startDate,
          endDate,
          technologies: techList,
          highlights,
          metrics,
          description: highlights[0] || `${title} implementation.`,
        });

        // Also add unique project technologies to rawSkills
        for (const tech of techList) {
          const baseName = tech.replace(/\s*\d+(\.\d+)?/g, "").replace(/\s*v\d+/g, "").trim();
          if (baseName && !rawSkills.some((s) => s.toLowerCase() === baseName.toLowerCase())) {
            rawSkills.push(baseName);
          }
        }
      }
    }
  }

  // Calculate total YoE from experiences
  let totalMonths = 0;
  for (const exp of experiences) {
    totalMonths += calculateTenureMonths(exp.startDate, exp.endDate, exp.isCurrent);
  }
  const calculatedYoE = Math.max(1, Math.round(totalMonths / 12));

  // Build MasterSkill list
  const skills: MasterSkill[] = rawSkills.map((name) => {
    const category = categorizeSkill(name);
    const isPrimary = ["javascript", "typescript", "react", "next.js", "node.js", "tailwind", "sql", "postgresql"].some(
      (k) => name.toLowerCase().includes(k)
    );
    return {
      name,
      category,
      yearsOfExperience: isPrimary ? calculatedYoE : 1,
    };
  });

  const targetRole = experiences.length > 0 && experiences[0].title
    ? experiences[0].title
    : "Software Engineer";

  return CandidateProfileSchema.parse({
    id: candidateId,
    name,
    location: "",
    targetRole,
    minSalary: 0,
    yearsOfExperience: calculatedYoE,
    remotePreference: "ANY",
    preferredLocations: ["Remote"],
    skills,
    projects,
    experiences,
    resumeText: markdown,
    targetRoleKeywords: [targetRole.toLowerCase()],
    techStack: skills.map((s) => s.name),
    companyStageBlacklist: ["consulting", "staffing", "agency"],
  });
}

/**
 * Parses markdown resume text into a structured CandidateProfile using AI
 * with multi-model fallback (Google Gemini -> Groq -> OpenRouter).
 * Falls back to deterministic regex parser if all AI models fail.
 */
export async function parseResumeMarkdownWithAI(
  markdown: string,
  candidateId: string = "candidate-default",
  options?: AIRouterOptions
): Promise<CandidateProfile> {
  if (!markdown || !markdown.trim()) {
    return parseResumeMarkdownToProfile("", candidateId);
  }

  const system = `You are an expert technical resume parser and candidate profile extractor for Pulse.
Extract structured candidate facts from the provided markdown resume.
CRITICAL INVARIANTS:
1. Ground all extractions strictly in the provided resume text. Never hallucinate skills, metrics, experiences, or project scopes not present in the markdown.
2. Extract the candidate's full name. Derive an appropriate target role from their latest title or background (e.g. "Full Stack Engineer", "Senior Frontend Engineer").
3. For Work Experience:
   - Identify company name, job title, location, remote status ("REMOTE", "HYBRID", "ONSITE", "UNKNOWN"), start date (YYYY-MM), end date (YYYY-MM or null), whether it is current position (isCurrent: true/false), and detailed bullet point highlights.
   - Assign deterministic IDs e.g. "exp-company-1".
4. For Master Projects:
   - Identify project title, company/context (or "Personal" / "Independent"), role (e.g. "Lead Engineer"), dates (YYYY-MM), technology stack array, detailed bullet highlights, quantifiable metrics (e.g. "reduced latency by 65%", "60fps"), and a concise description.
   - Assign deterministic IDs e.g. "proj-title".
5. For Skills Repository:
   - Categorize each skill into: "LANGUAGE", "FRAMEWORK", "DATABASE", "CLOUD", "TOOL", or "DOMAIN".
   - Assign estimated years of experience based on candidate tenure and usage across roles.
6. Calculate total professional years of experience accurately based on employment timeline.
7. Extract candidate's current residence/location if indicated (or leave empty if not specified). Extract preferred locations or remote preference if indicated (defaulting to ["Remote"] and "ANY" if flexible).`;

  const prompt = `RESUME MARKDOWN:
${markdown}

Extract all candidate profile master facts according to the schema.`;

  try {
    const extracted = await generateStructuredWithFallback({
      schema: CandidateResumeExtractionSchema,
      system,
      prompt,
      options: {
        workload: "RESUME_PARSING",
        ...options,
      },
    });

    const projects: MasterProject[] = (extracted.projects || []).map((p, idx) => ({
      ...p,
      id: p.id && p.id.trim().length > 0 ? p.id : `proj-${p.title.toLowerCase().replace(/[^a-z0-9]/g, "-") || idx + 1}`,
      company: p.company || "",
      role: p.role || "",
      startDate: p.startDate || null,
      endDate: p.endDate || null,
      technologies: Array.isArray(p.technologies) ? p.technologies : [],
      highlights: Array.isArray(p.highlights) ? p.highlights : [],
      metrics: Array.isArray(p.metrics) ? p.metrics : [],
      description: p.description || (p.highlights && p.highlights[0]) || `${p.title} project`,
    }));

    const experiences: MasterExperience[] = (extracted.experiences || []).map((e, idx) => ({
      ...e,
      id: e.id && e.id.trim().length > 0 ? e.id : `exp-${e.company.toLowerCase().replace(/[^a-z0-9]/g, "-") || idx + 1}-${idx + 1}`,
      company: e.company || "Company",
      title: e.title || "Software Engineer",
      location: e.location || "",
      remoteStatus: e.remoteStatus || "UNKNOWN",
      startDate: e.startDate || null,
      endDate: e.endDate || null,
      isCurrent: Boolean(e.isCurrent),
      highlights: Array.isArray(e.highlights) ? e.highlights : [],
    }));

    const skills: MasterSkill[] = (extracted.skills || []).map((s) => ({
      name: s.name,
      category: s.category || categorizeSkill(s.name),
      yearsOfExperience: s.yearsOfExperience !== undefined ? s.yearsOfExperience : null,
    }));

    const preferredLocations =
      extracted.preferredLocations && extracted.preferredLocations.length > 0
        ? extracted.preferredLocations
        : ["Remote"];

    const targetRole = extracted.targetRole || "Software Engineer";
    const targetRoleKeywords =
      extracted.targetRoleKeywords && extracted.targetRoleKeywords.length > 0
        ? extracted.targetRoleKeywords
        : [targetRole.toLowerCase()];

    const techStack =
      extracted.techStack && extracted.techStack.length > 0
        ? extracted.techStack
        : skills.map((s) => s.name);

    const companyStageBlacklist =
      extracted.companyStageBlacklist && extracted.companyStageBlacklist.length > 0
        ? extracted.companyStageBlacklist
        : ["consulting", "staffing", "agency"];

    return CandidateProfileSchema.parse({
      id: candidateId,
      name: extracted.name || "Default Candidate",
      location: extracted.location || "",
      targetRole,
      minSalary: extracted.minSalary || 0,
      currency: extracted.currency || "INR",
      yearsOfExperience: extracted.yearsOfExperience || 0,
      remotePreference: extracted.remotePreference || "ANY",
      preferredLocations,
      skills,
      projects,
      experiences,
      resumeText: markdown,
      targetRoleKeywords,
      techStack,
      companyStageBlacklist,
    });
  } catch (err) {
    console.warn("AI resume parsing encountered error or fallback, invoking deterministic parser:", err);
    return parseResumeMarkdownToProfile(markdown, candidateId);
  }
}
