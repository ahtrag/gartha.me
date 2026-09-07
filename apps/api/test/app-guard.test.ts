import { SELF, env } from "cloudflare:test";
import { createDb, jobRuns } from "@gartha/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("accessGuard is mounted on the real app", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM reports; DELETE FROM job_runs;");
  });

  it("GET /api/admin/reports/latest is 503 with no header (Access not configured)", async () => {
    const res = await SELF.fetch("http://gartha.me/api/admin/reports/latest");
    expect(res.status).toBe(503);
  });

  it("POST /api/admin/reports/run is 503 with no header and creates no job run", async () => {
    const res = await SELF.fetch("http://gartha.me/api/admin/reports/run", { method: "POST" });
    expect(res.status).toBe(503);

    const db = createDb(env.DB);
    const runs = await db.select().from(jobRuns);
    expect(runs).toHaveLength(0);
  });
});
