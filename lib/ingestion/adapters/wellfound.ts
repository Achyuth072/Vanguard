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

interface WellfoundCompany {
  name?: string;
  slug?: string;
  stage?: string;
  size?: string;
  location?: string;
}

interface WellfoundCompensation {
  min_salary?: number | string | null;
  max_salary?: number | string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  currency?: string | null;
  equity_min?: number | string | null;
  equity_max?: number | string | null;
  equity_string?: string | null;
}

interface WellfoundJobItem {
  id?: string | number;
  job_id?: string | number;
  slug?: string;
  title?: string;
  role?: string;
  job_title?: string;
  company?: WellfoundCompany | string;
  company_name?: string;
  startup_name?: string;
  stage?: string;
  startup_stage?: string;
  location?: string;
  locations?: string[];
  workplace_type?: string;
  is_remote?: boolean;
  remote?: boolean;
  compensation?: WellfoundCompensation;
  min_salary?: number | string | null;
  max_salary?: number | string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  salary_currency?: string | null;
  currency?: string | null;
  equity?: string | null;
  equity_min?: number | string | null;
  equity_max?: number | string | null;
  equity_string?: string | null;
  description?: string;
  job_description?: string;
  url?: string;
  job_url?: string;
  posted_at?: string;
  published_at?: string;
  created_at?: string;
  tags?: string[];
  skills?: string[];
}

interface WellfoundApiResponse {
  results?: WellfoundJobItem[];
  jobs?: WellfoundJobItem[];
  listings?: WellfoundJobItem[];
  data?: WellfoundJobItem[];
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export class WellfoundAdapter implements FeedAdapter {
  readonly sourceType = "WELLFOUND";

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

    const baseUrl = source.url && source.url.includes("wellfound.com")
      ? source.url.replace(/\/+$/, "")
      : "https://wellfound.com/api/v1/jobs";

    const url = new URL(baseUrl);
    const limit = options?.limit ?? config.count ?? 50;
    url.searchParams.set("limit", String(limit));

    const currentPage = source.lastCursor ? parseInt(source.lastCursor, 10) || 1 : 1;
    url.searchParams.set("page", String(currentPage));

    if (config.tags && config.tags.length > 0) {
      url.searchParams.set("roles", config.tags.join(","));
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "PulseCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Wellfound API request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as WellfoundApiResponse;
    const rawItems = payload.results ?? payload.jobs ?? payload.listings ?? payload.data ?? (Array.isArray(payload) ? (payload as WellfoundJobItem[]) : []);
    const items = Array.isArray(rawItems) ? rawItems : [];
    const allJobs: RawFeedJob[] = [];

    for (const item of items) {
      const rawId = item.id ?? item.job_id ?? item.slug;
      const title = (item.title ?? item.role ?? item.job_title ?? "").trim();
      if (!rawId || !title) continue;

      let company = "Wellfound Startup";
      let startupStage: string | undefined = undefined;

      if (typeof item.company === "object" && item.company !== null) {
        if (item.company.name) company = item.company.name.trim();
        if (item.company.stage) startupStage = item.company.stage.trim();
      } else if (typeof item.company === "string" && item.company.trim()) {
        company = item.company.trim();
      } else if (item.company_name) {
        company = item.company_name.trim();
      } else if (item.startup_name) {
        company = item.startup_name.trim();
      }

      if (!startupStage && (item.stage || item.startup_stage)) {
        startupStage = (item.stage || item.startup_stage)?.trim();
      }

      let location = "Remote";
      if (item.location) {
        location = item.location.trim();
      } else if (Array.isArray(item.locations) && item.locations.length > 0) {
        location = item.locations.join(", ");
      } else if (typeof item.company === "object" && item.company?.location) {
        location = item.company.location.trim();
      }

      let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "REMOTE";
      if (
        item.is_remote === true ||
        item.remote === true ||
        /remote/i.test(item.workplace_type || location)
      ) {
        remoteStatus = "REMOTE";
      } else if (/hybrid/i.test(item.workplace_type || location)) {
        remoteStatus = "HYBRID";
      } else if (/onsite|office|in-office/i.test(item.workplace_type || location)) {
        remoteStatus = "ONSITE";
      }

      const description = extractTextFromHtml(item.description || item.job_description || "");

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      let salaryCurrency = item.compensation?.currency || item.salary_currency || item.currency || null;

      const rawMin =
        item.compensation?.min_salary ??
        item.compensation?.salary_min ??
        item.min_salary ??
        item.salary_min;
      const rawMax =
        item.compensation?.max_salary ??
        item.compensation?.salary_max ??
        item.max_salary ??
        item.salary_max;

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

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      // Equity parsing and metadata normalization
      let equityString: string | undefined = undefined;
      const comp = item.compensation;
      if (comp?.equity_string) {
        equityString = comp.equity_string;
      } else if (item.equity_string) {
        equityString = item.equity_string;
      } else if (item.equity) {
        equityString = item.equity;
      } else if (comp?.equity_min !== undefined || comp?.equity_max !== undefined) {
        const minEq = comp.equity_min ?? 0;
        const maxEq = comp.equity_max ?? minEq;
        equityString = `${minEq}% - ${maxEq}%`;
      } else if (item.equity_min !== undefined || item.equity_max !== undefined) {
        const minEq = item.equity_min ?? 0;
        const maxEq = item.equity_max ?? minEq;
        equityString = `${minEq}% - ${maxEq}%`;
      }

      const jobUrl = item.url || item.job_url || `https://wellfound.com/jobs/${rawId}`;

      let postedAt: Date | null = null;
      const rawDate = item.posted_at || item.published_at || item.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) postedAt = d;
      }

      const metadata: Record<string, unknown> = {};
      if (startupStage) metadata.startupStage = startupStage;
      if (equityString) metadata.equity = equityString;
      if (item.tags || item.skills) metadata.tags = item.tags || item.skills;

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
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
