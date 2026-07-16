'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ALEPH_BET, MODES, degreeOf } from '@/lib/derivation';
import { YEARLY_PRICE_LABEL } from '@/lib/format';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './AccountPanel.module.css';

/**
 * The account console, in JubiLujah's /account design.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PRESENTATION ONLY, FOR NOW
 *
 * "Change password" and "Delete account" are laid out and behave locally, but
 * NOTHING is wired to a server — the Jubilee Account is still the browser stub,
 * so there is no password to change and no account to delete. Submitting either
 * one says so out loud rather than pretending to work.
 *
 * When auth is wired up, they map onto endpoints torahsings-api already serves:
 *   change password → POST   /api/auth/change-password  { current_password, new_password, refreshToken? }
 *   delete account  → DELETE /api/auth/account
 * See docs/API.md §7.2. At that point delete the PENDING_NOTICE paths below.
 * ────────────────────────────────────────────────────────────────────────────
 */

const PENDING_NOTICE = 'Not connected yet — this will work once your Jubilee Account is wired to the identity service.';

/**
 * The contribution counters. These are NOT placeholder numbers — nothing in the
 * library can be rated or reviewed yet, so zero is the true count for everyone.
 * When the ratings/reviews routers come up, replace this constant with the
 * GET /api/reviews contributions payload; the labels already match its fields
 * (albums_rated, songs_rated, reviews_written, helpful_received,
 * total_contributions), and the reviews list below takes GET /api/reviews/mine.
 */
const CONTRIBUTIONS: Array<{ label: string; value: number }> = [
  { label: 'Albums rated', value: 0 },
  { label: 'Songs rated', value: 0 },
  { label: 'Reviews written', value: 0 },
  { label: 'Helpful votes received', value: 0 },
  { label: 'Total contributions', value: 0 },
];

const EYE =
  'M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5C21.3 7.6 17 4.5 12 4.5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z';
const EYE_OFF =
  'M12 7a5 5 0 015 5c0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65a3 3 0 003 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 01-5-5c0-.79.2-1.53.53-2.2z';

function Eye({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.eye}
      onClick={toggle}
      aria-label={on ? 'Hide password' : 'Show password'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d={on ? EYE_OFF : EYE} />
      </svg>
    </button>
  );
}

/** The letter table, generated on demand. Real file, real data, no server. */
function downloadLetterTable() {
  const modeIds = Object.keys(MODES) as (keyof typeof MODES)[];

  const header = ['letter', 'name', 'name_sense', 'value', 'degree', ...modeIds.map((m) => MODES[m].label)];

  const rows = ALEPH_BET.map((l) => {
    const degree = degreeOf(l.value);
    return [
      l.letter,
      l.name,
      `"${l.sense.replace(/"/g, '""')}"`,
      String(l.value),
      String(degree),
      ...modeIds.map((m) => MODES[m].degrees[degree - 1]),
    ];
  });

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  // A BOM, so the Hebrew survives a double-click into a spreadsheet.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'torah-sings-letter-table.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountPanel() {
  const { session, status, entitlement, isStub, signIn, signOut, subscribe } = useJubileeAccount();

  // Change-password form — local state only (see the note at the top).
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwNote, setPwNote] = useState<string | null>(null);

  // Delete-account — local state only.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delNote, setDelNote] = useState<string | null>(null);

  const onDownloadTable = useCallback(() => downloadLetterTable(), []);

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading your Jubilee Account…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.page}>
        <div className={styles.shell} style={{ paddingTop: 64 }}>
          <div className={styles.signedOut}>
            <div className={styles.eyebrow}>One account across the ecosystem</div>
            <h2 className={styles.cardTitle} style={{ margin: '10px 0 0' }}>
              Sign in with your Jubilee Account
            </h2>
            <p className={styles.signedOutBody}>
              The same account carries you across every Jubilee platform. Sign in to pick up where you stopped
              listening, and to open whatever your membership has unlocked.
            </p>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={signIn}>
              Sign in
            </button>
          </div>
          {isStub && <StubNotice />}
        </div>
      </div>
    );
  }

  const isMember = entitlement === 'member';
  const initial = (session.displayName || session.email || '?').trim().charAt(0).toUpperCase();

  // Validates like the real thing, then stops at the door — no request is sent.
  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwNote(null);
    if (next.length < 8) {
      setPwErr('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setPwErr('New passwords do not match.');
      return;
    }
    setPwNote(PENDING_NOTICE);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.id}>
            <div className={styles.avatar} aria-hidden="true">
              {initial}
            </div>
            <div>
              <div className={styles.eyebrow}>Account</div>
              <h1 className={styles.h1}>Your account</h1>
              <p className={styles.sub}>
                Signed in as <strong>{session.email}</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        {/* ---- Change password (presentation only) ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Change password</h2>
            <p className={styles.cardNote}>
              Use at least 8 characters. Changing your password signs out your other devices.
            </p>
          </div>

          {pwNote && <p className={`${styles.msg} ${styles.msgOk}`}>{pwNote}</p>}
          {pwErr && <p className={`${styles.msg} ${styles.msgErr}`}>{pwErr}</p>}

          <form className={styles.form} onSubmit={submitPassword}>
            <label className={styles.field}>
              <span>Current password</span>
              <div className={styles.input}>
                <input
                  type={showCur ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                <Eye on={showCur} toggle={() => setShowCur(!showCur)} />
              </div>
            </label>

            <label className={styles.field}>
              <span>New password</span>
              <div className={styles.input}>
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <Eye on={showNew} toggle={() => setShowNew(!showNew)} />
              </div>
            </label>

            <label className={styles.field}>
              <span>Confirm new password</span>
              <div className={styles.input}>
                <input
                  type={showConf ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <Eye on={showConf} toggle={() => setShowConf(!showConf)} />
              </div>
            </label>

            <div className={styles.actions}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                Change password
              </button>
            </div>
          </form>
        </section>

        {/* ---- Membership ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Membership</h2>
            <p className={styles.cardNote}>
              {isMember
                ? 'The full treasury is open to you — every album, every lesson, every derivation.'
                : 'You are on the free tier. Partnership opens the whole library.'}
            </p>
          </div>

          <div className={styles.kv}>
            <span className={styles.key}>Status</span>
            <span className={`${styles.val} ${isMember ? styles.active : ''}`}>
              {isMember ? 'Active partner' : 'Free tier'}
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.key}>Plan</span>
            <span className={styles.val}>{isMember ? `Yearly · ${YEARLY_PRICE_LABEL}` : 'None'}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.key}>{isMember ? 'Renews' : 'Unlocks'}</span>
            <span className={styles.val}>
              {isMember ? (session.subscription.renewsAt ?? 'Annually') : 'The whole library'}
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.key}>Account ID</span>
            <span className={styles.val}>{session.userId}</span>
          </div>

          <div className={styles.actions}>
            {isMember ? (
              <Link href="/" className={`${styles.btn} ${styles.btnGhost}`}>
                Back to the library
              </Link>
            ) : (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={subscribe}>
                Become a partner — {YEARLY_PRICE_LABEL}/yr
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={signOut} style={{ marginLeft: 10 }}>
              Sign out
            </button>
          </div>
        </section>

        {/* ---- Resources kit ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>The resources kit</h2>
            <p className={styles.cardNote}>For the serious student. Included with membership.</p>
          </div>

          <ul className={styles.kit}>
            <li className={styles.kitRow}>
              <div className={styles.kitBody}>
                <span className={styles.kitName}>The letter table</span>
                <span className={styles.kitNote}>
                  All twenty-two symbols — pictographic sense, numerical value, sevenfold degree, and the note it
                  sounds in each of the six modes. CSV.
                </span>
              </div>
              <button
                type="button"
                className={styles.kitBtn}
                onClick={onDownloadTable}
                disabled={!isMember}
                title={isMember ? undefined : 'Unlocks with membership'}
              >
                {isMember ? 'Download' : 'Members'}
              </button>
            </li>

            <li className={styles.kitRow}>
              <div className={styles.kitBody}>
                <span className={styles.kitName}>The methodology, at the disclosed level</span>
                <span className={styles.kitNote}>
                  The stripping, the pictograph, the value, the fold, the mode — written out in full, with worked
                  examples. The ordering layer remains undisclosed.
                </span>
              </div>
              <button type="button" className={styles.kitBtn} disabled title="Publication pending">
                Pending
              </button>
            </li>

            <li className={styles.kitRow}>
              <div className={styles.kitBody}>
                <span className={styles.kitName}>Fragments of a Song</span>
                <span className={styles.kitNote}>The book, included with membership. EPUB and PDF.</span>
              </div>
              <button type="button" className={styles.kitBtn} disabled title="Publication pending">
                Pending
              </button>
            </li>
          </ul>
        </section>

        {/* ---- My Contributions ---- */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>My Contributions</h2>
            <p className={styles.cardNote}>
              Your rating and review activity across the library.
            </p>
          </div>

          <div className={styles.contribCards}>
            {CONTRIBUTIONS.map((c) => (
              <div className={styles.contribCard} key={c.label}>
                <div className={styles.contribNum}>{c.value.toLocaleString()}</div>
                <div className={styles.contribLbl}>{c.label}</div>
              </div>
            ))}
          </div>

          <h3 className={styles.contribSub}>Your reviews</h3>
          <p className={styles.contribEmpty}>You haven&apos;t written any reviews yet.</p>
        </section>

        {/* ---- Danger zone (presentation only) ---- */}
        <section className={`${styles.card} ${styles.cardDanger}`}>
          <div className={styles.cardHead}>
            <h2 className={`${styles.cardTitle} ${styles.cardTitleDanger}`}>Danger zone</h2>
          </div>

          <div className={styles.danger}>
            <div>
              <div className={styles.dangerTitle}>Delete account</div>
              <p className={styles.dangerNote}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                setDelNote(null);
                setConfirmOpen(true);
              }}
            >
              Delete account
            </button>
          </div>

          {delNote && !confirmOpen && (
            <p className={`${styles.msg} ${styles.msgOk}`} style={{ margin: '16px 0 0' }}>
              {delNote}
            </p>
          )}
        </section>

        {isStub && <StubNotice />}
      </div>

      {confirmOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="del-title">
            <h3 id="del-title" className={styles.modalTitle}>
              Delete your account?
            </h3>
            <p className={styles.modalBody}>
              This permanently deletes your account (<strong>{session.email}</strong>) and signs you out
              everywhere. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => {
                  setConfirmOpen(false);
                  setDelNote(PENDING_NOTICE);
                }}
              >
                Yes, delete my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Says out loud that SSO is not yet wired, rather than letting the stub pass for the real thing. */
function StubNotice() {
  return (
    <div className={styles.stub}>
      <div className={styles.eyebrow}>Development mode</div>
      <p className={styles.stubBody}>
        Jubilee Account SSO is not connected. This session is a local stand-in stored in your browser so that
        gating, subscription state, and unlocks can be exercised end to end. Change password and Delete account
        are laid out but inert until it is wired. Set <code>NEXT_PUBLIC_JUBILEE_SSO_URL</code> to hand off to the
        real identity service.
      </p>
    </div>
  );
}
