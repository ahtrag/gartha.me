import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createDb, jobRuns } from "@gartha/db";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("scheduled", () => {
  it("runs the daily report with the cron trigger", async () => {
    await env.DB.exec("DELETE FROM reports; DELETE FROM job_runs;");
    const ctx = createExecutionContext();
    const event = {
      scheduledTime: Date.parse("2026-09-07T22:00:00Z"),
      cron: "0 22 * * *",
      noRetry() {},
    };
    await worker.scheduled(event as ScheduledController, env, ctx);
    await waitOnExecutionContext(ctx);

    const runs = await createDb(env.DB).select().from(jobRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.trigger).toBe("cron");
    expect(runs[0]?.status).toBe("ok");
  });
});
