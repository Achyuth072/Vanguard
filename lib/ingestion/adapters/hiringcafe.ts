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

interface HiringCafeJobItem {
  id?: string | number;
  job_id?: string | number;
  objectID?: string | number;
  title?: string;
  job_title?: string;
  company?: string;
  company_name?: string;
  location?: string;
  workplace_type?: string;
  is_remote?: boolean;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  min_salary?: number | string | null;
  max_salary?: number | string | null;
  salary_currency?: string | null;
  description?: string;
  job_description?: string;
  url?: string;
  apply_url?: string;
  job_url?: string;
  posted_at?: string;
  created_at?: string;
}

interface HiringCafeApiResponse {
  results?: HiringCafeJobItem[];
  jobs?: HiringCafeJobItem[];
  items?: HiringCafeJobItem[];
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export class HiringCafeAdapter implements FeedAdapter {
  readonly sourceType = "HIRINGCAFE";

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

    const baseUrl = source.url && source.url.includes("hiring.cafe")
      ? source.url.replace(/\/+$/, "")
      : "https://hiring.cafe/api/search";

    const url = new URL(baseUrl);
    const limit = options?.limit ?? config.count ?? 50;
    url.searchParams.set("limit", String(limit));

    const currentPage = source.lastCursor ? parseInt(source.lastCursor, 10) || 1 : 1;
    url.searchParams.set("page", String(currentPage));

    if (config.tags && config.tags.length > 0) {
      url.searchParams.set("q", config.tags.join(" "));
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "VanguardCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`HiringCafe API request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as HiringCafeApiResponse;
    const rawItems = payload.results ?? payload.jobs ?? payload.items ?? (Array.isArray(payload) ? (payload as HiringCafeJobItem[]) : []);
    const items = Array.isArray(rawItems) ? rawItems : [];
    const allJobs: RawFeedJob[] = [];

    for (const item of items) {
      const rawId = item.id ?? item.job_id ?? item.objectID;
      const title = (item.title ?? item.job_title ?? "").trim();
      if (!rawId || !title) continue;

      const company = (item.company ?? item.company_name ?? "HiringCafe Employer").trim();
      const location = (item.location ?? "Remote").trim();

      let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "REMOTE";
      if (item.is_remote === true || /remote/i.test(item.workplace_type || location)) {
        remoteStatus = "REMOTE";
      } else if (/hybrid/i.test(item.workplace_type || location)) {
        remoteStatus = "HYBRID";
      } else if (/onsite|office|in-office/i.test(item.workplace_type || location)) {
        remoteStatus = "ONSITE";
      }

      const description = extractTextFromHtml(item.description || item.job_description || "");

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;

      const rawMin = item.salary_min ?? item.min_salary;
      const rawMax = item.salary_max ?? item.max_salary;

      if (typeof rawMin === "number") {
        salaryMin = rawMin;
      } else if (typeof rawMin === "string") {
        const parsed = parseFloat(rawMin);
        if (!isNaN(parsed)) salaryMin = parsed;
      }

      if (typeof rawMax === "number") {
        salaryMax = rawMax;
      } else if (typeof rawMax === "string") {
        const parsed = parseFloat(rawMax);
        if (!isNaN(parsed)) salaryMax = parsed;
      }

      let salaryCurrency = item.salary_currency || null;

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      const jobUrl = item.url || item.apply_url || item.job_url || `https://hiring.cafe/jobs/${rawId}`;

      let postedAt: Date | null = null;
      const rawDate = item.posted_at || item.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) postedAt = d;
      }

      allJobs.push({
        sourceExternalId: String(rawId),
        title,
        company,
        location,
        remoteStatus,
        salaryMin,
        salaryMax,
        salaryCurrency: salaryCurrency || "USD",
        description,
        url: jobUrl,
        postedAt,
      });
    }

    const nextCursor = String(currentPage + 1);
    const hasMore = payload.hasMore ?? (items.length >= limit);

    return {
      jobs: allJobs,
      nextCursor,
      hasMore,
    };
  }
}
