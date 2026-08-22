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
import {
  preFilterRawText,
  classifyRemoteAndLocation,
  extractSalaryFromRawText,
  type PreFilterCandidateCriteria,
} from "../../filters/prefilter";

interface AlgoliaHit {
  objectID: string;
  created_at_i: number;
  created_at?: string;
  author?: string;
  comment_text?: string;
  story_id?: number;
  story_title?: string;
  story_url?: string;
}

interface AlgoliaSearchResponse {
  hits?: AlgoliaHit[];
  nbHits?: number;
  page?: number;
  nbPages?: number;
  hitsPerPage?: number;
}

interface StoryHit {
  objectID: string;
  title: string;
  created_at_i: number;
}

interface StorySearchResponse {
  hits?: StoryHit[];
}

/**
 * Parses header line (e.g. "Company | Title | Location | Remote | Salary") into structured components.
 */
function parseHnHeaderLine(headerLine: string): {
  company: string;
  title: string;
  location?: string;
} {
  // Normalize pipe and dash separators
  const parts = headerLine
    .split(/\s*\|\s*|\s+–\s+|\s+—\s+/)
    .map((p) => p.trim().replace(/^[-–—]\s*/, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    // Clean company (strip URLs e.g. "Supabase (https://supabase.com)")
    const company = parts[0].replace(/\s*\([^)]*https?:\/\/[^)]*\)/gi, "").trim();
    const title = parts[1].trim();
    const location = parts.slice(2).join(" | ");

    return {
      company: company || "HN Poster",
      title: title || "Software Engineer",
      location: location || undefined,
    };
  }

  // Fallback: Check slash delimiter "Company / Title / Location"
  const slashParts = headerLine.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    return {
      company: slashParts[0].replace(/\s*\([^)]*https?:\/\/[^)]*\)/gi, "").trim() || "HN Poster",
      title: slashParts[1].trim() || "Software Engineer",
      location: slashParts.slice(2).join(" / ") || undefined,
    };
  }

  return {
    company: "HN Poster",
    title: headerLine.slice(0, 80).trim(),
  };
}

export class HackerNewsAdapter implements FeedAdapter {
  readonly sourceType = "HN";

  validateConfig(config: FeedSourceConfig | Record<string, unknown>): boolean {
    return Boolean(config && typeof config === "object");
  }

  async poll(
    source: FeedSource,
    candidate?: PreFilterCandidateCriteria | unknown,
    options?: AdapterPollOptions
  ): Promise<FeedPollResult> {
    const fetchFn = options?.fetchFn ?? fetch;
    const config = parseFeedSourceConfig(source.config);

    const baseApiUrl = source.url && source.url.includes("hn.algolia.com")
      ? source.url.replace(/\/+$/, "")
      : "https://hn.algolia.com/api/v1";

    // 1. Determine Story ID
    let storyId = config.searchStoryId;
    if (!storyId) {
      // Look up latest "Ask HN: Who is hiring?" story
      const storySearchUrl = `${baseApiUrl}/search?query=${encodeURIComponent(
        config.searchStoryPrefix || "Ask HN: Who is hiring"
      )}&tags=story&hitsPerPage=1`;

      const storyRes = await fetchFn(storySearchUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PulseCareerBot/1.0",
        },
        signal: options?.abortSignal,
      });

      if (!storyRes.ok) {
        throw new Error(`Failed to find latest HN Who is Hiring story (${storyRes.status} ${storyRes.statusText})`);
      }

      const storyData = (await storyRes.json()) as StorySearchResponse;
      if (storyData.hits && storyData.hits.length > 0 && storyData.hits[0].objectID) {
        storyId = parseInt(storyData.hits[0].objectID, 10);
      }
    }

    if (!storyId) {
      throw new Error("Could not resolve Hacker News story ID for 'Ask HN: Who is hiring?'");
    }

    // 2. Fetch comments for story
    let commentsUrl = `${baseApiUrl}/search_by_date?tags=comment,story_${storyId}&hitsPerPage=100`;

    const lastCursorNum = source.lastCursor ? parseInt(source.lastCursor, 10) : 0;
    if (lastCursorNum > 0) {
      commentsUrl += `&numericFilters=created_at_i%3E${lastCursorNum}`;
    }

    const commentsRes = await fetchFn(commentsUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PulseCareerBot/1.0",
      },
      signal: options?.abortSignal,
    });

    if (!commentsRes.ok) {
      throw new Error(`Failed to fetch comments for HN story ${storyId} (${commentsRes.status} ${commentsRes.statusText})`);
    }

    const commentsData = (await commentsRes.json()) as AlgoliaSearchResponse;
    const hits = Array.isArray(commentsData.hits) ? commentsData.hits : [];
    const allJobs: RawFeedJob[] = [];
    let newestCreatedAtI = lastCursorNum;

    for (const hit of hits) {
      if (!hit.objectID || !hit.comment_text) continue;

      if (hit.created_at_i > newestCreatedAtI) {
        newestCreatedAtI = hit.created_at_i;
      }

      // If lastCursor is set and hit is older or equal, skip
      if (lastCursorNum > 0 && hit.created_at_i <= lastCursorNum) {
        continue;
      }

      const rawText = extractTextFromHtml(hit.comment_text);
      if (!rawText || rawText.trim().length < 20) continue;

      // Execute zero-AI 6-dimension pre-filter if candidate criteria provided
      let filterPassed = true;
      let detectedRoles: string[] = [];
      let detectedSkills: string[] = [];

      if (candidate && typeof candidate === "object") {
        const preFilterResult = preFilterRawText(rawText, candidate as PreFilterCandidateCriteria);
        filterPassed = preFilterResult.passed;
        detectedRoles = preFilterResult.extractedMetadata.detectedRoles;
        detectedSkills = preFilterResult.extractedMetadata.detectedSkills;

        if (!filterPassed) {
          // Pre-filter rejected comment
          continue;
        }
      }

      // Parse Header Line
      const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || rawText.slice(0, 100);
      const headerParsed = parseHnHeaderLine(firstLine);

      // Determine Title
      let title = headerParsed.title;
      if ((!title || title.length > 80 || title === "Software Engineer") && detectedRoles.length > 0) {
        title = detectedRoles[0];
      }

      // Company
      let company = headerParsed.company;
      if (company === "HN Poster" && hit.author) {
        company = hit.author;
      }

      // Location & Remote
      const { remoteStatus, detectedLocations } = classifyRemoteAndLocation(rawText);
      const location = headerParsed.location || (detectedLocations.length > 0 ? detectedLocations.join(", ") : undefined);

      // Salary
      const salaryInfo = extractSalaryFromRawText(rawText);

      allJobs.push({
        sourceExternalId: String(hit.objectID),
        title: title.trim(),
        company: company.trim(),
        location: location || (remoteStatus === "REMOTE" ? "Remote" : undefined),
        remoteStatus,
        salaryMin: salaryInfo?.min ?? null,
        salaryMax: salaryInfo?.max ?? null,
        salaryCurrency: salaryInfo?.currency ?? null,
        description: rawText,
        rawText,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        postedAt: new Date(hit.created_at_i * 1000),
        metadata: {
          storyId,
          author: hit.author,
          detectedSkills,
          detectedRoles,
        },
      });
    }

    const nextCursor = newestCreatedAtI > 0 ? String(newestCreatedAtI) : source.lastCursor;

    return {
      jobs: allJobs,
      nextCursor,
      hasMore: hits.length >= 100,
    };
  }
}
