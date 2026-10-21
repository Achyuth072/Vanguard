import type {
  FeedAdapter,
  FeedPollResult,
  FeedSource,
  FeedSourceConfig,
  RawFeedJob,
  AdapterPollOptions,
} from "./types";
import { parseFeedSourceConfig } from "../../feed-sources";

interface SmartRecruitersLocation {
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  hybrid?: boolean;
  fullLocation?: string;
}

interface SmartRecruitersPosting {
  id: string;
  name: string;
  uuid?: string;
  refNumber?: string;
  company?: {
    identifier?: string;
    name?: string;
  };
  releasedDate?: string;
  location?: SmartRecruitersLocation;
  industry?: { id?: string };
  function?: { id?: string };
  typeOfEmployment?: { id?: string };
}

interface SmartRecruitersResponse {
  offset?: number;
  limit?: number;
  totalFound?: number;
  content?: SmartRecruitersPosting[];
}

function formatCompanyName(slug: string): string {
  if (!slug) return "SmartRecruiters Employer";
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export class SmartRecruitersAdapter implements FeedAdapter {
  readonly sourceType = "SMARTRECRUITERS";

  validateConfig(config: FeedSourceConfig | Record<string, unknown>): boolean {
    if (!config || typeof config !== "object") return false;
    if ("boardSlugs" in config && Array.isArray(config.boardSlugs)) {
      return config.boardSlugs.length > 0 && config.boardSlugs.every((s) => typeof s === "string" && s.trim().length > 0);
    }
    return true;
  }

  async poll(
    source: FeedSource,
    _candidate?: unknown,
    options?: AdapterPollOptions
  ): Promise<FeedPollResult> {
    const fetchFn = options?.fetchFn ?? fetch;
    const config = parseFeedSourceConfig(source.config);

    const slugs = options?.boardSlugOverride
      ? [options.boardSlugOverride]
      : (config.boardSlugs && config.boardSlugs.length > 0)
        ? config.boardSlugs
        : ["BoschGroup", "Canonical"];

    const limit = options?.limit ?? config.count ?? 50;
    const allJobs: RawFeedJob[] = [];
    const baseApi = source.url && source.url.includes("smartrecruiters.com")
      ? source.url.replace(/\/+$/, "")
      : "https://api.smartrecruiters.com/v1/companies";

    for (const slug of slugs) {
      const endpointUrl = `${baseApi}/${encodeURIComponent(slug)}/postings?limit=${limit}`;

      try {
        const response = await fetchFn(endpointUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "VanguardCareerBot/1.0",
          },
          signal: options?.abortSignal,
        });

        if (response.status === 404) {
          console.warn(`[SmartRecruitersAdapter] Company slug '${slug}' returned 404 (not found). Skipping.`);
          continue;
        }

        if (!response.ok) {
          throw new Error(`SmartRecruiters API request failed for company '${slug}' (${response.status} ${response.statusText})`);
        }

        const payload = (await response.json()) as SmartRecruitersResponse;
        const postings = Array.isArray(payload.content) ? payload.content : [];

        for (const item of postings) {
          if (!item.id || !item.name) continue;

          const title = item.name.trim();
          const company = item.company?.name?.trim() || formatCompanyName(slug);

          const loc = item.location;
          const remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" =
            loc?.remote ? "REMOTE" : loc?.hybrid ? "HYBRID" : "ONSITE";
          const location = loc?.fullLocation?.trim()
            || (loc ? [loc.city, loc.region, loc.country].filter(Boolean).join(", ") : "")
            || "Unknown Location";

          const identifier = item.company?.identifier || slug;
          const jobUrl = `https://jobs.smartrecruiters.com/${identifier}/${item.id}`;

          let postedAt: Date | null = null;
          if (item.releasedDate) {
            const d = new Date(item.releasedDate);
            if (!isNaN(d.getTime())) postedAt = d;
          }

          const employmentType = item.typeOfEmployment?.id || "Full-time";
          const description = `${title} at ${company}\n\nLocation: ${location}\nWorkplace: ${remoteStatus}\nEmployment Type: ${employmentType}\nRef: ${item.refNumber || "N/A"}`;

          allJobs.push({
            sourceExternalId: item.id,
            title,
            company,
            location,
            remoteStatus,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            description,
            url: jobUrl,
            postedAt,
            metadata: {
              refNumber: item.refNumber,
              slug,
              industry: item.industry?.id,
              function: item.function?.id,
            },
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError" || options?.boardSlugOverride) throw err;
        console.warn(`[SmartRecruitersAdapter] Failed to poll company '${slug}':`, (err as Error).message);
      }
    }

    return {
      jobs: allJobs,
      nextCursor: "",
      hasMore: false,
    };
  }
}
