# gartha.me Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship gartha.me on Cloudflare's free tier: a static Astro site (home, blog, post), an admin page showing a daily report, and one Worker that serves the site, the API, and a daily cron job.

**Architecture:** pnpm + Turborepo monorepo. `apps/web` is Astro with static output. `apps/api` is a Hono Worker that serves `apps/web/dist` through the assets binding, exposes `/api/*`, and runs `scheduled()`. `packages/db` holds the D1 schema and migrations. `packages/ui` holds shared Astro components and design tokens. Cloudflare Access gates `/admin` and `/api/admin`.

**Tech Stack:** TypeScript, pnpm 9, Turborepo 2, Biome, Astro 5, Hono 4, Drizzle ORM, Cloudflare Workers + D1 + Assets, Wrangler 4, Vitest with `@cloudflare/vitest-pool-workers`, jose for JWT verification.

**Spec:** `docs/superpowers/specs/2026-09-07-gartha-me-site-design.md`

**Conventions used throughout:**
- Run every command from the repo root unless a step says otherwise.
- Commit messages are imperative, lower-case prefix (`feat:`, `test:`, `chore:`), and end with the Co-Authored-By and Claude-Session trailers already configured for this session.
- Library versions below are the latest majors known at planning time. If `pnpm add` resolves a newer major, read that package's changelog before continuing.

---

## File structure

```
gartha.me/
  package.json                 pnpm workspace root, scripts
  pnpm-workspace.yaml
  turbo.json
  biome.json
  tsconfig.base.json
  .github/workflows/ci.yml
  packages/
    db/
      package.json
      drizzle.config.ts
      src/schema.ts            Drizzle table definitions
      src/index.ts             createDb(d1) + Report/JobRun types
      migrations/0001_init.sql
    ui/
      package.json
      src/tokens.css
      src/Character.astro
      src/Avatar.astro
      src/Badge.astro
      src/Card.astro
      src/Button.astro
      src/StatRow.astro
      src/CategoryChip.astro
      src/index.ts             re-exports
  apps/
    api/
      package.json
      wrangler.toml
      tsconfig.json
      vitest.config.ts
      src/index.ts             fetch + scheduled entry
      src/app.ts               Hono app factory
      src/env.ts               Env bindings type
      src/routes/health.ts
      src/routes/admin.ts
      src/middleware/access.ts Cloudflare Access JWT check
      src/jobs/daily-report.ts runDailyReport + ReportProducer
      src/jobs/stub-producer.ts
      test/health.test.ts
      test/daily-report.test.ts
      test/admin-routes.test.ts
      test/access.test.ts
    web/
      package.json
      astro.config.mjs
      tsconfig.json
      src/content.config.ts
      src/content/blog/*.md
      src/data/profile.ts
      src/lib/posts.ts         sorting, read time, prev/next
      src/layouts/Site.astro
      src/pages/index.astro
      src/pages/blog/index.astro
      src/pages/blog/[slug].astro
      src/pages/admin/index.astro
      src/scripts/admin.ts     client fetch for the admin page
      test/posts.test.ts
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.nvmrc`

- [ ] **Step 1: Confirm toolchain**

Run: `node -v && corepack enable && corepack prepare pnpm@9 --activate && pnpm -v`
Expected: Node 22 or newer, pnpm 9.x.

- [ ] **Step 2: Write root package.json**

```json
{
  "name": "gartha.me",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "deploy": "pnpm build && pnpm --filter @gartha/api exec wrangler deploy"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Write pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Write turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 5: Write biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "files": { "ignore": ["**/dist/**", "**/.wrangler/**", "**/.turbo/**", "design/**", "**/.astro/**"] }
}
```

- [ ] **Step 6: Write tsconfig.base.json and .nvmrc**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

`.nvmrc`:
```
22
```

- [ ] **Step 7: Install and verify**

Run: `pnpm install && pnpm lint`
Expected: install succeeds; Biome reports no errors (there is nothing to lint yet).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json biome.json tsconfig.base.json .nvmrc
git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

### Task 2: packages/db schema and migration

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/schema.ts`, `packages/db/src/index.ts`, `packages/db/migrations/0001_init.sql`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@gartha/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate"
  },
  "dependencies": {
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["@cloudflare/workers-types"], "noEmit": true },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Write src/schema.ts**

```ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reports = sqliteTable("reports", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  generatedAt: text("generated_at").notNull(),
  emailsRead: integer("emails_read").notNull(),
  needsReply: integer("needs_reply").notNull(),
  billsDue: integer("bills_due").notNull(),
  archived: integer("archived").notNull(),
  summary: text("summary").notNull(),
  items: text("items").notNull(), // JSON ReportItem[]
});

export const jobRuns = sqliteTable("job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status", { enum: ["running", "ok", "failed"] }).notNull(),
  error: text("error"),
  trigger: text("trigger", { enum: ["cron", "manual"] }).notNull(),
});
```

- [ ] **Step 4: Write src/index.ts**

```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export * from "./schema";

export type ReportItem = {
  kind: "reply" | "bill" | "info";
  title: string;
  note: string;
  priority: "high" | "normal" | "low";
};

export type Report = {
  date: string;
  generatedAt: string;
  emailsRead: number;
  needsReply: number;
  billsDue: number;
  archived: number;
  summary: string;
  items: ReportItem[];
};

export type JobRun = typeof schema.jobRuns.$inferSelect;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Convert a stored row (items as JSON text) into a Report. */
export function rowToReport(row: typeof schema.reports.$inferSelect): Report {
  return { ...row, items: JSON.parse(row.items) as ReportItem[] };
}
```

- [ ] **Step 5: Write drizzle.config.ts**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
```

- [ ] **Step 6: Write migrations/0001_init.sql by hand**

Hand-written so the file is readable and applies with `wrangler d1 migrations apply`, which expects plain SQL in this folder.

```sql
CREATE TABLE reports (
  date         TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  emails_read  INTEGER NOT NULL,
  needs_reply  INTEGER NOT NULL,
  bills_due    INTEGER NOT NULL,
  archived     INTEGER NOT NULL,
  summary      TEXT NOT NULL,
  items        TEXT NOT NULL
);

CREATE TABLE job_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL CHECK (status IN ('running','ok','failed')),
  error       TEXT,
  trigger     TEXT NOT NULL CHECK (trigger IN ('cron','manual'))
);

CREATE INDEX job_runs_started_at ON job_runs (started_at DESC);
```

- [ ] **Step 7: Install and typecheck**

Run: `pnpm install && pnpm --filter @gartha/db typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): add reports and job_runs schema with initial migration"
```

---

### Task 3: apps/api skeleton with health route and asset fallback

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/wrangler.toml`, `apps/api/vitest.config.ts`, `apps/api/src/env.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/routes/health.ts`, `apps/api/test/health.test.ts`, `apps/api/public/index.html` (placeholder until Astro builds)

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@gartha/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "deploy": "wrangler deploy",
    "migrate:local": "wrangler d1 migrations apply gartha-me --local",
    "migrate:remote": "wrangler d1 migrations apply gartha-me --remote"
  },
  "dependencies": {
    "@gartha/db": "workspace:*",
    "hono": "^4.6.0",
    "jose": "^5.9.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.6.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "noEmit": true,
    "lib": ["ES2022"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **Step 3: Write wrangler.toml**

The `account_id` is the personal account from the spec. The D1 `database_id` is filled in Task 13 after the database is created; the placeholder keeps local dev working.

```toml
name = "gartha-me"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
account_id = "c8aa9726eeee38e3701009e0acd38071"

[assets]
directory = "../web/dist"
binding = "ASSETS"
not_found_handling = "404-page"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "gartha-me"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "../../packages/db/migrations"

[triggers]
crons = ["0 22 * * *"]

[vars]
ACCESS_TEAM_DOMAIN = ""
ACCESS_AUD = ""

[observability]
enabled = true
```

- [ ] **Step 4: Write vitest.config.ts**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          bindings: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
        },
      },
    },
  },
});
```

- [ ] **Step 5: Write src/env.ts**

```ts
export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
};
```

- [ ] **Step 6: Write the failing health test**

`apps/api/test/health.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns ok with a timestamp", async () => {
    const res = await SELF.fetch("http://gartha.me/api/health");
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; time: string }>();
    expect(body.ok).toBe(true);
    expect(new Date(body.time).toString()).not.toBe("Invalid Date");
  });
});
```

- [ ] **Step 7: Install, then run the test to see it fail**

Run: `pnpm install && pnpm --filter @gartha/api test`
Expected: FAIL, the Worker entry does not exist yet.

- [ ] **Step 8: Write src/routes/health.ts**

```ts
import { Hono } from "hono";
import type { Env } from "../env";

export const health = new Hono<{ Bindings: Env }>();

health.get("/", (c) => c.json({ ok: true, time: new Date().toISOString() }));
```

- [ ] **Step 9: Write src/app.ts**

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { health } from "./routes/health";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/health", health);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "not found" }, 404);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
```

- [ ] **Step 10: Write src/index.ts**

```ts
import { createApp } from "./app";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch: app.fetch,
  // scheduled handler is added in Task 7
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 11: Create a placeholder asset directory**

Wrangler refuses to start if the assets directory is missing. Until Astro builds, create it:

Run: `mkdir -p apps/web/dist && echo '<h1>placeholder</h1>' > apps/web/dist/index.html`

(`apps/web/dist` is git-ignored, so this never gets committed.)

- [ ] **Step 12: Run the test to see it pass**

Run: `pnpm --filter @gartha/api test`
Expected: PASS, 1 test.

- [ ] **Step 13: Smoke-test dev server**

Run: `pnpm --filter @gartha/api dev` in one terminal, then `curl -s localhost:8787/api/health` and `curl -s localhost:8787/`.
Expected: JSON with `ok: true`; the placeholder HTML. Stop the dev server.

- [ ] **Step 14: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): hono worker skeleton with health route and asset fallback"
```

---

### Task 4: Daily report job with stub producer

**Files:**
- Create: `apps/api/src/jobs/daily-report.ts`, `apps/api/src/jobs/stub-producer.ts`, `apps/api/test/daily-report.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/api/test/daily-report.test.ts`:
```ts
import { env } from "cloudflare:test";
import { createDb, jobRuns, reports } from "@gartha/db";
import { desc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { type ReportProducer, runDailyReport } from "../src/jobs/daily-report";
import { stubProducer } from "../src/jobs/stub-producer";

const NOW = new Date("2026-09-07T22:00:00Z");

async function resetDb() {
  await env.DB.exec("DELETE FROM reports; DELETE FROM job_runs;");
}

describe("runDailyReport", () => {
  beforeEach(resetDb);

  it("writes a report for the date and records an ok run", async () => {
    const db = createDb(env.DB);
    const report = await runDailyReport({ db, now: NOW, trigger: "cron", producer: stubProducer });

    expect(report.date).toBe("2026-09-07");
    expect(report.summary).toContain("not yet connected");

    const stored = await db.select().from(reports);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.date).toBe("2026-09-07");

    const runs = await db.select().from(jobRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("ok");
    expect(runs[0]?.trigger).toBe("cron");
    expect(runs[0]?.finishedAt).not.toBeNull();
  });

  it("replaces a same-day report instead of duplicating it", async () => {
    const db = createDb(env.DB);
    await runDailyReport({ db, now: NOW, trigger: "cron", producer: stubProducer });
    const second: ReportProducer = async () => ({
      emailsRead: 99, needsReply: 1, billsDue: 0, archived: 98,
      summary: "second run", items: [],
    });
    await runDailyReport({ db, now: NOW, trigger: "manual", producer: second });

    const stored = await db.select().from(reports);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.summary).toBe("second run");
    expect(stored[0]?.emailsRead).toBe(99);
  });

  it("records a failed run and keeps the old report when the producer throws", async () => {
    const db = createDb(env.DB);
    await runDailyReport({ db, now: NOW, trigger: "cron", producer: stubProducer });
    const boom: ReportProducer = async () => { throw new Error("upstream down"); };

    await expect(
      runDailyReport({ db, now: NOW, trigger: "manual", producer: boom }),
    ).rejects.toThrow("upstream down");

    const stored = await db.select().from(reports);
    expect(stored[0]?.summary).toContain("not yet connected");

    const runs = await db.select().from(jobRuns).orderBy(desc(jobRuns.id));
    expect(runs[0]?.status).toBe("failed");
    expect(runs[0]?.error).toBe("upstream down");
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm --filter @gartha/api test daily-report`
Expected: FAIL, modules not found.

Note: the test pool applies D1 migrations only if told to. Add `drizzle-orm` as a dependency of the api package, and add this to `vitest.config.ts` under `poolOptions.workers`:

```ts
setupFiles: ["./test/setup.ts"],
```

and create `apps/api/test/setup.ts`:
```ts
import { env } from "cloudflare:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll } from "vitest";

beforeAll(async () => {
  const sql = readFileSync(join(__dirname, "../../../packages/db/migrations/0001_init.sql"), "utf8");
  await env.DB.exec(sql.replace(/\n/g, " "));
});
```

If `readFileSync` is unavailable inside the Workers pool, switch to the documented `applyD1Migrations` helper from `cloudflare:test` with `readD1Migrations` in a Node-side `globalSetup`; see https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/ (D1 recipe). Pick whichever runs green, keep one.

Run: `pnpm add -F @gartha/api drizzle-orm@^0.38.0`

- [ ] **Step 3: Write src/jobs/daily-report.ts**

```ts
import { type Db, type Report, type ReportItem, jobRuns, reports, rowToReport } from "@gartha/db";
import { eq } from "drizzle-orm";

export type ProducedReport = Omit<Report, "date" | "generatedAt">;

/** Produces the day's report from whatever source is wired in. */
export type ReportProducer = (now: Date) => Promise<ProducedReport>;

export type RunOptions = {
  db: Db;
  now: Date;
  trigger: "cron" | "manual";
  producer: ReportProducer;
};

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runDailyReport({ db, now, trigger, producer }: RunOptions): Promise<Report> {
  const startedAt = now.toISOString();
  const [run] = await db
    .insert(jobRuns)
    .values({ startedAt, status: "running", trigger })
    .returning({ id: jobRuns.id });
  if (!run) throw new Error("failed to record job run");

  try {
    const produced = await producer(now);
    const date = toDateKey(now);
    const row = {
      date,
      generatedAt: new Date().toISOString(),
      emailsRead: produced.emailsRead,
      needsReply: produced.needsReply,
      billsDue: produced.billsDue,
      archived: produced.archived,
      summary: produced.summary,
      items: JSON.stringify(produced.items satisfies ReportItem[]),
    };
    await db
      .insert(reports)
      .values(row)
      .onConflictDoUpdate({ target: reports.date, set: row });

    await db
      .update(jobRuns)
      .set({ status: "ok", finishedAt: new Date().toISOString() })
      .where(eq(jobRuns.id, run.id));

    return rowToReport(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(jobRuns)
      .set({ status: "failed", error: message, finishedAt: new Date().toISOString() })
      .where(eq(jobRuns.id, run.id));
    throw err;
  }
}
```

- [ ] **Step 4: Write src/jobs/stub-producer.ts**

```ts
import type { ReportProducer } from "./daily-report";

/** Placeholder until the email + Grok producer exists. */
export const stubProducer: ReportProducer = async () => ({
  emailsRead: 0,
  needsReply: 0,
  billsDue: 0,
  archived: 0,
  summary: "Email source not yet connected. This report was generated by the stub producer.",
  items: [],
});
```

- [ ] **Step 5: Run tests to see them pass**

Run: `pnpm --filter @gartha/api test daily-report`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): daily report job with stub producer and run history"
```

---

### Task 5: Admin report routes

**Files:**
- Create: `apps/api/src/routes/admin.ts`, `apps/api/test/admin-routes.test.ts`
- Modify: `apps/api/src/app.ts`

The Access middleware arrives in Task 6. These tests run against the routes without it, so build the admin router as a function that takes an optional middleware list.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/admin-routes.test.ts`:
```ts
import { env } from "cloudflare:test";
import { createDb } from "@gartha/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAdminRouter } from "../src/routes/admin";
import { runDailyReport } from "../src/jobs/daily-report";
import { stubProducer } from "../src/jobs/stub-producer";
import type { Env } from "../src/env";
import { Hono } from "hono";

function testApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/api/admin", createAdminRouter({ guards: [] }));
  return app;
}

async function seed(dates: string[]) {
  const db = createDb(env.DB);
  for (const d of dates) {
    await runDailyReport({ db, now: new Date(`${d}T22:00:00Z`), trigger: "cron", producer: stubProducer });
  }
}

describe("admin report routes", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM reports; DELETE FROM job_runs;");
  });

  it("GET /reports/latest returns the newest report", async () => {
    await seed(["2026-09-05", "2026-09-07", "2026-09-06"]);
    const res = await testApp().request("/api/admin/reports/latest", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ report: { date: string }; runs: unknown[] }>();
    expect(body.report.date).toBe("2026-09-07");
    expect(body.runs.length).toBeGreaterThan(0);
  });

  it("GET /reports/latest is 404 with no reports", async () => {
    const res = await testApp().request("/api/admin/reports/latest", {}, env);
    expect(res.status).toBe(404);
  });

  it("GET /reports/:date returns that date or 404", async () => {
    await seed(["2026-09-06"]);
    const ok = await testApp().request("/api/admin/reports/2026-09-06", {}, env);
    expect(ok.status).toBe(200);
    const missing = await testApp().request("/api/admin/reports/2026-09-01", {}, env);
    expect(missing.status).toBe(404);
    const bad = await testApp().request("/api/admin/reports/nope", {}, env);
    expect(bad.status).toBe(400);
  });

  it("GET /reports lists dates newest first", async () => {
    await seed(["2026-09-05", "2026-09-07"]);
    const res = await testApp().request("/api/admin/reports", {}, env);
    const body = await res.json<{ dates: string[] }>();
    expect(body.dates).toEqual(["2026-09-07", "2026-09-05"]);
  });

  it("POST /reports/run creates today's report with a manual run", async () => {
    const res = await testApp().request("/api/admin/reports/run", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ report: { date: string }; runs: { trigger: string }[] }>();
    expect(body.report.date).toBe(new Date().toISOString().slice(0, 10));
    expect(body.runs[0]?.trigger).toBe("manual");
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm --filter @gartha/api test admin-routes`
Expected: FAIL, `createAdminRouter` not found.

- [ ] **Step 3: Write src/routes/admin.ts**

```ts
import { createDb, jobRuns, reports, rowToReport } from "@gartha/db";
import { desc, eq } from "drizzle-orm";
import { Hono, type MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { runDailyReport } from "../jobs/daily-report";
import { stubProducer } from "../jobs/stub-producer";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RUN_LIMIT = 10;

type Opts = { guards: MiddlewareHandler<{ Bindings: Env }>[] };

export function createAdminRouter({ guards }: Opts) {
  const admin = new Hono<{ Bindings: Env }>();
  for (const g of guards) admin.use("*", g);

  async function recentRuns(db: ReturnType<typeof createDb>) {
    return db.select().from(jobRuns).orderBy(desc(jobRuns.id)).limit(RUN_LIMIT);
  }

  admin.get("/reports", async (c) => {
    const db = createDb(c.env.DB);
    const rows = await db.select({ date: reports.date }).from(reports).orderBy(desc(reports.date));
    return c.json({ dates: rows.map((r) => r.date) });
  });

  admin.get("/reports/latest", async (c) => {
    const db = createDb(c.env.DB);
    const [row] = await db.select().from(reports).orderBy(desc(reports.date)).limit(1);
    if (!row) return c.json({ error: "no reports yet" }, 404);
    return c.json({ report: rowToReport(row), runs: await recentRuns(db) });
  });

  admin.get("/reports/:date", async (c) => {
    const date = c.req.param("date");
    if (!DATE_RE.test(date)) return c.json({ error: "bad date" }, 400);
    const db = createDb(c.env.DB);
    const [row] = await db.select().from(reports).where(eq(reports.date, date)).limit(1);
    if (!row) return c.json({ error: "no report for that date" }, 404);
    return c.json({ report: rowToReport(row), runs: await recentRuns(db) });
  });

  admin.post("/reports/run", async (c) => {
    const db = createDb(c.env.DB);
    const report = await runDailyReport({
      db,
      now: new Date(),
      trigger: "manual",
      producer: stubProducer,
    });
    return c.json({ report, runs: await recentRuns(db) });
  });

  return admin;
}
```

- [ ] **Step 4: Mount it in src/app.ts**

Replace the file with:
```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { createAdminRouter } from "./routes/admin";
import { health } from "./routes/health";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/health", health);
  app.route("/api/admin", createAdminRouter({ guards: [] })); // guard added in Task 6

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "not found" }, 404);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
```

- [ ] **Step 5: Run all api tests**

Run: `pnpm --filter @gartha/api test`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): admin report routes (latest, by date, list, run)"
```

---

### Task 6: Cloudflare Access JWT middleware

**Files:**
- Create: `apps/api/src/middleware/access.ts`, `apps/api/test/access.test.ts`
- Modify: `apps/api/src/app.ts`

Access puts a JWT in the `Cf-Access-Jwt-Assertion` header. Verify it against the team's JWKS at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` with issuer `https://<team>.cloudflareaccess.com` and the application's AUD tag. To keep tests hermetic, the middleware takes a `verify` function so tests can inject one; production uses jose.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/access.test.ts`:
```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { accessGuard, type Verify } from "../src/middleware/access";

const ENV = { ACCESS_TEAM_DOMAIN: "gartha", ACCESS_AUD: "aud123" } as Env;

function appWith(verify: Verify) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", accessGuard({ verify }));
  app.get("/x", (c) => c.text("secret"));
  return app;
}

describe("accessGuard", () => {
  it("401 when the header is missing", async () => {
    const app = appWith(async () => ({ email: "x" }));
    const res = await app.request("/x", {}, ENV);
    expect(res.status).toBe(401);
  });

  it("401 when verification fails", async () => {
    const app = appWith(async () => { throw new Error("bad sig"); });
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "t" } }, ENV);
    expect(res.status).toBe(401);
  });

  it("passes through and exposes the email when valid", async () => {
    let seen: { token: string; team: string; aud: string } | undefined;
    const app = appWith(async (token, team, aud) => { seen = { token, team, aud }; return { email: "me@x" }; });
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "tok" } }, ENV);
    expect(res.status).toBe(200);
    expect(seen).toEqual({ token: "tok", team: "gartha", aud: "aud123" });
  });

  it("503 when Access is not configured", async () => {
    const app = appWith(async () => ({ email: "x" }));
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "tok" } }, { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } as Env);
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm --filter @gartha/api test access`
Expected: FAIL, module not found.

- [ ] **Step 3: Write src/middleware/access.ts**

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

export type Verify = (token: string, team: string, aud: string) => Promise<{ email: string }>;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export const joseVerify: Verify = async (token, team, aud) => {
  const issuer = `https://${team}.cloudflareaccess.com`;
  let jwks = jwksCache.get(team);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(team, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: aud });
  return { email: typeof payload.email === "string" ? payload.email : "" };
};

export function accessGuard({ verify = joseVerify }: { verify?: Verify } = {}): MiddlewareHandler<{
  Bindings: Env;
  Variables: { accessEmail: string };
}> {
  return async (c, next) => {
    const team = c.env.ACCESS_TEAM_DOMAIN;
    const aud = c.env.ACCESS_AUD;
    if (!team || !aud) return c.json({ error: "access not configured" }, 503);

    const token = c.req.header("Cf-Access-Jwt-Assertion");
    if (!token) return c.json({ error: "unauthorized" }, 401);

    try {
      const { email } = await verify(token, team, aud);
      c.set("accessEmail", email);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
```

- [ ] **Step 4: Run tests to see them pass**

Run: `pnpm --filter @gartha/api test access`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the guard into src/app.ts**

Change the admin mount line to:
```ts
import { accessGuard } from "./middleware/access";
// ...
app.route("/api/admin", createAdminRouter({ guards: [accessGuard()] }));
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm --filter @gartha/api test`
Expected: PASS, 13 tests. The admin-routes tests still pass because they build their own router with no guards.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): verify cloudflare access jwt on admin routes"
```

---

### Task 7: Scheduled handler

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/test/scheduled.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/scheduled.test.ts`:
```ts
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createDb, jobRuns } from "@gartha/db";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("scheduled", () => {
  it("runs the daily report with the cron trigger", async () => {
    await env.DB.exec("DELETE FROM reports; DELETE FROM job_runs;");
    const ctx = createExecutionContext();
    const event = { scheduledTime: Date.parse("2026-09-07T22:00:00Z"), cron: "0 22 * * *", noRetry() {} };
    await worker.scheduled(event as ScheduledController, env, ctx);
    await waitOnExecutionContext(ctx);

    const runs = await createDb(env.DB).select().from(jobRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.trigger).toBe("cron");
    expect(runs[0]?.status).toBe("ok");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @gartha/api test scheduled`
Expected: FAIL, `worker.scheduled` is not a function.

- [ ] **Step 3: Add the handler to src/index.ts**

```ts
import { createDb } from "@gartha/db";
import { createApp } from "./app";
import type { Env } from "./env";
import { runDailyReport } from "./jobs/daily-report";
import { stubProducer } from "./jobs/stub-producer";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runDailyReport({
        db: createDb(env.DB),
        now: new Date(controller.scheduledTime),
        trigger: "cron",
        producer: stubProducer,
      }).catch((err) => console.error("daily report failed", err)),
    );
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4: Run to see it pass**

Run: `pnpm --filter @gartha/api test`
Expected: PASS, 14 tests.

- [ ] **Step 5: Try the cron locally**

Run: `pnpm --filter @gartha/api exec wrangler dev --test-scheduled` and in another terminal `curl "localhost:8787/__scheduled?cron=0+22+*+*+*"`.
Expected: the dev log shows the scheduled run; stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): cron-triggered daily report"
```

---

### Task 8: packages/ui tokens and components

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/tokens.css`, `packages/ui/src/Character.astro`, `packages/ui/src/Avatar.astro`, `packages/ui/src/Badge.astro`, `packages/ui/src/Card.astro`, `packages/ui/src/Button.astro`, `packages/ui/src/StatRow.astro`, `packages/ui/src/CategoryChip.astro`, `packages/ui/src/index.ts`, `packages/ui/test/character.test.ts`

Values come straight from `design/Main.dc.html`. Astro components are tested by rendering them with Astro's container API.

- [ ] **Step 1: Write package.json and tsconfig.json**

`package.json`:
```json
{
  "name": "@gartha/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./*.astro": "./src/*.astro"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "astro check"
  },
  "peerDependencies": { "astro": "^5.0.0" },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "astro": "^5.1.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Write src/tokens.css**

```css
:root {
  --font-display: "Baloo 2", "Trebuchet MS", system-ui, sans-serif;
  --font-body: "Nunito", "Trebuchet MS", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", Menlo, monospace;

  --ink: #2f3561;
  --ink-2: #4a5187;
  --muted: #6b72a3;
  --muted-2: #9aa0c7;
  --paper: #ffffff;
  --bg-top: #eef1fc;
  --bg-bottom: #dfe5fa;
  --line: #cdd5f3;
  --track: #c3caf0;

  --blue: #3b5bdb;
  --blue-deep: #2f49b8;
  --green: #2ecc71;
  --green-deep: #1a8a4a;
  --coral: #ff5f6d;
  --orange: #ff8c42;
  --gold: #ffb020;
  --gold-deep: #b26a00;
  --purple: #c86dff;
  --purple-deep: #8a3fc2;
  --skin: #ffcfa8;
  --dark: #1f2447;

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 26px;
  --radius-xl: 28px;

  --shadow-card: 0 8px 0 var(--line);
  --shadow-card-sm: 0 4px 0 var(--line);
  --shadow-primary: 0 7px 0 var(--blue-deep);
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--ink);
  background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
  min-height: 100vh;
}

a { color: var(--blue); text-decoration: none; }
a:hover { color: var(--blue-deep); }
.display { font-family: var(--font-display); }
.mono { font-family: var(--font-mono); }
```

- [ ] **Step 3: Write src/Character.astro**

The `variant` picks hoodie color and the held item. `coder` holds the laptop, `gamer` holds a controller, `builder` holds a terminal card with lines. Paths are lifted from `design/Main.dc.html` and the roster in the second draft.

```astro
---
type Variant = "coder" | "gamer" | "builder";
interface Props { variant?: Variant; size?: number; class?: string }
const { variant = "coder", size = 240, class: cls } = Astro.props;
const hoodie = { coder: "var(--blue)", gamer: "var(--coral)", builder: "var(--gold)" }[variant];
const pocket = { coder: "var(--blue-deep)", gamer: "#d94b58", builder: "#d98a00" }[variant];
const h = Math.round(size * 1.25);
---
<svg width={size} height={h} viewBox="0 0 240 300" fill="none" class={cls} role="img" aria-label={`Gartha, ${variant}`}>
  <ellipse cx="120" cy="288" rx="80" ry="14" fill="var(--track)"></ellipse>
  <rect x="84" y="232" width="30" height="46" rx="12" fill="var(--ink)"></rect>
  <rect x="126" y="232" width="30" height="46" rx="12" fill="var(--ink)"></rect>
  <rect x="78" y="266" width="42" height="18" rx="9" fill="var(--dark)"></rect>
  <rect x="120" y="266" width="42" height="18" rx="9" fill="var(--dark)"></rect>
  <rect x="58" y="134" width="124" height="118" rx="30" fill={hoodie}></rect>
  <rect x="86" y="146" width="68" height="40" rx="14" fill={pocket}></rect>
  <path d="M96 150 h48 v18 h-48z" fill={hoodie}></path>
  <rect x="36" y="150" width="30" height="80" rx="15" fill={hoodie}></rect>
  <rect x="174" y="150" width="30" height="80" rx="15" fill={hoodie}></rect>
  <rect x="40" y="220" width="24" height="22" rx="11" fill="var(--skin)"></rect>
  <rect x="176" y="220" width="24" height="22" rx="11" fill="var(--skin)"></rect>
  {variant === "coder" && (
    <>
      <rect x="66" y="196" width="108" height="66" rx="10" fill="var(--paper)"></rect>
      <rect x="72" y="202" width="96" height="48" rx="6" fill="var(--ink)"></rect>
      <text x="120" y="234" text-anchor="middle" font-family="var(--font-mono)" font-size="20" font-weight="700" fill="var(--green)">&lt;/&gt;</text>
    </>
  )}
  {variant === "gamer" && (
    <>
      <rect x="70" y="200" width="100" height="48" rx="24" fill="var(--ink)"></rect>
      <circle cx="92" cy="224" r="8" fill="var(--paper)"></circle>
      <circle cx="148" cy="218" r="5" fill="var(--green)"></circle>
      <circle cx="158" cy="228" r="5" fill="var(--gold)"></circle>
    </>
  )}
  {variant === "builder" && (
    <>
      <rect x="84" y="196" width="72" height="56" rx="8" fill="var(--ink)"></rect>
      <rect x="94" y="206" width="52" height="8" rx="2" fill="var(--green)"></rect>
      <rect x="94" y="220" width="36" height="8" rx="2" fill="var(--paper)"></rect>
      <rect x="94" y="234" width="44" height="8" rx="2" fill="var(--paper)"></rect>
    </>
  )}
  <rect x="52" y="30" width="136" height="120" rx="36" fill="var(--skin)"></rect>
  <path d="M52 78 C52 40 76 24 120 24 C164 24 188 40 188 78 L188 84 C170 62 150 60 120 62 C90 60 70 62 52 84 Z" fill="var(--ink)"></path>
  <path d="M40 92 C40 46 72 22 120 22 C168 22 200 46 200 92" stroke="var(--dark)" stroke-width="12" stroke-linecap="round"></path>
  <rect x="26" y="80" width="30" height="42" rx="12" fill="var(--purple)"></rect>
  <rect x="184" y="80" width="30" height="42" rx="12" fill="var(--purple)"></rect>
  <rect x="34" y="88" width="14" height="26" rx="7" fill="var(--ink)"></rect>
  <rect x="192" y="88" width="14" height="26" rx="7" fill="var(--ink)"></rect>
  <path d="M198 122 C196 138 172 140 160 140" stroke="var(--dark)" stroke-width="6" stroke-linecap="round"></path>
  <circle cx="158" cy="141" r="6" fill="var(--green)"></circle>
  <rect x="86" y="88" width="14" height="22" rx="7" fill="var(--ink)"></rect>
  <rect x="140" y="88" width="14" height="22" rx="7" fill="var(--ink)"></rect>
  <path d="M108 126 Q120 134 132 126" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"></path>
  <circle cx="78" cy="118" r="7" fill="#ffb0b0" opacity="0.8"></circle>
  <circle cx="162" cy="118" r="7" fill="#ffb0b0" opacity="0.8"></circle>
</svg>
```

- [ ] **Step 4: Write src/Avatar.astro**

```astro
---
interface Props { size?: number }
const { size = 40 } = Astro.props;
---
<span style={`display:inline-flex;width:${size}px;height:${size}px;border-radius:33%;background:var(--skin);overflow:hidden;align-items:flex-end;justify-content:center`}>
  <svg width={size * 0.85} height={size * 0.85} viewBox="20 20 200 140" fill="none" aria-hidden="true">
    <rect x="52" y="30" width="136" height="120" rx="36" fill="var(--skin)"></rect>
    <path d="M52 78 C52 40 76 24 120 24 C164 24 188 40 188 78 L188 84 C170 62 150 60 120 62 C90 60 70 62 52 84 Z" fill="var(--ink)"></path>
    <rect x="86" y="88" width="14" height="22" rx="7" fill="var(--ink)"></rect>
    <rect x="140" y="88" width="14" height="22" rx="7" fill="var(--ink)"></rect>
    <path d="M108 126 Q120 134 132 126" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"></path>
  </svg>
</span>
```

- [ ] **Step 5: Write Badge, Card, Button, StatRow, CategoryChip**

`src/Badge.astro`:
```astro
---
interface Props { color?: string }
const { color = "var(--purple)" } = Astro.props;
---
<span class="display" style={`display:inline-block;padding:6px 16px;background:${color};color:#fff;font-size:15px;font-weight:800;letter-spacing:.08em;clip-path:polygon(10% 0,100% 0,90% 100%,0 100%)`}><slot /></span>
```

`src/Card.astro`:
```astro
---
interface Props { title?: string; tone?: "paper" | "blue" | "dark"; class?: string }
const { title, tone = "paper", class: cls } = Astro.props;
const bg = { paper: "var(--paper)", blue: "var(--blue)", dark: "var(--ink)" }[tone];
const shadow = { paper: "var(--shadow-card)", blue: "0 8px 0 var(--blue-deep)", dark: "0 8px 0 var(--dark)" }[tone];
---
<section class={cls} style={`position:relative;padding:${title ? "42px 26px 24px" : "28px"};border-radius:var(--radius-lg);background:${bg};box-shadow:${shadow}`}>
  {title && <div class="display" style="position:absolute;left:50%;top:-18px;transform:translateX(-50%);padding:8px 32px;border-radius:var(--radius-md);background:var(--bg-top);color:var(--muted);font-size:17px;font-weight:800;letter-spacing:.1em;white-space:nowrap">{title}</div>}
  <slot />
</section>
```

`src/Button.astro`:
```astro
---
interface Props { href: string; kind?: "primary" | "secondary" }
const { href, kind = "primary" } = Astro.props;
const style = kind === "primary"
  ? "background:var(--blue);color:#fff;box-shadow:var(--shadow-primary)"
  : "background:var(--paper);color:var(--blue);box-shadow:0 7px 0 var(--line)";
---
<a href={href} class="display" style={`display:inline-flex;align-items:center;height:64px;padding:0 32px;border-radius:20px;font-size:22px;font-weight:800;${style}`}><slot /></a>
```

`src/StatRow.astro`:
```astro
---
interface Props { label: string; value: string; color: string }
const { label, value, color } = Astro.props;
---
<div style="display:flex;align-items:center;gap:14px">
  <div style={`width:52px;height:52px;border-radius:16px;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0`}><slot /></div>
  <div style="display:flex;flex-direction:column">
    <span class="mono" style="font-size:13px;color:var(--muted);font-weight:700">{label}</span>
    <span class="display" style="font-size:26px;font-weight:800">{value}</span>
  </div>
</div>
```

`src/CategoryChip.astro`:
```astro
---
export type Category = "code" | "games" | "builds";
interface Props { category: Category }
const { category } = Astro.props;
const tone = {
  code: "background:#e6ebff;color:var(--blue)",
  games: "background:#f3e6ff;color:var(--purple-deep)",
  builds: "background:#e3f9ec;color:var(--green-deep)",
}[category];
---
<span class="mono" style={`display:inline-block;padding:4px 12px;border-radius:var(--radius-sm);font-size:13px;font-weight:700;${tone}`}>{category}</span>
```

`src/index.ts`:
```ts
export { default as Character } from "./Character.astro";
export { default as Avatar } from "./Avatar.astro";
export { default as Badge } from "./Badge.astro";
export { default as Card } from "./Card.astro";
export { default as Button } from "./Button.astro";
export { default as StatRow } from "./StatRow.astro";
export { default as CategoryChip } from "./CategoryChip.astro";
```

- [ ] **Step 6: Write the Character render test**

`packages/ui/test/character.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Character from "../src/Character.astro";

describe("Character", () => {
  it.each([
    ["coder", "&lt;/&gt;"],
    ["gamer", 'cx="92"'],
    ["builder", 'width="52" height="8"'],
  ] as const)("renders the %s variant with its held item", async (variant, marker) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Character, { props: { variant } });
    expect(html).toContain("<svg");
    expect(html).toContain(marker);
    expect(html).toContain(`aria-label="Gartha, ${variant}"`);
  });
});
```

Add `packages/ui/vitest.config.ts`:
```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({ test: { include: ["test/**/*.test.ts"] } });
```

- [ ] **Step 7: Install and run**

Run: `pnpm install && pnpm --filter @gartha/ui test`
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): design tokens, svg character, and card components"
```

---

### Task 9: apps/web Astro scaffold, content collection, and post helpers

**Files:**
- Create: `apps/web/package.json`, `apps/web/astro.config.mjs`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/src/content.config.ts`, `apps/web/src/content/blog/*.md` (3 sample posts), `apps/web/src/data/profile.ts`, `apps/web/src/lib/posts.ts`, `apps/web/test/posts.test.ts`, `apps/web/src/layouts/Site.astro`

- [ ] **Step 1: Write package.json, astro.config.mjs, tsconfig.json, vitest.config.ts**

`package.json`:
```json
{
  "name": "@gartha/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "@gartha/ui": "workspace:*",
    "astro": "^5.1.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

`astro.config.mjs`:
```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://gartha.me",
  output: "static",
  markdown: { shikiConfig: { theme: "github-dark" } },
  vite: { server: { proxy: { "/api": "http://localhost:8787" } } },
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src", "test"]
}
```

`vitest.config.ts`:
```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({ test: { include: ["test/**/*.test.ts"] } });
```

- [ ] **Step 2: Write src/content.config.ts**

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(["code", "games", "builds"]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

- [ ] **Step 3: Write three sample posts**

`src/content/blog/cloudflare-workers-side-projects.md`:
```md
---
title: Why I moved my side projects to Cloudflare Workers
description: One account, one deploy, zero servers to babysit.
date: 2026-09-01
category: code
featured: true
---

For years every side project started the same way: pick a VPS, harden it, forget about it, then find out six months later that the box has been unpatched the whole time. I wanted the fun part without the ops part.

## The whole deploy is one file

```toml
name = "gartha-me"
main = "apps/api/src/index.ts"

[assets]
directory = "apps/web/dist"
```

That cron line is the whole scheduler.
```

`src/content/blog/ranked-distributed-system.md`:
```md
---
title: Ranked is just a distributed system with bad retries
description: Latency, tilt, and why your team comp is a load balancer.
date: 2026-08-20
category: games
---

Placeholder body. Replace before launch.
```

`src/content/blog/daily-email-report-bot.md`:
```md
---
title: Building a daily email report bot on a free tier
description: Cron trigger, D1, one Worker.
date: 2026-08-10
category: builds
---

Placeholder body. Replace before launch.
```

- [ ] **Step 4: Write src/data/profile.ts**

```ts
export const profile = {
  name: "Gartha",
  title: "Software Engineer +1",
  level: 7,
  xpPercent: 40,
  stars: 4,
  intro:
    "Ships backend systems by day, grinds ranked lobbies by night. This site is the save file: notes on code, games, and whatever I am building this week.",
  stack: [
    { label: "FRONTEND", value: "TypeScript", glyph: "TS", color: "var(--blue)" },
    { label: "BACKEND", value: "Workers", glyph: "λ", color: "var(--orange)" },
  ],
  stats: [
    { label: "LINES SHIPPED", value: "[N]", color: "var(--coral)" },
    { label: "HOURS PLAYED", value: "[N]", color: "var(--blue)" },
    { label: "COFFEE", value: "[N]", color: "var(--green)" },
    { label: "CURRENT GAME", value: "[GAME]", color: "var(--orange)" },
  ],
  years: "[YEARS]",
  commits: "[COMMITS]",
} as const;
```

- [ ] **Step 5: Write the failing posts test**

`apps/web/test/posts.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { neighbours, readTime, sortNewest } from "../src/lib/posts";

const p = (id: string, date: string, draft = false) => ({ id, data: { date: new Date(date), draft } });

describe("posts helpers", () => {
  it("sortNewest orders by date desc and drops drafts", () => {
    const out = sortNewest([p("a", "2026-01-01"), p("b", "2026-03-01"), p("c", "2026-02-01", true)]);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("readTime rounds up at 200 wpm with a floor of 1", () => {
    expect(readTime("one two three")).toBe(1);
    expect(readTime(Array(401).fill("w").join(" "))).toBe(3);
  });

  it("neighbours returns previous (older) and next (newer)", () => {
    const sorted = sortNewest([p("a", "2026-01-01"), p("b", "2026-02-01"), p("c", "2026-03-01")]);
    expect(neighbours(sorted, "b")).toEqual({ prev: sorted[2], next: sorted[0] });
    expect(neighbours(sorted, "c")).toEqual({ prev: sorted[1], next: undefined });
  });
});
```

- [ ] **Step 6: Run to see it fail**

Run: `pnpm install && pnpm --filter @gartha/web test`
Expected: FAIL, module not found.

- [ ] **Step 7: Write src/lib/posts.ts**

```ts
type Dated = { id: string; data: { date: Date; draft: boolean } };

export function sortNewest<T extends Dated>(posts: T[]): T[] {
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** In a newest-first list, prev is the older neighbour and next is the newer one. */
export function neighbours<T extends Dated>(sorted: T[], id: string): { prev?: T; next?: T } {
  const i = sorted.findIndex((p) => p.id === id);
  return { prev: sorted[i + 1], next: i > 0 ? sorted[i - 1] : undefined };
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 8: Run to see it pass**

Run: `pnpm --filter @gartha/web test`
Expected: PASS, 3 tests.

- [ ] **Step 9: Write src/layouts/Site.astro**

```astro
---
import "@gartha/ui/tokens.css";
interface Props { title: string; active?: "home" | "blog" | "projects"; wide?: boolean }
const { title, active = "home", wide = false } = Astro.props;
const nav = [
  { key: "home", href: "/", label: "Home" },
  { key: "blog", href: "/blog", label: "Blog" },
  { key: "projects", href: "#", label: "Projects", disabled: true },
] as const;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · gartha.me</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" />
    <style>
      .wrap { max-width: 1248px; margin: 0 auto; padding: 0 24px; }
      header { display: flex; align-items: center; justify-content: space-between; padding: 28px 0; gap: 16px; flex-wrap: wrap; }
      .brand { display: flex; align-items: center; gap: 14px; }
      .logo { width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 0 var(--blue-deep); font-size: 18px; font-weight: 700; }
      nav { display: flex; gap: 10px; }
      nav a { height: 48px; padding: 0 22px; border-radius: var(--radius-md); display: flex; align-items: center; font-weight: 700; color: var(--muted); }
      nav a[aria-current="page"] { background: var(--paper); color: var(--blue); font-weight: 800; box-shadow: var(--shadow-card-sm); }
      nav a[aria-disabled="true"] { opacity: .5; pointer-events: none; }
      main { padding-bottom: 64px; }
    </style>
    <slot name="head" />
  </head>
  <body>
    <div class={wide ? "" : "wrap"}>
      <header class={wide ? "wrap" : ""}>
        <a class="brand" href="/">
          <span class="logo mono">&lt;/&gt;</span>
          <span class="display" style="font-size:26px;font-weight:800;color:var(--ink)">gartha.me</span>
        </a>
        <nav>
          {nav.map((n) => (
            <a href={n.href} aria-current={n.key === active ? "page" : undefined} aria-disabled={"disabled" in n ? "true" : undefined}>{n.label}</a>
          ))}
        </nav>
        <slot name="header-right" />
      </header>
      <main><slot /></main>
    </div>
  </body>
</html>
```

- [ ] **Step 10: Build to verify the scaffold compiles**

Create a temporary `src/pages/index.astro` that renders the layout with `<p>hello</p>`, then:

Run: `pnpm --filter @gartha/web build`
Expected: build succeeds, `apps/web/dist/index.html` exists.

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): astro scaffold, blog collection, post helpers, site layout"
```

---

### Task 10: Home page

**Files:**
- Modify: `apps/web/src/pages/index.astro`

Layout mirrors `design/Main.dc.html`: three columns (profile, character, stack + stats) on desktop, stacked on narrow screens. Icons are inline SVG copied from the mockup.

- [ ] **Step 1: Write src/pages/index.astro**

```astro
---
import { getCollection } from "astro:content";
import Site from "../layouts/Site.astro";
import { Badge, Button, Card, Character, StatRow } from "@gartha/ui";
import { profile } from "../data/profile";
import { formatDate, sortNewest } from "../lib/posts";

const posts = sortNewest(await getCollection("blog"));
const latest = posts[0];
const stars = Array.from({ length: 5 }, (_, i) => i < profile.stars);
---
<Site title="Home" active="home">
  <Fragment slot="header-right">
    <div class="pills">
      <span class="pill mono" style="color:var(--gold-deep)"><i style="background:var(--gold)"></i>{posts.length} posts</span>
      <span class="pill mono" style="color:var(--green-deep)"><i style="background:var(--green)"></i>{profile.years} yrs</span>
    </div>
  </Fragment>

  <section class="hero">
    <div class="profile">
      <div><Badge>PLAYABLE</Badge></div>
      <h1 class="display">{profile.name}</h1>
      <p class="title">{profile.title}</p>
      <div class="stars" aria-label={`${profile.stars} of 5 stars`}>
        {stars.map((on) => (
          <svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill={on ? "var(--gold)" : "var(--track)"}></path></svg>
        ))}
      </div>
      <div class="level">
        <span class="display" style="font-size:20px;font-weight:800;color:var(--muted)">LV <b style="font-size:36px;color:var(--ink)">{profile.level}</b></span>
        <div class="bar"><div style={`width:${profile.xpPercent}%`}></div><span class="mono">XP</span></div>
      </div>
      <p class="intro">{profile.intro}</p>
      <hr />
      <div class="ctas">
        <Button href="/blog">Read the blog</Button>
        <Button href="#" kind="secondary">About me</Button>
      </div>
    </div>

    <div class="stage">
      <Character variant="coder" size={304} />
      <div class="plinth"></div>
      <div class="commits mono">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V7l6 4 2-6 2 6 6-4v10z"></path></svg>
        {profile.commits} commits
      </div>
    </div>

    <div class="side">
      <Card title="MAIN STACK">
        <div class="rows">
          {profile.stack.map((s) => (
            <StatRow label={s.label} value={s.value} color={s.color}><span class="mono" style="color:#fff;font-size:16px;font-weight:700">{s.glyph}</span></StatRow>
          ))}
        </div>
      </Card>
      <Card title="STATS">
        <div class="rows">
          {profile.stats.map((s) => (
            <StatRow label={s.label} value={s.value} color={s.color}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L4 14h7l-1 7 9-11h-7z"></path></svg></StatRow>
          ))}
        </div>
      </Card>
    </div>
  </section>

  {latest && (
    <a class="latest" href={`/blog/${latest.id}`}>
      <span class="mono" style="color:var(--muted);font-size:14px;font-weight:700">// latest save</span>
      <span class="chip"><i></i><b>{latest.data.title}</b><span class="mono" style="color:var(--muted);font-size:13px">{formatDate(latest.data.date)}</span></span>
    </a>
  )}
</Site>

<style>
  .pills { display: flex; gap: 12px; }
  .pill { height: 48px; padding: 0 18px 0 8px; border-radius: var(--radius-md); background: var(--paper); display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-card-sm); font-size: 15px; font-weight: 700; }
  .pill i { width: 32px; height: 32px; border-radius: 10px; display: block; }
  .hero { display: grid; grid-template-columns: 400px 1fr 340px; gap: 40px; align-items: start; margin-top: 40px; }
  .profile { display: flex; flex-direction: column; gap: 22px; }
  h1 { margin: 0; font-size: 72px; line-height: 1; font-weight: 800; }
  .title { margin: 0; font-size: 22px; font-weight: 800; color: var(--blue); }
  .stars { display: flex; gap: 6px; }
  .level { display: flex; align-items: center; gap: 14px; }
  .bar { flex: 1; height: 34px; border-radius: 12px; background: var(--track); position: relative; overflow: hidden; }
  .bar div { position: absolute; inset: 0 auto 0 0; background: var(--green); border-radius: 12px; }
  .bar span { position: absolute; left: 50%; top: 7px; font-size: 15px; font-weight: 700; color: #fff; }
  .intro { margin: 0; font-size: 19px; line-height: 1.5; font-weight: 600; color: var(--ink-2); text-wrap: pretty; }
  hr { border: 0; height: 2px; background: #fff; margin: 0; }
  .ctas { display: flex; gap: 14px; flex-wrap: wrap; }
  .stage { display: flex; flex-direction: column; align-items: center; gap: 16px; padding-top: 40px; }
  .plinth { width: 340px; max-width: 100%; height: 44px; border-radius: 22px; background: var(--paper); box-shadow: var(--shadow-card); }
  .commits { display: flex; align-items: center; gap: 10px; padding: 10px 26px; border-radius: 18px; background: var(--paper); box-shadow: 0 5px 0 var(--line); font-size: 22px; font-weight: 700; }
  .side { display: flex; flex-direction: column; gap: 22px; }
  .rows { display: flex; flex-direction: column; gap: 14px; }
  .latest { display: flex; align-items: center; gap: 12px; margin-top: 48px; color: inherit; }
  .chip { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 14px; background: var(--paper); box-shadow: var(--shadow-card-sm); font-size: 15px; }
  .chip i { width: 10px; height: 10px; border-radius: 5px; background: var(--green); }
  @media (max-width: 1100px) { .hero { grid-template-columns: 1fr 1fr; } .side { grid-column: 1 / -1; flex-direction: row; } .side > * { flex: 1; } }
  @media (max-width: 720px) { .hero { grid-template-columns: 1fr; } .side { flex-direction: column; } h1 { font-size: 56px; } .pills { display: none; } }
</style>
```

- [ ] **Step 2: Build and look**

Run: `pnpm --filter @gartha/web build && pnpm --filter @gartha/web preview`
Open http://localhost:4321 and compare with the Home artboard. Check at 375px wide that nothing overflows horizontally. Stop preview.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/index.astro
git commit -m "feat(web): character-select home page"
```

---

### Task 11: Blog list and post pages

**Files:**
- Create: `apps/web/src/pages/blog/index.astro`, `apps/web/src/pages/blog/[slug].astro`, `apps/web/src/components/PostCard.astro`

- [ ] **Step 1: Write src/components/PostCard.astro**

```astro
---
import { CategoryChip } from "@gartha/ui";
import { formatDate, readTime } from "../lib/posts";
import type { CollectionEntry } from "astro:content";
interface Props { post: CollectionEntry<"blog"> }
const { post } = Astro.props;
const mins = readTime(post.body ?? "");
---
<a class="card" href={`/blog/${post.id}`} data-category={post.data.category}>
  <div><CategoryChip category={post.data.category} /></div>
  <h2 class="display">{post.data.title}</h2>
  <p>{post.data.description}</p>
  <div class="meta mono"><span>{formatDate(post.data.date)}</span><span>{mins} min</span></div>
</a>
<style>
  .card { display: flex; flex-direction: column; justify-content: space-between; gap: 18px; padding: 28px; border-radius: var(--radius-xl); background: var(--paper); box-shadow: var(--shadow-card); color: var(--ink); min-height: 230px; box-sizing: border-box; }
  h2 { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 800; text-wrap: pretty; }
  p { margin: 0; font-size: 15px; line-height: 1.5; font-weight: 600; color: var(--muted); }
  .meta { display: flex; gap: 14px; font-size: 13px; font-weight: 700; color: var(--muted-2); }
</style>
```

- [ ] **Step 2: Write src/pages/blog/index.astro**

```astro
---
import { getCollection } from "astro:content";
import Site from "../../layouts/Site.astro";
import PostCard from "../../components/PostCard.astro";
import { Badge, Character } from "@gartha/ui";
import { formatDate, readTime, sortNewest } from "../../lib/posts";

const all = sortNewest(await getCollection("blog"));
const featured = all.find((p) => p.data.featured) ?? all[0];
const rest = all.filter((p) => p !== featured);
const cats = ["all", "code", "games", "builds"] as const;
---
<Site title="Blog" active="blog">
  <div class="head">
    <div><span class="mono" style="font-size:14px;font-weight:700;color:var(--muted)">// quest log</span><h1 class="display">Blog</h1></div>
    <div class="filters" role="tablist">
      {cats.map((c) => <button class="display" role="tab" data-filter={c} aria-selected={c === "all"}>{c[0].toUpperCase() + c.slice(1)}</button>)}
    </div>
  </div>

  <div class="grid">
    {featured && (
      <a class="featured" href={`/blog/${featured.id}`} data-category={featured.data.category}>
        <div class="ftext">
          <div style="display:flex;gap:8px"><Badge color="var(--gold)">FEATURED</Badge><span class="mono tag">{featured.data.category}</span></div>
          <h2 class="display">{featured.data.title}</h2>
          <p>{featured.data.description}</p>
          <div class="meta mono"><span>{formatDate(featured.data.date)}</span><span>{readTime(featured.body ?? "")} min</span></div>
        </div>
        <div class="fchar"><Character variant="builder" size={220} /></div>
      </a>
    )}
    {rest.map((p) => <PostCard post={p} />)}
  </div>
</Site>

<script>
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-filter]");
  const cards = document.querySelectorAll<HTMLElement>("[data-category]");
  for (const b of buttons) {
    b.addEventListener("click", () => {
      const f = b.dataset.filter;
      for (const x of buttons) x.setAttribute("aria-selected", String(x === b));
      for (const c of cards) c.hidden = f !== "all" && c.dataset.category !== f;
    });
  }
</script>

<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 24px; }
  h1 { margin: 0; font-size: 56px; line-height: 1; font-weight: 800; }
  .filters { display: flex; gap: 10px; }
  .filters button { height: 44px; padding: 0 20px; border: 0; border-radius: 14px; background: var(--paper); color: var(--muted); font-size: 16px; font-weight: 800; box-shadow: var(--shadow-card-sm); cursor: pointer; }
  .filters button[aria-selected="true"] { background: var(--blue); color: #fff; box-shadow: 0 4px 0 var(--blue-deep); }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-top: 36px; }
  .featured { grid-column: span 2; display: flex; justify-content: space-between; gap: 24px; padding: 32px; border-radius: var(--radius-xl); background: var(--blue); box-shadow: 0 8px 0 var(--blue-deep); color: #fff; overflow: hidden; min-height: 250px; box-sizing: border-box; }
  .ftext { display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }
  .tag { padding: 4px 12px; border-radius: var(--radius-sm); background: var(--blue-deep); font-size: 13px; font-weight: 700; }
  .featured h2 { margin: 0; font-size: 36px; line-height: 1.1; font-weight: 800; max-width: 520px; text-wrap: pretty; }
  .featured p { margin: 0; font-size: 17px; line-height: 1.5; font-weight: 600; color: var(--bg-bottom); max-width: 520px; }
  .featured .meta { display: flex; gap: 14px; font-size: 14px; font-weight: 700; color: #b9c4f5; }
  .fchar { align-self: flex-end; margin-bottom: -60px; flex-shrink: 0; }
  @media (max-width: 1000px) { .grid { grid-template-columns: 1fr 1fr; } .featured { grid-column: span 2; } .fchar { display: none; } }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .featured { grid-column: span 1; } }
</style>
```

- [ ] **Step 3: Write src/pages/blog/[slug].astro**

```astro
---
import { getCollection, render } from "astro:content";
import Site from "../../layouts/Site.astro";
import { Avatar } from "@gartha/ui";
import { formatDate, neighbours, readTime, sortNewest } from "../../lib/posts";

export async function getStaticPaths() {
  const sorted = sortNewest(await getCollection("blog"));
  return sorted.map((post) => ({ params: { slug: post.id }, props: { post, ...neighbours(sorted, post.id) } }));
}
const { post, prev, next } = Astro.props;
const { Content } = await render(post);
---
<Site title={post.data.title} active="blog">
  <Fragment slot="header-right"><a class="back" href="/blog">← Back to quest log</a></Fragment>
  <article>
    <header class="hd">
      <div style="display:flex;gap:8px"><span class="mono tag">{post.data.category}</span></div>
      <h1 class="display">{post.data.title}</h1>
      <div class="by"><Avatar /><b>Gartha</b><span class="mono">{formatDate(post.data.date)}</span><span class="mono">{readTime(post.body ?? "")} min read</span></div>
    </header>
    <div class="body"><Content /></div>
    <nav class="pn">
      {prev ? <a href={`/blog/${prev.id}`}><small class="mono">PREVIOUS QUEST</small><b>{prev.data.title}</b></a> : <span></span>}
      {next ? <a href={`/blog/${next.id}`} class="r"><small class="mono">NEXT QUEST</small><b>{next.data.title}</b></a> : <span></span>}
    </nav>
  </article>
</Site>

<style>
  .back { height: 48px; padding: 0 20px; border-radius: var(--radius-md); background: var(--paper); display: flex; align-items: center; font-weight: 800; box-shadow: var(--shadow-card-sm); }
  article { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
  .hd { position: relative; padding: 40px 44px; border-radius: var(--radius-xl); background: var(--blue); box-shadow: 0 8px 0 var(--blue-deep); color: #fff; display: flex; flex-direction: column; gap: 18px; overflow: hidden; }
  .tag { padding: 4px 12px; border-radius: var(--radius-sm); background: var(--blue-deep); font-size: 13px; font-weight: 700; }
  h1 { margin: 0; font-size: 46px; line-height: 1.08; font-weight: 800; max-width: 700px; text-wrap: pretty; }
  .by { display: flex; align-items: center; gap: 14px; font-size: 14px; color: #b9c4f5; }
  .by b { color: #fff; font-size: 16px; }
  .body { padding: 44px 48px; border-radius: var(--radius-xl); background: var(--paper); box-shadow: var(--shadow-card); font-size: 19px; line-height: 1.7; font-weight: 600; color: #3a4173; }
  .body :global(h2) { font-family: var(--font-display); font-size: 30px; line-height: 1.15; font-weight: 800; color: var(--ink); margin: 32px 0 8px; }
  .body :global(pre) { border-radius: 20px; padding: 22px 24px; font-size: 15px; line-height: 1.65; overflow-x: auto; }
  .body :global(code) { font-family: var(--font-mono); }
  .pn { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .pn a { padding: 20px 24px; border-radius: 22px; background: var(--paper); box-shadow: 0 6px 0 var(--line); display: flex; flex-direction: column; gap: 2px; color: var(--ink); }
  .pn a.r { text-align: right; }
  .pn small { font-size: 12px; font-weight: 700; color: var(--muted-2); }
  .pn b { font-size: 16px; font-weight: 800; }
  @media (max-width: 720px) { .hd, .body { padding: 28px 24px; } h1 { font-size: 34px; } .pn { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 4: Build and look**

Run: `pnpm --filter @gartha/web build && pnpm --filter @gartha/web preview`
Check `/blog`, the filter buttons, `/blog/cloudflare-workers-side-projects`, and the previous/next links. Stop preview.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): blog list with category filter and post page"
```

---

### Task 12: Admin page and client script

**Files:**
- Create: `apps/web/src/pages/admin/index.astro`, `apps/web/src/scripts/admin.ts`, `apps/web/test/admin-render.test.ts`

The page is a static shell. The script fetches JSON from the API (same origin in production; proxied to `localhost:8787` in dev via the Vite proxy from Task 9) and fills the DOM. Access sets its cookie on the page request, so the fetch carries it and Access injects the JWT header on the way to the Worker.

- [ ] **Step 1: Write the failing render test**

`apps/web/test/admin-render.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { renderReport, type ReportPayload } from "../src/scripts/admin";

const payload: ReportPayload = {
  report: {
    date: "2026-09-07", generatedAt: "2026-09-07T22:00:05Z",
    emailsRead: 47, needsReply: 3, billsDue: 2, archived: 31,
    summary: "Quiet inbox.",
    items: [{ kind: "reply", title: "Invoice", note: "before Friday", priority: "high" }],
  },
  runs: [{ id: 1, startedAt: "2026-09-07T22:00:00Z", finishedAt: "2026-09-07T22:00:05Z", status: "ok", error: null, trigger: "cron" }],
};

describe("renderReport", () => {
  it("fills the counts, summary, items and run log", () => {
    document.body.innerHTML = `
      <span data-field="date"></span><span data-field="emailsRead"></span><span data-field="needsReply"></span>
      <span data-field="billsDue"></span><span data-field="archived"></span><p data-field="summary"></p>
      <ul data-field="items"></ul><ul data-field="runs"></ul>`;
    renderReport(document, payload);
    expect(document.querySelector('[data-field="emailsRead"]')?.textContent).toBe("47");
    expect(document.querySelector('[data-field="summary"]')?.textContent).toBe("Quiet inbox.");
    expect(document.querySelectorAll('[data-field="items"] li')).toHaveLength(1);
    expect(document.querySelector('[data-field="runs"]')?.textContent).toContain("cron");
  });
});
```

Set the environment for this test by adding at the top of the file: `// @vitest-environment jsdom` and install jsdom: `pnpm add -D -F @gartha/web jsdom`.

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @gartha/web test admin-render`
Expected: FAIL, module not found.

- [ ] **Step 3: Write src/scripts/admin.ts**

```ts
export type ReportItem = { kind: "reply" | "bill" | "info"; title: string; note: string; priority: "high" | "normal" | "low" };
export type Report = {
  date: string; generatedAt: string; emailsRead: number; needsReply: number; billsDue: number; archived: number;
  summary: string; items: ReportItem[];
};
export type JobRun = { id: number; startedAt: string; finishedAt: string | null; status: "running" | "ok" | "failed"; error: string | null; trigger: "cron" | "manual" };
export type ReportPayload = { report: Report; runs: JobRun[] };

function el<T extends Element>(root: ParentNode, field: string): T | null {
  return root.querySelector<T>(`[data-field="${field}"]`);
}

export function renderReport(root: ParentNode, { report, runs }: ReportPayload): void {
  const set = (f: string, v: string | number) => { const e = el<HTMLElement>(root, f); if (e) e.textContent = String(v); };
  set("date", report.date);
  set("emailsRead", report.emailsRead);
  set("needsReply", report.needsReply);
  set("billsDue", report.billsDue);
  set("archived", report.archived);
  set("summary", report.summary);

  const items = el<HTMLUListElement>(root, "items");
  if (items) {
    items.replaceChildren(...report.items.map((it) => {
      const li = document.createElement("li");
      li.dataset.kind = it.kind;
      li.dataset.priority = it.priority;
      const t = document.createElement("b"); t.textContent = it.title;
      const n = document.createElement("span"); n.textContent = it.note;
      li.append(t, n);
      return li;
    }));
  }

  const log = el<HTMLUListElement>(root, "runs");
  if (log) {
    log.replaceChildren(...runs.map((r) => {
      const li = document.createElement("li");
      li.dataset.status = r.status;
      li.textContent = `${r.startedAt.slice(11, 19)} ${r.trigger} · ${r.status}${r.error ? ` · ${r.error}` : ""}`;
      return li;
    }));
  }
}

export function showError(root: ParentNode, message: string): void {
  const box = el<HTMLElement>(root, "error");
  if (box) { box.textContent = message; box.hidden = false; }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function mount(root: Document): void {
  const load = async (path: string, init?: RequestInit) => {
    try {
      const err = el<HTMLElement>(root, "error"); if (err) err.hidden = true;
      renderReport(root, await getJson<ReportPayload>(path, init));
    } catch (e) {
      showError(root, e instanceof Error ? e.message : "something went wrong");
    }
  };

  root.querySelector('[data-action="run"]')?.addEventListener("click", () => load("/api/admin/reports/run", { method: "POST" }));
  root.querySelector<HTMLInputElement>('[data-action="date"]')?.addEventListener("change", (ev) => {
    const v = (ev.target as HTMLInputElement).value;
    if (v) load(`/api/admin/reports/${v}`);
  });

  load("/api/admin/reports/latest");
}
```

- [ ] **Step 4: Run to see it pass**

Run: `pnpm --filter @gartha/web test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write src/pages/admin/index.astro**

```astro
---
import "@gartha/ui/tokens.css";
import { Avatar } from "@gartha/ui";
const nav = [
  { label: "Daily report", active: true },
  { label: "Posts" }, { label: "Inbox rules" }, { label: "Settings" },
];
const tiles = [
  { field: "emailsRead", label: "EMAILS READ", color: "var(--blue)" },
  { field: "needsReply", label: "NEEDS REPLY", color: "var(--coral)" },
  { field: "billsDue", label: "BILLS DUE", color: "var(--gold)" },
  { field: "archived", label: "AUTO ARCHIVED", color: "var(--green)" },
];
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Admin · gartha.me</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" />
  </head>
  <body>
    <div class="shell">
      <aside>
        <div class="brand"><span class="logo mono">&lt;/&gt;</span><div><b class="display">gartha.me</b><span class="mono">admin</span></div></div>
        <nav>{nav.map((n) => <a href="#" aria-current={n.active ? "page" : undefined} aria-disabled={n.active ? undefined : "true"}>{n.label}</a>)}</nav>
        <div class="me"><Avatar /><div><b>Gartha</b><span class="mono" style="color:var(--green)">online</span></div></div>
      </aside>

      <main>
        <div class="top">
          <div><span class="mono" style="color:var(--muted);font-size:14px;font-weight:700">// today's quest board</span><h1 class="display">Daily report</h1></div>
          <div class="actions">
            <label class="date mono">Date <input type="date" data-action="date" /></label>
            <button class="run display" data-action="run">Run now</button>
          </div>
        </div>

        <p class="err" data-field="error" hidden></p>

        <div class="tiles">
          {tiles.map((t) => (
            <div class="tile"><i style={`background:${t.color}`}></i><div><span class="mono">{t.label}</span><b class="display" data-field={t.field}>–</b></div></div>
          ))}
        </div>

        <div class="cols">
          <section class="card">
            <div class="row"><h2 class="display">Summary</h2><span class="mono" data-field="date"></span></div>
            <p class="summary" data-field="summary">Loading…</p>
            <ul class="items" data-field="items"></ul>
          </section>
          <section class="card dark">
            <div class="row"><h2 class="display">Cron log</h2><i class="dot"></i></div>
            <ul class="runs mono" data-field="runs"></ul>
          </section>
        </div>
      </main>
    </div>
    <script>
      import { mount } from "../../scripts/admin";
      mount(document);
    </script>
  </body>
</html>

<style>
  .shell { display: flex; min-height: 100vh; }
  aside { width: 260px; padding: 28px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 28px; background: var(--paper); box-shadow: 4px 0 0 var(--line); }
  .brand { display: flex; align-items: center; gap: 12px; padding: 0 8px; }
  .brand div { display: flex; flex-direction: column; } .brand b { font-size: 20px; } .brand span { font-size: 12px; color: var(--muted); }
  .logo { width: 44px; height: 44px; border-radius: 14px; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 0 var(--blue-deep); font-weight: 700; }
  nav { display: flex; flex-direction: column; gap: 6px; }
  nav a { height: 48px; padding: 0 14px; border-radius: 14px; display: flex; align-items: center; font-weight: 700; color: var(--muted); }
  nav a[aria-current="page"] { background: var(--blue); color: #fff; font-weight: 800; box-shadow: 0 4px 0 var(--blue-deep); }
  nav a[aria-disabled="true"] { opacity: .5; pointer-events: none; }
  .me { margin-top: auto; padding: 16px; border-radius: 18px; background: var(--bg-top); display: flex; align-items: center; gap: 12px; }
  .me div { display: flex; flex-direction: column; font-size: 15px; } .me span { font-size: 12px; font-weight: 700; }
  main { flex: 1; padding: 32px 40px; display: flex; flex-direction: column; gap: 24px; min-width: 0; }
  .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 40px; line-height: 1; font-weight: 800; }
  .actions { display: flex; gap: 12px; align-items: center; }
  .date { height: 48px; padding: 0 16px; border-radius: 16px; background: var(--paper); display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-card-sm); font-size: 15px; font-weight: 700; }
  .date input { border: 0; font: inherit; background: transparent; }
  .run { height: 48px; padding: 0 20px; border: 0; border-radius: 16px; background: var(--green); color: #fff; font-size: 16px; font-weight: 800; box-shadow: 0 4px 0 var(--green-deep); cursor: pointer; }
  .err { margin: 0; padding: 14px 18px; border-radius: 16px; background: #ffe3e6; color: #b52e2e; font-weight: 700; }
  .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
  .tile { padding: 18px 20px; border-radius: 22px; background: var(--paper); box-shadow: 0 6px 0 var(--line); display: flex; align-items: center; gap: 14px; }
  .tile i { width: 48px; height: 48px; border-radius: 15px; flex-shrink: 0; }
  .tile div { display: flex; flex-direction: column; } .tile span { font-size: 12px; font-weight: 700; color: var(--muted); } .tile b { font-size: 28px; line-height: 1; }
  .cols { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .card { padding: 28px 30px; border-radius: var(--radius-lg); background: var(--paper); box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 18px; }
  .card.dark { background: var(--ink); color: #b9c4f5; box-shadow: 0 8px 0 var(--dark); }
  .card.dark h2 { color: #fff; }
  .row { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; }
  .summary { margin: 0; font-size: 17px; line-height: 1.65; font-weight: 600; color: #3a4173; }
  .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .items li { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 18px; background: var(--bg-top); border-left: 0; }
  .items li b { font-size: 16px; } .items li span { font-size: 14px; font-weight: 600; color: var(--muted); }
  .items li[data-priority="high"] b::before { content: "! "; color: var(--coral); }
  .runs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .runs li[data-status="failed"] { color: var(--coral); } .runs li[data-status="ok"]::before { content: "● "; color: var(--green); }
  .dot { width: 10px; height: 10px; border-radius: 5px; background: var(--green); }
  @media (max-width: 900px) { .shell { flex-direction: column; } aside { width: auto; flex-direction: row; align-items: center; } nav { flex-direction: row; } .me { display: none; } .tiles { grid-template-columns: 1fr 1fr; } .cols { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 6: Run both apps and check the admin page end to end**

Terminal 1: `pnpm --filter @gartha/api migrate:local && pnpm --filter @gartha/api dev`
Terminal 2: `pnpm --filter @gartha/web dev`
Open http://localhost:4321/admin. Locally `ACCESS_TEAM_DOMAIN` is empty, so the API answers 503 and the page shows "access not configured" in the error box. That proves the wiring. To exercise the happy path locally, temporarily add to `apps/api/wrangler.toml` under `[vars]` nothing, but instead run the api with `wrangler dev --var ACCESS_TEAM_DOMAIN:dev --var ACCESS_AUD:dev` AND, only for this local check, comment out the guard line in `app.ts`. Verify "Run now" fills the tiles. Restore the guard line before committing. Stop both servers.

- [ ] **Step 7: Full build**

Run: `pnpm build`
Expected: Turborepo builds ui, web, api in order with no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): admin daily report page"
```

---

### Task 13: Cloudflare provisioning, Access, and deploy

**Files:**
- Modify: `apps/api/wrangler.toml` (database_id, routes)
- Create: `.github/workflows/ci.yml`, `README.md`

Everything here targets Cloudflare account `c8aa9726eeee38e3701009e0acd38071`. The user must run the `wrangler login` step themselves; suggest `! pnpm --filter @gartha/api exec wrangler login` so it runs in-session.

- [ ] **Step 1: Log in and confirm the account**

Run: `pnpm --filter @gartha/api exec wrangler whoami`
Expected: shows the account id above. If it shows a different account, log out and log in with garthaprasidhiyanta@gmail.com.

- [ ] **Step 2: Create the D1 database and record its id**

Run: `pnpm --filter @gartha/api exec wrangler d1 create gartha-me`
Copy the `database_id` from the output into `apps/api/wrangler.toml`, replacing the zero UUID.

- [ ] **Step 3: Apply migrations remotely**

Run: `pnpm --filter @gartha/api migrate:remote`
Expected: `0001_init.sql` applied.

- [ ] **Step 4: Add the custom domain to wrangler.toml**

Append:
```toml
routes = [
  { pattern = "gartha.me", custom_domain = true },
  { pattern = "www.gartha.me", custom_domain = true }
]
```

- [ ] **Step 5: First deploy**

Run: `pnpm deploy`
Expected: Wrangler uploads the Worker with assets and prints `https://gartha.me`. Open it and confirm the home page and `/api/health`.

- [ ] **Step 6: Redirect www to apex**

In the dashboard: Rules → Redirect Rules → create rule "www to apex": when hostname equals `www.gartha.me`, dynamic redirect to `concat("https://gartha.me", http.request.uri.path)`, status 301.

- [ ] **Step 7: Create the Access application**

Dashboard → Zero Trust → Access → Applications → Add → Self-hosted.
- Name: gartha.me admin
- Domains: `gartha.me/admin`, `gartha.me/api/admin`
- Session duration: 24h
- Policy "owner": Allow, include Emails = garthaprasidhiyanta@gmail.com
- Identity providers: One-time PIN (and Google if already configured on the team).
Save. Copy the application's **Audience (AUD) tag** and note the **team domain** (the `<team>` in `<team>.cloudflareaccess.com`).

- [ ] **Step 8: Set the Access variables as secrets**

Run:
```bash
pnpm --filter @gartha/api exec wrangler secret put ACCESS_TEAM_DOMAIN   # paste team name only, no domain suffix
pnpm --filter @gartha/api exec wrangler secret put ACCESS_AUD           # paste the AUD tag
```
Remove the two empty `[vars]` entries from `wrangler.toml` so the secrets are not overwritten on deploy, then `pnpm deploy` again.

- [ ] **Step 9: Verify Access end to end**

Open https://gartha.me/admin in a private window. Expected: Access login, then the admin page loads and shows "no reports yet". Click "Run now". Expected: the tiles fill with zeros and the summary says the source is not connected. Then `curl -i https://gartha.me/api/admin/reports/latest` from a terminal. Expected: an Access redirect (302), never JSON.

- [ ] **Step 10: Connect Workers Builds for deploy on push**

Dashboard → Workers & Pages → gartha-me → Settings → Builds → Connect to GitHub → select the repo, branch `main`.
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Deploy command: `pnpm --filter @gartha/api exec wrangler d1 migrations apply gartha-me --remote && pnpm --filter @gartha/api exec wrangler deploy`
- Root directory: `/`

- [ ] **Step 11: Write .github/workflows/ci.yml**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 12: Write README.md**

```md
# gartha.me

Personal site, blog, and admin on Cloudflare Workers.

## Dev

    pnpm install
    pnpm --filter @gartha/api migrate:local
    pnpm dev            # astro on :4321, worker on :8787 (astro proxies /api)

## Test / build / deploy

    pnpm test
    pnpm build
    pnpm deploy         # or push to main (Workers Builds)

## Layout

- apps/web       Astro static site
- apps/api       Hono Worker: assets + /api + daily cron
- packages/ui    shared components and tokens
- packages/db    D1 schema and migrations
- design/        mockup sources
- docs/superpowers  specs and plans
```

- [ ] **Step 13: Commit and push**

```bash
git add apps/api/wrangler.toml .github README.md
git commit -m "chore: cloudflare provisioning, ci workflow, readme"
git push -u origin main
```
Expected: GitHub Actions passes; Workers Builds deploys; https://gartha.me serves the new build.

---

## Self-review

**Spec coverage**
- Home, blog list, post: Tasks 10, 11. Pagination at 12 posts is not implemented; with three posts it is not needed yet and adding it later is additive. Noted as an intentional deferral.
- Admin: Task 12 (latest, by date, run now, cron log, error card).
- API routes, Access check, cron: Tasks 5, 6, 7.
- Job semantics (upsert, failed run keeps old report): Task 4 tests cover all three.
- Schema and migrations: Task 2.
- UI components and tokens: Task 8.
- Testing strategy: each package has tests; CI in Task 13.
- Deployment, domain, Access, Workers Builds: Task 13.

**Placeholders:** none. The only bracketed values are content placeholders in `profile.ts` that the user fills in.

**Type consistency:** `Report`, `ReportItem`, `JobRun` in `packages/db` match the client-side types in `apps/web/src/scripts/admin.ts`. `createAdminRouter({ guards })` is used identically in Task 5 tests and Task 6 app wiring. `runDailyReport` signature is the same in Tasks 4, 5, 7.
