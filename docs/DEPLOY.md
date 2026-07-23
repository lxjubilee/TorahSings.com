# Deploying TorahSings.com

Verified against the live box 2026-07-17. Two PM2 processes serve this project:

| PM2 name | cwd | What it is |
|---|---|---|
| `torahsings` | `/var/www/torahsings.com` | the Next 16 front-end, `next start -p 3122` |
| `torahsings-api` | `/var/www/torahsings.com/api` | the Express identity API, `api.torahsings.com`, port 4031 |

Host `94.72.120.231`, root via `W:\InspirePersonas.com\.credentials\id_ed25519_jubilee_prod`.
nginx proxies both; Cloudflare SSL mode **Full** (origin cert is self-signed).

Deploying requires the owner's explicit go-ahead **every time**. Approval for one
deploy never carries to the next.

---

## ⛔ Do not tar the working tree over `/var/www/torahsings.com`

The old procedure ("tar the tree, scp, extract into `/var/www/torahsings.com`")
is **destructive as written**. Three reasons, each verified:

1. **It overwrites production secrets.** `/var/www/torahsings.com/.env` holds **23
   keys** — `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `SENDGRID_API_KEY`,
   `SERVICE_CLIENTS`, `SERVICE_JWT_SECRET`, Turnstile, JI SSO — and sits exactly
   where the tar lands. The repo root now has its own `.env` (local dev values).
   Extracting replaces 23 production secrets with 3 dev ones and takes **both**
   processes down. `.env` is gitignored, so git will not protect you here — tar
   does not read `.gitignore`.

2. **It bakes localhost into the production bundle.** `.env.local` carries
   `NEXT_PUBLIC_API_BASE=http://localhost:4031`. Next inlines `NEXT_PUBLIC_*` at
   **build** time, and the procedure builds *on the VPS* — so every visitor's
   sign-in would call their own machine.

3. **Divergence runs both ways — prod is not simply "behind".** As of 2026-07-17
   prod `api/src` had **67 files to this tree's 55**, while prod's `api/src/config.js`
   was *older* than the local copy. The local `api/` is a partial vendored
   snapshot that has since been edited. A tar extract does not delete, so prod-only
   files survive — but shared files get overwritten, which can regress prod.

**Always exclude:** `.env`, `.env.local`, `.env*.local`, `node_modules`, `.next`, `.git`.

---

## Deploying API changes (the safe path)

Copy only the files you changed. Verified working 2026-07-17:

```bash
KEY="W:/InspirePersonas.com/.credentials/id_ed25519_jubilee_prod"
HOST=root@94.72.120.231
TS=$(date +%Y%m%d-%H%M%S)

# 1. Back up what you are about to replace — this is your rollback.
ssh -i "$KEY" $HOST "mkdir -p /root/backups/torahsings-api-$TS && \
  cp /var/www/torahsings.com/api/src/config.js /root/backups/torahsings-api-$TS/"

# 2. Ship the individual files. Never .env.
scp -i "$KEY" api/src/config.js $HOST:/var/www/torahsings.com/api/src/config.js

# 3. Restart and confirm it actually booted (do not assume).
ssh -i "$KEY" $HOST "pm2 restart torahsings-api --update-env && sleep 4 && \
  pm2 list | grep torahsings-api && pm2 logs torahsings-api --lines 15 --nostream --err"
```

**Verify from the box, not from your laptop** — `127.0.0.1:4031` bypasses Cloudflare
and tests the process itself:

```bash
ssh -i "$KEY" $HOST '
  curl -s -o /dev/null -w "me: %{http_code}\n"     http://127.0.0.1:4031/api/auth/me        # want 200
  curl -s -o /dev/null -w "signin: %{http_code}\n" -X POST http://127.0.0.1:4031/api/auth/signin \
       -H "content-type: application/json" -d "{}"                                          # want 400 = alive
'
```

A crash-looping process still reports `online` for a second or two — check
`restart_time` and the error log, not just status.

### Secrets fail closed (since 2026-07-17)

`api/src/config.js` no longer falls back to a literal for `SESSION_SECRET` — a
default secret written in source is a *public* secret. **The API now refuses to
boot if `SESSION_SECRET` is unset.** Both it and `JWT_SECRET` are set on the VPS
(verified), so this is safe; but if you ever rebuild the box, set them **before**
starting the API. Never re-add a fallback.

---

## Deploying the front-end

`torahsings`, cwd `/var/www/torahsings.com`. Build env matters:

```
NEXT_PUBLIC_MEDIA_BASE=https://cdn.jubileeverse.com/torahsings   # baked at build
```

Unset locally so dev streams from `J:\` via the `/media/[...]` route. **Confirm no
`.env.local` reached the box before building**, or `NEXT_PUBLIC_API_BASE` will be
inlined as localhost. Then `npm ci && npm run build && pm2 restart torahsings`.

## Audio

The `J:\music\angels` tree (~3.3 GB) lives in Cloudflare R2 bucket
`jubileeverse-cdn` under the `torahsings/` prefix, served via the existing custom
domain `cdn.jubileeverse.com` — not a separate bucket.

```bash
rclone copy "J:/music/angels" jubilee-r2:jubileeverse-cdn/torahsings
```

The remote is named `jubilee-r2` in the studio machine's rclone config (`rclone
listremotes` to confirm — earlier revisions of this file said `r2:`).

**Sync before you build.** The scan catalogues whatever is on `J:` at that moment,
so an album that has landed on the drive but not in R2 renders a play button that
404s — and only in production, since dev streams from `J:` and looks fine.

```bash
# what the catalog expects vs what R2 actually holds
rclone check "J:/music/angels" jubilee-r2:jubileeverse-cdn/torahsings --size-only
```

## Cover art

Covers are ordinary files inside the album folder, so they need no separate
pipeline: the rclone sync above already carries `artwork/` to R2, and `artUrl()`
(src/lib/angels.ts) resolves them exactly like the audio — CDN in production,
the `/media` route off `J:` in dev.

The scan prefers each album's **webp** over its png. Both are on the drive and
both are on the CDN, but the webp is ~0.5 MB against ~3 MB for the same picture.

Only 14 of 285 albums have artwork at all. The other 271 carry `art: null` and
render `<CelestialArt>` — the generated placeholder — so an album never shows a
broken image while waiting for a cover.

There is no thumbnailing step and no `sharp` dependency (it was never in
package.json, so `npm run catalog` used to need an ambient install; it no longer
does). If the ~470 KB average per cover becomes a problem once more albums have
artwork, the fix is a 500 px webp variant beside each original on `J:` and a
one-line change to the scan's file preference — not a new upload path.

Cache note: covers are keyed by filename with no `?v=`, so a *replaced* cover
sits behind Cloudflare's TTL. Purge that one URL from the Cloudflare dashboard
after re-syncing.
