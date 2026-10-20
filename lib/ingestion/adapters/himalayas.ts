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
import { extractSalaryFromRawText } from "../../filters/prefilter";

interface HimalayasApiResponse {
  data?: HimalayasJobItem[];
  meta?: {
    total?: number;
    count?: number;
    offset?: number;
    nextOffset?: number;
  };
}

interface HimalayasJobItem {
  id: string | number;
  title: string;
  companyName: string;
  companySlug?: string;
  applicationLink?: string;
  excerpt?: string;
  description?: string;
  categories?: string[];
  locationRestrictions?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  pubDate?: number; // Unix timestamp in seconds
}

export class HimalayasAdapter implements FeedAdapter {
  readonly sourceType = "HIMALAYAS";

  validateConfig(config: FeedSourceConfig | Record<string, unknown>): boolean {
    return Boolean(config && typeof config === "object");
  }

  async poll(
    source: FeedSource,
    _candidate?: unknown,
    options?: AdapterPollOptions
  ): Promise<FeedPollResult> {
    const fetchFn = options?.fetchFn ?? fetch;
    const config = parseFeedSourceConfig(source.config);

    const baseUrl = source.url && source.url.includes("himalayas.app")
      ? source.url.replace(/\/+$/, "")
      : "https://himalayas.app/jobs/api";

    const currentOffset = source.lastCursor ? parseInt(source.lastCursor, 10) || 0 : 0;
    const url = new URL(baseUrl);
    url.searchParams.set("offset", String(currentOffset));

    if (config.categories && Array.isArray(config.categories) && config.categories.length > 0) {
      url.searchParams.set("categories", config.categories.join(","));
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "VanguardCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Himalayas API request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as HimalayasApiResponse;
    const items = Array.isArray(payload.data) ? payload.data : [];
    const allJobs: RawFeedJob[] = [];

    for (const item of items) {
      if (!item.id || !item.title) continue;

      const postedAt = typeof item.pubDate === "number"
        ? new Date(item.pubDate > 1e11 ? item.pubDate : item.pubDate * 1000)
        : null;

      const description = extractTextFromHtml(item.description || item.excerpt || "");
      const locationRestrictions = Array.isArray(item.locationRestrictions) ? item.locationRestrictions : [];
      const locationStr = locationRestrictions.length > 0 ? locationRestrictions.join(", ") : "Worldwide Remote";

      let salaryMin = typeof item.minSalary === "number" ? item.minSalary : null;
      let salaryMax = typeof item.maxSalary === "number" ? item.maxSalary : null;
      let salaryCurrency = item.currency ?? null;

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      const jobUrl = item.applicationLink || `https://himalayas.app/jobs/${item.id}`;

      allJobs.push({
        sourceExternalId: String(item.id),
        title: item.title.trim(),
        company: (item.companyName || "Himalayas Employer").trim(),
        location: locationStr,
        remoteStatus: "REMOTE",
        salaryMin,
        salaryMax,
        salaryCurrency: salaryCurrency || "USD",
        description,
        url: jobUrl,
        postedAt,
        metadata: {
          categories: item.categories,
          companySlug: item.companySlug,
          locationRestrictions,
        },
      });
    }

    const nextOffset = typeof payload.meta?.nextOffset === "number"
      ? payload.meta.nextOffset
      : currentOffset + items.length;

    const hasMore = typeof payload.meta?.total === "number"
      ? nextOffset < payload.meta.total
      : items.length > 0;

    return {
      jobs: allJobs,
      nextCursor: String(nextOffset),
      hasMore,
    };
  }
}
