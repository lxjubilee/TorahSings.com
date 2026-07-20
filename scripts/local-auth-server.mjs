#!/usr/bin/env node
/**
 * LOCAL DEV AUTH SERVER — sign-up / sign-in against a local SQLite database.
 *
 * WHY THIS EXISTS
 * ---------------
 * `torahsings-api` (../api) is the real service, but it needs PostgreSQL and is
 * not deployed yet (docs/AUTH_API.md). This stands in for it on localhost so the
 * whole sign-up flow — request code → verify code → account created → signed in
 * — completes with **no Postgres, no Docker, no SendGrid, no network**.
 *
 * WHAT MAKES IT FAITHFUL (not a hand-wave mock)
 * ---------------------------------------------
 *   • It imports the REAL `hashPassword`/`verifyPassword` from
 *     ../api/src/auth/password.js — the same scrypt KDF, byte-for-byte.
 *   • It imports the REAL token minting from ../api/src/auth/token.js — the same
 *     `base64url(JSON).base64url(HMAC-SHA256)` pair the web client expects.
 *   • The request/response contracts, validation rules, status codes and error
 *     shapes mirror api/src/routes/auth.js and were verified against the live
 *     endpoints on api.jubilujah.com (empty body → the same `issues[]`).
 *   • The 6-digit code is printed to this console — exactly what the real API's
 *     dev email transport does when SENDGRID_API_KEY is empty (api/src/config.js).
 *
 * WHAT IT IS NOT
 * --------------
 * Dev-only. No rate limiting, no 2FA, no Turnstile, no JubileeInspire delegation,
 * no password reset. It is NOT a substitute for torahsings-api in production.
 *
 * RUN
 * ---
 *   node scripts/local-auth-server.mjs            # listens on :4031
 *   PORT=4055 node scripts/local-auth-server.mjs
 *
 * Then point the web at it (.env):
 *   NEXT_PUBLIC_API_BASE=http://localhost:4031
 * and `npm run dev`. next.config.mjs rewrites /api/* here, so the browser stays
 * same-origin and no CORS is involved.
 *
 * The database is a single file: .local-auth.db (gitignored). Delete it to reset.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// -------------------------------------------------------------------- env ---
// Secrets live in .env (gitignored), never in this file. loadEnvFile is built
// into Node >=21.7 — no dotenv dependency, which keeps this script zero-dep.
// Values already in the real environment win; loadEnvFile does not overwrite.
for (const f of ['.env', '.env.local']) {
  const p = path.join(ROOT, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

/** Read a required secret, or explain exactly how to fix its absence and exit. */
function requireEnv(name, purpose) {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  console.error(`\n  ✗ ${name} is not set — it ${purpose}.\n`);
  console.error('    This server keeps no secret in source, so it cannot start without one.');
  console.error('    Create .env in the repo root (it is gitignored):\n');
  console.error(`      ${name}=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")\n`);
  console.error('    See .env.example for every key.\n');
  process.exit(1);
}

// pathToFileURL: on Windows a bare absolute path ("w:\...") is not a legal ESM
// specifier — the loader needs a file:// URL.
const apiMod = (...p) => pathToFileURL(path.join(ROOT, 'api', 'src', ...p)).href;

// The REAL scrypt KDF, imported straight from the service. password.js depends on
// nothing but node:crypto, so it loads even though api/node_modules is absent —
// which means a local account's hash is byte-for-byte what torahsings-api makes.
const { hashPassword, verifyPassword } = await import(apiMod('auth', 'password.js'));

// ------------------------------------------------------------------- tokens ---
// Mirrors api/src/auth/token.js EXACTLY (itself matching JubileeInspire's
// api/services/crypto.js). We re-implement instead of importing because token.js
// imports config.js -> dotenv, and api/node_modules is not installed (installing
// it would drag in pg/stripe/sendgrid for one helper, and there is no Postgres
// here to use them against). The wire format is what src/lib/api.ts parses, so
// it must not drift:
//     base64url(JSON.stringify(payload)) + "." + base64url(HMAC_SHA256(b64, secret))
// A TWO-part hand-rolled token, NOT a standard 3-part JWT.
// No hardcoded fallback, deliberately. A default secret in source is a PUBLIC
// secret — anyone reading the repo could forge a token that this server accepts.
// Fail closed instead: unset => refuse to start. See requireEnv() above.
const TOKEN_SECRET = requireEnv('JWT_SECRET', 'signs local access/refresh tokens');
const ACCESS_TTL_MS = Number(process.env.ACCESS_TOKEN_TTL_MS || 60 * 60 * 1000); // 1h
const REFRESH_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000); // 30d
const EXTENDED_REFRESH_TTL_MS = Number(
  process.env.EXTENDED_REFRESH_TTL_MS || 365 * 24 * 60 * 60 * 1000
); // 1y — "keep me signed in"

const randHex = (bytes) => crypto.randomBytes(bytes).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// The /api/auth/admin/* service gate. The real API takes a client-credentials
// HS256 JWT (SERVICE_JWT_SECRET, per-route scopes — see api/src/middleware/
// serviceAuth.js); reproducing that flow locally would need `jose` and buys
// nothing, so this accepts one static dev token instead. What it DOES preserve
// is the shape callers must code against: Bearer or 401. Never a public route.
const SERVICE_TOKEN = requireEnv('LOCAL_SERVICE_TOKEN', 'authorises /api/auth/admin/* calls');
function requireServiceAuth(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  const presented = m?.[1].trim();
  // timingSafeEqual needs equal lengths; hash both so any input is comparable.
  const ok =
    presented &&
    crypto.timingSafeEqual(
      Buffer.from(hashToken(presented), 'hex'),
      Buffer.from(hashToken(SERVICE_TOKEN), 'hex')
    );
  if (!ok) throw new HttpError(401, 'Invalid or missing service token.');
}

function sign(payload, type, ttlMs) {
  const expiresAt = new Date(Date.now() + ttlMs);
  const data = { ...payload, type, exp: expiresAt.getTime(), iat: Date.now(), jti: randHex(16) };
  const b64 = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
  const token = `${b64}.${signature}`;
  return { token, hash: hashToken(token), expiresAt };
}

const generateAccessToken = (payload) => sign(payload, 'access', ACCESS_TTL_MS);
const generateRefreshToken = (payload, { extended = false } = {}) =>
  sign(payload, 'refresh', extended ? EXTENDED_REFRESH_TTL_MS : REFRESH_TTL_MS);

function verifyToken(token, expectedType) {
  try {
    if (typeof token !== 'string') return null;
    const [b64, signature] = token.split('.');
    if (!b64 || !signature) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    if (expectedType && payload.type !== expectedType) return null;
    return payload;
  } catch {
    return null;
  }
}

const PORT = Number(process.env.PORT || 4031);
const DB_PATH = process.env.LOCAL_AUTH_DB || path.join(ROOT, '.local-auth.db');

// Mirrors api/src/routes/auth.js
const SIGNUP_CODE_EXPIRY_MS = 30 * 60 * 1000; // 30 min
const CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 s
const MAX_RESENDS = 2; // 2 resends => 3 codes total
const DEFAULT_SIGNUP_ROLE = process.env.DEFAULT_SIGNUP_ROLE || 'content_editor';

// ---------------------------------------------------------------- database ---
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- Mirrors the Postgres identity.* tables that api/src/routes/auth.js uses.
  CREATE TABLE IF NOT EXISTS users (
    id                     TEXT PRIMARY KEY,
    external_subject       TEXT,
    email                  TEXT NOT NULL UNIQUE,
    display_name           TEXT,
    is_active              INTEGER NOT NULL DEFAULT 1,
    first_signin_completed INTEGER NOT NULL DEFAULT 0,
    last_login_at          INTEGER,
    created_at             INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS credentials (
    user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    TEXT NOT NULL,
    PRIMARY KEY (user_id, role)
  );
  CREATE TABLE IF NOT EXISTS signup_verifications (
    verification_guid TEXT PRIMARY KEY,
    email             TEXT NOT NULL,
    display_name      TEXT,
    password_hash     TEXT NOT NULL,
    code              TEXT NOT NULL,
    expires_at        INTEGER NOT NULL,
    attempts          INTEGER NOT NULL DEFAULT 0,
    max_attempts      INTEGER NOT NULL DEFAULT 5,
    resend_count      INTEGER NOT NULL DEFAULT 0,
    last_resend_at    INTEGER,
    verified_at       INTEGER,
    used_at           INTEGER,
    created_at        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    created_at INTEGER NOT NULL
  );

  -- Mirrors production.user_reviews (api/src/routes/reviews.js). Postgres keeps a
  -- trigger-maintained production.review_summaries alongside it; here the summary
  -- is computed on read instead — the row counts are tiny locally and it removes
  -- a cache that could drift.
  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT PRIMARY KEY,
    target_type   TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars         INTEGER NOT NULL,
    title         TEXT,
    body          TEXT,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    UNIQUE (target_type, target_id, user_id)
  );
`);

const now = () => Date.now();
const audit = (userId, action, detail) =>
  db.prepare('INSERT INTO audit (user_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(userId, action, JSON.stringify(detail ?? {}), now());

// ------------------------------------------------------------------ reviews ---
// Mirrors api/src/routes/reviews.js. The DTO shapes below are what
// src/lib/reviews.ts types against — keep them identical or the web breaks.

/** Bearer -> user row, or null. The read counterpart of requireUser. */
function currentUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token, 'access') : null;
  if (!payload?.sub) return null;
  return db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub) || null;
}

function requireUser(req) {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, 'Authentication required.');
  return u;
}

const EMPTY_SUMMARY = (type, id) => ({
  target_type: type,
  target_id: id,
  average: null,
  rating_count: 0,
  review_count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
});

/** `status` is always 'published' here — local dev has no moderation queue. */
const reviewDto = (r) => ({
  id: r.id,
  stars: r.stars,
  title: r.title,
  body: r.body,
  status: 'published',
  helpful_count: r.helpful_count,
  created_at: new Date(r.created_at).toISOString(),
  edited: r.updated_at > r.created_at,
});

function summaryFor(type, id) {
  const rows = db
    .prepare('SELECT stars, body FROM reviews WHERE target_type=? AND target_id=? AND deleted_at IS NULL')
    .all(type, id);
  if (!rows.length) return EMPTY_SUMMARY(type, id);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let reviewCount = 0;
  for (const r of rows) {
    distribution[r.stars] = (distribution[r.stars] || 0) + 1;
    sum += r.stars;
    if (r.body && r.body.trim()) reviewCount += 1;
  }
  return {
    target_type: type,
    target_id: id,
    // 2dp, matching the Postgres ROUND(...,2) on review_summaries.avg_stars.
    average: Math.round((sum / rows.length) * 100) / 100,
    rating_count: rows.length,
    review_count: reviewCount,
    distribution,
  };
}

function mineFor(userId, type, id) {
  if (!userId) return null;
  const r = db
    .prepare('SELECT * FROM reviews WHERE target_type=? AND target_id=? AND user_id=? AND deleted_at IS NULL')
    .get(type, id, userId);
  return r ? reviewDto(r) : null;
}

// ------------------------------------------------------------------ helpers ---
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const genOtpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Constant-time 6-digit compare. */
function codeMatches(given, stored) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(stored));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Minimal stand-in for the api's zod schemas — same rules, same `issues[]`. */
function validate(body, rules) {
  const issues = [];
  for (const [path, rule] of Object.entries(rules)) {
    const v = body?.[path];
    if (v === undefined || v === null || v === '') {
      issues.push({ path, message: 'Required' });
      continue;
    }
    const msg = rule(v);
    if (msg) issues.push({ path, message: msg });
  }
  if (issues.length) throw new HttpError(400, 'Validation failed', { issues });
}

const isEmail = (v) =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254
    ? null
    : 'Invalid email';
const isPassword = (v) =>
  typeof v !== 'string' || v.length < 8
    ? 'String must contain at least 8 character(s)'
    : v.length > 200
      ? 'String must contain at most 200 character(s)'
      : null;
const isName = (v) =>
  typeof v !== 'string' || v.trim().length < 1 || v.trim().length > 120 ? 'Invalid name' : null;
const isUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? null : 'Invalid uuid';
const isCode = (v) => (typeof v === 'string' && /^\d{6}$/.test(v) ? null : 'Invalid');

/**
 * Mint the access + refresh pair and persist the refresh hash so it is
 * revocable — the same shape docs/AUTH_API.md documents and src/lib/auth.ts
 * stores.
 */
function issueTokens(userId, { extended = false } = {}) {
  const access = generateAccessToken({ sub: userId });
  const refresh = generateRefreshToken({ sub: userId }, { extended });
  db.prepare('INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .run(refresh.hash, userId, refresh.expiresAt.getTime());
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresAt: access.expiresAt.toISOString(),
  };
}

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.display_name });

/** The real API emails this; with no provider configured it logs it. Same here. */
function deliverCode(email, code, kind) {
  const line = `  ${kind} code for ${email}:  ${code}`;
  console.log('\n' + '─'.repeat(60));
  console.log('  📧  DEV EMAIL (not sent — no provider configured)');
  console.log(line);
  console.log('─'.repeat(60) + '\n');
}

// ------------------------------------------------------------------- routes ---
const routes = {
  /** Phase 1 — stash a pending sign-up + email a code. No account yet. */
  'POST /api/auth/signup': (body) => {
    validate(body, { name: isName, email: isEmail, password: isPassword });
    const email = body.email.trim().toLowerCase();

    const existing = db.prepare('SELECT 1 FROM users WHERE email = ? AND is_active = 1').get(email);
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists. Please sign in.');
    }

    // Drop earlier unfinished sign-ups so only the newest code works.
    db.prepare('DELETE FROM signup_verifications WHERE email = ? AND used_at IS NULL').run(email);

    const guid = crypto.randomUUID();
    const code = genOtpCode();
    db.prepare(
      `INSERT INTO signup_verifications
         (verification_guid, email, display_name, password_hash, code, expires_at, max_attempts, created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(guid, email, body.name.trim(), hashPassword(body.password), code,
          now() + SIGNUP_CODE_EXPIRY_MS, CODE_ATTEMPTS, now());

    deliverCode(email, code, 'SIGN-UP');
    return { status: 200, body: { success: true, requiresVerification: true, email, verificationGuid: guid } };
  },

  /** Phase 2 — check the code, create the account, sign them in. */
  'POST /api/auth/verify-signup': (body) => {
    validate(body, { verificationGuid: isUuid, verificationCode: isCode });
    const row = db.prepare('SELECT * FROM signup_verifications WHERE verification_guid = ?')
      .get(body.verificationGuid);
    if (!row) throw new HttpError(400, 'Invalid or expired verification.');
    if (row.used_at) throw new HttpError(400, 'This sign-up was already completed. Please sign in.');
    if (row.expires_at <= now()) throw new HttpError(400, 'Verification code expired. Please sign up again.');
    if (row.attempts >= row.max_attempts) throw new HttpError(429, 'Too many attempts. Please sign up again.');

    if (!codeMatches(body.verificationCode, row.code)) {
      db.prepare('UPDATE signup_verifications SET attempts = attempts + 1 WHERE verification_guid = ?')
        .run(row.verification_guid);
      const left = Math.max(0, row.max_attempts - row.attempts - 1);
      throw new HttpError(400, `Incorrect code. ${left} attempt(s) left.`, { attemptsRemaining: left });
    }

    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(row.email);
    if (taken) {
      db.prepare('UPDATE signup_verifications SET verified_at = ?, used_at = ? WHERE verification_guid = ?')
        .run(now(), now(), row.verification_guid);
      throw new HttpError(409, 'An account with this email already exists. Please sign in.');
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, external_subject, email, display_name, last_login_at, first_signin_completed, created_at)
       VALUES (?,?,?,?,?,1,?)`
    ).run(id, `jubilujah|${row.email}`, row.email, row.display_name, now(), now());
    db.prepare('INSERT INTO credentials (user_id, password_hash) VALUES (?,?)').run(id, row.password_hash);
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)').run(id, DEFAULT_SIGNUP_ROLE);
    db.prepare('UPDATE signup_verifications SET verified_at = ?, used_at = ? WHERE verification_guid = ?')
      .run(now(), now(), row.verification_guid);
    audit(id, 'account.created', { via: 'signup_otp' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    console.log(`  ✅  account created: ${user.email}  (${user.display_name})`);
    return {
      status: 201,
      body: { user: publicUser(user), tokens: issueTokens(id, { extended: !!body.rememberMe }) },
    };
  },

  /** Resend — 60 s cooldown, capped at MAX_RESENDS. */
  'POST /api/auth/send-signup-verification': (body) => {
    validate(body, { verificationGuid: isUuid });
    const row = db.prepare('SELECT * FROM signup_verifications WHERE verification_guid = ?')
      .get(body.verificationGuid);
    if (!row) throw new HttpError(400, 'Invalid or expired verification.');
    if (row.used_at) throw new HttpError(400, 'This sign-up was already completed. Please sign in.');

    if (row.last_resend_at && now() - row.last_resend_at < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now() - row.last_resend_at)) / 1000);
      throw new HttpError(429, `Please wait ${wait}s before requesting another code.`, { cooldownSeconds: wait });
    }
    if (row.resend_count >= MAX_RESENDS) {
      throw new HttpError(429, 'Too many codes requested. Please sign up again.', { exhausted: true });
    }

    const code = genOtpCode();
    db.prepare(
      `UPDATE signup_verifications
          SET code = ?, expires_at = ?, attempts = 0, resend_count = resend_count + 1, last_resend_at = ?
        WHERE verification_guid = ?`
    ).run(code, now() + SIGNUP_CODE_EXPIRY_MS, now(), row.verification_guid);

    deliverCode(row.email, code, 'SIGN-UP (resend)');
    return {
      status: 200,
      body: { success: true, verificationGuid: row.verification_guid, resendsRemaining: MAX_RESENDS - (row.resend_count + 1) },
    };
  },

  /** Local sign-in (AUTH_LOGIN_MODE=local): verify against our own credentials. */
  'POST /api/auth/signin': (body) => {
    validate(body, { email: isEmail, password: (v) => (typeof v === 'string' && v.length ? null : 'Required') });
    const email = body.email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    const cred = user ? db.prepare('SELECT * FROM credentials WHERE user_id = ?').get(user.id) : null;
    // One generic message for unknown email AND wrong password — no enumeration.
    if (!user || !cred || !verifyPassword(body.password, cred.password_hash)) {
      throw new HttpError(401, 'Invalid email or password');
    }
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), user.id);
    audit(user.id, 'account.signin', {});
    return { status: 200, body: { user: publicUser(user), tokens: issueTokens(user.id, { extended: !!body.rememberMe }) } };
  },

  /** Rotate a refresh token for a fresh pair. */
  'POST /api/auth/refresh': (body) => {
    const presented = body?.refreshToken;
    const payload = verifyToken(presented, 'refresh');
    if (!payload) throw new HttpError(401, 'Invalid or expired refresh token');
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(presented));
    if (!row || row.revoked_at || row.expires_at <= now()) {
      throw new HttpError(401, 'Invalid or expired refresh token');
    }
    // Rotate: burn the presented token, issue a new pair.
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?').run(now(), row.token_hash);
    return { status: 200, body: { tokens: issueTokens(row.user_id) } };
  },

  /** Current user. Returns 200 with authenticated:false when signed out. */
  'GET /api/auth/me': (_body, req) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token ? verifyToken(token, 'access') : null;
    if (!payload?.sub) return { status: 200, body: { authenticated: false } };
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub);
    if (!user) return { status: 200, body: { authenticated: false } };
    const roles = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(user.id).map((r) => r.role);
    return { status: 200, body: { authenticated: true, user: publicUser(user), roles } };
  },

  /**
   * Service-to-service: does an account exist for this email?
   * Mirrors api/src/routes/service.js — same shape, same 401/400 codes.
   *
   *   curl -H "Authorization: Bearer $LOCAL_SERVICE_TOKEN" \
   *     "http://localhost:4031/api/auth/admin/check-email?email=a@b.com"
   *
   * Not for the browser: unauthenticated, it would let anyone enumerate which
   * emails have accounts. /signup's 409 stays the only public answer.
   */
  'GET /api/auth/admin/check-email': (_body, req, url) => {
    requireServiceAuth(req);

    // validate() takes the same {field: rule} map the POST routes use, so a bad
    // query param yields the identical 400 + issues[] shape as a bad body.
    const q = { email: (url.searchParams.get('email') || '').trim() };
    validate(q, { email: isEmail });
    const email = q.email.toLowerCase();

    const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
    if (!user) return { status: 200, body: { email, exists: false } };

    // `exists` tracks the row; `active` is separate so a caller can tell a
    // deactivated account (email taken) from a free email.
    const roles = db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role')
      .all(user.id).map((r) => r.role);
    return {
      status: 200,
      body: {
        email,
        exists: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          active: !!user.is_active,
          emailVerified: !!user.first_signin_completed,
          roles,
          createdAt: new Date(user.created_at).toISOString(),
        },
      },
    };
  },

  'POST /api/auth/logout': (body) => {
    if (body?.refreshToken) {
      db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?')
        .run(now(), hashToken(body.refreshToken));
    }
    return { status: 200, body: { ok: true } };
  },

  /**
   * Delete the caller's own account. Mirrors the real API's DELETE
   * /api/auth/account -> purgeUserAccount: a LOCAL teardown only. There is no JI
   * call here (nor in prod's purge), so deleting on TorahSings never touches the
   * shared Jubilee Account or any other site. credentials / user_roles /
   * refresh_tokens cascade off users via ON DELETE CASCADE; reviews and pending
   * signups are removed explicitly.
   */
  'DELETE /api/auth/account': (_body, req) => {
    const user = requireUser(req);
    db.prepare('DELETE FROM reviews WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // cascades credentials/roles/tokens
    db.prepare('DELETE FROM signup_verifications WHERE email = ?').run(user.email);
    audit(user.id, 'account.deleted', { via: 'self_service' });
    console.log(`  🗑  account deleted: ${user.email}`);
    return { status: 200, body: { ok: true } };
  },

  // ---- Reviews: fixed paths (these must win over the /:type/:id patterns) ----

  /** Batch summaries for an album + its songs in one round-trip. Public. */
  'POST /api/reviews/summaries': (body, req) => {
    const targets = Array.isArray(body?.targets) ? body.targets : [];
    if (!targets.length) throw new HttpError(400, 'targets is required.');
    const user = currentUser(req); // optional — `mine` is null when signed out
    const summaries = {};
    for (const t of targets) {
      summaries[`${t.type}:${t.id}`] = {
        ...summaryFor(t.type, t.id),
        mine: mineFor(user?.id, t.type, t.id),
      };
    }
    return { status: 200, body: { summaries } };
  },

  /** The counters behind the account page's "My Contributions" card. */
  'GET /api/reviews/me/contributions': (_body, req) => {
    const user = requireUser(req);
    const rows = db
      .prepare('SELECT target_type, body, helpful_count FROM reviews WHERE user_id=? AND deleted_at IS NULL')
      .all(user.id);
    return {
      status: 200,
      body: {
        albums_rated: rows.filter((r) => r.target_type === 'album').length,
        songs_rated: rows.filter((r) => r.target_type === 'song').length,
        reviews_written: rows.filter((r) => r.body && r.body.trim()).length,
        total_contributions: rows.length,
        helpful_received: rows.reduce((n, r) => n + (r.helpful_count || 0), 0),
      },
    };
  },

  /** The caller's own reviews, newest first. */
  'GET /api/reviews/me/reviews': (_body, req) => {
    const user = requireUser(req);
    const rows = db
      .prepare('SELECT * FROM reviews WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200')
      .all(user.id);
    return {
      status: 200,
      body: rows.map((r) => ({ ...reviewDto(r), target_type: r.target_type, target_id: r.target_id })),
    };
  },
};

// ---------------------------------------------------------- pattern routes ---
// The table above is an exact `METHOD /path` match, which cannot express
// /api/reviews/:type/:id. These regex routes are tried only when that misses.
// Order matters: /summary must be tested before the bare /:type/:id.
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const TARGET = new RegExp(`^/api/reviews/(album|song)/(${UUID})$`);
const TARGET_SUMMARY = new RegExp(`^/api/reviews/(album|song)/(${UUID})/summary$`);

const patternRoutes = [
  {
    method: 'GET',
    re: TARGET_SUMMARY,
    handler: ([, type, id], _body, req) => ({
      status: 200,
      body: { ...summaryFor(type, id), mine: mineFor(currentUser(req)?.id, type, id) },
    }),
  },

  /** Published reviews for one target (only rows that carry a body). Public. */
  {
    method: 'GET',
    re: TARGET,
    handler: ([, type, id], _body, req, url) => {
      const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 10));
      const sort = ['recent', 'highest', 'lowest', 'helpful'].includes(url.searchParams.get('sort'))
        ? url.searchParams.get('sort')
        : 'recent';
      const order = { recent: 'created_at DESC', highest: 'stars DESC, created_at DESC',
                      lowest: 'stars ASC, created_at DESC', helpful: 'helpful_count DESC, created_at DESC' }[sort];
      const me = currentUser(req);
      const WHERE = `r.target_type=? AND r.target_id=? AND r.deleted_at IS NULL
                     AND r.body IS NOT NULL AND trim(r.body) <> ''`;
      const total = db.prepare(`SELECT COUNT(*) AS n FROM reviews r WHERE ${WHERE}`).get(type, id).n;
      const rows = db
        .prepare(`SELECT r.*, u.display_name AS author_name
                    FROM reviews r JOIN users u ON u.id = r.user_id
                   WHERE ${WHERE}
                   ORDER BY r.${order}
                   LIMIT ? OFFSET ?`)
        .all(type, id, limit, (page - 1) * limit);
      return {
        status: 200,
        body: {
          items: rows.map((r) => ({
            ...reviewDto(r),
            target_type: r.target_type,
            target_id: r.target_id,
            author: { display_name: r.author_name || 'Anonymous', avatar_url: null },
            mine: !!me && r.user_id === me.id,
            voted: false,
          })),
          page, limit, total, has_more: (page - 1) * limit + rows.length < total, sort,
        },
      };
    },
  },

  /** Upsert the caller's rating/note. Keyed (target_type, target_id, user). */
  {
    method: 'PUT',
    re: TARGET,
    handler: ([, type, id], body, req) => {
      const user = requireUser(req);
      const stars = body?.stars;
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new HttpError(400, 'stars must be a whole number from 1 to 5.');
      }
      const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 150) : null;
      const text = typeof body?.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 5000) : null;
      const t = now();
      const existing = db.prepare('SELECT id FROM reviews WHERE target_type=? AND target_id=? AND user_id=?')
        .get(type, id, user.id);
      if (existing) {
        db.prepare('UPDATE reviews SET stars=?, title=?, body=?, updated_at=?, deleted_at=NULL WHERE id=?')
          .run(stars, title, text, t, existing.id);
      } else {
        db.prepare(`INSERT INTO reviews (id, target_type, target_id, user_id, stars, title, body, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(crypto.randomUUID(), type, id, user.id, stars, title, text, t, t);
      }
      const row = db.prepare('SELECT * FROM reviews WHERE target_type=? AND target_id=? AND user_id=?')
        .get(type, id, user.id);
      audit(user.id, 'review.upsert', { type, id, stars });
      return { status: 200, body: { review: reviewDto(row), summary: summaryFor(type, id) } };
    },
  },

  /** Soft-delete, as Postgres does — the row stays, deleted_at is stamped. */
  {
    method: 'DELETE',
    re: TARGET,
    handler: ([, type, id], _body, req) => {
      const user = requireUser(req);
      db.prepare(`UPDATE reviews SET deleted_at=? WHERE target_type=? AND target_id=? AND user_id=? AND deleted_at IS NULL`)
        .run(now(), type, id, user.id);
      return { status: 200, body: { deleted: true, summary: summaryFor(type, id) } };
    },
  },
];

// ------------------------------------------------------------------- server ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = `${req.method} ${url.pathname}`;

  let body = {};
  if (req.method !== 'GET') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'error', message: 'Malformed JSON' }));
      }
    }
  }

  // Exact match first; fall back to the /:type/:id regex routes.
  let handler = routes[key];
  if (!handler) {
    for (const p of patternRoutes) {
      if (p.method !== req.method) continue;
      const m = p.re.exec(url.pathname);
      if (m) {
        handler = (b, rq, u) => p.handler(m, b, rq, u);
        break;
      }
    }
  }
  if (!handler) {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not_found', message: `No route for ${key}` }));
  }

  try {
    const out = handler(body, req, url);
    res.writeHead(out.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out.body));
    console.log(`  ${out.status}  ${key}`);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const payload = { error: 'error', message: e.message, ...(e.extra || {}) };
    if (status === 500) {
      console.error(e);
      payload.message = 'Internal error';
    }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
    console.log(`  ${status}  ${key}  — ${e.message}`);
  }
});

server.listen(PORT, () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────────────────┐');
  console.log('  │  Torah Sings — LOCAL DEV AUTH  (SQLite, no Postgres)      │');
  console.log('  └───────────────────────────────────────────────────────────┘');
  console.log(`   listening : http://localhost:${PORT}`);
  console.log(`   database  : ${DB_PATH}`);
  console.log(`   accounts  : ${n}`);
  console.log('   kdf/token : imported from api/src/auth (production format)');
  console.log('');
  console.log('   Point the web at it in .env:');
  console.log(`     NEXT_PUBLIC_API_BASE=http://localhost:${PORT}`);
  console.log('');
  console.log('   Sign-up codes are printed here instead of emailed.');
  console.log('');
});
