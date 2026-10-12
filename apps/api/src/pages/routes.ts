// Pages that show posts are rendered per request from D1, so a new post is
// live as soon as it is published (scripts/posts.ts), with no build.
import { type Post, createDb, posts } from "@gartha/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../env";
import { type PostSummary, renderHome, renderList, renderPost } from "./render";

const summary = {
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  date: posts.date,
  category: posts.category,
  minutes: posts.minutes,
};
const published = eq(posts.draft, false);
const newest = [desc(posts.date), desc(posts.slug)] as const;

// Matches the headers apps/web/public/_headers gives static pages.
const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

async function template(env: Env, reqUrl: string, path: string): Promise<string> {
  const res = await env.ASSETS.fetch(new Request(new URL(path, reqUrl)));
  if (!res.ok) throw new Error(`template ${path} returned ${res.status}`);
  return res.text();
}

async function notFound(env: Env, reqUrl: string) {
  const res = await env.ASSETS.fetch(new Request(new URL("/404.html", reqUrl)));
  return new Response(await res.text(), { status: 404, headers: HEADERS });
}

export const pages = new Hono<{ Bindings: Env }>();

// Canonical URLs end in a slash, as the static pages always have.
for (const path of ["/blog", "/about"]) {
  pages.get(path, (c) => c.redirect(`${path}/`, 301));
}
// The raw templates also exist as files; send those paths to the real pages.
pages.get("/index.html", (c) => c.redirect("/", 301));
pages.get("/about/index.html", (c) => c.redirect("/about/", 301));
pages.get("/blog/index.html", (c) => c.redirect("/blog/", 301));
pages.get("/blog/:slug{[^/]+}", (c) => c.redirect(`/blog/${c.req.param("slug")}/`, 301));

pages.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const [stats, latest, html] = await Promise.all([
    db
      .select({
        posts: sql<number>`count(*)`,
        words: sql<number>`coalesce(sum(${posts.words}), 0)`,
        minutes: sql<number>`coalesce(sum(${posts.minutes}), 0)`,
      })
      .from(posts)
      .where(published),
    db
      .select(summary)
      .from(posts)
      .where(published)
      .orderBy(...newest)
      .limit(1),
    template(c.env, c.req.url, "/"),
  ]);
  const s = stats[0] ?? { posts: 0, words: 0, minutes: 0 };
  return c.body(renderHome(html, s, latest[0]), 200, HEADERS);
});

pages.get("/blog/", async (c) => {
  const db = createDb(c.env.DB);
  const [rows, html] = await Promise.all([
    db
      .select(summary)
      .from(posts)
      .where(published)
      .orderBy(...newest),
    template(c.env, c.req.url, "/blog/"),
  ]);
  return c.body(renderList(html, rows), 200, HEADERS);
});

pages.get("/about/", async (c) => {
  const db = createDb(c.env.DB);
  const [rows, html] = await Promise.all([
    db
      .select(summary)
      .from(posts)
      .where(published)
      .orderBy(...newest)
      .limit(2),
    template(c.env, c.req.url, "/about/"),
  ]);
  return c.body(renderList(html, rows, "recent"), 200, HEADERS);
});

pages.get("/blog/:slug/", async (c) => {
  const db = createDb(c.env.DB);
  const slug = c.req.param("slug");
  const found = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), published))
    .limit(1);
  const post: Post | undefined = found[0];
  if (!post) return notFound(c.env, c.req.url);

  // In a newest-first list, "previous" is the older neighbour and "next" the newer one.
  const all: PostSummary[] = await db
    .select(summary)
    .from(posts)
    .where(published)
    .orderBy(...newest);
  const i = all.findIndex((p) => p.slug === slug);
  const html = await template(c.env, c.req.url, "/templates/post/");
  const origin = new URL(c.req.url).origin;
  return c.body(
    renderPost(html, post, { prev: all[i + 1], next: i > 0 ? all[i - 1] : undefined }, origin),
    200,
    HEADERS,
  );
});

// The post template is an internal building block, not a page.
pages.get("/templates/*", (c) => notFound(c.env, c.req.url));
