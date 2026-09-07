import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export * from "./schema";

export type ReportItem = {
  kind: "reply" | "bill" | "info";
  title: string;
  note: string;
  priority: "high" | "normal" | "low";
};

type ReportRow = typeof schema.reports.$inferSelect;
export type Report = Omit<ReportRow, "items"> & { items: ReportItem[] };

export type JobRun = typeof schema.jobRuns.$inferSelect;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Convert a stored row (items as JSON text) into a Report. */
export function rowToReport(row: typeof schema.reports.$inferSelect): Report {
  return { ...row, items: JSON.parse(row.items) as ReportItem[] };
}
