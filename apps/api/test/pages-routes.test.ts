import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

async function seed() {
  await env.DB.exec("DELETE FROM posts");
  const insert = env.DB.prepare(
    `INSERT INTO posts (slug, title, description, date, category, featured, draft, body_md, body_html, words, minutes, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, '2026-10-12T00:00:00Z')`,
  );
  await env.DB.batch([
    insert.bind(
      "older",
      "Older post",
      "the first one",
      "2026-09-01",
      "code",
      0,
      "x",
      "<p>older body</p>",
      300,
      2,
    ),
    insert.bind(
      "newer",
      "Newer <post>",
      "the second one",
      "2026-10-01",
      "builds",
      0,
      "x",
      "<p>newer body</p>",
      900,
      5,
    ),
    insert.bind(
      "secret",
      "Draft post",
      "not yet",
      "2026-10-05",
      "code",
      1,
      "x",
      "<p>draft</p>",
      10,
      1,
    ),
  ]);
}

describe("pages rendered from D1", () => {
  beforeEach(seed);

  it("lists published posts on /blog/, newest first, without drafts", async () => {
    const res = await SELF.fetch("http://gartha.me/blog/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.indexOf("Newer &lt;post&gt;")).toBeGreaterThan(-1);
    expect(html.indexOf("Newer &lt;post&gt;")).toBeLessThan(html.indexOf("Older post"));
    expect(html).not.toContain("Draft post");
    expect(html).not.toContain("__ROW_");
    expect(html).not.toContain('data-tpl="row"');
  });

  it("renders a post with its body, meta and neighbours", async () => {
    const res = await SELF.fetch("http://gartha.me/blog/older/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<p>older body</p>");
    expect(html).toContain("<title>Older post · gartha.me</title>");
    expect(html).toContain('href="https://gartha.me/blog/older/"');
    expect(html).toContain('href="/blog/newer/"');
    expect(html).not.toMatch(/__[A-Z_]+__/);
  });

  it("404s for drafts, unknown slugs and the raw template", async () => {
    for (const path of ["/blog/secret/", "/blog/nope/", "/templates/post/"]) {
      const res = await SELF.fetch(`http://gartha.me${path}`);
      expect(res.status, path).toBe(404);
    }
  });

  it("adds the trailing slash", async () => {
    const res = await SELF.fetch("http://gartha.me/blog/older", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("/blog/older/");
  });

  it("fills the latest note and counts on the home page", async () => {
    const html = await (await SELF.fetch("http://gartha.me/")).text();
    expect(html).toContain('href="/blog/newer/"');
    expect(html).toContain("2 posts · 1.2k words · 7 min of reading · last written 2026-10-01");
  });

  it("shows recent notes on /about/", async () => {
    const html = await (await SELF.fetch("http://gartha.me/about/")).text();
    expect(html).toContain("Newer &lt;post&gt;");
    expect(html).toContain("Older post");
  });
});
