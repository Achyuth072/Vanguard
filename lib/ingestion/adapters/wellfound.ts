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

function parseNumeric(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
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
    const config = parseFeedSourceConfig(source.config);
    const rawConfig = typeof source.config === "string" ? this.safeParseJson(source.config) : source.config;
    const limit = options?.limit ?? config.count ?? 50;
    const currentPage = source.lastCursor ? parseInt(source.lastCursor, 10) || 1 : 1;

    // Injected session payload (CDP bridge / session cookie) takes precedence
    const injectedPayload = (rawConfig as Record<string, unknown>)?.sessionPayload ||
      (options as Record<string, unknown> | undefined)?.sessionPayload;

    let payload: WellfoundApiResponse;

    if (injectedPayload) {
      payload = injectedPayload as WellfoundApiResponse;
    } else {
      const fetchFn = options?.fetchFn ?? fetch;
      const baseUrl = source.url && source.url.includes("wellfound.com")
        ? source.url.replace(/\/+$/, "")
        : "https://wellfound.com/api/v1/jobs";

      const url = new URL(baseUrl);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", String(currentPage));

      if (config.tags && config.tags.length > 0) {
        url.searchParams.set("roles", config.tags.join(","));
      }

      const response = await fetchFn(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "VanguardCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });

      if (!response.ok) {
        throw new Error(
          `Wellfound API request failed (${response.status} ${response.statusText})${
            response.status === 403 || response.status === 404
              ? ": Wellfound requires an active browser session via Vanguard CDP bridge or session cookies to bypass Cloudflare protection."
              : ""
          }`
        );
      }

      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType && !contentType.includes("json")) {
        throw new Error(
          "Wellfound returned a non-JSON challenge page (Cloudflare bot management). Use Vanguard CDP bridge session ingestion."
        );
      }

      try {
        payload = (await response.json()) as WellfoundApiResponse;
      } catch (err) {
        throw new Error(
          `Wellfound response parsing failed: ${(err as Error).message}. Use Vanguard CDP bridge session ingestion.`
        );
      }
    }

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

      const workplaceOrLoc = `${item.workplace_type || ""} ${location}`;
      let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "REMOTE";
      if (item.is_remote === true || item.remote === true || /remote/i.test(workplaceOrLoc)) {
        remoteStatus = "REMOTE";
      } else if (/hybrid/i.test(workplaceOrLoc)) {
        remoteStatus = "HYBRID";
      } else if (/onsite|office|in-person/i.test(item.workplace_type || "") || (location !== "Remote" && !/remote/i.test(location))) {
        remoteStatus = "ONSITE";
      }

      const description = extractTextFromHtml(item.description || item.job_description || "");

      const comp = item.compensation;
      let salaryMin = parseNumeric(item.salary_min ?? item.min_salary ?? comp?.salary_min ?? comp?.min_salary);
      let salaryMax = parseNumeric(item.salary_max ?? item.max_salary ?? comp?.salary_max ?? comp?.max_salary);
      let salaryCurrency = item.salary_currency ?? item.currency ?? comp?.currency ?? null;

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      let equity: string | null = item.equity ?? item.equity_string ?? comp?.equity_string ?? null;
      if (!equity && item.equity_min !== undefined && item.equity_max !== undefined) {
        equity = `${item.equity_min}% - ${item.equity_max}%`;
      } else if (!equity && comp?.equity_min !== undefined && comp?.equity_max !== undefined) {
        equity = `${comp.equity_min}% - ${comp.equity_max}%`;
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
      if (equity) metadata.equity = equity;
      if (item.skills && Array.isArray(item.skills)) metadata.skills = item.skills;
      if (item.tags && Array.isArray(item.tags)) metadata.tags = item.tags;

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

  private safeParseJson(str: string): Record<string, unknown> {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
