import { z } from "zod";

export const MasterSkillCategorySchema = z.enum([
  "LANGUAGE",
  "FRAMEWORK",
  "DATABASE",
  "CLOUD",
  "TOOL",
  "DOMAIN",
]);

export type MasterSkillCategory = z.infer<typeof MasterSkillCategorySchema>;

export const MasterSkillSchema = z.object({
  name: z.string().min(1),
  category: MasterSkillCategorySchema,
  yearsOfExperience: z.number().int().nonnegative().optional().nullable(),
});

export type MasterSkill = z.infer<typeof MasterSkillSchema>;

export const MasterProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().optional().default(""),
  role: z.string().optional().default(""),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  description: z.string().default(""),
});

export type MasterProject = z.infer<typeof MasterProjectSchema>;

export const RemoteStatusSchema = z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]);
export type RemoteStatus = z.infer<typeof RemoteStatusSchema>;

export const MasterExperienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional().default(""),
  remoteStatus: RemoteStatusSchema.default("UNKNOWN"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean().default(false),
  highlights: z.array(z.string()).default([]),
});

export type MasterExperience = z.infer<typeof MasterExperienceSchema>;

export const CandidateProfileSchema = z.object({
  id: z.string().default("candidate-default"),
  name: z.string().default("Default Candidate"),
  targetRole: z.string().default("Software Engineer"),
  minSalary: z.number().int().nonnegative().default(0),
  currency: z.string().default("INR"),
  yearsOfExperience: z.number().int().nonnegative().default(0),
  remotePreference: z.string().default("ANY"),
  preferredLocations: z.array(z.string()).default([]),
  skills: z.array(MasterSkillSchema).default([]),
  projects: z.array(MasterProjectSchema).default([]),
  experiences: z.array(MasterExperienceSchema).default([]),
  resumeText: z.string().default(""),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;
export type CandidateProfileInput = z.input<typeof CandidateProfileSchema>;

export interface RawCandidateDbRecord {
  id: string;
  name: string;
  targetRole: string;
  minSalary: number;
  currency?: string;
  yearsOfExperience: number;
  remotePreference: string;
  preferredLocations: string;
  skills: string;
  projects: string;
  experiences: string;
  resumeText: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SerializedCandidateFields {
  preferredLocations: string;
  skills: string;
  projects: string;
  experiences: string;
}

export function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (typeof val !== "string") return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export function parseMasterSkills(val: unknown): MasterSkill[] {
  const parsed = typeof val === "string" ? parseJsonSafe(val, []) : val;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (typeof item === "string") {
        return { name: item, category: "DOMAIN" as const, yearsOfExperience: null };
      }
      const res = MasterSkillSchema.safeParse(item);
      return res.success ? res.data : null;
    })
    .filter((s): s is MasterSkill => s !== null);
}

export function parseMasterProjects(val: unknown): MasterProject[] {
  const parsed = typeof val === "string" ? parseJsonSafe(val, []) : val;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      const res = MasterProjectSchema.safeParse(item);
      return res.success ? res.data : null;
    })
    .filter((p): p is MasterProject => p !== null);
}

export function parseMasterExperiences(val: unknown): MasterExperience[] {
  const parsed = typeof val === "string" ? parseJsonSafe(val, []) : val;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      const res = MasterExperienceSchema.safeParse(item);
      return res.success ? res.data : null;
    })
    .filter((e): e is MasterExperience => e !== null);
}

export function parsePreferredLocations(val: unknown): string[] {
  const parsed = typeof val === "string" ? parseJsonSafe(val, []) : val;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((loc): loc is string => typeof loc === "string");
}

export function serializeCandidateProfile(
  profile: CandidateProfileInput
): Omit<RawCandidateDbRecord, "createdAt" | "updatedAt"> {
  const validated = CandidateProfileSchema.parse(profile);

  return {
    id: validated.id,
    name: validated.name,
    targetRole: validated.targetRole,
    minSalary: validated.minSalary,
    currency: validated.currency,
    yearsOfExperience: validated.yearsOfExperience,
    remotePreference: validated.remotePreference,
    preferredLocations: JSON.stringify(validated.preferredLocations),
    skills: JSON.stringify(validated.skills),
    projects: JSON.stringify(validated.projects),
    experiences: JSON.stringify(validated.experiences),
    resumeText: validated.resumeText,
  };
}

export function deserializeCandidateProfile(
  record: RawCandidateDbRecord
): CandidateProfile {
  return CandidateProfileSchema.parse({
    id: record.id,
    name: record.name,
    targetRole: record.targetRole,
    minSalary: record.minSalary,
    currency: record.currency || "INR",
    yearsOfExperience: record.yearsOfExperience,
    remotePreference: record.remotePreference,
    preferredLocations: parsePreferredLocations(record.preferredLocations),
    skills: parseMasterSkills(record.skills),
    projects: parseMasterProjects(record.projects),
    experiences: parseMasterExperiences(record.experiences),
    resumeText: record.resumeText || "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
