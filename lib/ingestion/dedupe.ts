import { createHash } from "node:crypto";

export interface DedupeInput {
  company: string;
  title: string;
  url?: string | null;
}

/**
 * Normalizes text to lowercased alphanumeric tokens separated by single spaces.
 */
export function normalizeAlphanumericTokens(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Strips tracking parameters, hashes, www prefixes, and trailing slashes to produce a canonical URL identity.
 */
export function normalizeCanonicalUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const url = new URL(rawUrl.trim());
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }

    let pathname = url.pathname.toLowerCase().replace(/\/+$/, "");
    if (!pathname) {
      pathname = "";
    }

    return `${host}${pathname}`;
  } catch {
    return "";
  }
}

/**
 * Computes a deterministic SHA-256 deduplication key from company, role title, and canonical URL.
 */
export function generateDedupeKey(input: DedupeInput): string {
  const companyTokens = normalizeAlphanumericTokens(input.company);
  const titleTokens = normalizeAlphanumericTokens(input.title);
  const canonicalUrl = normalizeCanonicalUrl(input.url);

  const payload = `${companyTokens}|${titleTokens}|${canonicalUrl}`;
  return createHash("sha256").update(payload).digest("hex");
}
