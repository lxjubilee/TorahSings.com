# TorahSings ⇄ Jubilujah — Admin console parity

Companion to `API_PARITY.md`. That document covers the **API**; this one covers
the **admin console UI** that sits on top of it.

> Reference implementation: `W:\JubiLujah.com\app\web` (Next.js, `app/admin/*`).
> Analysed 2026-07-23 against TorahSings `main` @ `ce3303a`.

---

## 0. Headline

**The API is done. The console is not.**

`API_PARITY.md` established endpoint and schema parity — 23 routers, ~173
handlers, 658/658 columns. Jubilujah's admin console is ~2,650 lines of React
across 12 sections; TorahSings has **one placeholder page** (`/admin`, added
2026-07-23) that lists endpoints and does nothing else.

So the gap is almost entirely front-end. Three things qualify that:

1. **The parity API is not deployed.** Probed `api.torahsings.com` on 2026-07-23:
   every non-admin parity route returns **404** (`/api/pipeline`,
   `/api/analytics/overview`, `/api/subscriptions/plans`, `/api/mobile/config`,
   `/api/awards/periods/2026`, `/api/catalog`, `/api/radio/stations`,
   `/api/listening/today`, `/api/app-version`). The code is committed; the box is
   still running the older build. **Nine of twelve sections cannot function until
   this deploy happens** (`API_PARITY.md` §5).
2. **`/api/admin/*` returns 401 for everything**, including
   `/api/admin/zzz-nonexistent-control`. That is a router-level `requireRole`
   gate firing before routing, so a 401 there is *not* evidence the sub-route
   exists. Do not read those 401s as "deployed".
3. **Three config items** gate real data even after deploy — unchanged from
   `API_PARITY.md` §4: `MANIFEST_PATH` (music/mobile/radio/catalog return empty),
   `R2_*` (cover upload 503s), `STRIPE_*` (subscriptions run mock).

---

## 1. Complete feature inventory — Jubilujah admin

Twelve sections, in the order the nav lists them
(`app/admin/layout.tsx`). Sizes are lines of TSX.

### Shell — `layout.tsx` (76)
Vertical "Operations Console" nav, sticky below the site header, right-hand
detail pane. Three-state gate: loading → "Checking access…"; unauthenticated →
redirect to `/signin?returnTo=…`; authenticated without `admin` → "Access
denied" notice.

### 1. Analytics — `AnalyticsDashboard.tsx` (511 + 17 page)
The largest surface. Seven sub-tabs:

| Tab | Content |
|---|---|
| Overview | KPI row, plus subscriber roll-up from `/api/admin/subscribers` |
| Trends | 90-day series |
| Albums | Sortable, paginated table |
| Songs | Sortable, paginated table |
| Users | Paginated table (no sort) |
| Ratings | Rating distribution |
| Reviews | Review analytics |

Backed by `/api/analytics/{overview,trends,albums,songs,users,ratings,reviews}`
plus `/export` (CSV). Page passes a server-computed `avgBestseller` from
`lib/bestseller.ts`.

### 2. Active Listeners — `ActiveListeners.tsx` (109 + 11)
Polls `/api/admin/active-listeners` every few seconds. Per-listener row: name,
location, album, track number, song, cover thumbnail with fallback glyph, and an
animated CSS equalizer. The equalizer is decorative — the server cannot tap the
audio stream.

### 3. Overview — `page.tsx` (46)
Pipeline stage counts as KPI tiles (10 stages, `concept` → `distributed`) from
`/api/pipeline`, then a recent-activity table from `/api/admin/audit` (when,
action, target, actor).

### 4. Manage Music — `ManageMusic.tsx` (599 + 11)
Six sub-tabs — `dashboard · albums · songs · missing · activity · sync`:

- **Toolbar**: "Sync with CDN" (missing only) and "Full re-probe" (all), last-sync
  status line.
- **Albums**: search, artist filter, pagination, per-row Publish/Hide, bulk
  Publish · Hide · Set Draft · Refresh · Validate over a selection.
- **Album detail**: Publish, Hide, Refresh from CDN, Validate.
- **Songs**: search, album-code filter, pagination, per-song visibility.
- **Missing Assets**: gaps found by the CDN probe.
- **Activity**: `/api/admin/music/activity` log.
- **Sync**: run history (`/sync/runs`, drill into a run) and sync config.
- **Export**: `/api/admin/music/export`.

### 5. Mobile App Settings — `MobileAppSettings.tsx` (628 + 11)
Full CMS for the mobile app's home screen. Two-pane: category list ⇄ page editor.

- Categories (the app's top nav): add, rename, activate/deactivate,
  **drag-to-reorder**.
- Hero slides per category: add, edit, delete, reorder, autorotate toggle.
- Sections per category: add, edit, delete, reorder.
- Items per section: pick albums or artists (`/pick/albums`, `/pick/artists`),
  add, remove, reorder.
- Custom prompt/confirm dialog system (`DialogContext`).
- Config editor (`/api/admin/mobile/config`).

### 6. Publish to Production — `PublishToProduction.tsx` (102 + 11)
Lists candidates from `/api/admin/publish/candidates` (code, title, artist,
studio track count, live count, path). Publish one, or publish all. Renders the
step-by-step result of `POST /api/admin/publish`.

### 7. Pipeline — `page.tsx` (37)
Stage-count KPIs plus a table of items (type, truncated id, stage pill, entered
timestamp) from `/api/pipeline`.

### 8. Awards — `page.tsx` (48)
Award periods for a hard-coded year (2026) from `/api/awards/periods/:year`, and
nominations from `/api/awards/nominations?period=`, grouped by category. Read-only
review surface — admins pick winners by hand; nomination count is signal, not a
vote.

### 9. Production History — `page.tsx` (76)
**Server-computed, no API.** `lib/productionHistory.ts` (142) buckets live albums
and songs into Sun–Sat PST workweeks (`YYWW`), scores each against a weekly quota
(`ALBUM_QUOTA` / `SONG_QUOTA`), colour-codes the score, and locks past weeks.
`revalidate = 600`.

### 10. Languages — `page.tsx` (55)
**Server-computed, no API.** `lib/languageStats.ts` (52) derives language from the
album code suffix (`…EN`, `…ES`). KPI row (supported, with content, total albums,
total songs) and a table with a coverage bar per language. `revalidate = 3600`.

### 11. Subscribers — `page.tsx` (128)
From `/api/admin/subscribers`: MRR total, paying-subscriber count, per-plan
roll-up, and a table of every active/past-due subscription — plan, currency,
interval, price, monthly equivalent, period end, cancel-at-period-end, start date.
Annual plans normalised to a monthly figure.

### 12. Users & Roles — `page.tsx` (179)
From `/api/admin/users`: every account with granted roles. Per row — inline
first/last name edit with dirty-tracking (`PATCH /users/:id`), checkbox toggles
for the four grantable roles (`PATCH /users/:id/roles`), and delete
(`DELETE /users/:id`). `viewer` is baseline and never shown as grantable.

---

## 2. Feature-by-feature comparison

Legend — **API**: is the endpoint in this repo? **Live**: is it deployed?
**UI**: does TorahSings have the screen?

| # | Section | API | Live | UI | Notes |
|---|---|:--:|:--:|:--:|---|
| — | Admin shell + nav + role gate | n/a | n/a | ◐ | `/admin` stub gates on role; no nav, no sub-pages |
| 1 | Analytics (7 tabs) | ✅ | ❌ | ❌ | `/api/analytics/*` 404s in prod |
| 2 | Active Listeners | ✅ | ? | ❌ | under the blanket `/api/admin` 401 |
| 3 | Overview (pipeline + audit) | ✅ | ❌ | ❌ | `/api/pipeline` 404s |
| 4 | Manage Music (6 tabs) | ✅ | ? | ❌ | needs `MANIFEST_PATH` |
| 5 | Mobile App Settings | ✅ | ? | ❌ | needs `MANIFEST_PATH` |
| 6 | Publish to Production | ✅ | ? | ❌ | |
| 7 | Pipeline | ✅ | ❌ | ❌ | `/api/pipeline` 404s |
| 8 | Awards | ✅ | ❌ | ❌ | `/api/awards/*` 404s |
| 9 | Production History | n/a | n/a | ❌ | pure front-end; **no API needed** |
| 10 | Languages | n/a | n/a | ❌ | pure front-end; **no API needed** |
| 11 | Subscribers | ✅ | ? | ❌ | Stripe mock until `STRIPE_*` |
| 12 | Users & Roles | ✅ | ? | ❌ | TorahSings adds `GET /users/:id` |

TorahSings' `admin.js` is a **superset** of Jubilujah's — same 11 handlers plus
`GET /users/:id`. No admin endpoint is missing.

---

## 3. Missing features

**Everything in the console except the role gate.** Grouped by what it costs:

**A. Needs only front-end work** (no API, no deploy, no config)
- Production History — port `lib/productionHistory.ts` + page
- Languages — port `lib/languageStats.ts` + page
- Admin shell: nav, sticky layout, sub-routes

**B. Needs front-end + the API deploy**
- Analytics (7 tabs, CSV export, `lib/bestseller.ts`)
- Overview (pipeline KPIs + audit feed)
- Pipeline
- Awards
- Active Listeners
- Users & Roles
- Publish to Production

**C. Needs front-end + deploy + config**
- Manage Music — `MANIFEST_PATH`, and `R2_*` for cover ops
- Mobile App Settings — `MANIFEST_PATH`
- Subscribers — `STRIPE_*` for real figures (renders with mock data otherwise)

**D. Supporting gaps**
- `lib/{languageStats,productionHistory,bestseller}.ts` — all three absent
- Admin CSS: Jubilujah uses global classes (`.admin-table`, `.kpi-row`, `.kpi`,
  `.notice`, `.section-title`, `.status-pill`) that **do not exist** in
  TorahSings' `globals.css`; only `.eyebrow` is present. Plus three widget
  stylesheets — `analytics.css` (207), `manage-music.css` (90),
  `mobile-settings.css` (188).
- **Styling convention differs**: Jubilujah uses global CSS + heavy inline styles;
  TorahSings uses CSS Modules throughout. A copy-paste port will not match the
  house style.
- `useAuth().hasRole(...)` (Jubilujah) vs `useJubileeAccount().isAdmin`
  (TorahSings, added 2026-07-23) — every ported component needs this swapped.

---

## 4. Implementation plan

Sequenced so each phase ships something usable and nothing is blocked waiting.

### Phase 0 — Unblock (no UI work)
1. **Deploy the parity API.** `API_PARITY.md` §5, still pending approval. Until
   this lands, 9 of 12 sections have no data source. Verify with the probe in §6.
2. Decide on the three config items — `MANIFEST_PATH`, `R2_*`, `STRIPE_*`. Each
   degrades gracefully (empty / 503 / mock), so none blocks *building*; they block
   the screens showing anything true.

### Phase 1 — Console shell + the two free wins
No API dependency, so this can start immediately and in parallel with Phase 0.

- `src/app/admin/layout.tsx` — vertical nav, sticky, role gate reusing `isAdmin`.
  Replace the current placeholder `/admin/page.tsx`.
- `src/components/admin/AdminNav.module.css` — house-style, not ported inline CSS.
- Admin CSS primitives as a module or a scoped global: table, KPI tile, notice,
  section title, status pill.
- **Languages** — port `languageStats` against `angelsCatalog` (album codes carry
  the `…EN` suffix already).
- **Production History** — port `productionHistory`; needs a completion date per
  album. The catalog has none today, so either add an mtime to the scan or drive
  it off the drive's folder timestamps.

*Deliverable: a real console with working nav and two live sections.*

### Phase 2 — Read-only sections (after Phase 0)
Cheap, high-value, all GET:
- **Users & Roles** (179) — highest operational value; makes granting admin a UI
  action instead of a SQL statement.
- **Subscribers** (128)
- **Overview** (46) + **Pipeline** (37) — share the `/api/pipeline` shape.
- **Awards** (48) — parameterise the hard-coded 2026.

### Phase 3 — Analytics
- Port `AnalyticsDashboard` (511) + `analytics.css` (207) + `lib/bestseller.ts`.
- Seven tabs; consider shipping Overview + Trends first, then the three tables,
  then Ratings/Reviews.
- **Check the dataviz skill before building the charts** rather than porting
  Jubilujah's styling wholesale.

### Phase 4 — Active Listeners + Publish to Production
- **Active Listeners** (109) — polling; use an interval that a real audience can
  sustain, and stop it when the tab is hidden.
- **Publish to Production** (102) — a write path that moves content live. Needs a
  confirm step (`ConfirmDialog` already exists in this repo as of `ce3303a`).

### Phase 5 — The two large CMS surfaces
Do these last: biggest, most stateful, and the most config-dependent.
- **Manage Music** (599 + 90 CSS) — 6 tabs, bulk operations, CDN sync. Split into
  one component per tab rather than one 600-line file.
- **Mobile App Settings** (628 + 188 CSS) — drag-and-drop ordering across four
  nested levels. The heaviest single item in the port; budget accordingly and
  reuse the existing `ConfirmDialog`.

### Rough size

| Phase | TSX | CSS / lib | Relative |
|---|--:|--:|:--:|
| 1 · shell + languages + history | ~210 | ~350 | M |
| 2 · read-only sections | ~440 | ~60 | M |
| 3 · analytics | ~530 | ~230 | L |
| 4 · listeners + publish | ~230 | ~40 | S |
| 5 · music + mobile | ~1,250 | ~280 | XL |
| **Total** | **~2,660** | **~960** | |

~3,600 lines to reach parity. The estimate assumes a port, not a redesign; the
CSS-Modules conversion and the `hasRole` → `isAdmin` swap are the per-file tax.

---

## 5. Decisions worth taking before Phase 1

- **Port or redesign?** A faithful port is faster and matches Jubilujah's
  operators' muscle memory. A redesign matches TorahSings' house style (CSS
  Modules, `PageHero`, the gold accent). This plan assumes *port the behaviour,
  restyle the surface*.
- **Hard-coded values** to parameterise on the way in: the awards year (2026),
  `ALBUM_QUOTA`/`SONG_QUOTA`, and the 10 pipeline stage names.
- **Client-side role checks are presentation only.** Every screen must keep
  assuming the API is the boundary — `requireRole('admin')` already enforces it.
- **The mobile CMS may not apply.** Sections 5 and part of 4 administer a *mobile
  app*. If TorahSings has no mobile app, Phase 5 halves — confirm before building.

---

## 6. How the findings were verified

- Feature inventory: read all 13 admin pages and 5 admin components in
  `W:\JubiLujah.com\app\web`.
- Endpoint mapping: extracted every `/api/...` string from those files.
- API comparison: diffed `api/src/routes/` filenames and line counts across both
  repos (23 files, near-identical); diffed `admin.js` handler lists directly.
- Deployment state: probed `https://api.torahsings.com` per route, **with a
  control request** (`/api/admin/zzz-nonexistent-control` → 401) proving the
  admin 401s are a blanket gate rather than route existence.

Re-run the deployment probe after Phase 0:

```bash
for p in /api/pipeline /api/analytics/overview /api/subscriptions/plans \
         /api/mobile/config /api/awards/periods/2026 /api/app-version; do
  printf "%-32s %s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "https://api.torahsings.com$p")"
done
# 404 = still the old build · 401/200 = parity API is live
```
