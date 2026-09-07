import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { type Verify, accessGuard } from "../src/middleware/access";

const ENV = { ACCESS_TEAM_DOMAIN: "gartha", ACCESS_AUD: "aud123" } as Env;

function appWith(verify: Verify) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", accessGuard({ verify }));
  app.get("/x", (c) => c.text("secret"));
  return app;
}

describe("accessGuard", () => {
  it("401 when the header is missing", async () => {
    const app = appWith(async () => ({ email: "x" }));
    const res = await app.request("/x", {}, ENV);
    expect(res.status).toBe(401);
  });

  it("401 when verification fails", async () => {
    const app = appWith(async () => {
      throw new Error("bad sig");
    });
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "t" } }, ENV);
    expect(res.status).toBe(401);
  });

  it("passes through and exposes the email when valid", async () => {
    let seen: { token: string; team: string; aud: string } | undefined;
    const app = appWith(async (token, team, aud) => {
      seen = { token, team, aud };
      return { email: "me@x" };
    });
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "tok" } }, ENV);
    expect(res.status).toBe(200);
    expect(seen).toEqual({ token: "tok", team: "gartha", aud: "aud123" });
  });

  it("503 when Access is not configured", async () => {
    const app = appWith(async () => ({ email: "x" }));
    const res = await app.request("/x", { headers: { "Cf-Access-Jwt-Assertion": "tok" } }, {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_AUD: "",
    } as Env);
    expect(res.status).toBe(503);
  });
});
