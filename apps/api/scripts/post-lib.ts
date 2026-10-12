// Pure helpers for scripts/posts.ts, kept separate so they can be tested.
import { POST_CATEGORIES, type PostCategory, readMinutes, slugify, wordCount } from "@gartha/db";

export type PostMeta = {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: PostCategory;
  featured: boolean;
  draft: boolean;
};

export type PostInput = PostMeta & { slug: string; bodyMd: string; bodyHtml: string };

/**
 * Splits a markdown file into its frontmatter and body. Supports the simple
 * `key: value` frontmatter used here: strings (optionally quoted), booleans
 * and dates.
 */
export function parsePost(source: string): { meta: PostMeta; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!m) throw new Error("missing frontmatter (--- ... ---) at the top of the file");
  const fields: Record<string, string> = {};
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) throw new Error(`bad frontmatter line: ${line}`);
    let value = line.slice(i + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    fields[line.slice(0, i).trim()] = value;
  }
  const need = (k: string) => {
    const v = fields[k];
    if (!v) throw new Error(`frontmatter is missing "${k}"`);
    return v;
  };
  const date = need("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, got "${date}"`);
  const category = need("category");
  if (!(POST_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`category must be one of ${POST_CATEGORIES.join(", ")}, got "${category}"`);
  }
  return {
    meta: {
      title: need("title"),
      description: need("description"),
      date,
      category: category as PostCategory,
      featured: fields.featured === "true",
      draft: fields.draft === "true",
    },
    body: (m[2] ?? "").replace(/^\s+/, ""),
  };
}

/** The slug a file publishes under: its name without the extension. */
export function slugFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return slugify(base.replace(/\.(md|markdown)$/i, ""));
}

const sql = (v: string) => `'${v.replaceAll("'", "''")}'`;

/** One statement that inserts the post, or replaces it if the slug exists. */
export function upsertSql(post: PostInput, now = new Date()): string {
  const words = wordCount(post.bodyMd);
  const row: [string, string][] = [
    ["slug", sql(post.slug)],
    ["title", sql(post.title)],
    ["description", sql(post.description)],
    ["date", sql(post.date)],
    ["category", sql(post.category)],
    ["featured", post.featured ? "1" : "0"],
    ["draft", post.draft ? "1" : "0"],
    ["body_md", sql(post.bodyMd)],
    ["body_html", sql(post.bodyHtml)],
    ["words", String(words)],
    ["minutes", String(readMinutes(post.bodyMd))],
    ["updated_at", sql(now.toISOString())],
  ];
  const cols = row.map(([c]) => c);
  const updates = cols.filter((c) => c !== "slug").map((c) => `${c} = excluded.${c}`);
  return `INSERT INTO posts (${cols.join(", ")}) VALUES (${row.map(([, v]) => v).join(", ")})
ON CONFLICT(slug) DO UPDATE SET ${updates.join(", ")};
`;
}

export function deleteSql(slug: string): string {
  return `DELETE FROM posts WHERE slug = ${sql(slug)};\n`;
}
