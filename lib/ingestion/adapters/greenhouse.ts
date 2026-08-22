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

interface GreenhouseJobResponse {
  jobs?: GreenhouseJobItem[];
}

interface GreenhouseJobItem {
  id: number | string;
  internal_job_id?: number | string;
  title: string;
  updated_at?: string;
  requisition_id?: string;
  absolute_url?: string;
  location?: {
    name?: string;
  };
  departments?: Array<{ id: number | string; name: string }>;
  offices?: Array<{ id: number | string; name: string; location?: string }>;
  content?: string;
  metadata?: Array<{
    id?: number | string;
    name?: string;
    value?: unknown;
    value_type?: string;
  }>;
}

function formatCompanyName(slug: string): string {
  if (!slug) return "Greenhouse Board";
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Decodes escaped HTML entities that Greenhouse sometimes returns (e.g. &lt;p&gt;).
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export class GreenhouseAdapter implements FeedAdapter {
  readonly sourceType = "GREENHOUSE";

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
    let newestUpdatedAt = source.lastCursor ? new Date(source.lastCursor).getTime() : 0;

    for (const slug of boardSlugs) {
      const baseUrl = source.url && source.url.includes("boards-api.greenhouse.io")
        ? source.url.replace(/\/+$/, "")
        : "https://boards-api.greenhouse.io/v1/boards";

      let endpoint = `${baseUrl}/${encodeURIComponent(slug)}/jobs?content=true`;
      if (source.lastCursor) {
        endpoint += `&updated_after=${encodeURIComponent(source.lastCursor)}`;
      }

      const response = await fetchFn(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PulseCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Greenhouse API request failed for board '${slug}' (${response.status} ${response.statusText})`);
      }

      const data = (await response.json()) as GreenhouseJobResponse;
      const jobItems = Array.isArray(data.jobs) ? data.jobs : [];

      for (const item of jobItems) {
        if (!item.id || !item.title) continue;

        const updatedDate = item.updated_at ? new Date(item.updated_at) : null;
        const updatedTimestamp = updatedDate ? updatedDate.getTime() : 0;

        if (source.lastCursor && updatedTimestamp > 0) {
          const lastCursorTimestamp = new Date(source.lastCursor).getTime();
          if (updatedTimestamp <= lastCursorTimestamp) {
            continue;
          }
        }

        if (updatedTimestamp > newestUpdatedAt) {
          newestUpdatedAt = updatedTimestamp;
        }

        // Clean HTML content
        const rawContent = item.content ? decodeHtmlEntities(item.content) : "";
        const description = extractTextFromHtml(rawContent);

        // Location & Remote Classification
        const locationName = item.location?.name || "";
        const { remoteStatus } = classifyRemoteAndLocation(`${item.title} ${locationName} ${description.slice(0, 300)}`);

        // Extract Salary from metadata or description
        let salaryMin: number | null = null;
        let salaryMax: number | null = null;
        let salaryCurrency: string | null = null;

        if (Array.isArray(item.metadata)) {
          for (const meta of item.metadata) {
            const nameLower = (meta.name || "").toLowerCase();
            if (nameLower.includes("salary min") && typeof meta.value === "string") {
              const val = parseFloat(meta.value);
              if (!isNaN(val)) salaryMin = val;
            } else if (nameLower.includes("salary max") && typeof meta.value === "string") {
              const val = parseFloat(meta.value);
              if (!isNaN(val)) salaryMax = val;
            } else if (nameLower.includes("salary") && typeof meta.value === "string") {
              const extracted = extractSalaryFromRawText(meta.value);
              if (extracted) {
                salaryMin = extracted.min;
                salaryMax = extracted.max;
                salaryCurrency = extracted.currency;
              }
            }
          }
        }

        if (salaryMin === null && salaryMax === null) {
          const extractedFromText = extractSalaryFromRawText(description);
          if (extractedFromText) {
            salaryMin = extractedFromText.min;
            salaryMax = extractedFromText.max;
            salaryCurrency = extractedFromText.currency;
          }
        }

        const jobUrl = item.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${item.id}`;

        allJobs.push({
          sourceExternalId: String(item.id),
          title: item.title.trim(),
          company: formatCompanyName(slug),
          location: locationName || (remoteStatus === "REMOTE" ? "Remote" : undefined),
          remoteStatus,
          salaryMin,
          salaryMax,
          salaryCurrency: salaryCurrency || "USD",
          description,
          url: jobUrl,
          postedAt: updatedDate,
          metadata: {
            boardSlug: slug,
            internalJobId: item.internal_job_id,
            requisitionId: item.requisition_id,
            departments: item.departments,
            offices: item.offices,
          },
        });
      }
    }

    const nextCursor = newestUpdatedAt > 0 ? new Date(newestUpdatedAt).toISOString() : source.lastCursor;

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: false,
    };
  }
}
