import { z } from "zod";

export const SelectedProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  relevanceRationale: z.string(),
  bulletPoints: z.array(z.string()),
});

export type SelectedProject = z.infer<typeof SelectedProjectSchema>;

export const ExperienceHighlightSchema = z.object({
  company: z.string(),
  role: z.string(),
  bulletPoints: z.array(z.string()),
});

export type ExperienceHighlight = z.infer<typeof ExperienceHighlightSchema>;

export const TailoredResumeSchema = z.object({
  summary: z.string(),
  matchingSkills: z.array(z.string()),
  selectedProjects: z.array(SelectedProjectSchema),
  experienceHighlights: z.array(ExperienceHighlightSchema),
  markdownContent: z.string(),
});

export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const ApplicationAnswerSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  keyPointsUsed: z.array(z.string()),
  createdAt: z.string(),
});

export type ApplicationAnswer = z.infer<typeof ApplicationAnswerSchema>;

export const ApplicationAnswersBatchSchema = z.object({
  answers: z.array(ApplicationAnswerSchema),
});

export type ApplicationAnswersBatch = z.infer<typeof ApplicationAnswersBatchSchema>;

