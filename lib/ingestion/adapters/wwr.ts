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

function parseWwrTitle(rawTitle: string): { title: string; company: string } {
  const clean = rawTitle.trim();

  if (clean.includes(":")) {
    const parts = clean.split(":");
    const company = parts[0].trim();
    const title = parts.slice(1).join(":").trim();
    if (company && title) {
      return { company, title };
    }
  }

  const atMatch = /\s+at\s+/i.exec(clean);
  if (atMatch) {
    const title = clean.substring(0, atMatch.index).trim();
    const company = clean.substring(atMatch.index + atMatch[0].length).trim();
    if (title && company) {
      return { title, company };
    }
  }

  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    const company = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    if (company && title) {
      return { company, title };
    }
  }

  return { title: clean, company: "We Work Remotely Employer" };
}

export class WeWorkRemotelyAdapter implements FeedAdapter {
  readonly sourceType = "WWR";

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

    const baseUrl = source.url && source.url.includes("weworkremotely.com")
      ? source.url
      : "https://weworkremotely.com/categories/remote-programming-jobs.rss";

    const response = await fetchFn(baseUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "PulseCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`We Work Remotely RSS request failed (${response.status} ${response.statusText})`);
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
      const pubDateStr = extractXmlTagValue(block, "pubDate");
      const rawDescription = extractXmlTagValue(block, "description");

      if (!rawTitle) continue;

      const { title, company } = parseWwrTitle(rawTitle);
      const url = link || guid || baseUrl;
      const sourceExternalId = guid || link || `wwr-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const description = extractTextFromHtml(rawDescription);

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
        location: "Worldwide Remote",
        remoteStatus: "REMOTE",
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
