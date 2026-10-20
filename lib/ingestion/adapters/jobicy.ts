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

interface JobicyApiResponse {
  apiVersion?: string;
  jobCount?: number;
  jobs?: JobicyJobItem[];
}

interface JobicyJobItem {
  id: number | string;
  url?: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry?: string | string[];
  jobType?: string | string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number | string | null;
  annualSalaryMax?: number | string | null;
  salaryCurrency?: string | null;
}

export class JobicyAdapter implements FeedAdapter {
  readonly sourceType = "JOBICY";

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

    const baseUrl = source.url && source.url.includes("jobicy.com")
      ? source.url.replace(/\/+$/, "")
      : "https://jobicy.com/api/v2/remote-jobs";

    const url = new URL(baseUrl);
    const count = config.count ?? 50;
    url.searchParams.set("count", String(count));

    if (config.industry) {
      url.searchParams.set("industry", config.industry);
    }

    if (source.lastCursor) {
      const pageNum = parseInt(source.lastCursor, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        url.searchParams.set("page", String(pageNum));
      }
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "VanguardCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Jobicy API request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as JobicyApiResponse;
    const items = Array.isArray(payload.jobs) ? payload.jobs : [];
    const allJobs: RawFeedJob[] = [];

    for (const item of items) {
      if (!item.id || !item.jobTitle) continue;

      const postedAt = item.pubDate ? new Date(item.pubDate) : null;
      const description = extractTextFromHtml(item.jobDescription || item.jobExcerpt || "");

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;

      if (typeof item.annualSalaryMin === "number") {
        salaryMin = item.annualSalaryMin;
      } else if (typeof item.annualSalaryMin === "string") {
        const val = parseFloat(item.annualSalaryMin);
        if (!isNaN(val)) salaryMin = val;
      }

      if (typeof item.annualSalaryMax === "number") {
        salaryMax = item.annualSalaryMax;
      } else if (typeof item.annualSalaryMax === "string") {
        const val = parseFloat(item.annualSalaryMax);
        if (!isNaN(val)) salaryMax = val;
      }

      let salaryCurrency = item.salaryCurrency || null;

      if (salaryMin === null && salaryMax === null) {
        const extracted = extractSalaryFromRawText(description);
        if (extracted) {
          salaryMin = extracted.min;
          salaryMax = extracted.max;
          salaryCurrency = extracted.currency;
        }
      }

      const jobUrl = item.url || `https://jobicy.com/jobs/${item.id}`;

      allJobs.push({
        sourceExternalId: String(item.id),
        title: item.jobTitle.trim(),
        company: (item.companyName || "Remote Employer").trim(),
        location: item.jobGeo || "Worldwide Remote",
        remoteStatus: "REMOTE",
        salaryMin,
        salaryMax,
        salaryCurrency: salaryCurrency || "USD",
        description,
        url: jobUrl,
        postedAt,
        metadata: {
          jobIndustry: item.jobIndustry,
          jobType: item.jobType,
          jobLevel: item.jobLevel,
        },
      });
    }

    const currentPage = source.lastCursor ? parseInt(source.lastCursor, 10) || 1 : 1;
    const nextCursor = String(currentPage + 1);

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: items.length >= count,
    };
  }
}
