"use server";

import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  CandidateProfileSchema,
  serializeCandidateProfile,
  deserializeCandidateProfile,
  type CandidateProfile,
  type CandidateProfileInput,
  type RawCandidateDbRecord,
} from "@/types/candidate";
import {
  parseResumeMarkdownWithAI,
  parseResumeMarkdownToProfile,
} from "@/lib/candidate-parser";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignored in non-request contexts like node unit tests
  }
}

/**
 * Retrieves the candidate profile with parsed structured collections.
 */
export async function getCandidateProfile(
  candidateId: string = "candidate-default"
): Promise<CandidateProfile> {
  let record = await db.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!record && candidateId === "candidate-default") {
    record = await db.candidate.findFirst();
  }

  if (!record) {
    return CandidateProfileSchema.parse({
      id: candidateId,
      name: "Default Candidate",
      targetRole: "Software Engineer",
      minSalary: 0,
      currency: "INR",
      yearsOfExperience: 0,
      remotePreference: "ANY",
      preferredLocations: [],
      skills: [],
      projects: [],
      experiences: [],
      resumeText: "",
    });
  }

  return deserializeCandidateProfile(record as RawCandidateDbRecord);
}

/**
 * Validates candidate profile input with Zod and updates the SQLite record.
 */
export async function updateCandidateProfile(
  data: CandidateProfileInput
): Promise<{ success: boolean; profile: CandidateProfile }> {
  // Validate and parse incoming data
  const validated = CandidateProfileSchema.parse(data);
  const serialized = serializeCandidateProfile(validated);

  const updatedRecord = await db.candidate.upsert({
    where: { id: validated.id },
    create: serialized,
    update: serialized,
  });

  await db.event.create({
    data: {
      entityType: "Candidate",
      entityId: validated.id,
      eventType: "CANDIDATE_PROFILE_UPDATED",
      payload: JSON.stringify({
        targetRole: validated.targetRole,
        projectsCount: validated.projects.length,
        skillsCount: validated.skills.length,
        experiencesCount: validated.experiences.length,
        updatedAt: new Date().toISOString(),
      }),
    },
  });

  safeRevalidatePath("/");
  safeRevalidatePath("/settings");

  return {
    success: true,
    profile: deserializeCandidateProfile(updatedRecord as RawCandidateDbRecord),
  };
}

/**
 * Parses raw resume markdown into a fully structured CandidateProfile.
 * By default, uses fast deterministic regex parsing (0 API calls).
 * Supports optional AI parsing with model fallback when explicitly requested.
 */
export async function parseCandidateResumeAction(
  markdown: string,
  candidateId: string = "candidate-default",
  mode: "deterministic" | "ai" = "deterministic"
): Promise<{
  success: boolean;
  profile: CandidateProfile;
  method: "deterministic" | "ai";
  error?: string;
}> {
  if (mode === "deterministic") {
    const profile = parseResumeMarkdownToProfile(markdown, candidateId);
    return {
      success: true,
      profile,
      method: "deterministic",
    };
  }

  try {
    const profile = await parseResumeMarkdownWithAI(markdown, candidateId);
    return {
      success: true,
      profile,
      method: "ai",
    };
  } catch (err) {
    const fallback = parseResumeMarkdownToProfile(markdown, candidateId);
    return {
      success: true,
      profile: fallback,
      method: "deterministic",
      error: err instanceof Error ? err.message : "Fallback parser invoked",
    };
  }
}

/**
 * Retrieves the local resume markdown content from .scratch/Resume/ if available.
 */
export async function getLocalResumeMarkdownAction(): Promise<{
  success: boolean;
  markdown: string | null;
  filename?: string;
}> {
  try {
    const resumeDir = path.join(process.cwd(), ".scratch", "Resume");
    if (!fs.existsSync(resumeDir)) {
      return { success: false, markdown: null };
    }

    const primaryPath = path.join(resumeDir, "Achyuth.md");
    if (fs.existsSync(primaryPath)) {
      const content = fs.readFileSync(primaryPath, "utf-8");
      return { success: true, markdown: content, filename: "Achyuth.md" };
    }

    const files = fs.readdirSync(resumeDir).filter((f) => f.endsWith(".md"));
    if (files.length > 0) {
      const content = fs.readFileSync(path.join(resumeDir, files[0]), "utf-8");
      return { success: true, markdown: content, filename: files[0] };
    }

    return { success: false, markdown: null };
  } catch (err) {
    console.error("Failed to read local resume markdown:", err);
    return { success: false, markdown: null };
  }
}

