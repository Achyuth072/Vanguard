export interface SourceDefinition {
  key: string;
  label: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "emerald" | "amber" | "violet" | "blue";
  colorClass: string;
  dotColorClass: string;
}

export const SUPPORTED_SOURCES: SourceDefinition[] = [
  {
    key: "YC",
    label: "YC",
    badgeVariant: "amber",
    colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColorClass: "bg-amber-400",
  },
  {
    key: "WELLFOUND",
    label: "Wellfound",
    badgeVariant: "destructive",
    colorClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dotColorClass: "bg-rose-400",
  },
  {
    key: "HIRING_CAFE",
    label: "HiringCafe",
    badgeVariant: "blue",
    colorClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dotColorClass: "bg-cyan-400",
  },
  {
    key: "LINKEDIN",
    label: "LinkedIn",
    badgeVariant: "blue",
    colorClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    dotColorClass: "bg-sky-400",
  },
  {
    key: "INDEED",
    label: "Indeed",
    badgeVariant: "violet",
    colorClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    dotColorClass: "bg-indigo-400",
  },
  {
    key: "SMARTRECRUITERS",
    label: "SmartRecruiters",
    badgeVariant: "emerald",
    colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotColorClass: "bg-emerald-400",
  },
  {
    key: "REMOTIVE",
    label: "Remotive",
    badgeVariant: "amber",
    colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColorClass: "bg-amber-400",
  },
  {
    key: "OTTA",
    label: "Otta",
    badgeVariant: "violet",
    colorClass: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    dotColorClass: "bg-violet-400",
  },
  {
    key: "COMPANY_SITE",
    label: "Company Site",
    badgeVariant: "emerald",
    colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotColorClass: "bg-emerald-400",
  },
  {
    key: "MANUAL",
    label: "Manual",
    badgeVariant: "secondary",
    colorClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotColorClass: "bg-zinc-400",
  },
  {
    key: "PASTE",
    label: "Paste",
    badgeVariant: "secondary",
    colorClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotColorClass: "bg-zinc-400",
  },
  {
    key: "OTHER",
    label: "Other",
    badgeVariant: "secondary",
    colorClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotColorClass: "bg-zinc-400",
  },
];

/**
 * Detects the source platform from a given URL hostname.
 */
export function detectSourceFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string" || !url.trim()) {
    return null;
  }

  const clean = url.trim().toLowerCase();

  if (clean.includes("workatastartup.com") || clean.includes("ycombinator.com")) {
    return "YC";
  }
  if (clean.includes("wellfound.com") || clean.includes("angel.co")) {
    return "WELLFOUND";
  }
  if (clean.includes("hiring.cafe") || clean.includes("hiringcafe.com")) {
    return "HIRING_CAFE";
  }
  if (clean.includes("linkedin.com")) {
    return "LINKEDIN";
  }
  if (clean.includes("indeed.com")) {
    return "INDEED";
  }
  if (clean.includes("otta.com")) {
    return "OTTA";
  }
  if (clean.includes("remotive.com")) {
    return "REMOTIVE";
  }
  if (
    clean.includes("greenhouse.io") ||
    clean.includes("lever.co") ||
    clean.includes("ashbyhq.com") ||
    clean.includes("myworkdayjobs.com") ||
    clean.includes("workday.com") ||
    clean.includes("oraclecloud.com") ||
    clean.includes("smartrecruiters.com") ||
    clean.includes("bamboohr.com") ||
    clean.includes("recruitee.com") ||
    clean.includes("rippling.com") ||
    clean.includes("jobvite.com")
  ) {
    return "COMPANY_SITE";
  }

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return "OTHER";
  }

  return null;
}

/**
 * Normalizes user-input or legacy source strings into canonical keys.
 */
export function normalizeSource(source?: string | null, url?: string | null): string {
  if (source && typeof source === "string" && source.trim()) {
    const raw = source.trim().toLowerCase().replace(/[\s\-_]+/g, "");

    if (raw === "yc" || raw === "ycombinator" || raw === "workatastartup") {
      return "YC";
    }
    if (raw === "wellfound" || raw === "angellist" || raw === "angel") {
      return "WELLFOUND";
    }
    if (raw === "hiringcafe" || raw === "hiring.cafe") {
      return "HIRING_CAFE";
    }
    if (raw === "linkedin") {
      return "LINKEDIN";
    }
    if (raw === "indeed") {
      return "INDEED";
    }
    if (raw === "otta") {
      return "OTTA";
    }
    if (raw === "smartrecruiters") {
      return "SMARTRECRUITERS";
    }
    if (raw === "remotive") {
      return "REMOTIVE";
    }
    if (
      raw === "companysite" ||
      raw === "direct" ||
      raw === "careerpage" ||
      raw === "careersite" ||
      raw === "company"
    ) {
      return "COMPANY_SITE";
    }
    if (raw === "manual" || raw === "manualentry") {
      return "MANUAL";
    }
    if (raw === "paste") {
      return "PASTE";
    }
    if (raw === "url") {
      const fromUrl = detectSourceFromUrl(url);
      return fromUrl || "OTHER";
    }
  }

  if (url) {
    const detected = detectSourceFromUrl(url);
    if (detected) return detected;
  }

  return "MANUAL";
}

/**
 * Formats a canonical or legacy source into a clean display label.
 */
export function getSourceLabel(source?: string | null): string {
  if (!source) return "Manual";
  const normalized = normalizeSource(source);
  const match = SUPPORTED_SOURCES.find((s) => s.key === normalized);
  if (match) return match.label;
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/**
 * Returns the CSS styling classes for a given source badge.
 */
export function getSourceBadgeStyle(source?: string | null): {
  colorClass: string;
  dotColorClass: string;
  label: string;
} {
  const normalized = normalizeSource(source);
  const match = SUPPORTED_SOURCES.find((s) => s.key === normalized);
  if (match) {
    return {
      colorClass: match.colorClass,
      dotColorClass: match.dotColorClass,
      label: match.label,
    };
  }
  return {
    colorClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotColorClass: "bg-zinc-400",
    label: source || "Manual",
  };
}
