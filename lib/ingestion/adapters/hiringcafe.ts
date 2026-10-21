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

interface HiringCafeMcpResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
}

interface HiringCafeApiResponse {
  results?: HiringCafeJobItem[];
  jobs?: HiringCafeJobItem[];
  items?: HiringCafeJobItem[];
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
}

function extractBullet(section: string, field: string): string {
  const match = section.match(new RegExp(`-\\s+\\*\\*${field}:\\*\\*\\s*([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

function parseNumeric(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
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
      : "https://hiring.cafe/api/mcp";

    const isMcp = baseUrl.includes("api/mcp");
    const limit = options?.limit ?? config.count ?? 50;
    const currentPage = source.lastCursor ? parseInt(source.lastCursor, 10) || 1 : 1;

    let response: Response;

    if (isMcp) {
      const searchTerms = config.tags && config.tags.length > 0
        ? config.tags.join(" ")
        : "Software Engineer";

      const mcpBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "search_jobs",
          arguments: {
            search: searchTerms,
            limit: Math.min(limit, 25),
          },
        },
      };

      response = await fetchFn(baseUrl, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "User-Agent": "hiringcafe-cli",
        },
        body: JSON.stringify(mcpBody),
        signal: options?.abortSignal,
      });
    } else {
      const url = new URL(baseUrl);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", String(currentPage));

      if (config.tags && config.tags.length > 0) {
        url.searchParams.set("q", config.tags.join(" "));
      }

      response = await fetchFn(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "VanguardCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });
    }

    if (!response.ok) {
      throw new Error(`HiringCafe API request failed (${response.status} ${response.statusText})`);
    }

    const payload = await response.json();

    // Check if response is MCP JSON-RPC
    if (this.isMcpPayload(payload)) {
      return this.parseMcpResponse(payload, currentPage);
    }

    // Fallback to legacy REST format
    return this.parseLegacyRestResponse(payload as HiringCafeApiResponse, currentPage, limit);
  }

  private isMcpPayload(payload: unknown): payload is HiringCafeMcpResponse {
    return Boolean(
      payload &&
      typeof payload === "object" &&
      ("jsonrpc" in payload || "result" in payload)
    );
  }

  private parseMcpResponse(payload: HiringCafeMcpResponse, currentPage: number): FeedPollResult {
    const textContent = payload.result?.content?.[0]?.text ?? "";
    if (!textContent) {
      return { jobs: [], nextCursor: String(currentPage + 1), hasMore: false };
    }

    const jobs: RawFeedJob[] = [];
    const sections = textContent.split(/(?=^###\s+\[)/m);

    for (const section of sections) {
      const titleMatch = section.match(/^###\s+\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/m);
      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      const url = titleMatch[2].trim();

      const companyMatch = section.match(/\*\*([^\*\n]+)\*\*/);
      const company = companyMatch ? companyMatch[1].trim() : "HiringCafe Employer";
      const location = extractBullet(section, "Location") || "Remote";
      const workplace = extractBullet(section, "Workplace");
      const rawId = extractBullet(section, "Job ID") || url.split("/").pop()?.split("?")[0] || Math.random().toString(36).substring(2);

      const postedRaw = extractBullet(section, "Posted");
      let postedAt: Date | null = null;
      if (postedRaw) {
        const d = new Date(postedRaw);
        if (!isNaN(d.getTime())) postedAt = d;
      }

      const workplaceOrLocation = `${workplace} ${location}`;
      const remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" =
        /remote/i.test(workplaceOrLocation) ? "REMOTE" :
        /hybrid/i.test(workplaceOrLocation) ? "HYBRID" :
        /onsite|field|office/i.test(workplaceOrLocation) ? "ONSITE" : "REMOTE";

      const description = section
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && l !== "---" && !l.startsWith("###") && !l.startsWith("**") && !l.startsWith("- **"))
        .join("\n\n");

      const salaryText = extractBullet(section, "Salary");
      const salaryExtracted = (salaryText ? extractSalaryFromRawText(salaryText) : null) ?? extractSalaryFromRawText(description);

      jobs.push({
        sourceExternalId: rawId,
        title,
        company,
        location,
        remoteStatus,
        salaryMin: salaryExtracted?.min ?? null,
        salaryMax: salaryExtracted?.max ?? null,
        salaryCurrency: salaryExtracted?.currency ?? "USD",
        description: description || title,
        url,
        postedAt,
      });
    }

    return {
      jobs,
      nextCursor: String(currentPage + 1),
      hasMore: jobs.length > 0,
    };
  }

  private parseLegacyRestResponse(
    payload: HiringCafeApiResponse,
    currentPage: number,
    limit: number
  ): FeedPollResult {
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

      let salaryMin = parseNumeric(item.salary_min ?? item.min_salary);
      let salaryMax = parseNumeric(item.salary_max ?? item.max_salary);
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
