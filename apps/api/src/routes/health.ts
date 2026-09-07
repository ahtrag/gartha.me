import { Hono } from "hono";
import type { Env } from "../env";

export const health = new Hono<{ Bindings: Env }>();

health.get("/", (c) => c.json({ ok: true, time: new Date().toISOString() }));
