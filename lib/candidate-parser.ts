import {
  CandidateProfileSchema,
  type CandidateProfile,
  type MasterExperience,
  type MasterProject,
  type MasterSkill,
  type MasterSkillCategory,
  type RemoteStatus,
} from "../types/candidate";

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
    ["git", "github", "linux", "webpack", "vite", "figma", "jest", "playwright"].some(
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
      targetRole: "Software Engineer",
      minSalary: 0,
      yearsOfExperience: 0,
      remotePreference: "ANY",
      preferredLocations: ["Remote", "Bengaluru", "India"],
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
          // clean (ES6+) or (App Router) or (PostgreSQL)
          const baseName = item.replace(/\s*\([^)]*\)/g, "").trim();
          if (baseName && !rawSkills.includes(baseName)) {
            rawSkills.push(baseName);
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
          location: remoteStatus === "REMOTE" ? "Remote" : "Bengaluru, India",
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
              if (bullet.includes("fps") || bullet.includes("%") || bullet.includes("reduced") || bullet.includes("optimized")) {
                metrics.push(bullet);
              }
            }
          }
        }

        projects.push({
          id: `proj-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          title,
          company: "Personal",
          role: "Lead Engineer",
          startDate,
          endDate,
          technologies: techList,
          highlights,
          metrics,
          description: highlights[0] || `${title} application`,
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

  if (!skills.some((s) => s.name.toLowerCase().includes("full-stack"))) {
    skills.push({ name: "Full-Stack Web Development", category: "DOMAIN", yearsOfExperience: calculatedYoE });
  }
  if (!skills.some((s) => s.name.toLowerCase().includes("ai"))) {
    skills.push({ name: "AI Agents / LLMs", category: "DOMAIN", yearsOfExperience: 1 });
  }

  return CandidateProfileSchema.parse({
    id: candidateId,
    name,
    targetRole: "Full Stack Engineer",
    minSalary: 0,
    yearsOfExperience: calculatedYoE,
    remotePreference: "ANY",
    preferredLocations: ["Remote", "Bengaluru", "India"],
    skills,
    projects,
    experiences,
    resumeText: markdown,
  });
}
