import { Hono } from "hono";
import type { Env } from "./env";
import { accessGuard } from "./middleware/access";
import { pages } from "./pages/routes";
import { createAdminRouter } from "./routes/admin";
import { health } from "./routes/health";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/health", health);
  app.route("/api/admin", createAdminRouter({ guards: [accessGuard()] }));
  app.route("/", pages);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "not found" }, 404);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError((err, c) => {
    console.error(err);
    if (!c.req.path.startsWith("/api/")) {
      return c.text("Something went wrong on the board. Try again in a moment.", 500);
    }
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
