import { SELF, env } from "cloudflare:test";
import { createDb, jobRuns } from "@gartha/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

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

  it("GET /api/admin/reports/latest is 401 with a malformed token when Access is configured", async () => {
    const app = createApp();
    // Full URL on the real host and no dev email, so a local .dev.vars cannot
    // trigger the localhost bypass and mask a guard regression.
    const res = await app.request(
      "http://gartha.me/api/admin/reports/latest",
      { headers: { "Cf-Access-Jwt-Assertion": "not-a-jwt" } },
      { ...env, ACCESS_TEAM_DOMAIN: "team", ACCESS_AUD: "aud", ACCESS_DEV_EMAIL: undefined },
    );
    expect(res.status).toBe(401);
  });
});
