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
 * Dev-only. No rate limiting, no 2FA, no Turnstile, no JubileeInspire delegation.
 * Password reset works (link printed to this console); it is still NOT a
 * substitute for torahsings-api in production.
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
// Password reset — mirrors api/src/config.js (PASSWORD_RESET_TTL_MIN=60,
// WEB_BASE_URL). The link is printed to this console instead of emailed.
const RESET_TOKEN_EXPIRY_MS = Number(process.env.PASSWORD_RESET_TTL_MIN || 60) * 60 * 1000;
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';

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
  -- Mirrors identity.password_resets (api/src/routes/auth.js). Only the SHA-256
  -- of the emailed token is stored; the raw token lives only in the reset link.
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    created_at INTEGER NOT NULL
  );

  -- Mirrors production.playback_events (api/src/routes/analytics.js), trimmed to
  -- the columns the console's seven analytics views actually aggregate. Seeded
  -- below so the charts have a shape to draw.
  CREATE TABLE IF NOT EXISTS playback_events (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           TEXT,
    album_code        TEXT,
    song_title        TEXT,
    listening_seconds INTEGER NOT NULL DEFAULT 0,
    completed         INTEGER NOT NULL DEFAULT 0,
    skipped           INTEGER NOT NULL DEFAULT 0,
    started_at        INTEGER NOT NULL
  );

  -- Mirrors production.now_playing (api/src/routes/admin.js). A row is "live"
  -- only while updated_at is inside the 45s window, so the console's Active
  -- Listeners view empties on its own once a session stops reporting in.
  CREATE TABLE IF NOT EXISTS now_playing (
    session_id TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    album_code TEXT,
    song_title TEXT,
    track_n    INTEGER,
    ip_address TEXT,
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Mirrors production.pipeline_state (api/src/routes/pipeline.js). Local only:
  -- nothing here writes to it during normal use, so it is seeded once below to
  -- give the operations console something real to render.
  CREATE TABLE IF NOT EXISTS pipeline_state (
    rateable_type    TEXT NOT NULL,
    rateable_id      TEXT NOT NULL,
    current_stage    TEXT NOT NULL,
    assignee_user_id TEXT,
    entered_stage_at INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    PRIMARY KEY (rateable_type, rateable_id)
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

  -- Mirrors production.user_playlists / production.user_playlist_items
  -- (api/src/routes/me.js).
  --
  -- ONE DELIBERATE DIVERGENCE: Postgres gives user_playlist_items.song_id a real
  -- FK to catalog.songs, so the real API 404s a song that was never imported.
  -- There is no catalog mirror here (TorahSings derives its song uuids from the
  -- album code — see src/lib/ids.ts), so this stores any well-formed uuid. That
  -- keeps add-to-playlist exercisable locally; it does NOT mean an id that the
  -- real API would reject will be accepted there.
  CREATE TABLE IF NOT EXISTS user_playlists (
    id            TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    is_public     INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_playlist_items (
    id          TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
    song_id     TEXT NOT NULL,
    position    INTEGER NOT NULL,
    added_at    INTEGER NOT NULL,
    UNIQUE (playlist_id, song_id)
  );
`);

const now = () => Date.now();
const audit = (userId, action, detail) =>
  db.prepare('INSERT INTO audit (user_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(userId, action, JSON.stringify(detail ?? {}), now());

// Seed ~90 days of playback so the analytics charts have a real shape rather
// than a flat line. Deterministic (a small LCG, not Math.random) so every run
// produces the same series and a changed chart means changed code.
if (db.prepare('SELECT COUNT(*) AS n FROM playback_events').get().n === 0) {
  const users = db.prepare('SELECT id FROM users ORDER BY created_at LIMIT 6').all().map((u) => u.id);
  if (users.length) {
    const ALBUMS = [
      ['ANSMX01001EN', ['Light Before the Sun', 'Our Maker Knelt in Dust', 'The Sword We Held Was Mercy']],
      ['ANSMX01002EN', ['Grief Built the Basket', 'The Second Day Undone']],
      ['ANSMX02001EN', ['The Wind Was His Remembering', 'Smoke Rose Where the Rain Fell']],
    ];
    let s = 20260723;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const ins = db.prepare(
      `INSERT INTO playback_events
         (user_id, album_code, song_title, listening_seconds, completed, skipped, started_at)
       VALUES (?,?,?,?,?,?,?)`,
    );
    const DAY = 86_400_000;
    db.exec('BEGIN');
    for (let d = 89; d >= 0; d--) {
      // Weekends run lighter than weekdays, so the day-of-week chart says something.
      const date = new Date(now() - d * DAY);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const plays = Math.floor(rnd() * (weekend ? 6 : 14)) + (weekend ? 1 : 3);
      for (let i = 0; i < plays; i++) {
        const [code, songs] = ALBUMS[Math.floor(rnd() * ALBUMS.length)];
        const song = songs[Math.floor(rnd() * songs.length)];
        const full = 180 + Math.floor(rnd() * 180);
        const done = rnd() > 0.35;
        const secs = done ? full : Math.floor(full * (0.1 + rnd() * 0.6));
        // Cluster listening into waking hours rather than spreading it flat.
        const hour = 7 + Math.floor(rnd() * 15);
        const at = new Date(date);
        at.setHours(hour, Math.floor(rnd() * 60), 0, 0);
        ins.run(users[Math.floor(rnd() * users.length)], code, song, secs, done ? 1 : 0, done ? 0 : 1, at.getTime());
      }
    }
    db.exec('COMMIT');
  }
}

// Three simulated listening sessions, kept warm by a heartbeat.
//
// LOCAL DEV ONLY. now_playing rows are live for 45 seconds, so a static seed
// would go cold before anyone opened the page and the console would sit empty
// forever. Real rows come from the player reporting in; nothing does that
// locally, so this stands in for it. The heartbeat also advances the track now
// and then, which is what makes the view visibly *live* rather than a snapshot.
{
  const users = db.prepare('SELECT id FROM users ORDER BY created_at LIMIT 3').all().map((u) => u.id);
  const NOW_PLAYING_SIM = [
    ['sim-session-1', 'ANSMX01001EN', ['Light Before the Sun', 'Our Maker Knelt in Dust'], '127.0.0.1'],
    ['sim-session-2', 'ANSMX01002EN', ['Grief Built the Basket', 'The Second Day Undone'], '192.168.1.24'],
    ['sim-session-3', 'ANSMX02001EN', ['The Wind Was His Remembering'], '10.0.0.65'],
  ];
  const beat = () => {
    if (!users.length) return;
    const t = now();
    NOW_PLAYING_SIM.forEach(([sid, code, songs, ip], i) => {
      const user = users[i % users.length];
      const existing = db.prepare('SELECT started_at FROM now_playing WHERE session_id = ?').get(sid);
      // Advance the track roughly every four minutes of wall clock.
      const idx = Math.floor(t / 240_000) % songs.length;
      const started = existing ? existing.started_at : t - (i + 1) * 37_000;
      db.prepare(
        `INSERT INTO now_playing
           (session_id, user_id, album_code, song_title, track_n, ip_address, started_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(session_id) DO UPDATE SET
           song_title = excluded.song_title,
           track_n    = excluded.track_n,
           updated_at = excluded.updated_at`,
      ).run(sid, user, code, songs[idx], idx + 1, ip, started, t);
    });
  };
  beat();
  // Well inside the 45s window, so a row never lapses between beats.
  setInterval(beat, 15_000).unref();
}

// Seed the pipeline once, so the console's Overview and Pipeline sections have
// something to draw. Real rows come from the studio's transitions; there is no
// transition endpoint locally, so without this the section is permanently empty
// and untestable. Guarded on emptiness — it never fights a hand-edited row.
if (db.prepare('SELECT COUNT(*) AS n FROM pipeline_state').get().n === 0) {
  const seed = [
    ['song', '11111111-1111-4111-8111-111111111111', 'concept', 2],
    ['song', '22222222-2222-4222-8222-222222222222', 'lyrics_drafting', 5],
    ['song', '33333333-3333-4333-8333-333333333333', 'lyrics_drafting', 9],
    ['song', '44444444-4444-4444-8444-444444444444', 'song_generation', 14],
    ['album', '55555555-5555-4555-8555-555555555555', 'qa_review', 21],
    ['song', '66666666-6666-4666-8666-666666666666', 'final_approval', 30],
    ['album', '77777777-7777-4777-8777-777777777777', 'published', 44],
  ];
  const ins = db.prepare(
    `INSERT INTO pipeline_state
       (rateable_type, rateable_id, current_stage, assignee_user_id, entered_stage_at, updated_at)
     VALUES (?,?,?,NULL,?,?)`,
  );
  const DAY = 86_400_000;
  for (const [type, id, stage, daysAgo] of seed) {
    const t = now() - daysAgo * DAY;
    ins.run(type, id, stage, t, t);
  }
}

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

/**
 * The admin gate, matching requireRole('admin') in api/src/middleware/rbac.js:
 * 401 when there is no session, 403 when there is one without the role. The
 * console relies on telling those apart, so do not collapse them.
 */
function requireAdmin(req) {
  const u = requireUser(req);
  const roles = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(u.id).map((r) => r.role);
  if (!roles.includes('admin')) throw new HttpError(403, 'Requires role: admin or higher');
  return u;
}

/**
 * The albums/songs/users analytics tables, aggregated from the local playback
 * seed. One helper because the three differ only in what they group by — the
 * search, sort, and pagination contract is identical, and the console types
 * against a single {total, page, limit, items} shape.
 */
function analyticsTable(req, url, kind) {
  requireAdmin(req);
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 25));
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const SORTS = { plays: 'plays', listeners: 'listeners', listening_seconds: 'seconds', avg_rating: 'plays' };
  const sort = SORTS[url.searchParams.get('sort')] || 'plays';

  let items;
  if (kind === 'users') {
    items = db.prepare(
      `SELECT u.id AS user_id, u.display_name AS name, u.email,
              COUNT(pe.id) AS plays, COUNT(DISTINCT pe.song_title) AS songs,
              COUNT(DISTINCT pe.album_code) AS albums,
              COALESCE(SUM(pe.listening_seconds),0) AS listening_seconds,
              MAX(pe.started_at) AS last_listen
         FROM users u JOIN playback_events pe ON pe.user_id = u.id
        GROUP BY u.id, u.display_name, u.email
        ORDER BY plays DESC`,
    ).all().map((r) => ({ ...r, last_listen: r.last_listen ? new Date(r.last_listen).toISOString() : null }));
  } else {
    const col = kind === 'albums' ? 'album_code' : 'song_title';
    items = db.prepare(
      `SELECT ${col} AS title, MAX(album_code) AS album,
              COUNT(*) AS plays, COUNT(DISTINCT user_id) AS listeners,
              COALESCE(SUM(listening_seconds),0) AS listening_seconds
         FROM playback_events WHERE ${col} IS NOT NULL
        GROUP BY ${col}
        ORDER BY ${sort} DESC`,
    ).all().map((r) => ({ ...r, artist: 'Sung by the Angels', avg_rating: null }));
  }

  if (q) {
    items = items.filter((i) => `${i.title ?? ''} ${i.name ?? ''} ${i.email ?? ''} ${i.album ?? ''}`.toLowerCase().includes(q));
  }
  const offset = (page - 1) * limit;
  return { status: 200, body: { total: items.length, page, limit, items: items.slice(offset, offset + limit) } };
}

/** The API's liveness window for now_playing: 45 seconds, then a row goes cold. */
const LIVE_WINDOW_MS = 45_000;

/** Mirrors GRANTABLE_ROLES in api/src/routes/admin.js. `viewer` is implicit. */
const GRANTABLE_ROLES = ['reviewer', 'content_editor', 'executive', 'admin'];

/** Mirrors STAGES in api/src/routes/pipeline.js — order is the flow of work. */
const PIPELINE_STAGES = [
  'concept', 'lyrics_drafting', 'lyrics_approved', 'song_generation', 'qa_review',
  'engineering', 'sunil_approval', 'final_approval', 'published', 'distributed',
];

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

// ---------------------------------------------------------------- playlists ---
// Mirrors api/src/routes/me.js. The DTO shapes below are what
// src/lib/playlists.ts types against — keep them identical or the web breaks.

/**
 * The list every user gets. The real API auto-provisions it on first listing and
 * always returns it FIRST, which is what makes it the default row in the
 * Add-to-Playlist menu and the top sub-category on the Playlists page.
 */
const DEFAULT_PLAYLIST_NAME = 'My Favorites';

function ensureDefaultPlaylist(userId) {
  const has = db
    .prepare('SELECT 1 FROM user_playlists WHERE owner_user_id = ? AND name = ?')
    .get(userId, DEFAULT_PLAYLIST_NAME);
  if (has) return;
  const t = now();
  db.prepare(
    `INSERT INTO user_playlists (id, owner_user_id, name, description, is_public, created_at, updated_at)
     VALUES (?,?,?,?,0,?,?)`,
  ).run(crypto.randomUUID(), userId, DEFAULT_PLAYLIST_NAME, 'Your go-to mix of saved songs.', t, t);
}

/**
 * `cover` is always null: resolving it needs the manifest, which local dev does
 * not have. The client derives the cover from `first_song_id` against its own
 * catalog instead — the same fallback the real API documents for TorahSings.
 */
const playlistDto = (pl) => ({
  id: pl.id,
  name: pl.name,
  description: pl.description,
  is_public: !!pl.is_public,
  is_default: pl.name === DEFAULT_PLAYLIST_NAME,
  item_count: db
    .prepare('SELECT COUNT(*) AS n FROM user_playlist_items WHERE playlist_id = ?')
    .get(pl.id).n,
  first_song_id:
    db
      .prepare('SELECT song_id FROM user_playlist_items WHERE playlist_id = ? ORDER BY position LIMIT 1')
      .get(pl.id)?.song_id ?? null,
  cover: null,
  created_at: new Date(pl.created_at).toISOString(),
  updated_at: new Date(pl.updated_at).toISOString(),
});

/** Resolve a playlist owned by the caller, or throw the same error the API does. */
function ownedPlaylist(id, userId) {
  // isUuid returns an error MESSAGE when invalid and null when it is fine.
  if (isUuid(id)) throw new HttpError(400, 'invalid playlist id');
  const pl = db.prepare('SELECT * FROM user_playlists WHERE id = ?').get(id);
  if (!pl) throw new HttpError(404, 'playlist not found');
  if (pl.owner_user_id !== userId) throw new HttpError(403, 'not your playlist');
  return pl;
}

const touchPlaylist = (id) =>
  db.prepare('UPDATE user_playlists SET updated_at = ? WHERE id = ?').run(now(), id);

/**
 * Append one song, ignoring a song already on the list. Returns true when a row
 * was actually inserted, so the caller can report how many were NEW — the count
 * the "Added N tracks" confirmation shows.
 */
function appendSong(playlistId, songId) {
  const dup = db
    .prepare('SELECT 1 FROM user_playlist_items WHERE playlist_id = ? AND song_id = ?')
    .get(playlistId, songId);
  if (dup) return false;
  const next =
    (db
      .prepare('SELECT MAX(position) AS m FROM user_playlist_items WHERE playlist_id = ?')
      .get(playlistId)?.m ?? -1) + 1;
  db.prepare(
    'INSERT INTO user_playlist_items (id, playlist_id, song_id, position, added_at) VALUES (?,?,?,?,?)',
  ).run(crypto.randomUUID(), playlistId, songId, next, now());
  return true;
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

/** Password-reset counterpart of deliverCode — prints the clickable reset link. */
function deliverResetLink(email, url) {
  console.log('\n' + '─'.repeat(60));
  console.log('  📧  DEV EMAIL (not sent — no provider configured)');
  console.log(`  Password-reset link for ${email}:`);
  console.log(`  ${url}`);
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

  /**
   * Forgot password — email a single-use reset link. Anti-enumeration: the
   * response is ALWAYS the same 200 regardless of whether the email is on file,
   * so nothing observable reveals account existence. Only password-capable
   * (credentialed), active users actually get a link. Mirrors the real API's
   * POST /api/auth/forgot-password (api/src/routes/auth.js).
   */
  'POST /api/auth/forgot-password': (body) => {
    validate(body, { email: isEmail });
    const email = body.email.trim().toLowerCase();
    const user = db
      .prepare(
        `SELECT u.id, u.email FROM users u
           JOIN credentials c ON c.user_id = u.id
          WHERE u.email = ? AND u.is_active = 1`
      )
      .get(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      db.prepare(
        'INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)'
      ).run(hashToken(rawToken), user.id, now() + RESET_TOKEN_EXPIRY_MS, now());
      audit(user.id, 'password.reset_requested', {});
      deliverResetLink(user.email, `${WEB_BASE_URL}/reset-password?token=${rawToken}`);
    }
    // Same body whether or not an account matched.
    return {
      status: 200,
      body: { ok: true, message: 'If an account exists for that email, a reset link has been sent.' },
    };
  },

  /**
   * Reset password — redeem the token, set the new password, revoke every
   * session. Mirrors the real API: an invalid/expired/used token is a generic
   * 400. `jiSync` is reported as skipped (no JubileeInspire locally).
   */
  'POST /api/auth/reset-password': (body) => {
    validate(body, { token: (v) => (typeof v === 'string' && v.length >= 20 && v.length <= 200 ? null : 'Invalid'), password: isPassword });
    const row = db
      .prepare(
        `SELECT pr.token_hash, pr.user_id
           FROM password_resets pr
           JOIN users u ON u.id = pr.user_id
          WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ? AND u.is_active = 1`
      )
      .get(hashToken(body.token), now());
    if (!row) throw new HttpError(400, 'This reset link is invalid or has expired.');

    db.prepare(
      `INSERT INTO credentials (user_id, password_hash) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash`
    ).run(row.user_id, hashPassword(body.password));
    // Burn this token and any other outstanding ones for the user.
    db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(now(), row.user_id);
    // Revoke every session so no device keeps a live token.
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .run(now(), row.user_id);
    audit(row.user_id, 'password.reset', {});
    console.log(`  🔑  password reset completed for user ${row.user_id}`);
    return { status: 200, body: { ok: true, jiSync: { ok: false, skipped: true } } };
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

  // ---- Playlists: fixed paths (these must win over the /:id patterns) --------

  /** The caller's playlists, "My Favorites" first, each with its item count. */
  'GET /api/me/playlists': (_body, req) => {
    const user = requireUser(req);
    ensureDefaultPlaylist(user.id);
    const rows = db
      .prepare(
        `SELECT * FROM user_playlists
          WHERE owner_user_id = ?
          ORDER BY (name = ?) DESC, created_at DESC`,
      )
      .all(user.id, DEFAULT_PLAYLIST_NAME);
    return { status: 200, body: rows.map(playlistDto) };
  },

  /** Create one. 201 + the new row, whose id the client immediately adds to. */
  'POST /api/me/playlists': (body, req) => {
    const user = requireUser(req);
    validate(body, {
      name: (v) =>
        typeof v !== 'string' || v.trim().length < 1 || v.trim().length > 200
          ? 'String must contain at least 1 character(s)'
          : null,
    });
    const t = now();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO user_playlists (id, owner_user_id, name, description, is_public, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(
      id,
      user.id,
      body.name.trim().slice(0, 200),
      typeof body.description === 'string' ? body.description.slice(0, 2000) : null,
      body.is_public ? 1 : 0,
      t,
      t,
    );
    audit(user.id, 'playlist.create', { id, name: body.name.trim() });
    return { status: 201, body: playlistDto(db.prepare('SELECT * FROM user_playlists WHERE id = ?').get(id)) };
  },

  /**
   * Distinct song ids across every playlist the caller owns, with a per-song
   * count — drives the "already added ✓" tick without opening a menu.
   */
  'GET /api/me/playlist-song-ids': (_body, req) => {
    const user = requireUser(req);
    const rows = db
      .prepare(
        `SELECT pi.song_id, COUNT(*) AS n
           FROM user_playlist_items pi
           JOIN user_playlists pl ON pl.id = pi.playlist_id
          WHERE pl.owner_user_id = ?
          GROUP BY pi.song_id`,
      )
      .all(user.id);
    const counts = {};
    for (const r of rows) counts[r.song_id] = r.n;
    return { status: 200, body: { counts } };
  },

  // ---------------------------------------------------------------- admin ---
  // Mirrors the admin surface of the real API (api/src/routes/admin.js and
  // pipeline.js) closely enough to develop the operations console against.
  // Shapes must match the Postgres ones exactly — the console types against
  // them — so each handler below names the endpoint it stands in for.

  // ------------------------------------------------------------ analytics ---
  // Mirrors api/src/routes/analytics.js. Postgres aggregates production.
  // playback_events; here the same aggregates run over the local seed, so the
  // console's seven views can be developed and checked without a warehouse.

  /** GET /api/analytics/overview — the headline figures. */
  'GET /api/analytics/overview': (_body, req) => {
    requireAdmin(req);
    const t = db.prepare(
      `SELECT COUNT(*) AS plays, COALESCE(SUM(listening_seconds),0) AS seconds,
              SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN skipped=1 THEN 1 ELSE 0 END) AS skipped
         FROM playback_events`,
    ).get();
    const top = (col) => db.prepare(
      `SELECT ${col} AS id, COUNT(*) AS plays FROM playback_events
        WHERE ${col} IS NOT NULL GROUP BY ${col} ORDER BY plays DESC LIMIT 1`,
    ).get();
    const topAlbum = top('album_code');
    const topSong = top('song_title');
    const listener = db.prepare(
      `SELECT pe.user_id, u.display_name, COUNT(*) AS plays,
              COALESCE(SUM(pe.listening_seconds),0) AS seconds
         FROM playback_events pe LEFT JOIN users u ON u.id = pe.user_id
        GROUP BY pe.user_id, u.display_name ORDER BY plays DESC LIMIT 1`,
    ).get();
    const rv = db.prepare(
      `SELECT COUNT(*) AS ratings,
              SUM(CASE WHEN body IS NOT NULL AND trim(body) <> '' THEN 1 ELSE 0 END) AS reviews,
              AVG(CASE WHEN target_type='album' THEN stars END) AS avg_album,
              AVG(CASE WHEN target_type='song' THEN stars END) AS avg_song
         FROM reviews WHERE deleted_at IS NULL`,
    ).get();
    const r2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
    return {
      status: 200,
      body: {
        total_albums: db.prepare('SELECT COUNT(DISTINCT album_code) n FROM playback_events').get().n,
        total_songs: db.prepare('SELECT COUNT(DISTINCT song_title) n FROM playback_events').get().n,
        total_users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
        active_users: db.prepare('SELECT COUNT(DISTINCT user_id) n FROM playback_events').get().n,
        total_plays: t.plays,
        total_listening_hours: Math.round((Number(t.seconds) / 360)) / 10,
        completed_plays: t.completed || 0,
        skipped_plays: t.skipped || 0,
        total_ratings: rv.ratings || 0,
        total_reviews: rv.reviews || 0,
        avg_album_rating: r2(rv.avg_album),
        avg_song_rating: r2(rv.avg_song),
        most_played_album: topAlbum ? { title: topAlbum.id, plays: topAlbum.plays } : null,
        most_played_song: topSong ? { title: topSong.id, plays: topSong.plays } : null,
        most_active_listener: listener
          ? { name: listener.display_name || 'Deleted user', plays: listener.plays, hours: Math.round(Number(listener.seconds) / 360) / 10 }
          : null,
        most_rated_album: null,
        most_reviewed_album: null,
      },
    };
  },

  /** GET /api/analytics/trends — daily/DAU/monthly series + peak buckets. */
  'GET /api/analytics/trends': (_body, req, url) => {
    requireAdmin(req);
    const days = Math.min(730, Math.max(7, parseInt(url.searchParams.get('days'), 10) || 90));
    const since = now() - days * 86_400_000;
    const daily = db.prepare(
      `SELECT date(started_at/1000,'unixepoch') AS day, COUNT(*) AS plays,
              COALESCE(SUM(listening_seconds),0) AS seconds,
              SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN skipped=1 THEN 1 ELSE 0 END) AS skipped
         FROM playback_events WHERE started_at >= ?
        GROUP BY day ORDER BY day`,
    ).all(since);
    const dau = db.prepare(
      `SELECT date(started_at/1000,'unixepoch') AS day, COUNT(DISTINCT user_id) AS users
         FROM playback_events WHERE started_at >= ? GROUP BY day ORDER BY day`,
    ).all(since);
    const monthly = db.prepare(
      `SELECT strftime('%Y-%m', started_at/1000,'unixepoch') AS month, COUNT(*) AS plays,
              COALESCE(SUM(listening_seconds),0) AS seconds
         FROM playback_events GROUP BY month ORDER BY month`,
    ).all();
    const peakHours = db.prepare(
      `SELECT CAST(strftime('%H', started_at/1000,'unixepoch') AS INTEGER) AS hour, COUNT(*) AS plays
         FROM playback_events GROUP BY hour ORDER BY hour`,
    ).all();
    const peakDays = db.prepare(
      `SELECT CAST(strftime('%w', started_at/1000,'unixepoch') AS INTEGER) AS dow, COUNT(*) AS plays
         FROM playback_events GROUP BY dow ORDER BY dow`,
    ).all();
    return {
      status: 200,
      body: {
        daily: daily.map((d) => ({
          day: d.day, plays: d.plays,
          hours: Math.round(Number(d.seconds) / 360) / 10,
          completed: d.completed || 0, skipped: d.skipped || 0,
        })),
        dau,
        monthly: monthly.map((m) => ({ month: m.month, plays: m.plays, hours: Math.round(Number(m.seconds) / 360) / 10 })),
        peak_hours: peakHours,
        peak_days: peakDays,
      },
    };
  },

  /** GET /api/analytics/ratings — distribution + best/worst albums. */
  'GET /api/analytics/ratings': (_body, req) => {
    requireAdmin(req);
    const totals = db.prepare(
      `SELECT SUM(CASE WHEN target_type='album' THEN 1 ELSE 0 END) AS album_ratings,
              SUM(CASE WHEN target_type='song' THEN 1 ELSE 0 END) AS song_ratings,
              AVG(stars) AS avg_all, COUNT(DISTINCT user_id) AS raters
         FROM reviews WHERE deleted_at IS NULL`,
    ).get();
    const distribution = {};
    for (const s of [1, 2, 3, 4, 5]) distribution[String(s)] = 0;
    for (const r of db.prepare('SELECT stars, COUNT(*) n FROM reviews WHERE deleted_at IS NULL GROUP BY stars').all()) {
      distribution[String(r.stars)] = r.n;
    }
    return {
      status: 200,
      body: {
        total_album_ratings: totals.album_ratings || 0,
        total_song_ratings: totals.song_ratings || 0,
        average_rating: totals.avg_all == null ? null : Math.round(Number(totals.avg_all) * 100) / 100,
        raters: totals.raters || 0,
        distribution,
        highest_rated_albums: [],
        lowest_rated_albums: [],
      },
    };
  },

  /** GET /api/analytics/reviews — review totals and the latest few. */
  'GET /api/analytics/reviews': (_body, req) => {
    requireAdmin(req);
    const WRITTEN = "body IS NOT NULL AND trim(body) <> '' AND deleted_at IS NULL";
    const totals = db.prepare(
      `SELECT SUM(CASE WHEN target_type='album' THEN 1 ELSE 0 END) AS album_reviews,
              SUM(CASE WHEN target_type='song' THEN 1 ELSE 0 END) AS song_reviews,
              COUNT(DISTINCT user_id) AS reviewers,
              AVG(length(body)) AS avg_len
         FROM reviews WHERE ${WRITTEN}`,
    ).get();
    const latest = db.prepare(
      `SELECT r.target_type, r.stars, r.title, r.body, r.created_at, u.display_name
         FROM reviews r LEFT JOIN users u ON u.id = r.user_id
        WHERE ${WRITTEN} ORDER BY r.created_at DESC LIMIT 20`,
    ).all();
    return {
      status: 200,
      body: {
        total_album_reviews: totals.album_reviews || 0,
        total_song_reviews: totals.song_reviews || 0,
        reviewers: totals.reviewers || 0,
        avg_review_length: Math.round(Number(totals.avg_len) || 0),
        pending_moderation: 0,
        most_reviewed_album: null,
        most_reviewed_song: null,
        latest: latest.map((r) => ({
          title: r.title, target_type: r.target_type, stars: r.stars, body: r.body,
          by: r.display_name, created_at: new Date(r.created_at).toISOString(),
        })),
      },
    };
  },

  /** GET /api/analytics/albums|songs|users — paginated, searchable tables. */
  'GET /api/analytics/albums': (_body, req, url) => analyticsTable(req, url, 'albums'),
  'GET /api/analytics/songs': (_body, req, url) => analyticsTable(req, url, 'songs'),
  'GET /api/analytics/users': (_body, req, url) => analyticsTable(req, url, 'users'),

  /** GET /api/analytics/export — the same tables as CSV. */
  'GET /api/analytics/export': (_body, req, url) => {
    requireAdmin(req);
    const kind = ['albums', 'songs', 'users'].includes(url.searchParams.get('kind'))
      ? url.searchParams.get('kind')
      : 'albums';
    const { body } = analyticsTable(req, new URL('http://x/?limit=10000'), kind);
    const HEAD = {
      albums: ['Album', 'Plays', 'Unique Listeners', 'Listening Hours'],
      songs: ['Song', 'Album', 'Plays', 'Unique Listeners', 'Listening Hours'],
      users: ['User', 'Email', 'Plays', 'Distinct Songs', 'Listening Hours'],
    }[kind];
    const rows = body.items.map((x) =>
      kind === 'albums'
        ? [x.title, x.plays, x.listeners, (x.listening_seconds / 3600).toFixed(2)]
        : kind === 'songs'
          ? [x.title, x.album, x.plays, x.listeners, (x.listening_seconds / 3600).toFixed(2)]
          : [x.name, x.email, x.plays, x.songs, (x.listening_seconds / 3600).toFixed(2)],
    );
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return {
      status: 200,
      csv: [HEAD.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n'),
      filename: `torahsings-analytics-${kind}.csv`,
    };
  },

  /** GET /api/admin/users — every account with its granted roles. */
  'GET /api/admin/users': (_body, req) => {
    requireAdmin(req);
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at').all();
    const roleRows = db.prepare('SELECT user_id, role FROM user_roles ORDER BY role').all();
    const byUser = new Map();
    for (const r of roleRows) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id).push(r.role);
    }
    return {
      status: 200,
      body: rows.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        // Postgres keeps first/last as their own columns; the local table only
        // has display_name, so split it the same way the API composes it.
        first_name: (u.display_name || '').split(' ')[0] || null,
        last_name: (u.display_name || '').split(' ').slice(1).join(' ') || null,
        is_active: !!u.is_active,
        last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
        created_at: new Date(u.created_at).toISOString(),
        roles: byUser.get(u.id) || [],
      })),
    };
  },

  /**
   * GET /api/admin/active-listeners — sessions seen in the last 45 seconds.
   *
   * The window is the whole behaviour: a stale row must drop out on its own,
   * exactly as `updated_at > NOW() - INTERVAL '45 seconds'` does in Postgres.
   */
  'GET /api/admin/active-listeners': (_body, req) => {
    requireAdmin(req);
    const cutoff = now() - LIVE_WINDOW_MS;
    const rows = db
      .prepare(
        `SELECT np.session_id, np.album_code, np.song_title, np.track_n, np.ip_address,
                np.started_at, np.updated_at, u.display_name
           FROM now_playing np
           JOIN users u ON u.id = np.user_id
          WHERE np.updated_at > ?
          ORDER BY np.updated_at DESC`,
      )
      .all(cutoff);
    const listeners = rows.map((x) => ({
      session_id: x.session_id,
      name: x.display_name || 'Deleted user',
      // Postgres resolves this through geoLookup(ip); there is no geo database
      // locally, so report the address rather than invent a city.
      location: x.ip_address || null,
      album: x.album_code || '—',
      track: x.track_n ?? null,
      song: x.song_title || '—',
      code: x.album_code || null,
      cover: null,
      since: new Date(x.started_at).toISOString(),
    }));
    return { status: 200, body: { count: listeners.length, listeners } };
  },

  /** GET /api/admin/audit — identity.audit_log, newest first. */
  'GET /api/admin/audit': (_body, req) => {
    requireAdmin(req);
    const rows = db
      .prepare(
        `SELECT a.id, a.action, a.detail, a.created_at, u.display_name AS actor
           FROM audit a
           LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT 500`,
      )
      .all();
    return {
      status: 200,
      body: rows.map((r) => {
        // Postgres splits this into target_type/target_id/payload columns; the
        // local table carries one JSON blob, so unpack it to the same shape.
        let payload = null;
        try {
          payload = r.detail ? JSON.parse(r.detail) : null;
        } catch {
          payload = null;
        }
        return {
          id: String(r.id),
          action: r.action,
          // "playlist.create" -> "playlist"; the real column is a real column.
          target_type: r.action.includes('.') ? r.action.split('.')[0] : null,
          target_id: payload?.id ?? null,
          payload,
          created_at: new Date(r.created_at).toISOString(),
          actor: r.actor || null,
        };
      }),
    };
  },

  /** GET /api/pipeline — production.pipeline_state + stage counts. */
  'GET /api/pipeline': (_body, req, url) => {
    // The real route is requireRole('content_editor'); admin clears that bar.
    requireUser(req);
    const stage = url.searchParams.get('stage');
    if (stage && !PIPELINE_STAGES.includes(stage)) throw new HttpError(400, 'invalid stage');
    const items = db
      .prepare(
        `SELECT rateable_type, rateable_id, current_stage, assignee_user_id,
                entered_stage_at, updated_at
           FROM pipeline_state
          ${stage ? 'WHERE current_stage = ?' : ''}
          ORDER BY updated_at DESC
          LIMIT 1000`,
      )
      .all(...(stage ? [stage] : []));
    const counts = {};
    for (const r of db.prepare('SELECT current_stage, COUNT(*) AS n FROM pipeline_state GROUP BY current_stage').all()) {
      counts[r.current_stage] = r.n;
    }
    return {
      status: 200,
      body: {
        items: items.map((i) => ({
          ...i,
          entered_stage_at: new Date(i.entered_stage_at).toISOString(),
          updated_at: new Date(i.updated_at).toISOString(),
        })),
        counts,
      },
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
// Playlists. Longest first: /items/bulk must be tested before /items, and both
// before the bare /:id — otherwise the shorter pattern swallows them.
const PL_ITEMS_BULK = new RegExp(`^/api/me/playlists/(${UUID})/items/bulk$`);
const PL_ITEM = new RegExp(`^/api/me/playlists/(${UUID})/items/(${UUID})$`);
const PL_ITEMS = new RegExp(`^/api/me/playlists/(${UUID})/items$`);
const PL_ONE = new RegExp(`^/api/me/playlists/(${UUID})$`);
// Admin user routes. /roles is longer, so it must be matched before the bare id.
const ADMIN_USER_ROLES = new RegExp(`^/api/admin/users/(${UUID})/roles$`);
const ADMIN_USER = new RegExp(`^/api/admin/users/(${UUID})$`);

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

  // ---- Playlists -----------------------------------------------------------

  /**
   * Bulk add — a whole album in one call. Songs already on the list are skipped,
   * and `added` counts only the NEW ones, which is what the menu reports back
   * ("Added 7 tracks." vs "Already in that playlist.").
   */
  {
    method: 'POST',
    re: PL_ITEMS_BULK,
    handler: ([, id], body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      const ids = Array.isArray(body?.song_ids) ? body.song_ids : [];
      if (!ids.length || ids.length > 100) {
        throw new HttpError(400, 'song_ids must hold between 1 and 100 ids.');
      }
      if (ids.some((s) => isUuid(s))) throw new HttpError(400, 'song_ids must all be uuids.');
      // One transaction, as the real API does — a half-added album is worse
      // than none, and node:sqlite gives us this for free.
      let added = 0;
      db.exec('BEGIN');
      try {
        for (const sid of ids) if (appendSong(pl.id, sid)) added += 1;
        touchPlaylist(pl.id);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      audit(user.id, 'playlist.bulk_add', { playlist: pl.id, added, total: ids.length });
      return { status: 200, body: { playlist_id: pl.id, added, total: ids.length } };
    },
  },

  /** Add a single song to the end. A duplicate is a 200, not an error. */
  {
    method: 'POST',
    re: PL_ITEMS,
    handler: ([, id], body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      validate(body, { song_id: isUuid });
      const inserted = appendSong(pl.id, body.song_id);
      touchPlaylist(pl.id);
      if (!inserted) {
        return { status: 200, body: { playlist_id: pl.id, song_id: body.song_id, duplicate: true } };
      }
      const row = db
        .prepare('SELECT * FROM user_playlist_items WHERE playlist_id = ? AND song_id = ?')
        .get(pl.id, body.song_id);
      return {
        status: 201,
        body: { ...row, added_at: new Date(row.added_at).toISOString() },
      };
    },
  },

  /** Remove one item. */
  {
    method: 'DELETE',
    re: PL_ITEM,
    handler: ([, id, itemId], _body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      db.prepare('DELETE FROM user_playlist_items WHERE id = ? AND playlist_id = ?').run(itemId, pl.id);
      touchPlaylist(pl.id);
      return { status: 204 };
    },
  },

  /**
   * Playlist detail with its ordered items. The real API joins catalog.songs for
   * titles and the manifest for urls; neither exists here, so the song ids are
   * returned bare and the client resolves them against its own catalog.
   */
  {
    method: 'GET',
    re: PL_ONE,
    handler: ([, id], _body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      const items = db
        .prepare('SELECT * FROM user_playlist_items WHERE playlist_id = ? ORDER BY position')
        .all(pl.id);
      return {
        status: 200,
        body: {
          ...playlistDto(pl),
          items: items.map((it) => ({
            id: it.id,
            song_id: it.song_id,
            position: it.position,
            added_at: new Date(it.added_at).toISOString(),
            cover: null,
            url: null,
          })),
        },
      };
    },
  },

  /** Rename / description / visibility. */
  {
    method: 'PATCH',
    re: PL_ONE,
    handler: ([, id], body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      const name =
        typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 200) : pl.name;
      const description =
        body?.description === undefined ? pl.description : (body.description || null);
      const isPublic = body?.is_public === undefined ? pl.is_public : body.is_public ? 1 : 0;
      db.prepare(
        'UPDATE user_playlists SET name = ?, description = ?, is_public = ?, updated_at = ? WHERE id = ?',
      ).run(name, description, isPublic, now(), pl.id);
      return { status: 200, body: playlistDto(db.prepare('SELECT * FROM user_playlists WHERE id = ?').get(pl.id)) };
    },
  },

  /** Delete a playlist. Items go with it (ON DELETE CASCADE). */
  {
    method: 'DELETE',
    re: PL_ONE,
    handler: ([, id], _body, req) => {
      const user = requireUser(req);
      const pl = ownedPlaylist(id, user.id);
      db.prepare('DELETE FROM user_playlists WHERE id = ?').run(pl.id);
      audit(user.id, 'playlist.delete', { id: pl.id });
      return { status: 204 };
    },
  },

  // ------------------------------------------------------- admin · users ---
  // Mirrors api/src/routes/admin.js. Longest path first: /roles must be tested
  // before the bare /:id, or the shorter pattern swallows it.

  /** PATCH /api/admin/users/:id/roles — set the granted set. */
  {
    method: 'PATCH',
    re: ADMIN_USER_ROLES,
    handler: ([, id], body, req) => {
      requireAdmin(req);
      const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!target) throw new HttpError(404, 'user not found');
      const asked = Array.isArray(body?.roles) ? body.roles : [];
      if (asked.some((r) => !GRANTABLE_ROLES.includes(r))) {
        throw new HttpError(400, `roles must be drawn from: ${GRANTABLE_ROLES.join(', ')}`);
      }
      // `viewer` is the implicit baseline the API always re-adds, exactly as
      // admin.js does with `new Set(['viewer', ...roles])`.
      const want = new Set(['viewer', ...asked]);
      const have = new Set(db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(id).map((r) => r.role));
      db.exec('BEGIN');
      try {
        for (const role of want) {
          if (!have.has(role)) {
            db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)').run(id, role);
          }
        }
        for (const role of have) {
          if (!want.has(role)) {
            db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').run(id, role);
          }
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      audit(currentUser(req).id, 'role.set', { id, roles: [...want] });
      return { status: 200, body: { user_id: id, roles: [...want] } };
    },
  },

  /** PATCH /api/admin/users/:id — rename. display_name stays "First Last". */
  {
    method: 'PATCH',
    re: ADMIN_USER,
    handler: ([, id], body, req) => {
      requireAdmin(req);
      const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!target) throw new HttpError(404, 'user not found');
      const first = typeof body?.first_name === 'string' ? body.first_name.trim().slice(0, 120) : '';
      const last = typeof body?.last_name === 'string' ? body.last_name.trim().slice(0, 120) : '';
      const display = [first, last].filter(Boolean).join(' ').trim();
      if (!display) throw new HttpError(400, 'a first or last name is required');
      db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display, id);
      audit(currentUser(req).id, 'user.rename', { id, display_name: display });
      return { status: 200, body: { id, display_name: display, first_name: first || null, last_name: last || null } };
    },
  },

  /** DELETE /api/admin/users/:id — hard delete, cascading credentials/roles. */
  {
    method: 'DELETE',
    re: ADMIN_USER,
    handler: ([, id], _body, req) => {
      const me = requireAdmin(req);
      // The real API refuses this too — an admin deleting themselves from the
      // console is almost always a misclick, and it cannot be undone.
      if (id === me.id) throw new HttpError(400, 'you cannot delete your own account from here');
      const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
      if (!target) throw new HttpError(404, 'user not found');
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.prepare('DELETE FROM signup_verifications WHERE email = ?').run(target.email);
      audit(me.id, 'user.delete', { id, email: target.email });
      return { status: 200, body: { ok: true, deleted: id } };
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
    // A handler may answer with a file instead of JSON (the analytics CSV
    // export). It signals that by returning `csv` rather than `body`.
    if (typeof out.csv === 'string') {
      res.writeHead(out.status, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${out.filename || 'export.csv'}"`,
      });
      res.end(out.csv);
      console.log(`  ${out.status}  ${key}  (csv)`);
      return;
    }
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
