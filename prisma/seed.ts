import { db } from "../lib/db";

export async function seed() {
  const defaultCandidateId = "candidate-default";

  const candidate = await db.candidate.upsert({
    where: { id: defaultCandidateId },
    update: {},
    create: {
      id: defaultCandidateId,
      name: "Default Candidate",
      targetRole: "Software Engineer",
      minSalary: 0,
      yearsOfExperience: 3,
      remotePreference: "ANY",
      preferredLocations: JSON.stringify(["Remote", "Bengaluru", "San Francisco"]),
      skills: JSON.stringify(["TypeScript", "React", "Next.js", "Node.js", "Python", "SQL"]),
      projects: JSON.stringify([]),
      experiences: JSON.stringify([]),
      resumeText: "Experienced Software Engineer with background in full-stack development, modern web applications, and AI workflows.",
    },
  });

  console.log(`Seeded default candidate profile: ${candidate.name} (${candidate.id})`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
