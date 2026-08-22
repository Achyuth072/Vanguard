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

interface RemoteOKJobItem {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  date?: string;
  url?: string;
  apply_url?: string;
  legal?: string;
}

export class RemoteOKAdapter implements FeedAdapter {
  readonly sourceType = "REMOTEOK";

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

    const baseUrl = source.url && source.url.includes("remoteok.com")
      ? source.url.replace(/\/+$/, "")
      : "https://remoteok.com/api";

    const url = new URL(baseUrl);
    if (config.tags && Array.isArray(config.tags) && config.tags.length > 0) {
      url.searchParams.set("tag", config.tags[0]);
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "PulseCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`RemoteOK API request failed (${response.status} ${response.statusText})`);
    }

    const rawArray = (await response.json()) as RemoteOKJobItem[];
    if (!Array.isArray(rawArray)) {
      return { jobs: [], nextCursor: source.lastCursor, hasMore: false };
    }

    const allJobs: RawFeedJob[] = [];
    let newestDateTimestamp = source.lastCursor ? new Date(source.lastCursor).getTime() : 0;

    for (const item of rawArray) {
      // Skip legal / notice object
      if (!item.id || !item.position || !item.company) {
        continue;
      }

      const postedDate = item.date ? new Date(item.date) : null;
      const postedTimestamp = postedDate ? postedDate.getTime() : 0;

      if (source.lastCursor && postedTimestamp > 0) {
        const lastCursorTimestamp = new Date(source.lastCursor).getTime();
        if (postedTimestamp <= lastCursorTimestamp) {
          continue;
        }
      }

      if (postedTimestamp > newestDateTimestamp) {
        newestDateTimestamp = postedTimestamp;
      }

      const description = extractTextFromHtml(item.description || "");

      let salaryMin = typeof item.salary_min === "number" && item.salary_min > 0 ? item.salary_min : null;
      let salaryMax = typeof item.salary_max === "number" && item.salary_max > 0 ? item.salary_max : null;
      let salaryCurrency = "USD";

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      const jobUrl = item.url || item.apply_url || `https://remoteok.com/remote-jobs/${item.id}`;

      allJobs.push({
        sourceExternalId: String(item.id),
        title: item.position.trim(),
        company: item.company.trim(),
        location: item.location || "Worldwide Remote",
        remoteStatus: "REMOTE",
        salaryMin,
        salaryMax,
        salaryCurrency,
        description,
        url: jobUrl,
        postedAt: postedDate,
        metadata: {
          slug: item.slug,
          tags: item.tags,
        },
      });
    }

    const nextCursor = newestDateTimestamp > 0 ? new Date(newestDateTimestamp).toISOString() : source.lastCursor;

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: false,
    };
  }
}
