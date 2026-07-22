# TorahSings ⇄ Jubilujah — API endpoint parity (status: complete)

The TorahSings API (`api.torahsings.com`, PM2 `torahsings-api`) is a fork of the
Jubilujah API. Endpoint parity and the database schema are both **done**; what
remains is deploying the code.

> Reference: the Jubilujah master API doc is `W:\JubiLujah.com\app\api\docs\API_REFERENCE.md`.
> Written 2026-07-20; DB verified 2026-07-21; migration scaffolding removed 2026-07-22.

---

## 1. Endpoints — full parity

`api/src/index.js` mounts the full Jubilujah router set (23 routers, ~173
handlers). Nothing left unported. TorahSings-only extras: `GET
/api/auth/admin/check-email` and `GET /api/admin/users/:id`.

Code that delivers this (kept):

- **`api/src/index.js`** — expanded from the auth-only surface to the full router
  set. Webhook raw-body mounts before the JSON parser; `/api/admin/*` sub-routers
  mount before the generic `/api/admin`.
- **`api/src/routes/admin.js`** — full admin router (users, roles, delete,
  subscribers, active-listeners, covers, audit, publish), plus Torah's
  `GET /users/:id`. Supersedes the trimmed `adminUsers.js` (still on disk, unused).
- **`api/src/util/r2.js`** — Cloudflare R2 helper for admin cover uploads;
  `@aws-sdk/client-s3` is imported lazily so the server boots before the SDK is
  installed.
- **`api/package.json`** — added `@aws-sdk/client-s3`.

---

## 2. Database — VERIFIED at full parity (2026-07-21)

Connected to the production Postgres (SSH tunnel to `94.72.120.231`, master role,
DB `torahsings`) and diffed it against `jubilujah`. **The schema was already
~complete** — every `production`/`radio`/`identity`/`catalog` table and all 14
enum types already existed. Only **2 columns** were missing (migrations 0027/0028,
never applied):

- `production.mobile_categories.hero_autorotate`
- `production.mobile_sections.auto_order`

Actions taken on the live DB, in order:

1. **Backup** — `pg_dump -Fc torahsings` → `/root/torahsings_backup_20260721_125720.dump`
   (307 KB; restore with `pg_restore`).
2. **Applied the 2 columns** — idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
3. **Verified** — `torahsings` now equals `jubilujah`: **658/658 columns, 0
   missing, 0 extra, 0 missing tables.**

So there are **no tables to create**. Every mounted router's tables exist; those
endpoints function (they don't 500 for lack of a table) once the code is deployed.

---

## 3. Migration scaffolding — REMOVED as redundant (2026-07-22)

The DB is already provisioned, so the copied-in migration scaffolding was dead
weight (and would have collided with the live schema — `0001` has unguarded
`CREATE TYPE`/`CREATE TABLE`). Deleted:

- `api/db/` — the copied Jubilujah migrations (`0001…0028`), seeds, and the
  `run-migrations.cjs` runner.
- `api/package.json` — the `migrate` / `migrate:seed` scripts.

`@aws-sdk/client-s3` was **kept** (cover uploads need it). If a fresh environment
(staging / local Postgres) is ever needed, re-copy the migrations from the
Jubilujah source rather than reintroducing stale copies here.

> **Ledger note:** `public._migrations` on prod `torahsings` is empty — the schema
> was provisioned out-of-band, not through a runner. That's fine; no runner
> remains in this repo. It only matters if a migration runner is ever
> reintroduced (in which case backfill the ledger before running it).

---

## 4. Table-dependency map (all present)

Every router group's tables exist in `torahsings`. The only remaining caveats are
**config, not schema**:

| Router group | Non-DB caveat |
|---|---|
| analytics / now-playing | — |
| awards / pipeline / reviewsAdmin / app-version | — |
| subscriptions / listening / webhook | Stripe falls back to `mock` until `STRIPE_*` set; webhook 400s without `STRIPE_WEBHOOK_SECRET` |
| mobile / mobileAdmin · music (admin) · radio · catalog | read the manifest (`MANIFEST_PATH`, unset) → return empty, no 500 |
| admin covers | needs `R2_*` creds + `@aws-sdk/client-s3` installed on the box; fails closed (503) otherwise |

---

## 5. Remaining step — deploy (needs approval)

The DB is done. What's left is shipping the API code, on the box in
`/var/www/torahsings.com/api`:

```
git pull                       # the repo changes above
npm install                    # picks up @aws-sdk/client-s3
pm2 restart torahsings-api
curl -s localhost:<port>/health
# smoke-test a newly-live route, e.g. GET /api/subscriptions/plans
```

**Nothing is committed or deployed yet — that needs your approval.**

---

## 6. Notes

- `adminUsers.js` stays on disk but is no longer imported; safe to delete later.
- `api/src/index.js` still carries inline "(B) NEEDS DB — 500s until tables exist"
  comments from the parity exercise. They're now inaccurate (the tables exist) but
  harmless; tidy them when next editing that file.
- **Catalog stays empty** until a manifest is configured; the web serves catalog
  from its own generated content regardless.
