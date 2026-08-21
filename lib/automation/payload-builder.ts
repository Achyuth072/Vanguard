import type { CandidateProfile, RawCandidateDbRecord } from "@/types/candidate";
import { deserializeCandidateProfile } from "@/types/candidate";
import type {
  CandidateProfilePayload,
  FormCandidateProfile,
  TailoredAnswerPattern,
} from "./types";

/**
 * Parses full name into first and last name components.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Builds candidate profile payload suitable for form mapping and browser filling.
 */
export function buildCandidateProfilePayload(
  candidateRecord: RawCandidateDbRecord | CandidateProfile | null | undefined,
  applicationRecord?: { questionAnswers?: string | null; tailoredResume?: string | null } | null,
  resumePath?: string
): CandidateProfilePayload {
  let profile: CandidateProfile;

  if (!candidateRecord) {
    profile = {
      id: "candidate-default",
      name: "Alex Builder",
      location: "",
      targetRole: "Software Engineer",
      minSalary: 0,
      currency: "INR",
      yearsOfExperience: 5,
      remotePreference: "ANY",
      preferredLocations: ["Remote", "San Francisco, CA"],
      skills: [],
      projects: [],
      experiences: [],
      resumeText: "",
    };
  } else if ("skills" in candidateRecord && typeof candidateRecord.skills === "string") {
    profile = deserializeCandidateProfile(candidateRecord as RawCandidateDbRecord);
  } else {
    profile = candidateRecord as CandidateProfile;
  }

  const { firstName, lastName } = splitFullName(profile.name || "Alex Builder");

  // Extract primary email and phone from resume text or defaults
  let email = "alex.builder@example.com";
  let phone = "+1 (555) 019-2834";

  if (profile.resumeText) {
    const emailMatch = profile.resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      email = emailMatch[0];
    }
    const phoneMatch = profile.resumeText.match(/(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/);
    if (phoneMatch) {
      phone = phoneMatch[0];
    }
  }

  const location = profile.location || profile.preferredLocations?.[0] || "Remote";
  const currentExp = profile.experiences?.find((e) => e.isCurrent) || profile.experiences?.[0];
  const currentCompany = currentExp?.company || "Pulse Technologies";
  const currentTitle = currentExp?.title || profile.targetRole || "Senior Software Engineer";

  // Build social links
  const links: Record<string, string> = {
    linkedIn: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    gitHub: `https://github.com/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    portfolio: `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.dev`,
  };

  // Build tailored answers
  const tailoredAnswers: TailoredAnswerPattern[] = [];
  if (applicationRecord?.questionAnswers) {
    try {
      const parsed = JSON.parse(applicationRecord.questionAnswers);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object" && item.question && item.answer) {
            tailoredAnswers.push({
              questionPattern: String(item.question),
              answer: String(item.answer),
            });
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  const formProfile: FormCandidateProfile = {
    firstName,
    lastName,
    fullName: profile.name || `${firstName} ${lastName}`.trim(),
    email,
    phone,
    location,
    currentCompany,
    currentTitle,
    links,
    workAuthorization: {
      authorizedInUS: true,
      requiresSponsorship: false,
    },
    demographics: {
      gender: "Decline to Self-Identify",
      race: "Decline to Self-Identify",
      veteranStatus: "I am not a protected veteran",
      disabilityStatus: "I do not wish to answer",
    },
    resumePath: resumePath || undefined,
  };

  return {
    profile: formProfile,
    tailoredAnswers: tailoredAnswers.length > 0 ? tailoredAnswers : undefined,
  };
}
