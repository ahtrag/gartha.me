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
    await db.insert(reports).values(row).onConflictDoUpdate({ target: reports.date, set: row });

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
