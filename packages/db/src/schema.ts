// Keep in sync with migrations/*.sql. The SQL migrations are the source of truth.
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
