import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/nope", () => {
  it("returns a JSON 404 for unknown api routes", async () => {
    const res = await SELF.fetch("http://gartha.me/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json<{ error: string }>();
    expect(body).toEqual({ error: "not found" });
  });
});

describe("GET /", () => {
  it("falls back to the ASSETS binding for non-api routes", async () => {
    const res = await SELF.fetch("http://gartha.me/");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("gartha.me");
  });
});
