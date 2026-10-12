import { readMinutes, slugify, wordCount } from "@gartha/db";
import { describe, expect, it } from "vitest";
import { deleteSql, parsePost, slugFromPath, upsertSql } from "../scripts/post-lib";

const source = `---
title: "It's a post: really"
description: Short and sweet
date: 2026-10-12
category: builds
---

Hello **world**.
`;

describe("parsePost", () => {
  it("reads frontmatter and body", () => {
    const { meta, body } = parsePost(source);
    expect(meta).toEqual({
      title: "It's a post: really",
      description: "Short and sweet",
      date: "2026-10-12",
      category: "builds",
      featured: false,
      draft: false,
    });
    expect(body).toBe("Hello **world**.\n");
  });

  it("rejects a bad category or date", () => {
    expect(() => parsePost(source.replace("builds", "cooking"))).toThrow(/category/);
    expect(() => parsePost(source.replace("2026-10-12", "Oct 12"))).toThrow(/date/);
  });
});

describe("upsertSql", () => {
  it("quotes values safely and upserts on slug", () => {
    const sql = upsertSql(
      {
        ...parsePost(source).meta,
        slug: "a-post",
        bodyMd: "one two three",
        bodyHtml: "<p>it's</p>",
      },
      new Date("2026-10-12T00:00:00Z"),
    );
    expect(sql).toContain("'It''s a post: really'");
    expect(sql).toContain("'<p>it''s</p>'");
    expect(sql).toContain("ON CONFLICT(slug) DO UPDATE SET");
    expect(sql).toContain(", 3, 1,");
  });

  it("builds a delete", () =>
    expect(deleteSql("o'k")).toBe("DELETE FROM posts WHERE slug = 'o''k';\n"));
});

describe("post helpers", () => {
  it("slugs file names and titles", () => {
    expect(slugFromPath("drafts/My New Post.md")).toBe("my-new-post");
    expect(slugify("Ça va? Yes!")).toBe("ca-va-yes");
  });
  it("counts words and minutes", () => {
    expect(wordCount("  a b\nc ")).toBe(3);
    expect(readMinutes("a")).toBe(1);
    expect(readMinutes(Array(401).fill("w").join(" "))).toBe(3);
  });
});
