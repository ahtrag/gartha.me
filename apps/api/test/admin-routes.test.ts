import { env } from "cloudflare:test";
import { createDb } from "@gartha/db";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { runDailyReport } from "../src/jobs/daily-report";
import { stubProducer } from "../src/jobs/stub-producer";
import { createAdminRouter } from "../src/routes/admin";

function testApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/api/admin", createAdminRouter({ guards: [] }));
  return app;
}

async function seed(dates: string[]) {
  const db = createDb(env.DB);
  for (const d of dates) {
    await runDailyReport({
      db,
      now: new Date(`${d}T22:00:00Z`),
      trigger: "cron",
      producer: stubProducer,
    });
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

  it("GET /reports/latest caps runs at 10, newest first", async () => {
    for (let i = 0; i < 12; i++) {
      await runDailyReport({
        db: createDb(env.DB),
        now: new Date("2026-09-07T22:00:00Z"),
        trigger: "manual",
        producer: stubProducer,
      });
    }
    const res = await testApp().request("/api/admin/reports/latest", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ runs: { id: number }[] }>();
    expect(body.runs.length).toBe(10);
    expect(body.runs[0]?.id).toBeGreaterThan(body.runs[9]?.id ?? 0);
  });

  it("POST /reports/run creates today's report with a manual run", async () => {
    const res = await testApp().request("/api/admin/reports/run", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ report: { date: string }; runs: { trigger: string }[] }>();
    expect(body.report.date).toBe(new Date().toISOString().slice(0, 10));
    expect(body.runs[0]?.trigger).toBe("manual");
  });
});
