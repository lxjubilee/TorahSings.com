import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../util/async.js';
import { query, withTransaction } from '../db.js';
import { HttpError, requireAuth } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendEmailVerificationCode } from '../services/email.js';
import { logger } from '../logger.js';

// ─────────────────────────────────────────────────────────────────────────
// Proving the address on your own account.
//
// Sign-up stopped emailing a code when it went one-phase, so an account can
// exist whose address nobody has ever checked. This is the way back, and the
// ONLY thing in the API that may set identity.users.email_verified.
//
//   1. THE ADDRESS COMES FROM THE SESSION, NEVER THE BODY. Both routes read
//      req.user and accept no address. Taking one from the caller would let any
//      signed-in person mail a Torah Sings-branded code to a stranger, and pair
//      it with a challenge the confirm step would honour against their own row.
//
//   2. PROMOTE-ONLY. Nothing here writes FALSE. Sign-up starts a row false; only
//      answering a code moves it, and once moved it stays.
//
//   3. NOTHING ELSE MAY SET THE FLAG. Not /signin, not a refresh, not a password
//      reset. Those prove a credential; this proves someone reads the mailbox,
//      which is the only claim the flag makes.
// ─────────────────────────────────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const CODE_ATTEMPTS = 5;
// How many codes one account may ask for in the window, so "send another" cannot
// be turned into a megaphone pointed at somebody's inbox.
const SEND_BUDGET = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

const genCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Constant-time compare, so a wrong code cannot be narrowed by timing. */
function codeMatches(given, stored) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(stored));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function loadSelf(userId) {
  const r = await query(
    'SELECT id, email, display_name, email_verified FROM identity.users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );
  if (!r.rowCount) throw new HttpError(401, 'Not signed in.');
  return r.rows[0];
}

// ---- GET /api/account/email-verification -----------------------------------
// What the account screen renders from. Its own endpoint rather than a field on
// /me so the screen can refresh just this after confirming.
router.get('/', ah(async (req, res) => {
  const me = await loadSelf(req.user.id);
  res.json({ email: me.email, emailVerified: me.email_verified === true });
}));

// ---- POST /api/account/email-verification/send -----------------------------
router.post('/send', ah(async (req, res) => {
  const me = await loadSelf(req.user.id);
  if (me.email_verified === true) return res.json({ success: true, alreadyVerified: true });

  const recent = await query(
    `SELECT COUNT(*)::int AS n FROM identity.email_verifications
      WHERE user_id = $1 AND created_at > NOW() - ($2::int || ' milliseconds')::interval`,
    [me.id, SEND_WINDOW_MS],
  );
  if (recent.rows[0].n >= SEND_BUDGET) {
    throw new HttpError(429, 'We have sent several codes already. Wait a few minutes.');
  }

  const code = genCode();
  await withTransaction(async (client) => {
    // Retire anything outstanding BEFORE inserting, so a member who asks twice
    // cannot answer the older code and be told it is wrong.
    await client.query(
      'UPDATE identity.email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [me.id],
    );
    await client.query(
      `INSERT INTO identity.email_verifications (user_id, email, code, expires_at, max_attempts)
       VALUES ($1, $2, $3, NOW() + ($4::int || ' milliseconds')::interval, $5)`,
      [me.id, me.email, code, CODE_EXPIRY_MS, CODE_ATTEMPTS],
    );
  });

  await sendEmailVerificationCode({ to: me.email, code });
  logger.info({ userId: me.id }, 'Email verification code issued');
  res.json({ success: true, minutes: Math.round(CODE_EXPIRY_MS / 60000) });
}));

// ---- POST /api/account/email-verification/confirm --------------------------
const confirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

router.post('/confirm', validate(confirmSchema), ah(async (req, res) => {
  const me = await loadSelf(req.user.id);

  const out = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, code, attempts, max_attempts, expires_at, email
         FROM identity.email_verifications
        WHERE user_id = $1 AND used_at IS NULL
        ORDER BY created_at DESC LIMIT 1
        FOR UPDATE`,
      [me.id],
    );
    if (!found.rowCount) throw new HttpError(400, 'Ask for a code first.');
    const row = found.rows[0];

    if (new Date(row.expires_at) <= new Date()) {
      throw new HttpError(400, 'That code has expired. Ask for a new one.');
    }
    if (row.attempts >= row.max_attempts) {
      throw new HttpError(429, 'Too many wrong tries. Ask for a new code.');
    }
    // The address must still be the one the code went to: a member who changed
    // it between asking and answering must not verify the NEW one on the
    // strength of a code sent to the old.
    if (String(row.email).toLowerCase() !== String(me.email).toLowerCase()) {
      throw new HttpError(400, 'Your address changed. Ask for a new code.');
    }

    if (!codeMatches(req.body.code, row.code)) {
      const bumped = await client.query(
        'UPDATE identity.email_verifications SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts, max_attempts',
        [row.id],
      );
      const left = Math.max(0, bumped.rows[0].max_attempts - bumped.rows[0].attempts);
      throw new HttpError(400, `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, {
        attemptsRemaining: left,
      });
    }

    await client.query('UPDATE identity.email_verifications SET used_at = NOW() WHERE id = $1', [row.id]);
    await client.query('UPDATE identity.users SET email_verified = TRUE WHERE id = $1', [me.id]);
    return { verified: true };
  });

  logger.info({ userId: me.id }, 'Email address confirmed');
  res.json({ success: true, ...out });
}));

export default router;
