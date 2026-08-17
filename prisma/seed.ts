import { db } from "../lib/db";
import {
  serializeCandidateProfile,
  type CandidateProfile,
} from "../types/candidate";

export async function seed() {
  const defaultCandidateId = "candidate-default";

  const profileData: CandidateProfile = {
    id: defaultCandidateId,
    name: "Default Candidate",
    targetRole: "Software Engineer",
    minSalary: 0,
    yearsOfExperience: 4,
    remotePreference: "ANY",
    preferredLocations: ["Remote", "Bengaluru", "San Francisco"],
    skills: [
      { name: "TypeScript", category: "LANGUAGE", yearsOfExperience: 4 },
      { name: "JavaScript", category: "LANGUAGE", yearsOfExperience: 5 },
      { name: "Python", category: "LANGUAGE", yearsOfExperience: 3 },
      { name: "SQL", category: "LANGUAGE", yearsOfExperience: 3 },
      { name: "React", category: "FRAMEWORK", yearsOfExperience: 4 },
      { name: "Next.js", category: "FRAMEWORK", yearsOfExperience: 3 },
      { name: "Node.js", category: "FRAMEWORK", yearsOfExperience: 4 },
      { name: "TailwindCSS", category: "FRAMEWORK", yearsOfExperience: 2 },
      { name: "PostgreSQL", category: "DATABASE", yearsOfExperience: 3 },
      { name: "SQLite", category: "DATABASE", yearsOfExperience: 3 },
      { name: "Prisma", category: "DATABASE", yearsOfExperience: 2 },
      { name: "AWS", category: "CLOUD", yearsOfExperience: 2 },
      { name: "Docker", category: "CLOUD", yearsOfExperience: 2 },
      { name: "Git", category: "TOOL", yearsOfExperience: 5 },
      { name: "AI Agents / LLMs", category: "DOMAIN", yearsOfExperience: 2 },
      { name: "Full-Stack Web Development", category: "DOMAIN", yearsOfExperience: 4 },
    ],
    projects: [
      {
        id: "proj-pulse",
        title: "Pulse Career Copilot",
        company: "Personal",
        role: "Lead Developer",
        startDate: "2024-01",
        endDate: null,
        technologies: ["TypeScript", "Next.js", "Prisma", "SQLite", "Vercel AI SDK"],
        highlights: [
          "Built deterministic filter engine with millisecond throughput",
          "Implemented provider-agnostic LLM router with zero operating cost fallback",
          "Designed local SQLite storage with automated export/import backup",
        ],
        metrics: [
          "Processed 500+ jobs with zero data loss",
          "Reduced job screening time by 85%",
        ],
        description:
          "Local-first AI career companion for discovering, scoring, and tracking relevant software engineering roles.",
      },
      {
        id: "proj-telemetry",
        title: "Realtime Telemetry Dashboard",
        company: "TechCorp",
        role: "Senior Fullstack Engineer",
        startDate: "2022-06",
        endDate: "2023-12",
        technologies: ["React", "TypeScript", "Node.js", "PostgreSQL", "TailwindCSS"],
        highlights: [
          "Architected streaming data visualization pipeline for high-volume telemetry",
          "Optimized PostgreSQL query latency by 40% via indexing and connection pooling",
        ],
        metrics: [
          "Handled 10M+ daily events with 99.99% uptime",
          "Improved frontend render performance by 60%",
        ],
        description:
          "High-throughput real-time enterprise telemetry dashboard and analytics service.",
      },
    ],
    experiences: [
      {
        id: "exp-techcorp",
        company: "TechCorp",
        title: "Senior Fullstack Engineer",
        location: "Bengaluru, India",
        remoteStatus: "HYBRID",
        startDate: "2022-06",
        endDate: "2024-01",
        isCurrent: false,
        highlights: [
          "Led a squad of 4 engineers building enterprise cloud dashboards",
          "Architected TypeScript backend services and Next.js applications",
          "Instituted automated end-to-end testing and CI/CD pipelines",
        ],
      },
      {
        id: "exp-innovate",
        company: "Innovate Labs",
        title: "Software Engineer",
        location: "Remote",
        remoteStatus: "REMOTE",
        startDate: "2020-08",
        endDate: "2022-05",
        isCurrent: false,
        highlights: [
          "Built scalable full-stack web applications in React and Node.js",
          "Integrated third-party APIs and webhook notification infrastructure",
          "Authored internal developer tooling for database migrations",
        ],
      },
    ],
    resumeText:
      "Full-stack Software Engineer with 4+ years of experience building modern web applications, scalable backend APIs, and AI workflows using TypeScript, Next.js, Node.js, React, and PostgreSQL/SQLite.",
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
