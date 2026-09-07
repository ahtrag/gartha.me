import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns ok with a timestamp", async () => {
    const res = await SELF.fetch("http://gartha.me/api/health");
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; time: string }>();
    expect(body.ok).toBe(true);
    expect(new Date(body.time).toString()).not.toBe("Invalid Date");
  });
});
