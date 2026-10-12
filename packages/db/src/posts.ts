export const POST_CATEGORIES = ["code", "games", "builds"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

/** Counts raw markdown tokens (whitespace-separated), not rendered/prose words. */
export function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

/** Reading time at 200 words a minute, never less than one minute. */
export function readMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(wordCount(markdown) / 200));
}

/** A URL-safe slug: lowercase words joined by hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
