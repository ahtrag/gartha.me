import { createDb, jobRuns, reports, rowToReport } from "@gartha/db";
import { desc, eq } from "drizzle-orm";
import { Hono, type MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { runDailyReport } from "../jobs/daily-report";
import { stubProducer } from "../jobs/stub-producer";
import type { AccessVariables } from "../middleware/access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RUN_LIMIT = 10;

type Opts = {
  guards: MiddlewareHandler<{ Bindings: Env; Variables: AccessVariables }>[];
};

export function createAdminRouter({ guards }: Opts) {
  const admin = new Hono<{ Bindings: Env; Variables: AccessVariables }>();
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
