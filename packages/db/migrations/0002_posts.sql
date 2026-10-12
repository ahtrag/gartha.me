-- Blog posts live here, not in the repo. The Worker renders /blog, /blog/:slug,
-- the home page and /about from this table, so publishing needs no build.
-- body_html is rendered once at publish time (scripts/publish-post.ts).
CREATE TABLE posts (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  date        TEXT NOT NULL,          -- YYYY-MM-DD
  category    TEXT NOT NULL CHECK (category IN ('code','games','builds')),
  featured    INTEGER NOT NULL DEFAULT 0,
  draft       INTEGER NOT NULL DEFAULT 0,
  body_md     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  words       INTEGER NOT NULL,
  minutes     INTEGER NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX posts_date ON posts (date DESC);
