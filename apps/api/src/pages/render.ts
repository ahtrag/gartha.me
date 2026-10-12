// Fills the page templates Astro builds (apps/web) with posts from D1.
//
// Templates mark the dynamic parts with:
//   __NAME__                      a value, HTML-escaped on the way in
//   <!--@rows-->                  where a list of post rows goes
//   <template data-tpl="row">…    the markup for one row (__ROW_*__ values)
//   <!--@body-->                  the post's pre-rendered HTML
//   <!--@if:x-->A<!--@else:x-->B<!--@endif:x-->   kept or dropped as a block
import type { Post } from "@gartha/db";

export type PostSummary = Pick<
  Post,
  "slug" | "title" | "description" | "date" | "category" | "minutes"
>;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Replaces each __KEY__ with its escaped value. Unknown placeholders are left alone. */
export function fill(html: string, values: Record<string, string | number>): string {
  return html.replace(/__([A-Z][A-Z0-9_]*?)__/g, (all, key: string) =>
    key in values ? escapeHtml(String(values[key])) : all,
  );
}

/** Keeps or drops an `<!--@if:name-->` block, honouring an optional `<!--@else:name-->`. */
export function toggle(html: string, name: string, show: boolean): string {
  const re = new RegExp(
    `<!--@if:${name}-->([\\s\\S]*?)(?:<!--@else:${name}-->([\\s\\S]*?))?<!--@endif:${name}-->`,
    "g",
  );
  return html.replace(re, (_, yes: string, no?: string) => (show ? yes : (no ?? "")));
}

const ROW_TEMPLATE = /<template data-tpl="row">([\s\S]*?)<\/template>/;

/** Renders one row per post into <!--@rows--> using the page's row template, then drops the template. */
export function fillRows(html: string, posts: PostSummary[]): string {
  const tpl = ROW_TEMPLATE.exec(html)?.[1] ?? "";
  const rows = posts
    .map((p, i) =>
      fill(tpl, {
        ROW_SLUG: p.slug,
        ROW_TITLE: p.title,
        ROW_DESC: p.description,
        ROW_DATE: p.date,
        ROW_CAT: p.category,
        ROW_MIN: p.minutes,
        ROW_I: i,
      }),
    )
    .join("");
  return html.replace(ROW_TEMPLATE, "").replace("<!--@rows-->", () => rows);
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function renderHome(
  html: string,
  stats: { posts: number; words: number; minutes: number },
  latest: PostSummary | undefined,
): string {
  const facts = [
    `${stats.posts} posts`,
    `${compact(stats.words)} words`,
    `${stats.minutes} min of reading`,
    ...(latest ? [`last written ${latest.date}`] : []),
  ].join(" · ");
  return fill(toggle(html, "latest", Boolean(latest)), {
    FACTS: facts,
    LATEST_SLUG: latest?.slug ?? "",
    LATEST_TITLE: latest?.title ?? "",
  });
}

export function renderList(html: string, posts: PostSummary[], block?: string): string {
  const shown = block ? toggle(html, block, posts.length > 0) : html;
  return fillRows(shown, posts);
}

export function renderPost(
  html: string,
  post: Post,
  neighbours: { prev?: PostSummary; next?: PostSummary },
  origin: string,
): string {
  const url = `${origin}/blog/${post.slug}/`;
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url,
    author: { "@type": "Person", name: "Gartha", url: origin },
    image: `${origin}/og.png`,
  });
  let out = toggle(html, "prev", Boolean(neighbours.prev));
  out = toggle(out, "next", Boolean(neighbours.next));
  out = fill(out, {
    POST_SLUG: post.slug,
    POST_TITLE: post.title,
    POST_DESC: post.description,
    POST_DATE: post.date,
    POST_CAT: post.category,
    POST_MIN: post.minutes,
    PREV_SLUG: neighbours.prev?.slug ?? "",
    PREV_TITLE: neighbours.prev?.title ?? "",
    NEXT_SLUG: neighbours.next?.slug ?? "",
    NEXT_TITLE: neighbours.next?.title ?? "",
  });
  // JSON-LD sits inside <script>, so it is escaped for that context, not as HTML.
  out = out.replace("__POST_LD__", () => ld.replaceAll("<", "\\u003c"));
  // The body is trusted HTML rendered at publish time; inserted last so its
  // text is never treated as placeholders.
  return out.replace("<!--@body-->", () => post.bodyHtml);
}
