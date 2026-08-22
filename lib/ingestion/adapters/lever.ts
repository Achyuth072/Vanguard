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
import { classifyRemoteAndLocation, extractSalaryFromRawText } from "../../filters/prefilter";

interface LeverJobPosting {
  id: string;
  text: string;
  createdAt?: number;
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: "remote" | "hybrid" | "onsite" | "unspecified" | string;
  categories?: {
    commitment?: string;
    department?: string;
    team?: string;
    location?: string;
    allLocations?: string[];
  };
  description?: string;
  descriptionPlain?: string;
  additional?: string;
  additionalPlain?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
}

function formatCompanyName(slug: string): string {
  if (!slug) return "Lever Board";
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export class LeverAdapter implements FeedAdapter {
  readonly sourceType = "LEVER";

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
    let newestCreatedAt = source.lastCursor ? parseInt(source.lastCursor, 10) || new Date(source.lastCursor).getTime() || 0 : 0;

    for (const slug of boardSlugs) {
      const baseUrl = source.url && source.url.includes("api.lever.co")
        ? source.url.replace(/\/+$/, "")
        : "https://api.lever.co/v0/postings";

      const endpoint = `${baseUrl}/${encodeURIComponent(slug)}?mode=json`;

      const response = await fetchFn(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PulseCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Lever API request failed for board '${slug}' (${response.status} ${response.statusText})`);
      }

      const jobItems = (await response.json()) as LeverJobPosting[];
      if (!Array.isArray(jobItems)) continue;

      for (const item of jobItems) {
        if (!item.id || !item.text) continue;

        const createdAtTimestamp = typeof item.createdAt === "number" ? item.createdAt : 0;
        const postedDate = createdAtTimestamp > 0 ? new Date(createdAtTimestamp) : null;

        if (source.lastCursor && createdAtTimestamp > 0) {
          const lastCursorNum = parseInt(source.lastCursor, 10) || new Date(source.lastCursor).getTime();
          if (createdAtTimestamp <= lastCursorNum) {
            continue;
          }
        }

        if (createdAtTimestamp > newestCreatedAt) {
          newestCreatedAt = createdAtTimestamp;
        }

        // Location formatting
        const primaryLoc = item.categories?.location || "";
        const allLocs = item.categories?.allLocations || [];
        const combinedLocations = Array.from(new Set([primaryLoc, ...allLocs])).filter(Boolean).join(", ");

        // Remote status
        let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "UNKNOWN";
        if (item.workplaceType === "remote") {
          remoteStatus = "REMOTE";
        } else if (item.workplaceType === "hybrid") {
          remoteStatus = "HYBRID";
        } else if (item.workplaceType === "onsite") {
          remoteStatus = "ONSITE";
        } else {
          remoteStatus = classifyRemoteAndLocation(`${item.text} ${combinedLocations}`).remoteStatus;
        }

        // Description extraction (combining main description and additional requirements)
        const descMain = item.descriptionPlain && item.descriptionPlain.trim().length > 0
          ? item.descriptionPlain.trim()
          : extractTextFromHtml(item.description || "");

        const descAdditional = item.additionalPlain && item.additionalPlain.trim().length > 0
          ? item.additionalPlain.trim()
          : extractTextFromHtml(item.additional || "");

        const description = [descMain, descAdditional].filter(Boolean).join("\n\n");

        // Salary extraction
        let salaryMin = item.salaryRange?.min ?? null;
        let salaryMax = item.salaryRange?.max ?? null;
        let salaryCurrency = item.salaryRange?.currency ?? null;

        if (salaryMin === null && salaryMax === null) {
          const extractedFromText = extractSalaryFromRawText(description);
          if (extractedFromText) {
            salaryMin = extractedFromText.min;
            salaryMax = extractedFromText.max;
            salaryCurrency = extractedFromText.currency;
          }
        }

        const jobUrl = item.hostedUrl || item.applyUrl || `https://jobs.lever.co/${slug}/${item.id}`;

        allJobs.push({
          sourceExternalId: item.id,
          title: item.text.trim(),
          company: formatCompanyName(slug),
          location: combinedLocations || (remoteStatus === "REMOTE" ? "Remote" : undefined),
          remoteStatus,
          salaryMin,
          salaryMax,
          salaryCurrency: salaryCurrency || "USD",
          description,
          url: jobUrl,
          postedAt: postedDate,
          metadata: {
            boardSlug: slug,
            commitment: item.categories?.commitment,
            department: item.categories?.department,
            team: item.categories?.team,
            workplaceType: item.workplaceType,
          },
        });
      }
    }

    const nextCursor = newestCreatedAt > 0 ? String(newestCreatedAt) : source.lastCursor;

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: false,
    };
  }
}
