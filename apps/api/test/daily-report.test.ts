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
      emailsRead: 99,
      needsReply: 1,
      billsDue: 0,
      archived: 98,
      summary: "second run",
      items: [],
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
    const boom: ReportProducer = async () => {
      throw new Error("upstream down");
    };

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
