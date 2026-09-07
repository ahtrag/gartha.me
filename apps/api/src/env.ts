export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** Local-only dev bypass for accessGuard; only honored on localhost/127.0.0.1. */
  ACCESS_DEV_EMAIL?: string;
};
