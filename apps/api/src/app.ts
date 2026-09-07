import { Hono } from "hono";
import type { Env } from "./env";
import { accessGuard } from "./middleware/access";
import { createAdminRouter } from "./routes/admin";
import { health } from "./routes/health";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/health", health);
  app.route("/api/admin", createAdminRouter({ guards: [accessGuard()] }));

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "not found" }, 404);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
