import { createDb } from "@gartha/db";
import { createApp } from "./app";
import type { Env } from "./env";
import { runDailyReport } from "./jobs/daily-report";
import { stubProducer } from "./jobs/stub-producer";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runDailyReport({
        db: createDb(env.DB),
        now: new Date(controller.scheduledTime),
        trigger: "cron",
        producer: stubProducer,
      }).catch((err) => console.error("daily report failed", err)),
    );
  },
} satisfies ExportedHandler<Env>;
