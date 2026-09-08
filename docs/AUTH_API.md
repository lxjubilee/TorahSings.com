# Torah Sings — Identity API

Reference for **sign up, sign in, get users, forgot password** on the TorahSings identity
service (`torahsings-api`), a replica of the Jubilujah identity API backed by the
`torahsings` database.

- **Base URL:** `https://api.torahsings.com` (local: `http://localhost:4031`)
- **Router prefix:** `/api/auth` (admin surface: `/api/admin`)
- **Source of truth:** `api/src/routes/auth.js`, `api/src/routes/admin.js`

> ✅ **Status (verified 2026-07-16): DEPLOYED AND LIVE on `https://api.torahsings.com`.**
> This supersedes the earlier "not deployed yet (awaiting go-ahead)" note, which was stale.
> Confirmed by read-only probes: `GET /api/auth/me` → `200 {"authenticated":false}`, and
> `signup` · `signin` · `forgot-password` ·
> `refresh` all answer with the documented validation contract (`400` + `issues[]`). The
> `50 req / 15 min / IP` limiter is active — responses carry `Ratelimit-Policy: 50;w=900`.
>
> **Not verified** (and so not claimed here): outbound email delivery, end-to-end account
> creation against production, the `AUTH_LOGIN_MODE` in force there, and the `/api/admin`
> surface. The identical endpoints also remain live on `https://api.jubilujah.com`.
>
> ⚠️ **Because it is live, `NEXT_PUBLIC_API_BASE=https://api.torahsings.com` means dev
> writes to production** — a sign-up from localhost creates a real account immediately.
> Use the local server below unless you mean to hit prod.

> 🧪 **Local, no-Postgres dev:** `npm run dev:auth` starts `scripts/local-auth-server.mjs`
> on **`http://localhost:4031`** — the full sign-up flow (one call → account created →
> signed in) against a SQLite file (`.local-auth.db`, gitignored). It imports the real
> scrypt KDF from `api/src/auth/password.js` and mirrors `api/src/auth/token.js`'s exact token
> format, and its contracts were checked byte-for-byte against the live endpoints. Point
> the web at it with `NEXT_PUBLIC_API_BASE=http://localhost:4031` in `.env.local`.
> Dev-only: no rate limiting, no 2FA/Turnstile, no JI delegation, no password reset.

> ⚠️ The older `AUTH_API.md` in the Jubilujah repo describes a `jv_session` **cookie +
> CSRF** model. That is **out of date.** The live code is **stateless Bearer tokens** — no
> cookies, no CSRF, no `X-CSRF-Token`.

---

## Auth model

Every successful login path returns a **token pair**:

```json
{
  "accessToken":  "<JubileeInspire-format token, 1h TTL>",
  "refreshToken": "<opaque, DB-backed, revocable, 30d (1y if rememberMe)>",
  "expiresAt":    "<ISO/ms expiry of the ACCESS token>"
}
```

- Send the access token on authenticated calls: `Authorization: Bearer <accessToken>`.
- When it expires, redeem the refresh token at **`POST /api/auth/refresh`** — body
  `{ "refreshToken": "..." }` — to get a fresh pair without re-entering credentials.
- Store both like passwords (Keychain/Keystore on native; never log them).

**Conventions:** JSON in/out, bodies capped at 256 KB, camelCase fields.
**Rate limit:** all `/api/auth/*` share **50 requests / 15 min / IP** → `429`.
**Errors:** `{ "error": "error", "message": "..." }`; validation adds `issues: [{path, message}]`.

---

## 1. Sign up

**One call.** Signing up no longer proves the address: the account is created, the
Jubilee ID is provisioned at the shared authority, and tokens come back — nothing is
emailed and nothing waits on a code.

> **Changed — breaking.** `POST /api/auth/verify-signup` and
> `POST /api/auth/send-signup-verification` **have been removed**, and `/signup` no
> longer answers `200 { requiresVerification, verificationGuid }`. This follows
> JubileeInspire's Jubilee ID door, which dropped the sign-up OTP first. The **login**
> OTP (§2) is unchanged.

### 1.1 `POST /api/auth/signup` — create the account and sign in

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–120 chars |
| `email` | string | valid email, ≤254, stored lowercase |
| `password` | string | 8–200 chars |
| `rememberMe` | boolean | optional → 1-year refresh |

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "correct horse battery" }
```

**201 Created** — account created **and logged in**:
```json
{ "success": true,
  "user": { "id": "…", "email": "ada@example.com", "displayName": "Ada Lovelace" },
  "tokens": { "accessToken": "…", "refreshToken": "…", "expiresAt": "…" } }
```
- `409` — an active account already exists here **or** at the Jubilee ID authority →
  "Please sign in." (The same generic message either way — signup already reveals
  existence, so this adds no enumeration surface.)
- `400` — validation failed (`issues[]`).

The address is **not** verified by this flow. `first_signin_completed` is set TRUE, as it
was when the code proved it: in this API that column gates the **login** OTP, so leaving
it FALSE would only move the emailed code to the next sign-in.

---

## 2. Sign in

| Field | Type | Rules |
|---|---|---|
| `email` | string | valid email |
| `password` | string | 1–200 chars |
| `rememberMe` | boolean | optional → 1-year refresh |
| `cfTurnstileToken` | string | optional (required if Turnstile configured) |
| `verificationGuid` + `verificationCode` | string | optional — submit an OTP inline |

### `POST /api/auth/signin`
```json
{ "email": "ada@example.com", "password": "correct horse battery", "rememberMe": true }
```

**Outcome A — logged in (200):**
```json
{ "user": { "id": "…", "email": "…", "displayName": "…" },
  "tokens": { "accessToken": "…", "refreshToken": "…", "expiresAt": "…" } }
```

**Outcome B — OTP required (200)** — a code was emailed; **no tokens yet**:
```json
{ "success": true, "requires2FA": true, "email": "ada@example.com", "verificationGuid": "…" }
```
Triggered on **first sign-in** (email gate) or when **2FA** is enabled. Then call
**`POST /api/auth/verify-login`** with `{ email, verificationGuid, verificationCode, rememberMe? }`
→ returns the same `{ user, tokens }`. Resend via `POST /api/auth/send-login-verification`.

**Errors**
- `401 Invalid email or password` — same message for unknown email *and* wrong password (no enumeration).
- `400` — Turnstile failed. `423` — account locked (`locked: true`, `lockedUntil`).
- OTP: 15-min expiry, 5 attempts, 60 s resend cooldown, lockout **1 h** after 2 resends.

---

## 3. Get users  *(admin only)*

### `GET /api/admin/users`
- **Auth:** `Authorization: Bearer <accessToken>` of a user holding the **`admin`** role
  (`requireRole('admin')`); otherwise `403`.
- No body, no params. Returns **all** users ordered by `created_at`.

**200 OK** — a JSON **array**:
```json
[
  {
    "id": "…", "email": "ada@example.com",
    "display_name": "Ada Lovelace", "first_name": "Ada", "last_name": "Lovelace",
    "is_active": true, "last_login_at": "2026-07-16T…Z", "created_at": "2026-07-01T…Z",
    "roles": ["admin", "content_editor"]
  }
]
```
> Note snake_case here (raw DB rows), unlike the camelCase auth surface.
> Related: `PATCH /api/admin/users/:id` `{ first_name, last_name }` updates names.
> Grantable roles: `reviewer`, `content_editor`, `executive`, `admin`.

---

## 4. Forgot password

Anti-enumeration: the response is **identical whether or not the email exists**.

### 4.1 `POST /api/auth/forgot-password`
Body `{ "email": "ada@example.com" }`

**200 OK — always:**
```json
{ "ok": true, "message": "If an account exists for that email, a reset link has been sent." }
```
Emails a single-use link to **`https://torahsings.com/reset-password?token=<rawToken>`**,
valid **60 minutes** (`PASSWORD_RESET_TTL_MIN`).

### 4.2 `POST /api/auth/reset-password` — redeem the token

| Field | Type | Rules |
|---|---|---|
| `token` | string | 20–200 chars, from the link |
| `password` | string | 8–200 chars (new password) |

**200 OK** → `{ "ok": true }`

Side effects: burns this **and all other** outstanding reset tokens, clears any login
lockout, and **revokes every session** (all devices must sign in again).
It does **not** log the user in — send them to sign-in afterward.

- `400 This reset link is invalid or has expired.` — unknown/used/expired token or inactive account.

---

## 5. Get token

Two **different** token endpoints — pick by who is calling.

| | User token (`/api/auth/refresh`) | Service token (`/api/auth/service/token`) |
|---|---|---|
| Caller | A signed-in **user** (web/mobile) | A trusted **partner service** (server-to-server) |
| Credential in | `refreshToken` from sign-in | `client_id` + `client_secret` |
| Returns | `accessToken` (1h) | `access_token` HS256 **JWT** (10 min) |
| Used on | `/api/auth/*`, `/api/admin/*` | `/api/auth/admin/*` only |
| Format | **Not a JWT** (see below) | Real HS256 JWT |
| Case | camelCase | snake_case (OAuth2) |

### 5.1 `POST /api/auth/refresh` — new access token for a user

| Field | Type | Rules |
|---|---|---|
| `refreshToken` | string | 20–400 chars, from any login response |

```json
{ "refreshToken": "…" }
```

**200 OK** — note the `tokens` wrapper:
```json
{ "tokens": { "accessToken": "<fresh 1h token>", "refreshToken": "<the SAME token back>", "expiresAt": "…" } }
```

> **Non-rotating by design.** The *same* refresh token is returned; its expiry **slides
> forward** server-side. So concurrent refreshes from multiple tabs/devices do **not**
> invalidate each other, and the session survives until an explicit logout or going idle
> past the TTL. Don't expect a new refresh token — keep storing the one you have.

- `401 Invalid or expired refresh token` — unknown, expired, or revoked (logout / logout-all / password reset).

**Access-token format** (`auth/token.js`) — a JubileeInspire-format token, **not** a standard JWT:
```
base64url(JSON.stringify(payload)) + "." + base64url(HMAC_SHA256(b64, secret))
```
Payload carries `type`, `exp` (ms epoch), `iat` (ms epoch), `jti`. Don't feed it to a JWT library — it has two parts, not three.

### 5.2 `POST /api/auth/service/token` — client-credentials JWT (server-to-server)

| Field | Type | Rules |
|---|---|---|
| `grant_type` | string | optional; only `client_credentials` supported |
| `client_id` | string | 1–128 chars |
| `client_secret` | string | 1–512 chars (constant-time compared) |
| `scope` | string | optional, space-delimited; must be a **subset** of what the client is granted (omit to get all) |

```json
{ "grant_type": "client_credentials", "client_id": "torahsings",
  "client_secret": "<secret>", "scope": "admin.set_password admin.provision" }
```

**200 OK**
```json
{ "access_token": "<HS256 JWT>", "token_type": "Bearer", "expires_in": 600,
  "scope": "admin.set_password admin.provision" }
```

- `401 invalid_client` — unknown id / wrong secret (sends `WWW-Authenticate: Bearer`).
- `403 invalid_scope` — requested scope not granted.
- `503 Service token issuance is not configured.` — `SERVICE_JWT_SECRET` unset (fails closed).

Then call an admin route with `Authorization: Bearer <access_token>`:
`POST /api/auth/admin/set-password` (`admin.set_password`) · `POST /api/auth/admin/provision-user` (`admin.provision`) · `GET /api/auth/admin/check-email` (`admin.check_email`).
Clients are registered via the `SERVICE_CLIENTS` env (`id:secret:scopeA|scopeB`, comma-separated).

### 5.3 `GET /api/auth/admin/check-email?email=<email>` — does an account exist?

For a partner service deciding between `provision-user` (new) and `set-password` (existing) before it writes. Read-only; scope `admin.check_email`. Email is trimmed + lower-cased, so lookup is case-insensitive.

**200 OK** — found:
```json
{ "email": "a@b.com", "exists": true,
  "user": { "id": "<uuid>", "email": "a@b.com", "displayName": "A B",
            "active": true, "emailVerified": true, "roles": ["content_editor"],
            "createdAt": "2026-07-17T07:13:40.971Z" } }
```
**200 OK** — not found: `{ "email": "a@b.com", "exists": false }`

- `exists` tracks the row; **`active` is reported separately** — a deactivated account still owns the email, so `exists: true, active: false` means *do not provision*, it is not a free address.
- Only **verified** accounts count: a pending sign-up (code not yet entered) has no `identity.users` row, so it reports `exists: false`. That matches `POST /signup`, which also tests only `users` — it does *not* 409 a pending sign-up, it drops the old pending row and issues a fresh code.
- `400` + `issues[]` on a missing/invalid email · `401` on a missing/bad service token.

> **Never expose this to the browser.** Unauthenticated, it is an account-enumeration oracle — anyone could test which emails have accounts here. It is service-only for that reason; `POST /signup`'s 409 remains the sole public answer, and it costs an attacker a real sign-up attempt (rate-limited) per guess.

---

## Supporting

| Flow | Method & path | Auth |
|---|---|---|
| Current user | `GET /api/auth/me` | optional Bearer |
| Refresh tokens | `POST /api/auth/refresh` | `{ refreshToken }` |
| Logout | `POST /api/auth/logout` | Bearer |
| Logout everywhere | `POST /api/auth/logout-all` | Bearer |
| Change password | `POST /api/auth/change-password` | Bearer, snake_case body |
| Delete account | `DELETE /api/auth/account` | Bearer (irreversible) |

`GET /api/auth/me` → `{ "authenticated": true, "user": {…}, "roles": [...] }` or `{ "authenticated": false }`.

---

## Quick curl

```bash
API=https://api.torahsings.com     # not live yet — use https://api.jubilujah.com to test

# Sign up — one call, returns 201 {user, tokens}
curl -sX POST $API/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"correct horse battery"}'

# Sign in
TOKENS=$(curl -sX POST $API/api/auth/signin -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}')
ACCESS=$(echo "$TOKENS" | jq -r .tokens.accessToken)

# Get users (admin)
curl -s $API/api/admin/users -H "Authorization: Bearer $ACCESS"

# Forgot password
curl -sX POST $API/api/auth/forgot-password -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com"}'

# Get token (user) — swap a refresh token for a fresh access token
REFRESH=$(echo "$TOKENS" | jq -r .tokens.refreshToken)
curl -sX POST $API/api/auth/refresh -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"        # -> { "tokens": { accessToken, refreshToken (same), expiresAt } }

# Get token (service) — client credentials -> short-lived JWT for /api/auth/admin/*
JWT=$(curl -sX POST $API/api/auth/service/token -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"torahsings","client_secret":"'"$CLIENT_SECRET"'","scope":"admin.provision"}' \
  | jq -r .access_token)
curl -sX POST $API/api/auth/admin/provision-user -H "Authorization: Bearer $JWT" \
  -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"…"}'
```
