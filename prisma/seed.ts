import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import {
  serializeCandidateProfile,
  type CandidateProfile,
} from "../types/candidate";

import { parseResumeMarkdownToProfile } from "../lib/candidate-parser";
import { seedDefaultFeedSources } from "../lib/feed-sources";

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
  const profileData: CandidateProfile = parseResumeMarkdownToProfile(
    resumeMarkdown,
    defaultCandidateId
  );

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

  const seededSources = await seedDefaultFeedSources(db);
  console.log(`Seeded ${seededSources.length} baseline feed sources into database.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
