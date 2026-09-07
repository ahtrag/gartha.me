import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../env";

export type Verify = (token: string, team: string, aud: string) => Promise<{ email: string }>;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export const joseVerify: Verify = async (token, team, aud) => {
  const issuer = `https://${team}.cloudflareaccess.com`;
  let jwks = jwksCache.get(team);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(team, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: aud });
  return { email: typeof payload.email === "string" ? payload.email : "" };
};

export function accessGuard({ verify = joseVerify }: { verify?: Verify } = {}): MiddlewareHandler<{
  Bindings: Env;
  Variables: { accessEmail?: string };
}> {
  return async (c, next) => {
    const team = c.env.ACCESS_TEAM_DOMAIN;
    const aud = c.env.ACCESS_AUD;
    if (!team || !aud) return c.json({ error: "access not configured" }, 503);

    const token = c.req.header("Cf-Access-Jwt-Assertion");
    if (!token) return c.json({ error: "unauthorized" }, 401);

    try {
      const { email } = await verify(token, team, aud);
      c.set("accessEmail", email);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
