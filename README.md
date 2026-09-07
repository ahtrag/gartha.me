# gartha.me

Personal site, blog, and admin on Cloudflare Workers.

## Dev

    pnpm install
    pnpm --filter @gartha/api dev   # runs local D1 migrations (predev), then worker on :8787
    pnpm dev                        # astro on :4321 (proxies /api) + worker on :8787, parallel

`pnpm --filter @gartha/api dev` alone applies local D1 migrations automatically via its
`predev` script before starting `wrangler dev`. To exercise the cron job locally, use
`pnpm --filter @gartha/api dev:cron` (`wrangler dev --test-scheduled`).

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (git-ignored) to configure
local secrets. Setting `ACCESS_DEV_EMAIL` there bypasses the Cloudflare Access guard
for requests on `localhost`/`127.0.0.1` only, so you can open `/admin` locally without
a real Access login.

## Test / build / deploy

    pnpm test            # turbo run test: api (vitest 4 + @cloudflare/vitest-pool-workers),
                          # web + ui (vitest 5); api tests need apps/web/dist, so build web first
    pnpm build            # turbo run build: astro build (web) before the worker (api)
    pnpm typecheck
    pnpm run deploy:cf     # wrangler deploy, or push to main (Workers Builds)

## Layout

- apps/web       Astro static site
- apps/api       Hono Worker: assets + /api + daily cron
- packages/ui    shared components and tokens
- packages/db    D1 schema and migrations
- design/        mockup sources
- docs/superpowers  specs and plans

## Deploy

One-time Cloudflare account setup (see `docs/superpowers/specs/2026-09-07-gartha-me-site-design.md`
and the Task 13 plan for full detail):

- [ ] `wrangler login`, confirm account `c8aa9726eeee38e3701009e0acd38071`
- [ ] `wrangler d1 create gartha-me`, copy `database_id` into `apps/api/wrangler.toml`
- [ ] `pnpm --filter @gartha/api migrate:remote` to apply `0001_init.sql`
- [ ] `pnpm run deploy:cf` for the first deploy
- [ ] Dashboard: Rules → Redirect Rules, www.gartha.me → gartha.me (301) —
      or, if that redirect isn't in place yet, the Access application below
      must also cover `www.gartha.me/admin*` and `www.gartha.me/api/admin*`
- [ ] Dashboard: Zero Trust → Access → Applications, create "gartha.me admin"
      guarding `/admin` and `/api/admin` (and the `www.gartha.me` equivalents
      per the note above); note the AUD tag and team domain
- [ ] `wrangler secret put ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`;
      `pnpm run deploy:cf` again
- [ ] Verify Access end to end (`/admin` prompts for login; `/api/admin/*`
      redirects instead of returning JSON when unauthenticated)
- [ ] Dashboard: Workers & Pages → gartha-me → Settings → Builds, connect
      GitHub for deploy-on-push to `main`
