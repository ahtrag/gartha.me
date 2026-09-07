import { createApp } from "./app";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch: app.fetch,
  // scheduled handler is added in Task 7
} satisfies ExportedHandler<Env>;
