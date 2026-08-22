import { z } from "zod";

export const FeedSourceTypeSchema = z.enum([
  "ASHBY",
  "GREENHOUSE",
  "LEVER",
  "HN",
  "HIMALAYAS",
  "REMOTEOK",
  "JOBICY",
  "WELLFOUND",
  "YC",
  "HIRINGCAFE",
  "WWR",
  "INDEED",
  "MANUAL",
]);

export type FeedSourceType = z.infer<typeof FeedSourceTypeSchema>;

export const FeedSourceConfigSchema = z.object({
  boardSlugs: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  industry: z.string().optional(),
  count: z.number().int().positive().optional(),
  searchStoryPrefix: z.string().optional(),
  searchStoryId: z.number().int().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export type FeedSourceConfig = z.infer<typeof FeedSourceConfigSchema>;

export const FeedSourceSchema = z.object({
  id: z.string().default(uuidv4Placeholder),
  name: z.string().min(1),
  type: FeedSourceTypeSchema,
  url: z.string().default(""),
  config: z.string().default("{}"),
  enabled: z.boolean().default(true),
  autoPoll: z.boolean().default(false),
  lastPolledAt: z.date().nullable().optional(),
  lastCursor: z.string().default(""),
  nextPollAt: z.date().nullable().optional(),
  pollIntervalMs: z.number().int().default(14400000), // 4 hours
  consecutiveEmpty: z.number().int().default(0),
  jobsDiscovered: z.number().int().default(0),
  jobsPassed: z.number().int().default(0),
  errorCount: z.number().int().default(0),
  lastError: z.string().default(""),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

function uuidv4Placeholder(): string {
  return "fs-" + Math.random().toString(36).substring(2, 10);
}

export type FeedSource = z.infer<typeof FeedSourceSchema>;
export type FeedSourceInput = z.input<typeof FeedSourceSchema>;

export interface RawFeedJob {
  sourceExternalId: string;
  title: string;
  company: string;
  location?: string;
  remoteStatus?: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  url: string;
  postedAt?: Date | null;
  rawText?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedPollResult {
  jobs: RawFeedJob[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface BaselineFeedSourceDefinition {
  id: string;
  name: string;
  type: FeedSourceType;
  url: string;
  config: FeedSourceConfig;
  enabled: boolean;
  autoPoll: boolean;
  pollIntervalMs: number;
}

export const DEFAULT_BASELINE_FEED_SOURCES: BaselineFeedSourceDefinition[] = [
  {
    id: "feed-source-ashby",
    name: "Ashby Boards",
    type: "ASHBY",
    url: "https://api.ashbyhq.com/posting-api/job-board",
    config: {
      boardSlugs: ["anthropic", "openai", "perplexity", "ramp", "replit", "cursor"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 14400000, // 4 hours
  },
  {
    id: "feed-source-greenhouse",
    name: "Greenhouse Boards",
    type: "GREENHOUSE",
    url: "https://boards-api.greenhouse.io/v1/boards",
    config: {
      boardSlugs: ["stripe", "figma", "vercel", "datadog", "airbnb", "uber", "coinbase"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 14400000, // 4 hours
  },
  {
    id: "feed-source-lever",
    name: "Lever Boards",
    type: "LEVER",
    url: "https://api.lever.co/v0/postings",
    config: {
      boardSlugs: ["palantir", "netflix", "affirm", "postman", "spotify"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 14400000, // 4 hours
  },
  {
    id: "feed-source-himalayas",
    name: "Himalayas Remote",
    type: "HIMALAYAS",
    url: "https://himalayas.app/jobs/api",
    config: {
      categories: ["software-development", "engineering"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-remoteok",
    name: "RemoteOK",
    type: "REMOTEOK",
    url: "https://remoteok.com/api",
    config: {
      tags: ["dev", "engineer", "fullstack", "frontend", "backend"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-jobicy",
    name: "Jobicy Remote",
    type: "JOBICY",
    url: "https://jobicy.com/api/v2/remote-jobs",
    config: {
      industry: "engineering",
      count: 50,
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-hn",
    name: "Hacker News Hiring",
    type: "HN",
    url: "https://hn.algolia.com/api/v1",
    config: {
      searchStoryPrefix: "Ask HN: Who is hiring?",
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 86400000, // 24 hours
  },
  {
    id: "feed-source-hiringcafe",
    name: "HiringCafe",
    type: "HIRINGCAFE",
    url: "https://hiring.cafe/api/search",
    config: {
      tags: ["software-engineer", "fullstack", "frontend", "backend"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-wwr",
    name: "We Work Remotely",
    type: "WWR",
    url: "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    config: {
      categories: ["remote-programming-jobs"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-wellfound",
    name: "Wellfound (AngelList)",
    type: "WELLFOUND",
    url: "https://wellfound.com/api/v1/jobs",
    config: {
      tags: ["software-engineer", "fullstack", "frontend", "backend", "ai"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
  {
    id: "feed-source-indeed",
    name: "Indeed RSS",
    type: "INDEED",
    url: "https://www.indeed.com/rss?q=software+engineer&l=Remote",
    config: {
      categories: ["software-engineer", "remote"],
    },
    enabled: true,
    autoPoll: false,
    pollIntervalMs: 21600000, // 6 hours
  },
];
