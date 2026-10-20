import type {
  FeedAdapter,
  FeedPollResult,
  FeedSource,
  FeedSourceConfig,
  RawFeedJob,
  AdapterPollOptions,
} from "./types";
import { parseFeedSourceConfig } from "../../feed-sources";
import { extractTextFromHtml } from "../pipeline";
import { classifyRemoteAndLocation } from "../../filters/prefilter";

interface AshbyJobResponse {
  jobs?: AshbyJobItem[];
}

interface AshbyJobItem {
  id: string;
  title: string;
  department?: string;
  team?: string;
  location?: string;
  locationName?: string;
  isRemote?: boolean;
  publishedAt?: string;
  openedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensation?: {
      summary?: string;
      currency?: string;
      minValue?: number;
      maxValue?: number;
    };
    compensationTiers?: Array<{
      tierSummary?: string;
      min?: number;
      max?: number;
      currencyCode?: string;
    }>;
  };
  secondaryLocations?: Array<{ location?: string; locationName?: string }>;
}

function formatCompanyName(slug: string): string {
  if (!slug) return "Ashby Board";
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export class AshbyAdapter implements FeedAdapter {
  readonly sourceType = "ASHBY";

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
    const boardSlugs = config.boardSlugs && config.boardSlugs.length > 0
      ? config.boardSlugs
      : ["default"];

    const allJobs: RawFeedJob[] = [];
    let newestPublishedAt = source.lastCursor ? new Date(source.lastCursor).getTime() : 0;

    for (const slug of boardSlugs) {
      const baseUrl = source.url && source.url.includes("api.ashbyhq.com")
        ? source.url.replace(/\/+$/, "")
        : "https://api.ashbyhq.com/posting-api/job-board";
      
      const endpoint = `${baseUrl}/${encodeURIComponent(slug)}`;

      const response = await fetchFn(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "VanguardCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Ashby API request failed for board '${slug}' (${response.status} ${response.statusText})`);
      }

      const data = (await response.json()) as AshbyJobResponse;
      const jobItems = Array.isArray(data.jobs) ? data.jobs : [];

      for (const item of jobItems) {
        if (!item.id || !item.title) continue;

        const publishedDate = item.publishedAt
          ? new Date(item.publishedAt)
          : item.openedAt
          ? new Date(item.openedAt)
          : null;

        const publishedTimestamp = publishedDate ? publishedDate.getTime() : 0;

        if (source.lastCursor && publishedTimestamp > 0) {
          const lastCursorTimestamp = new Date(source.lastCursor).getTime();
          if (publishedTimestamp <= lastCursorTimestamp) {
            continue;
          }
        }

        if (publishedTimestamp > newestPublishedAt) {
          newestPublishedAt = publishedTimestamp;
        }

        // Location formatting
        const primaryLoc = item.locationName || item.location || "";
        const secondaryLocs = (item.secondaryLocations || [])
          .map((loc) => loc.locationName || loc.location || "")
          .filter(Boolean);
        const combinedLocations = [primaryLoc, ...secondaryLocs].filter(Boolean).join(", ");

        // Remote classification
        let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "UNKNOWN";
        if (item.isRemote === true) {
          remoteStatus = "REMOTE";
        } else if (combinedLocations) {
          remoteStatus = classifyRemoteAndLocation(combinedLocations).remoteStatus;
        }

        // Salary extraction
        let salaryMin: number | null = null;
        let salaryMax: number | null = null;
        let salaryCurrency: string | null = null;

        if (item.compensation?.scrapeableCompensation) {
          const comp = item.compensation.scrapeableCompensation;
          salaryMin = comp.minValue ?? null;
          salaryMax = comp.maxValue ?? null;
          salaryCurrency = comp.currency ?? "USD";
        } else if (item.compensation?.compensationTiers && item.compensation.compensationTiers.length > 0) {
          const tier = item.compensation.compensationTiers[0];
          salaryMin = tier.min ?? null;
          salaryMax = tier.max ?? null;
          salaryCurrency = tier.currencyCode ?? "USD";
        }

        // Description extraction
        const description = item.descriptionPlain && item.descriptionPlain.trim().length > 0
          ? item.descriptionPlain.trim()
          : extractTextFromHtml(item.descriptionHtml || "");

        const jobUrl = item.jobUrl || item.applyUrl || `https://jobs.ashbyhq.com/${slug}/${item.id}`;

        allJobs.push({
          sourceExternalId: item.id,
          title: item.title.trim(),
          company: formatCompanyName(slug),
          location: combinedLocations || (remoteStatus === "REMOTE" ? "Remote" : undefined),
          remoteStatus,
          salaryMin,
          salaryMax,
          salaryCurrency,
          description,
          url: jobUrl,
          postedAt: publishedDate,
          metadata: {
            boardSlug: slug,
            department: item.department,
            team: item.team,
            compensationTierSummary: item.compensation?.compensationTierSummary,
          },
        });
      }
    }

    const nextCursor = newestPublishedAt > 0 ? new Date(newestPublishedAt).toISOString() : source.lastCursor;

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: false,
    };
  }
}
