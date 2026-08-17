"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function saveResumeContext(formData: FormData) {
  const text = formData.get("resumeText") as string;

  if (!text) {
    throw new Error("No text provided");
  }

  // Save the raw text directly to the DB Candidate profile
  await db.candidate.upsert({
    where: { id: "candidate-default" },
    update: { resumeText: text },
    create: {
      id: "candidate-default",
      resumeText: text,
      name: "Default Candidate",
    },
  });

  revalidatePath("/");
  return { success: true };
}

