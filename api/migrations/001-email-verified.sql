-- ─────────────────────────────────────────────────────────────────────────
-- identity.users.email_verified + identity.email_verifications
--
-- Sign-up no longer emails a six-digit code before creating the account (the
-- two-phase flow was removed to match JubileeInspire), so nothing records
-- whether an address was ever real. These two objects are that record and the
-- way to earn it: a member asks from /account, a code is emailed, and typing it
-- back is the proof.
--
-- ── WHY A SECOND TABLE RATHER THAN REUSING login_verifications ──
-- That table answers "is this the person signing in" and its rows are consumed
-- by the sign-in path. Verification is a different question asked at a different
-- time by an already-signed-in member, and sharing one table would mean a
-- half-finished sign-in and a half-finished address check could retire each
-- other. Same shape, separate lifecycle.
--
-- The column is PROMOTE-ONLY. A password sign-in must never set it: it proves
-- the person knows a password they may have chosen themselves minutes earlier,
-- which says nothing about who reads the mailbox.
--
-- ── THE BACKFILL RUNS EXACTLY ONCE, WHEN THE COLUMN IS CREATED ──
-- Every row present at that moment was created by the OLD two-phase sign-up,
-- which proved the address before creating anything — so those start TRUE.
-- Guarding on "did the column already exist" ties the backfill to the one moment
-- that is true, rather than to a clock: the naive
-- `UPDATE ... WHERE email_verified = FALSE` would, on a re-run months later,
-- sweep up every genuinely unverified sign-up made since.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  had_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'identity'
       AND table_name   = 'users'
       AND column_name  = 'email_verified'
  ) INTO had_column;

  IF NOT had_column THEN
    ALTER TABLE identity.users
      ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

    UPDATE identity.users SET email_verified = TRUE;

    RAISE NOTICE 'email_verified added; % existing row(s) backfilled as verified',
      (SELECT count(*) FROM identity.users);
  ELSE
    RAISE NOTICE 'email_verified already present — nothing to do';
  END IF;
END $$;

-- The outstanding challenge for a member. Mirrors login_verifications' shape so
-- the two read the same way, minus resend_count: the send route caps by counting
-- rows in a window instead, which survives the row being replaced.
CREATE TABLE IF NOT EXISTS identity.email_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES identity.users (id) ON DELETE CASCADE,
  email        text NOT NULL,
  code         varchar(6) NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The only lookup that matters is "the newest outstanding challenge for this
-- member", which both sending (to retire the previous one) and confirming ask for.
CREATE INDEX IF NOT EXISTS idx_email_verifications_user
  ON identity.email_verifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verifications_live
  ON identity.email_verifications (user_id)
  WHERE used_at IS NULL;

COMMENT ON COLUMN identity.users.email_verified IS
  'TRUE once the member answered a code emailed to this address. Promote-only; a password sign-in does NOT set it. Gates nothing.';
