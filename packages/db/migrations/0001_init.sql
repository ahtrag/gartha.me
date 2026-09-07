CREATE TABLE reports (
  date         TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  emails_read  INTEGER NOT NULL,
  needs_reply  INTEGER NOT NULL,
  bills_due    INTEGER NOT NULL,
  archived     INTEGER NOT NULL,
  summary      TEXT NOT NULL,
  items        TEXT NOT NULL
);

CREATE TABLE job_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL CHECK (status IN ('running','ok','failed')),
  error       TEXT,
  trigger     TEXT NOT NULL CHECK (trigger IN ('cron','manual'))
);

CREATE INDEX job_runs_started_at ON job_runs (started_at DESC);
