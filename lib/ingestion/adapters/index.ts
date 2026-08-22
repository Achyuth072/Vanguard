import type { FeedSourceType } from "../../../types/feed-source";
import type { FeedAdapter } from "./types";
import { AshbyAdapter } from "./ashby";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { HimalayasAdapter } from "./himalayas";
import { RemoteOKAdapter } from "./remoteok";
import { JobicyAdapter } from "./jobicy";
import { HackerNewsAdapter } from "./hn";

export * from "./types";
export * from "./ashby";
export * from "./greenhouse";
export * from "./lever";
export * from "./himalayas";
export * from "./remoteok";
export * from "./jobicy";
export * from "./hn";

const ADAPTER_REGISTRY = new Map<string, FeedAdapter>([
  ["ASHBY", new AshbyAdapter()],
  ["GREENHOUSE", new GreenhouseAdapter()],
  ["LEVER", new LeverAdapter()],
  ["HIMALAYAS", new HimalayasAdapter()],
  ["REMOTEOK", new RemoteOKAdapter()],
  ["JOBICY", new JobicyAdapter()],
  ["HN", new HackerNewsAdapter()],
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
