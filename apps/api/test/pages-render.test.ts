import { describe, expect, it } from "vitest";
import { escapeHtml, fill, fillRows, renderHome, toggle } from "../src/pages/render";

const row = (slug: string, title = slug) => ({
  slug,
  title,
  description: `about ${slug}`,
  date: "2026-10-12",
  category: "code" as const,
  minutes: 4,
});

describe("fill", () => {
  it("replaces known placeholders with escaped values and leaves the rest", () => {
    expect(fill("<h1>__T__</h1>__OTHER__", { T: `<b>"x" & y</b>` })).toBe(
      "<h1>&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;</h1>__OTHER__",
    );
  });

  it("does not treat lowercase dunder words as placeholders", () => {
    expect(fill("__init__", { init: "no" })).toBe("__init__");
  });
});

describe("toggle", () => {
  const html = "a<!--@if:x-->YES<!--@else:x-->NO<!--@endif:x-->b";
  it("keeps the if branch when shown", () => expect(toggle(html, "x", true)).toBe("aYESb"));
  it("keeps the else branch when hidden", () => expect(toggle(html, "x", false)).toBe("aNOb"));
  it("drops a block without else when hidden", () => {
    expect(toggle("a<!--@if:y-->Y<!--@endif:y-->b", "y", false)).toBe("ab");
  });
});

describe("fillRows", () => {
  it("renders a row per post from the template and removes the template", () => {
    const html =
      '<ul><!--@rows--></ul><template data-tpl="row"><li data-i="__ROW_I__">__ROW_TITLE__</li></template>';
    expect(fillRows(html, [row("a", "A & B"), row("b")])).toBe(
      '<ul><li data-i="0">A &amp; B</li><li data-i="1">b</li></ul>',
    );
  });
});

describe("renderHome", () => {
  const html =
    "<!--@if:latest--><a href=/blog/__LATEST_SLUG__/>__LATEST_TITLE__</a><!--@endif:latest--><p>__FACTS__</p>";
  it("shows the latest note and the counts", () => {
    expect(renderHome(html, { posts: 3, words: 2400, minutes: 13 }, row("new", "New"))).toBe(
      "<a href=/blog/new/>New</a><p>3 posts · 2.4k words · 13 min of reading · last written 2026-10-12</p>",
    );
  });
  it("hides the latest note when there are no posts", () => {
    expect(renderHome(html, { posts: 0, words: 0, minutes: 0 }, undefined)).toBe(
      "<p>0 posts · 0 words · 0 min of reading</p>",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes quotes for attributes", () => expect(escapeHtml(`'"`)).toBe("&#39;&quot;"));
});
