'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ALEPH_BET, MODES, degreeOf } from '@/lib/derivation';
import { YEARLY_PRICE_LABEL } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { useJubileeAccount } from '@/lib/jubilee-account';
import {
  getContributions,
  getMyReviews,
  type Contributions,
  type MyReview,
  type TargetType,
} from '@/lib/reviews';
import styles from './AccountPanel.module.css';

/**
 * The account console, in JubiLujah's /account design.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "Delete account" is LIVE: it calls DELETE /api/auth/account (deleteAccount in
 * jubilee-account.tsx → server-side purgeUserAccount). That teardown is local to
 * TorahSings only — it never calls JubileeInspire, so the shared Jubilee Account
 * and other sites are untouched.
 *
 * "Change password" is still PRESENTATION ONLY: it validates locally and stops
 * (PENDING_NOTICE) rather than pretending to work. Wire it to
 *   POST /api/auth/change-password  { current_password, new_password, refreshToken? }
 * (docs/API.md §7.2) to finish it, then drop PENDING_NOTICE.
 * ────────────────────────────────────────────────────────────────────────────
 */

const PENDING_NOTICE = 'Not connected yet — this will work once your Jubilee Account is wired to the identity service.';

/**
 * The contribution counters, in display order. Values come from
 * GET /api/reviews/me/contributions (see lib/reviews.ts) — the labels map 1:1
 * onto its fields, so rating an album or song is reflected here on next load.
 */
const CONTRIB_ROWS: Array<{ label: string; key: keyof Contributions }> = [
  { label: 'Albums rated', key: 'albums_rated' },
  { label: 'Songs rated', key: 'songs_rated' },
  { label: 'Reviews written', key: 'reviews_written' },
  { label: 'Helpful votes received', key: 'helpful_received' },
  { label: 'Total contributions', key: 'total_contributions' },
];

type MyReviewRow = MyReview & { target_type: TargetType; target_id: string };

/** "July 2026" — the reviews list dates to the month, not the day. */
function monthYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

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
  const { session, status, entitlement, signIn, signOut, subscribe, deleteAccount } = useJubileeAccount();

  // Change-password form — local state only (see the note at the top).
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwNote, setPwNote] = useState<string | null>(null);

  // Delete-account.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDelBusy(true);
    setDelErr(null);
    try {
      await deleteAccount();
      // Gone. Leave the account area for the public home.
      window.location.assign('/');
    } catch (e) {
      setDelBusy(false);
      setDelErr(
        e instanceof ApiError && e.status === 401
          ? 'Your session expired. Please sign in again, then retry.'
          : e instanceof ApiError
            ? e.message
            : 'Could not delete your account. Please try again.',
      );
    }
  };

  // My Contributions — live from the reviews API, refetched whenever the page
  // mounts, so a rating made on an album shows up on the next visit here.
  const [contrib, setContrib] = useState<Contributions | null>(null);
  const [myReviews, setMyReviews] = useState<MyReviewRow[]>([]);
  const [contribErr, setContribErr] = useState(false);

  // Keyed on userId, not `session` — the session object's identity changes and
  // would re-run this effect endlessly.
  const userId = session?.userId;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, r] = await Promise.all([getContributions(), getMyReviews()]);
        if (cancelled) return;
        setContrib(c);
        setMyReviews(r ?? []);
        setContribErr(false);
      } catch {
        // Don't blank the card on a blip — say so instead of showing fake zeros.
        if (!cancelled) setContribErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

          {contribErr && (
            <p className={`${styles.msg} ${styles.msgErr}`}>
              Could not load your contributions just now. Reload to try again.
            </p>
          )}

          <div className={styles.contribCards}>
            {CONTRIB_ROWS.map((c) => (
              <div className={styles.contribCard} key={c.label}>
                {/* An em dash until the real number arrives — never a fake 0. */}
                <div className={styles.contribNum}>
                  {contrib ? contrib[c.key].toLocaleString() : '—'}
                </div>
                <div className={styles.contribLbl}>{c.label}</div>
              </div>
            ))}
          </div>

          <h3 className={styles.contribSub}>Your reviews</h3>
          {myReviews.length === 0 ? (
            <p className={styles.contribEmpty}>You haven&apos;t written any reviews yet.</p>
          ) : (
            <ul className={styles.reviewList}>
              {myReviews.map((r) => (
                <li className={styles.reviewRow} key={r.id}>
                  <div className={styles.reviewTop}>
                    <span className={styles.reviewStars} aria-label={`${r.stars} out of 5 stars`}>
                      {'★'.repeat(r.stars)}
                      <span className={styles.reviewStarsOff}>{'★'.repeat(5 - r.stars)}</span>
                    </span>
                    <span
                      className={`${styles.reviewStatus} ${
                        r.status === 'published' ? styles.reviewStatusOk : styles.reviewStatusHold
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className={styles.reviewMeta}>
                    <span className={styles.reviewType}>{r.target_type}</span>
                    <span className={styles.reviewDot} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.reviewDate}>{monthYear(r.created_at)}</span>
                    {r.edited && <span className={styles.reviewDate}>· edited</span>}
                  </div>

                  {r.body ? <p className={styles.reviewBody}>{r.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
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
                setDelErr(null);
                setConfirmOpen(true);
              }}
            >
              Delete account
            </button>
          </div>
        </section>
      </div>

      {confirmOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (!delBusy && e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="del-title">
            <h3 id="del-title" className={styles.modalTitle}>
              Delete your account?
            </h3>
            <p className={styles.modalBody}>
              This permanently deletes your <strong>TorahSings.com</strong> account (
              <strong>{session.email}</strong>) and everything on it. It cannot be undone.
            </p>
            <p className={styles.modalBody} style={{ marginTop: 10 }}>
              Your Jubilee Account and any other Jubilee sites are <strong>not</strong> affected — this removes
              you from TorahSings.com only.
            </p>

            {delErr && (
              <p className={`${styles.msg} ${styles.msgErr}`} style={{ margin: '12px 0 0' }}>
                {delErr}
              </p>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setConfirmOpen(false)}
                disabled={delBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={confirmDelete}
                disabled={delBusy}
              >
                {delBusy ? 'Deleting…' : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
