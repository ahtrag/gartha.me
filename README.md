# gartha.me

Personal site, blog, and admin on Cloudflare Workers.

## Dev

    pnpm install
    pnpm --filter @gartha/api dev   # runs local D1 migrations (predev), then worker on :8787
    pnpm dev                        # astro on :4321 (proxies /api) + worker on :8787, parallel

`pnpm --filter @gartha/api dev` alone applies local D1 migrations automatically via its
`predev` script before starting `wrangler dev`. To exercise the cron job locally, use
`pnpm --filter @gartha/api dev:cron` (`wrangler dev --test-scheduled`).

## Test / build / deploy

    pnpm test            # turbo run test: api (vitest 4 + @cloudflare/vitest-pool-workers),
                          # web + ui (vitest 5); api tests need apps/web/dist, so build web first
    pnpm build            # turbo run build: astro build (web) before the worker (api)
    pnpm typecheck
    pnpm deploy            # wrangler deploy, or push to main (Workers Builds)

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
- [ ] `pnpm deploy` for the first deploy
- [ ] Dashboard: Rules → Redirect Rules, www.gartha.me → gartha.me (301)
- [ ] Dashboard: Zero Trust → Access → Applications, create "gartha.me admin"
      guarding `/admin` and `/api/admin`; note the AUD tag and team domain
- [ ] `wrangler secret put ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`; remove the
      empty `[vars]` entries from `wrangler.toml`; `pnpm deploy` again
- [ ] Verify Access end to end (`/admin` prompts for login; `/api/admin/*`
      redirects instead of returning JSON when unauthenticated)
- [ ] Dashboard: Workers & Pages → gartha-me → Settings → Builds, connect
      GitHub for deploy-on-push to `main`
