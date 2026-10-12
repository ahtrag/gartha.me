import { spawnSync } from "node:child_process";
// Manage blog posts in D1. Posts are rendered from markdown once, here, and
// stored as HTML, so publishing needs no build or deploy.
//
//   bun run posts publish <file.md> [--remote] [--slug my-slug]
//   bun run posts delete <slug> [--remote]
//   bun run posts list [--remote]
//
// Without --remote these act on the local dev database (wrangler --local).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugify } from "@gartha/db";
import { Marked, type Tokens } from "marked";
import { bundledLanguages, codeToHtml } from "shiki";
import { deleteSql, parsePost, slugFromPath, upsertSql } from "./post-lib";

const API_DIR = join(import.meta.dir, "..");
const args = process.argv.slice(2);
const remote = args.includes("--remote");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--slug"));
const [command, target] = positional;

function d1(extra: string[]): string {
  const res = spawnSync(
    "bunx",
    ["wrangler", "d1", "execute", "gartha-me", remote ? "--remote" : "--local", "--yes", ...extra],
    { cwd: API_DIR, encoding: "utf8" },
  );
  if (res.status !== 0) {
    process.stderr.write(res.stdout + res.stderr);
    process.exit(res.status ?? 1);
  }
  return res.stdout;
}

function runSql(statement: string) {
  const dir = mkdtempSync(join(tmpdir(), "posts-"));
  const file = join(dir, "post.sql");
  writeFileSync(file, statement);
  try {
    d1(["--file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Markdown to HTML: GitHub-flavoured, headings get ids, code is highlighted like the old Astro build. */
async function render(markdown: string): Promise<string> {
  const ids = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    async: true,
    async walkTokens(token) {
      if (token.type !== "code") return;
      const code = token as Tokens.Code & { html?: string };
      const lang = (code.lang ?? "").split(/\s/)[0] ?? "";
      code.html = await codeToHtml(code.text, {
        lang: lang in bundledLanguages ? lang : "text",
        theme: "github-dark",
      });
    },
    renderer: {
      code(token) {
        return (token as Tokens.Code & { html?: string }).html ?? false;
      },
      heading({ tokens, depth, text }) {
        const base = slugify(text) || "section";
        const n = ids.get(base) ?? 0;
        ids.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  return marked.parse(markdown) as Promise<string>;
}

async function publish(file: string) {
  const { meta, body } = parsePost(readFileSync(file, "utf8"));
  const slug = flag("--slug") ?? slugFromPath(file);
  const bodyHtml = await render(body);
  runSql(upsertSql({ ...meta, slug, bodyMd: body, bodyHtml }));
  const where = remote ? "https://gartha.me" : "the local database";
  console.log(
    `published "${meta.title}" to ${where}${meta.draft ? " as a draft" : ""}: /blog/${slug}/`,
  );
}

switch (command) {
  case "publish":
    if (!target) throw new Error("usage: posts publish <file.md> [--remote] [--slug my-slug]");
    await publish(target);
    break;
  case "delete":
    if (!target) throw new Error("usage: posts delete <slug> [--remote]");
    runSql(deleteSql(target));
    console.log(`deleted /blog/${target}/ from ${remote ? "gartha.me" : "the local database"}`);
    break;
  case "list":
    process.stdout.write(
      d1(["--command", "SELECT slug, date, draft, title FROM posts ORDER BY date DESC, slug"]),
    );
    break;
  default:
    console.log("usage: bun run posts <publish|delete|list> ...  (see scripts/posts.ts)");
    process.exit(command ? 1 : 0);
}
