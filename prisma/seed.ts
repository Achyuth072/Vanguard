import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import {
  serializeCandidateProfile,
  type CandidateProfile,
} from "../types/candidate";

function loadResumeMarkdown(): string {
  const primaryPath = path.join(process.cwd(), ".scratch", "Resume", "Achyuth.md");
  if (fs.existsSync(primaryPath)) {
    return fs.readFileSync(primaryPath, "utf-8");
  }
  const resumeDir = path.join(process.cwd(), ".scratch", "Resume");
  if (fs.existsSync(resumeDir)) {
    const mdFiles = fs.readdirSync(resumeDir).filter((f) => f.endsWith(".md"));
    if (mdFiles.length > 0) {
      return fs.readFileSync(path.join(resumeDir, mdFiles[0]), "utf-8");
    }
  }
  return "";
}

export async function seed() {
  const defaultCandidateId = "candidate-default";

  const resumeMarkdown = loadResumeMarkdown();

  const profileData: CandidateProfile = {
    id: defaultCandidateId,
    name: "Achyuth S",
    targetRole: "Full Stack Engineer",
    minSalary: 0,
    yearsOfExperience: 2,
    remotePreference: "ANY",
    preferredLocations: ["Remote", "Bengaluru", "India"],
    skills: [
      { name: "JavaScript", category: "LANGUAGE", yearsOfExperience: 2 },
      { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 2 },
      { name: "Python", category: "LANGUAGE", yearsOfExperience: 1 },
      { name: "Java", category: "LANGUAGE", yearsOfExperience: 1 },
      { name: "SQL", category: "LANGUAGE", yearsOfExperience: 2 },
      { name: "React.js", category: "FRAMEWORK", yearsOfExperience: 2 },
      { name: "Next.js", category: "FRAMEWORK", yearsOfExperience: 2 },
      { name: "Node.js", category: "FRAMEWORK", yearsOfExperience: 2 },
      { name: "Tailwind CSS", category: "FRAMEWORK", yearsOfExperience: 2 },
      { name: "Spring Boot", category: "FRAMEWORK", yearsOfExperience: 1 },
      { name: "PostgreSQL", category: "DATABASE", yearsOfExperience: 2 },
      { name: "Prisma", category: "DATABASE", yearsOfExperience: 1 },
      { name: "Supabase", category: "DATABASE", yearsOfExperience: 1 },
      { name: "IndexedDB", category: "DATABASE", yearsOfExperience: 1 },
      { name: "MS SQL", category: "DATABASE", yearsOfExperience: 1 },
      { name: "Full-Stack Web Development", category: "DOMAIN", yearsOfExperience: 2 },
      { name: "AI Agents / LLMs", category: "DOMAIN", yearsOfExperience: 1 },
      { name: "PWA / Offline-First", category: "DOMAIN", yearsOfExperience: 1 },
    ],
    projects: [
      {
        id: "proj-kagelin",
        title: "Kagelin",
        company: "Personal",
        role: "Lead Engineer",
        startDate: "2026-02",
        endDate: null,
        technologies: [
          "Next.js 16",
          "React 19",
          "Supabase",
          "IndexedDB",
          "PWA",
          "Zustand",
          "Tailwind CSS v4",
          "Framer Motion",
          "WebDAV",
        ],
        highlights: [
          "Built an offline-first productivity PWA (tasks, habits, focus timer, calendar) with a tri-layer architecture (Service Workers, IndexedDB, optimistic UI), enabling full functionality without an account or network dependency.",
          "Designed a privacy-first sync engine supporting bidirectional WebDAV/CalDAV sync, Google Calendar and Outlook integration, encrypted .zip backups, and universal .ics export/import.",
          "Optimized rendering performance to 60fps by isolating high-frequency state via Zustand and reducing view logic complexity from O(N * M) to O(N).",
          "Developed a high-density, keyboard-driven UI (Cmd+K command palette) with flat-DOM drag-and-drop (@dnd-kit) and a consistent design system using Tailwind CSS v4 and Framer Motion.",
        ],
        metrics: [
          "60fps render performance via isolated Zustand state",
          "100% offline-first functionality without account dependency",
        ],
        description:
          "Offline-first productivity PWA with tri-layer local-first architecture and bidirectional calendar/WebDAV sync.",
      },
      {
        id: "proj-pulse",
        title: "Agentic Career CRM (Pulse)",
        company: "Personal",
        role: "Lead Engineer",
        startDate: "2025-12",
        endDate: null,
        technologies: [
          "Next.js 14",
          "Gemini AI",
          "Prisma",
          "PostgreSQL",
          "Tailwind CSS",
          "TypeScript",
        ],
        highlights: [
          "Built an AI-driven CRM with a RAG pipeline to parse resumes and generate context-aware outreach using the Gemini API, automating the initial recruitment funnel.",
          "Implemented server-side workflows using Next.js Server Actions for background automation and low-latency updates, reducing client-side processing overhead.",
          "Designed relational data models with Prisma and PostgreSQL to manage structured candidate tracking, outreach history, and complex recruitment pipelines.",
          "Developed a responsive, dark-mode-first UI with Tailwind CSS, optimized for high-density information layouts and streamlined productivity workflows.",
        ],
        metrics: [
          "Automated resume parsing & context-aware outreach generation",
          "Low-latency background processing with Next.js Server Actions",
        ],
        description:
          "AI-driven career CRM with RAG pipeline to parse resumes and generate context-aware outreach using Gemini API.",
      },
    ],
    experiences: [
      {
        id: "exp-she-drives",
        company: "She Drives",
        title: "Core Developer",
        location: "Remote",
        remoteStatus: "REMOTE",
        startDate: "2025-05",
        endDate: "2025-11",
        isCurrent: false,
        highlights: [
          "Sole in-house developer, collaborating directly with founders to guide technical direction.",
          "Architected the MVP for a safety-centric female ride-hailing platform, defining schemas and user flows.",
          "Executed rapid development cycles to reduce time-to-market through focused feature prioritization.",
          "Owned deployment and production iteration cycles.",
        ],
      },
      {
        id: "exp-brandanswers-junior",
        company: "BRANDanswers",
        title: "Junior Frontend Engineer",
        location: "Bengaluru, India",
        remoteStatus: "ONSITE",
        startDate: "2023-01",
        endDate: "2023-09",
        isCurrent: false,
        highlights: [
          "Built frontend architecture for the CUET Mentor platform using React.js, improving load times by 20%.",
          "Converted Figma designs into reusable, pixel-perfect components improving user retention.",
        ],
      },
      {
        id: "exp-brandanswers-intern",
        company: "BRANDanswers",
        title: "Full Stack Developer Intern",
        location: "Bengaluru, India",
        remoteStatus: "ONSITE",
        startDate: "2022-04",
        endDate: "2022-09",
        isCurrent: false,
        highlights: [
          "Developed a full-stack inventory system using Next.js and Spring Boot REST APIs.",
          "Designed normalized MS SQL schemas and implemented JWT-based authentication.",
        ],
      },
    ],
    resumeText: resumeMarkdown,
  };

  const serialized = serializeCandidateProfile(profileData);

  const candidate = await db.candidate.upsert({
    where: { id: defaultCandidateId },
    update: serialized,
    create: serialized,
  });

  console.log(
    `Seeded rich candidate profile: ${candidate.name} (${candidate.id}) with ` +
      `${profileData.skills.length} skills, ${profileData.projects.length} projects, and ` +
      `${profileData.experiences.length} experiences.`
  );
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
