import type { FeedSourceType } from "../../../types/feed-source";
import type { FeedAdapter } from "./types";
import { AshbyAdapter } from "./ashby";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { HimalayasAdapter } from "./himalayas";
import { RemoteOKAdapter } from "./remoteok";
import { JobicyAdapter } from "./jobicy";
import { HackerNewsAdapter } from "./hn";
import { HiringCafeAdapter } from "./hiringcafe";
import { WeWorkRemotelyAdapter } from "./wwr";
import { WellfoundAdapter } from "./wellfound";
import { IndeedRssAdapter } from "./indeed";

export * from "./types";
export * from "./ashby";
export * from "./greenhouse";
export * from "./lever";
export * from "./himalayas";
export * from "./remoteok";
export * from "./jobicy";
export * from "./hn";
export * from "./hiringcafe";
export * from "./wwr";
export * from "./wellfound";
export * from "./indeed";

const ADAPTER_REGISTRY = new Map<string, FeedAdapter>([
  ["ASHBY", new AshbyAdapter()],
  ["GREENHOUSE", new GreenhouseAdapter()],
  ["LEVER", new LeverAdapter()],
  ["HIMALAYAS", new HimalayasAdapter()],
  ["REMOTEOK", new RemoteOKAdapter()],
  ["JOBICY", new JobicyAdapter()],
  ["HN", new HackerNewsAdapter()],
  ["HIRINGCAFE", new HiringCafeAdapter()],
  ["WWR", new WeWorkRemotelyAdapter()],
  ["WELLFOUND", new WellfoundAdapter()],
  ["INDEED", new IndeedRssAdapter()],
]);

export function getFeedAdapter(sourceType: FeedSourceType | string): FeedAdapter {
  const upperType = (sourceType || "").toUpperCase().trim();
  const adapter = ADAPTER_REGISTRY.get(upperType);

  if (!adapter) {
    throw new Error(`No FeedAdapter registered for source type: '${sourceType}'`);
  }

  return adapter;
}

export function getAllRegisteredAdapters(): FeedAdapter[] {
  return Array.from(ADAPTER_REGISTRY.values());
}
