import { type Db, type Report, type ReportItem, jobRuns, reports } from "@gartha/db";
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

// Assumption: the owner is in Asia/Jakarta (UTC+7). The daily report's date key
// (and the cron trigger time, see wrangler.toml) are anchored to that zone rather
// than UTC so "today's report" lines up with the owner's local calendar day.
export const REPORT_TIMEZONE = "Asia/Jakarta";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toDateKey(d: Date): string {
  return dateKeyFormatter.format(d);
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

    return { ...row, items: produced.items } satisfies Report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await db
        .update(jobRuns)
        .set({ status: "failed", error: message, finishedAt: new Date().toISOString() })
        .where(eq(jobRuns.id, run.id));
    } catch (updateErr) {
      console.error("failed to mark job run as failed", { runId: run.id, updateErr });
    }
    throw err;
  }
}
