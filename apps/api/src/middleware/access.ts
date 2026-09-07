import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../env";

export type Verify = (token: string, team: string, aud: string) => Promise<{ email: string }>;

export type AccessVariables = { accessEmail?: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export const joseVerify: Verify = async (token, team, aud) => {
  const issuer = `https://${team}.cloudflareaccess.com`;
  let jwks = jwksCache.get(team);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(team, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: aud,
    algorithms: ["RS256"],
  });
  if (typeof payload.email !== "string" || payload.email === "") {
    throw new Error("no email claim");
  }
  return { email: payload.email };
};

export function accessGuard({ verify = joseVerify }: { verify?: Verify } = {}): MiddlewareHandler<{
  Bindings: Env;
  Variables: AccessVariables;
}> {
  return async (c, next) => {
    const devEmail = c.env.ACCESS_DEV_EMAIL;
    const hostname = new URL(c.req.url).hostname;
    if (devEmail && (hostname === "localhost" || hostname === "127.0.0.1")) {
      c.set("accessEmail", devEmail);
      await next();
      return;
    }

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
