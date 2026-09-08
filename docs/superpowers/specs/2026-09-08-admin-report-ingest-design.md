# Admin daily report ingest (D1)

Date: 2026-09-08
Status: approved design, ready for planning

## Goal

Grok Bot Dev staff is the only writer of `/admin` daily reports. They
POST a D1-shaped JSON payload to this Worker. The Worker validates it,
upserts Cloudflare D1, and `/admin` keeps reading the existing admin
API. The stub producer and the admin **Run now** writer go away.

This spec replaces the deferred “email + Grok producer” item from
`2026-09-07-gartha-me-site-design.md` for v1: curation happens in the
staff bot; this repo only stores and displays the result.

## Locked decisions

- Staff POSTs JSON (ingest webhook). This Worker does not call Grok or
  Gmail.
- Auth is a shared Worker secret: `Authorization: Bearer <INGEST_TOKEN>`
  on a dedicated route that is **not** behind Cloudflare Access.
- Body is the exact D1 `reports` shape (date, four counts, summary,
  items). Extra fields are ignored. `generated_at` is stamped here.
- Only ingest writes `reports`. Cron never writes a report. **Run now**
  never writes a report. Cron may insert a `job_runs` miss if that
  Jakarta date has no ingest.

## Architecture

```
Grok Bot Dev staff
  │  POST /api/ingest/reports
  │  Authorization: Bearer INGEST_TOKEN
  ▼
Cloudflare Worker (apps/api)
  ├─ /api/ingest/reports     secret-gated writer → D1
  ├─ /api/admin/*            Access-gated reader (unchanged GETs)
  ├─ /admin/*                Access-gated static page
  └─ scheduled()             miss logger only (no report row)
  │
  ▼
D1  reports, job_runs
```

- Access stays on `gartha.me/admin*` and `gartha.me/api/admin*` only.
  `/api/ingest/*` must not be added to that Access application.
- `INGEST_TOKEN` is a Wrangler secret (local: `.dev.vars`). It is never
  committed.
- `job_runs.trigger` gains `ingest` so the cron log can show staff
  deliveries separately from `cron` and leftover `manual` history.

## Contract

`POST /api/ingest/reports`

Headers: `Authorization: Bearer <INGEST_TOKEN>`,
`Content-Type: application/json`.

Body:

```json
{
  "date": "2026-09-08",
  "emailsRead": 12,
  "needsReply": 3,
  "billsDue": 1,
  "archived": 8,
  "summary": "Three threads need a reply; one bill is due today.",
  "items": [
    {
      "kind": "reply",
      "title": "Follow up with Alex",
      "note": "Asked about the Friday deploy.",
      "priority": "high"
    }
  ]
}
```

| Field | Rule |
| ----- | ---- |
| `date` | `YYYY-MM-DD`. Trusted as the report key; not overwritten with “today”. |
| `emailsRead`, `needsReply`, `billsDue`, `archived` | JSON numbers, integers ≥ 0 |
| `summary` | non-empty string |
| `items` | array, may be empty |
| `items[].kind` | `reply` \| `bill` \| `info` |
| `items[].title`, `items[].note` | strings (title non-empty) |
| `items[].priority` | `high` \| `normal` \| `low` |

Unknown fields are ignored. `generatedAt` / `generated_at` in the body
are ignored; the Worker writes `generated_at` as ISO-8601 UTC now.

Same `date` upserts the `reports` row (replace counts, summary, items,
`generated_at`). Each POST still inserts a new `job_runs` row.

**200** body: `{ "report": { …stored report with parsed items and generatedAt… } }`.
No `runs` array (that stays on the admin GETs).

Give staff this contract plus the production URL and the token out of
band. They do not get Cloudflare or D1 credentials.

## Schema

`reports` is unchanged. `job_runs.trigger` CHECK becomes
`cron | manual | ingest`. SQLite cannot ALTER that CHECK in place;
migration `0002_job_runs_ingest.sql` recreates `job_runs`, copies
existing rows, and restores the `started_at` index. Drizzle’s
`jobRuns.trigger` enum matches.

`manual` remains in the enum so historical rows stay valid. New writes
use `ingest` or `cron` only.

## Admin and cron

- **Run now** stays visible but `disabled`. It does not fetch.
  `POST /api/admin/reports/run` remains registered and returns **410**
  `{ "error": "reports are written by ingest only" }` with no D1 write.
- Admin GETs (`/reports`, `/reports/latest`, `/reports/:date`) are
  unchanged.
- Cron stays `0 0 * * *` (07:00 Asia/Jakarta). For `toDateKey(scheduledTime)`:
  if a `reports` row exists, do nothing; if not, insert
  `job_runs` with `status=failed`, `trigger=cron`,
  `error=no ingest for YYYY-MM-DD`. Never insert or delete `reports`.

Ingest reuses `runDailyReport` with `trigger: "ingest"` and a producer
that returns the validated body, so upsert + `job_runs` ok/failed
behavior stays in one place. Delete `stub-producer.ts` and stop calling
`runDailyReport` from cron and from `POST /api/admin/reports/run`.
Cron miss inserts the failed `job_runs` row directly.

## Data flow

1. Staff POSTs the day’s D1 JSON to `/api/ingest/reports`.
2. Worker compares the Bearer token in constant time. Fail → 401.
3. Worker validates the body. Fail → 400, no D1 write.
4. Worker upserts `reports` and inserts `job_runs` (`ok`, `ingest`).
5. `/admin` loads `GET /api/admin/reports/latest` (or a picked date).
6. Midnight cron records a miss when today’s Jakarta date has no row.

## Error handling

| Status | When | D1 |
| ------ | ---- | --- |
| 401 | missing/wrong Bearer; same `unauthorized` message either way | no write |
| 400 | bad JSON or contract violation; message names the field (`bad date`, `emailsRead must be a non-negative integer`, `items[0].kind is invalid`, …) | no write |
| 410 | `POST /api/admin/reports/run` | no write |
| 500 | unexpected failure; `{ "error": "internal error" }`; details in Worker logs | if a `running` job row was inserted, mark it `failed` (same pattern as `runDailyReport` today) |

No 409: a second POST for the same date is an upsert.

A cron miss is not an HTTP error. It does not overwrite or delete
older reports. Admin empty state for “no reports yet” is unchanged.
Access/session errors on admin GETs stay as they are.

## Testing

- Valid ingest upserts D1 and returns the stored report; a second POST
  for the same date replaces counts/summary/items and stamps a new
  `generated_at`; two `job_runs` rows with `trigger=ingest`.
- No header, wrong token, and malformed `Authorization` → 401 and
  empty D1.
- Bad date, negative count, unknown `kind`/`priority`, empty
  `summary`, non-array `items` → 400 and no row.
- Cron with a report for the Jakarta date inserts no `job_runs`; cron
  without one inserts a failed `job_runs` and no `reports` row.
- `GET /api/admin/reports/latest` returns an ingested report.
  `POST /api/admin/reports/run` returns 410 and does not write.
- Admin render/mount: **Run now** is disabled.
- Ingest tests bind `INGEST_TOKEN` in the Vitest Worker env.

## Out of scope

- Email ingestion, xAI API calls, and Grok prompts (owned by staff).
- Changing the four tile metrics or item kinds.
- Rate limiting beyond Cloudflare defaults.
- CORS (the bot is a server).
- Admin Posts / Inbox rules / Settings.

## Staff handoff

Production: `POST https://gartha.me/api/ingest/reports`  
Local: `POST http://127.0.0.1:8787/api/ingest/reports`  
Auth: `Authorization: Bearer <token>`  
Token: Wrangler secret `INGEST_TOKEN`, shared out of band.
