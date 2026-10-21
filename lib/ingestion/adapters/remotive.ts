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

interface RemotiveJobItem {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveApiResponse {
  "job-count"?: number;
  "total-job-count"?: number;
  jobs?: RemotiveJobItem[];
}

export class RemotiveAdapter implements FeedAdapter {
  readonly sourceType = "REMOTIVE";

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

    const baseUrl = source.url && source.url.includes("remotive.com")
      ? source.url.replace(/\/+$/, "")
      : "https://remotive.com/api/remote-jobs";

    const url = new URL(baseUrl);
    const limit = options?.limit ?? config.count ?? 50;
    url.searchParams.set("limit", String(limit));

    const category = config.categories?.[0] || "software-dev";
    url.searchParams.set("category", category);

    if (config.tags && config.tags.length > 0) {
      url.searchParams.set("search", config.tags[0]);
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "VanguardCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Remotive API request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as RemotiveApiResponse;
    const items = Array.isArray(payload.jobs) ? payload.jobs : [];
    const allJobs: RawFeedJob[] = [];

    for (const item of items) {
      if (!item.id || !item.title) continue;

      const title = item.title.trim();
      const company = item.company_name?.trim() || "Remote Employer";
      const location = item.candidate_required_location?.trim() || "Worldwide";
      const remoteStatus = "REMOTE";

      const description = extractTextFromHtml(item.description || "");
      const salaryExtracted = (item.salary ? extractSalaryFromRawText(item.salary) : null)
        ?? extractSalaryFromRawText(description);

      let postedAt: Date | null = null;
      if (item.publication_date) {
        const d = new Date(item.publication_date);
        if (!isNaN(d.getTime())) postedAt = d;
      }

      allJobs.push({
        sourceExternalId: String(item.id),
        title,
        company,
        location,
        remoteStatus,
        salaryMin: salaryExtracted?.min ?? null,
        salaryMax: salaryExtracted?.max ?? null,
        salaryCurrency: salaryExtracted?.currency ?? "USD",
        description: description || title,
        url: item.url,
        postedAt,
        metadata: {
          category: item.category,
          tags: item.tags,
          jobType: item.job_type,
        },
      });
    }

    return {
      jobs: allJobs,
      nextCursor: "",
      hasMore: false,
    };
  }
}
