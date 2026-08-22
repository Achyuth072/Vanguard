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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function extractXmlTagValue(xmlBlock: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = regex.exec(xmlBlock);
  if (!match || !match[1]) return "";
  let val = match[1].trim();
  if (val.startsWith("<![CDATA[") && val.endsWith("]]>")) {
    val = val.substring(9, val.length - 3).trim();
  }
  return decodeHtmlEntities(val);
}

function parseIndeedTitleAndCompany(
  rawTitle: string,
  sourceTagValue: string
): { title: string; company: string; location?: string } {
  const cleanTitle = decodeHtmlEntities(rawTitle).trim();
  let company = sourceTagValue ? decodeHtmlEntities(sourceTagValue).trim() : "";
  let title = cleanTitle;
  let location: string | undefined = undefined;

  if (cleanTitle.includes(" - ")) {
    const parts = cleanTitle.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      // e.g. "Senior Platform Engineer - Datadog - Remote"
      title = parts[0];
      if (!company) company = parts[1];
      location = parts.slice(2).join(" - ");
    } else if (parts.length === 2) {
      // e.g. "Senior Platform Engineer - Datadog"
      title = parts[0];
      if (!company) company = parts[1];
    }
  } else if (cleanTitle.includes(" at ")) {
    const atMatch = /\s+at\s+/i.exec(cleanTitle);
    if (atMatch) {
      title = cleanTitle.substring(0, atMatch.index).trim();
      const afterAt = cleanTitle.substring(atMatch.index + atMatch[0].length).trim();
      if (!company) company = afterAt;
    }
  } else if (cleanTitle.includes(": ")) {
    const parts = cleanTitle.split(": ");
    if (!company) company = parts[0].trim();
    title = parts.slice(1).join(": ").trim();
  }

  if (!company) {
    company = "Indeed Employer";
  }

  return { title, company, location };
}

function extractIndeedJobKey(link: string, guid: string): string {
  if (guid && !guid.startsWith("http")) {
    return guid.trim();
  }

  const targetUrl = link || guid;
  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const jk = parsed.searchParams.get("jk");
      if (jk) return jk;
    } catch {
      // Ignore URL parsing errors for non-standard links
    }
  }

  return guid || link || `indeed-${Math.random().toString(36).substring(2, 10)}`;
}

export class IndeedRssAdapter implements FeedAdapter {
  readonly sourceType = "INDEED";

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

    let targetUrl = source.url && source.url.includes("indeed.com")
      ? source.url
      : "https://www.indeed.com/rss?q=software+engineer&l=Remote";

    if (config.categories && config.categories.length > 0 && !source.url) {
      const q = encodeURIComponent(config.categories.join(" "));
      targetUrl = `https://www.indeed.com/rss?q=${q}&l=Remote`;
    }

    const response = await fetchFn(targetUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "PulseCareerBot/1.0 (Indeed RSS Ingestion)",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Indeed RSS feed request failed (${response.status} ${response.statusText})`);
    }

    const xmlText = await response.text();
    const itemBlocks: string[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      if (match[1]) itemBlocks.push(match[1]);
    }

    const allJobs: RawFeedJob[] = [];

    for (const block of itemBlocks) {
      const rawTitle = extractXmlTagValue(block, "title");
      const link = extractXmlTagValue(block, "link");
      const guid = extractXmlTagValue(block, "guid");
      const sourceTag = extractXmlTagValue(block, "source");
      const pubDateStr = extractXmlTagValue(block, "pubDate");
      const rawDescription = extractXmlTagValue(block, "description");

      if (!rawTitle) continue;

      const { title, company, location: parsedLoc } = parseIndeedTitleAndCompany(rawTitle, sourceTag);
      const sourceExternalId = extractIndeedJobKey(link, guid);
      const url = link || guid || targetUrl;
      const description = extractTextFromHtml(rawDescription);

      let location = parsedLoc || "Remote";
      if (!parsedLoc) {
        if (/remote/i.test(description) || /remote/i.test(rawTitle)) {
          location = "Remote";
        }
      }

      let remoteStatus: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "REMOTE";
      if (/remote/i.test(location) || /remote/i.test(description) || /remote/i.test(rawTitle)) {
        remoteStatus = "REMOTE";
      } else if (/hybrid/i.test(location) || /hybrid/i.test(description)) {
        remoteStatus = "HYBRID";
      } else if (/onsite|office|in-office/i.test(location) || /onsite|in-office/i.test(description)) {
        remoteStatus = "ONSITE";
      }

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      let salaryCurrency: string | null = null;

      const extractedSalary = extractSalaryFromRawText(description);
      if (extractedSalary) {
        salaryMin = extractedSalary.min;
        salaryMax = extractedSalary.max;
        salaryCurrency = extractedSalary.currency;
      }

      let postedAt: Date | null = null;
      if (pubDateStr) {
        const d = new Date(pubDateStr);
        if (!isNaN(d.getTime())) postedAt = d;
      }

      allJobs.push({
        sourceExternalId,
        title,
        company,
        location,
        remoteStatus,
        salaryMin,
        salaryMax,
        salaryCurrency: salaryCurrency || "USD",
        description,
        url,
        postedAt,
      });
    }

    return {
      jobs: allJobs,
      nextCursor: "",
      hasMore: false,
    };
  }
}
