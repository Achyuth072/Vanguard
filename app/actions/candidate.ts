"use server";

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
