# TorahSings API — full reference

The backend behind `api.torahsings.com`. It runs as the PM2 process **`torahsings-api`**
from `/var/www/torahsings.com/api` on the VPS, behind its own nginx vhost, and is
**separate from the Next app** (PM2 `torahsings`, port 3122) that serves the site.

> **This directory is not in the web repo.** The API's source lives only on the
> server. This document was written by reading that source directly
> (`api/src/index.js`, `api/src/routes/*.js`, `api/src/config.js`) on
> 2026-07-16. If you change the API, update this file from the code, not memory.

Related: [AUTH_API.md](./AUTH_API.md) is the older, auth-only write-up that shipped
with the API. This file supersedes it in scope (it also covers the service,
admin and health surfaces) but AUTH_API.md carries more prose on the flows.

---

## 1. What is actually mounted

The API is a copy of the JubiLujah API, and `api/src/routes/` contains **22 route
files**. Only **four routers are imported and mounted** in `src/index.js`. The rest
(`catalog.js`, `ratings.js`, `radio.js`, `music.js`, `tracks.js`, `reviews.js`,
`comments.js`, `awards.js`, `listening.js`, `analytics.js`, `me.js`, `mobile.js`,
`mobileAdmin.js`, `pipeline.js`, `publish.js`, `subscriptions.js`,
`subscriptionsWebhook.js`, `appVersion.js`, `reviewsAdmin.js`) are **dormant** —
they are on disk but unreachable. Do not assume an endpoint exists because a file
for it does.

`src/index.js` states the intent plainly: *"A copy of the Jubilujah API mounting
ONLY the auth surface (/api/auth/*)."*

| Mount | Router | Rate limiter |
| --- | --- | --- |
| `/api/auth/service` | `routes/serviceToken.js` | `serviceLimiter` |
| `/api/auth/admin` | `routes/service.js` | `serviceLimiter` |
| `/api/auth` | `routes/auth.js` | `authLimiter` |
| `/api/admin` | `routes/adminUsers.js` | `writeLimiter` |
| `/health` | inline in `index.js` | none |

Anything else returns the 404 body from `middleware/error.js`:

```json
{ "error": "not_found", "message": "No route for GET /whatever" }
```

---

## 2. Base URLs

| Environment | Base |
| --- | --- |
| Production | `https://api.torahsings.com` |
| On the box | `http://127.0.0.1:${API_PORT}` |

CORS is an **allowlist**, not a wildcard: an `Origin` is permitted only if it
appears in `CORS_ORIGIN` (comma-separated). Requests with no `Origin` (curl,
server-to-server) are allowed. `credentials: true` is set, though the API uses
Bearer tokens rather than cookies. Production currently allows
`https://torahsings.com` and `https://www.torahsings.com`.

JSON bodies are capped at **256 kb**. `trust proxy` is `1`, so `req.ip` is the
client address from `X-Forwarded-For` — this matters for the rate limiters and
for the Turnstile `remoteip`.

---

## 3. Authentication model

Three distinct credentials, easy to confuse:

| Kind | Sent as | Guards | Issued by |
| --- | --- | --- | --- |
| **Access token** (user) | `Authorization: Bearer <jwt>` | `requireAuth`, `requireRole` | any sign-in path |
| **Refresh token** (user) | JSON body field | `POST /api/auth/refresh` | any sign-in path |
| **Service token** (machine) | `Authorization: Bearer <jwt>` | `requireServiceAuth` + scope | `POST /api/auth/service/token` |

`attachSession` runs on **every** request and resolves `req.auth` from the Bearer
access JWT. There are **no cookies**. A route is public unless it declares
`requireAuth`, `router.use(requireRole(...))`, or `requireServiceAuth`.

### Token lifetimes

| Token | Default | Env override |
| --- | --- | --- |
| Access | 1 hour | `ACCESS_TOKEN_TTL_MS` |
| Refresh | 30 days | `REFRESH_TOKEN_TTL_MS` |
| Refresh with `rememberMe: true` | **1 year** | `EXTENDED_REFRESH_TTL_MS` |

`rememberMe` is what maps to the extended refresh lifetime — this is the field the
web sign-in form's "Keep me signed in on this device" checkbox is meant to send.
The defaults mirror JubileeInspire's.

Every successful sign-in returns the same `tokens` object:

```json
{
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque>",
    "expiresAt": "<ISO-8601, access token expiry>"
  }
}
```

### Login mode — `local` vs `ji`

`AUTH_LOGIN_MODE` decides who is the credential authority.

- **`local`** — verify scrypt hashes in `identity.credentials`. Self-contained.
- **`ji`** — `POST /api/auth/signin` forwards email + password (+ the raw
  `cfTurnstileToken`) to JubileeInspire's `/api/auth/login` via
  `services/jiLogin.js`. **JI verifies the Turnstile token itself**, so the API
  must forward it raw and must not verify it first (tokens are single-use).
  Requires `JI_SERVICE_CLIENT_ID` / `JI_SERVICE_CLIENT_SECRET`; without them,
  `ji` mode silently fails to provision/sync and sign-in breaks.

**Production is currently `ji`** — confirmed live:

```console
$ curl -s https://api.torahsings.com/health
{"status":"healthy","db":true,"service":"torahsings-api","loginMode":"ji"}
```

---

## 4. Cloudflare Turnstile

Gate lives in `routes/auth.js`, on the **password step of `/signin` only** — when
`verificationGuid` + `verificationCode` are present (step 2), the unguessable GUID
is the proof and the captcha is skipped.

```js
async function verifyTurnstile(token, remoteip) {
  if (!config.turnstile.secret) return true;   // no secret => verification skipped
  if (!token) return false;                    // secret set => a token is REQUIRED
  ...
}
```

Consequences worth internalising:

- With `TURNSTILE_SECRET_KEY` **empty**, every token passes unchecked.
- With it **set**, any `/signin` request that omits `cfTurnstileToken` is rejected
  with **400 `Human verification failed. Please retry.`** — including existing
  clients that never sent one.

As of 2026-07-16 both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are **set**
in `/var/www/torahsings.com/.env`, but `torahsings-api` **has not been restarted
since**, so it is still running with the old empty values. The gate arms on its
next restart. The endpoint has zero hits in its access log, so nothing breaks today.

---

## 5. Rate limits

`standardHeaders: true` — clients get `RateLimit-*` response headers.

| Limiter | Window | Max | Applies to | Keyed by |
| --- | --- | --- | --- | --- |
| `authLimiter` | 15 min | 50 | `/api/auth/*` | IP |
| `writeLimiter` | 1 min | 120 | `/api/admin/*` (skips `GET`/`HEAD`) | IP |
| `serviceLimiter` | 15 min | `ADMIN_SERVICE_RATE_MAX` | `/api/auth/service`, `/api/auth/admin` | service client |

Exceeding a limit returns **429** with `{"error": "error", ...}`.

---

## 6. Error format

Every error is JSON from `middleware/error.js`:

```json
{ "error": "<code>", "message": "<human readable>" }
```

| Status | `error` code | Notes |
| --- | --- | --- |
| 400 | `error` | validation / bad input |
| 401 | `unauthorized` | missing or invalid token |
| 403 | `forbidden` | authenticated but wrong role/scope |
| 404 | `not_found` | no such route or resource |
| 409 | `conflict` | duplicate — also raised by Postgres `23505` |
| 422 | `unprocessable` | constraint violation — Postgres `23514`, adds `detail` |
| 429 | `error` | rate limited |
| 503 | `unavailable` | dependency down |
| 500 | `internal` | unhandled; body is always `Internal server error` |

`HttpError` may attach extra fields (e.g. `locked`, `cooldownSeconds`,
`resendsRemaining`), which are merged into the body — the web client reads these.

Request IDs come from `X-Request-Id` or are generated per request, and appear in
the server logs (`reqId`) — quote one when reporting a 500.

---

## 7. Endpoints

### 7.1 Health

#### `GET /health`

Unauthenticated. Returns **200** when the DB responds, **503** when it does not.

```json
{ "status": "healthy", "db": true, "service": "torahsings-api", "loginMode": "ji" }
```

---

### 7.2 Public auth — `/api/auth`

All bodies are JSON and validated with zod; a failure is a 400.

#### `POST /api/auth/signup`

Phase 1 of registration. Emails a 6-digit code; **creates no session**.

| Field | Rules |
| --- | --- |
| `name` | required, 1–120, trimmed |
| `email` | required, valid, ≤254, trimmed |
| `password` | required, 8–200 |

```json
{ "success": true, "requiresVerification": true, "email": "…", "verificationGuid": "<uuid>" }
```

#### `POST /api/auth/verify-signup`

Phase 2. Consumes the code and **signs the user in** (201).

| Field | Rules |
| --- | --- |
| `verificationGuid` | required, uuid |
| `verificationCode` | required, exactly 6 digits |
| `rememberMe` | optional boolean → 1-year refresh |

```json
{ "user": { "id": "…", "email": "…", "displayName": "…" }, "tokens": { … } }
```

#### `POST /api/auth/send-signup-verification`

Resends the signup code. Body: `{ "verificationGuid": "<uuid>" }`.
Returns `{ "success": true, … }` — may include `resendsRemaining` / `cooldownSeconds`.

#### `POST /api/auth/signin`

The main path, and the only one with a captcha gate.

| Field | Rules |
| --- | --- |
| `email` | required, valid, ≤254 |
| `password` | required, 1–200 |
| `cfTurnstileToken` | optional, ≤2048 — **required in practice once a secret is configured**, password step only |
| `verificationGuid` | optional uuid — step 2 |
| `verificationCode` | optional 6 digits — step 2 |
| `rememberMe` | optional boolean → 1-year refresh |

Two possible successes. **2FA required:**

```json
{ "success": true, "requires2FA": true, "email": "…", "verificationGuid": "<uuid>" }
```

…then re-POST to this same endpoint with `verificationGuid` + `verificationCode`
(plus the original password; no captcha). **Signed in:**

```json
{ "user": { … }, "tokens": { … } }
```

Errors: 400 captcha failure or bad code, 401 bad credentials, **423** account
locked (body carries `locked`).

#### `POST /api/auth/verify-login`

The **local-mode** OTP completion path. In `ji` mode the web client completes 2FA
by re-submitting to `/signin` instead, so this is not the path production uses.

Body: `email`, `verificationGuid`, `verificationCode`, optional `rememberMe`.
Returns `{ user, tokens }`.

#### `POST /api/auth/send-login-verification`

Resends the sign-in OTP. Body: `email` + `verificationGuid`.
Returns `{ "success": true, … }`, may carry `resendsRemaining` / `cooldownSeconds`;
429 on cooldown, 423 if locked.

#### `POST /api/auth/forgot-password`

Body: `{ "email": "…" }`. **Always** the same response, so it never reveals whether
an account exists:

```json
{ "ok": true, "message": "If an account exists for that email, a reset link has been sent." }
```

Only password-credentialed active users actually receive mail. Link TTL:
`PASSWORD_RESET_TTL_MIN` (default 60).

#### `POST /api/auth/reset-password`

| Field | Rules |
| --- | --- |
| `token` | required, 20–200 (from the emailed link) |
| `password` | required, 8–200 |

Returns `{ "ok": true, "jiSync": … }`.

#### `POST /api/auth/change-password` 🔒

Requires a Bearer access token.

| Field | Rules |
| --- | --- |
| `current_password` | required, 1–200 |
| `new_password` | required, 8–200 |
| `refreshToken` | optional — pass yours so this device stays signed in while every other device is revoked |

Returns `{ "ok": true, "jiSync": … }`.

#### `POST /api/auth/refresh`

Body: `{ "refreshToken": "…" }` (20–400 chars). Redeems it for a fresh access token.

```json
{ "tokens": { "accessToken": "…", "refreshToken": "<the same one you sent>", "expiresAt": "…" } }
```

401 if invalid or expired.

#### `POST /api/auth/logout`

Public (no auth needed). Returns `{ "ok": true }`.

#### `POST /api/auth/logout-all` 🔒

Revokes every refresh token for the user. Returns `{ "ok": true }`.

#### `DELETE /api/auth/account` 🔒

Deletes the authenticated account. Returns `{ "ok": true }`.

#### `GET /api/auth/me`

**Never 401s** — returns 200 either way, so it is safe to call unauthenticated.

```json
{ "authenticated": false }
```

```json
{ "authenticated": true, "user": { … }, "roles": ["user"] }
```

---

### 7.3 Service tokens — `/api/auth/service`

#### `POST /api/auth/service/token`

OAuth2-style client-credentials grant. Mints the service JWT the admin surface needs.

| Field | Rules |
| --- | --- |
| `grant_type` | optional, must be `client_credentials` |
| `client_id` | required, 1–128 |
| `client_secret` | required, 1–512 |
| `scope` | optional, ≤512, space-separated |

Clients are configured via `SERVICE_CLIENTS`; tokens are signed with
`SERVICE_JWT_SECRET` for `SERVICE_JWT_ISSUER` / `SERVICE_JWT_AUDIENCE`, TTL
`SERVICE_TOKEN_TTL_SEC`. `SERVICE_CLIENTS` is currently **empty** in production, so
no service client can authenticate today.

---

### 7.4 Service admin — `/api/auth/admin`

Machine-to-machine. Requires a service token **and** the named scope. May also be
IP-restricted via `ADMIN_SERVICE_ALLOW_IPS`. Both accept an **`Idempotency-Key`**
header.

#### `POST /api/auth/admin/set-password` — scope `admin.set_password`

| Field | Rules |
| --- | --- |
| `email` | required, valid, ≤254 |
| `newPassword` | required (length enforced in the handler → **422**, not 400) |

#### `POST /api/auth/admin/provision-user` — scope `admin.provision`

| Field | Rules |
| --- | --- |
| `email` | required, valid, ≤254 |
| `password` | required (length enforced in the handler → 422) |
| `firstName` | optional, ≤50 |
| `lastName` | optional, ≤50 |
| `displayName` | optional, ≤100 |
| `role` | optional — `user` \| `admin` \| `guest` |
| `emailVerified` | optional boolean |

---

### 7.5 Admin — `/api/admin`

`router.use(requireRole('admin'))` guards the **whole** router: a valid user access
token with the `admin` role. Non-admins get 403.

#### `GET /api/admin/users`

Every account with its granted roles — `id`, `email`, `display_name`, `first_name`,
`last_name`, `is_active`, `last_login_at`, `created_at`.

#### `GET /api/admin/users/:id`

One account. 400 if `:id` is not a UUID, 404 if absent.

#### `PATCH /api/admin/users/:id`

| Field | Rules |
| --- | --- |
| `first_name` | optional, ≤120, defaults `''` |
| `last_name` | optional, ≤120, defaults `''` |

`display_name` is recomputed as `"first last"`. **At least one** of the two must be
non-empty, else 400 `a first or last name is required`. 400 on a non-UUID `:id`.

---

## 8. Environment

Read from `/var/www/torahsings.com/.env` (the **shared** file — the Next app reads
it too, which is why setting `TURNSTILE_SECRET_KEY` there affects both).

| Group | Variables |
| --- | --- |
| Core | `NODE_ENV`, `API_PORT`, `CORS_ORIGIN`, `WEB_BASE_URL`, `WEB_INTERNAL_URL` |
| Auth | `AUTH_LOGIN_MODE`, `JWT_SECRET`, `SESSION_SECRET`, `ACCESS_TOKEN_TTL_MS`, `REFRESH_TOKEN_TTL_MS`, `EXTENDED_REFRESH_TTL_MS`, `REFRESH_TTL_DAYS` |
| Captcha | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| JubileeInspire | `JI_API_BASE`, `JI_LOGIN_BASE`, `JI_LOGIN_SOURCE`, `JI_SERVICE_CLIENT_ID`, `JI_SERVICE_CLIENT_SECRET` |
| Service surface | `SERVICE_CLIENTS`, `SERVICE_JWT_SECRET`, `SERVICE_JWT_ISSUER`, `SERVICE_JWT_AUDIENCE`, `SERVICE_TOKEN_TTL_SEC`, `ADMIN_SERVICE_ALLOW_IPS`, `ADMIN_SERVICE_RATE_MAX` |
| Email | `SENDGRID_API_KEY`, `EMAIL_FROM`, `PASSWORD_RESET_TTL_MIN` |
| Billing (dormant) | `PAYMENT_PROVIDER`, `BILLING_CURRENCY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_FAMILY`, `CHECKOUT_SUCCESS_PATH`, `CHECKOUT_CANCEL_PATH` |
| Content (dormant) | `CDN_BASE`, `MANIFEST_PATH`, `LISTENING_TZ`, `REVALIDATE_SECRET` |
| DB | `DATABASE_URL` |

The billing and content groups are read by `config.js` but belong to the dormant
routers — they do nothing while those routers stay unmounted.

---

## 9. Known gaps

Facts worth knowing before building against this, all verified 2026-07-16:

1. **The website does not use this API.** `src/lib/jubilee-account.tsx` in the Next
   app still runs a localStorage stub, so `torahsings.com/signin` accepts *any*
   email and password and fabricates a client-side session. Every endpoint above is
   effectively unused — `/api/auth/signin` has **zero hits** in its nginx access log.
2. **`src/openapi.json` is stale.** It self-describes as *"Jubilujah.com API 1.0.0"*
   with `servers: http://localhost:4000` and 28 paths that do not match what is
   mounted here. Do not generate clients from it.
3. **`SERVICE_CLIENTS` is empty**, so `/api/auth/service/token` cannot mint a token
   and the whole `/api/auth/admin` surface is unreachable in production.
4. **Turnstile is configured but not yet armed** — see §4.
5. **No `api/` in the web repo.** There is no local source of truth; the server is
   the only copy, and `.bak-*` files sit next to live sources in `api/src/`.
