'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Eyebrow } from '@/components/system/Eyebrow';
import { ALEPH_BET, MODES, degreeOf } from '@/lib/derivation';
import { YEARLY_PRICE_LABEL } from '@/lib/format';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './AccountPanel.module.css';

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

  const onDownloadTable = useCallback(() => downloadLetterTable(), []);

  if (status === 'loading') {
    return <p className={styles.loading}>Reading your Jubilee Account…</p>;
  }

  if (!session) {
    return (
      <>
        <div className={styles.signedOut}>
          <Eyebrow>One account across the ecosystem</Eyebrow>
          <h2 className={styles.cardTitle}>Sign in with your Jubilee Account</h2>
          <p className={styles.signedOutBody}>
            The same account carries you across every Jubilee platform. Sign in to pick up where you stopped
            listening, and to open whatever your membership has unlocked.
          </p>
          <button type="button" className="pill" onClick={signIn}>
            Sign in
          </button>
        </div>
        {isStub && <StubNotice />}
      </>
    );
  }

  const isMember = entitlement === 'member';

  return (
    <>
      <div className={styles.grid}>
        <section className={styles.card}>
          <Eyebrow>Your account</Eyebrow>
          <h2 className={styles.cardTitle}>{session.displayName}</h2>

          <div className={styles.field}>
            <span className={styles.key}>Email</span>
            <span className={styles.val}>{session.email}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.key}>Account ID</span>
            <span className={styles.val}>{session.userId}</span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.link} onClick={signOut}>
              Sign out
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <Eyebrow>Membership</Eyebrow>
          <h2 className={styles.cardTitle}>{isMember ? 'The full treasury' : 'The taste'}</h2>

          <div className={styles.field}>
            <span className={styles.key}>Status</span>
            <span className={[styles.val, isMember ? styles.active : ''].filter(Boolean).join(' ')}>
              {isMember ? 'Active partner' : 'Free tier'}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.key}>Plan</span>
            <span className={styles.val}>{isMember ? `Yearly · ${YEARLY_PRICE_LABEL}` : 'None'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.key}>{isMember ? 'Renews' : 'Unlocks'}</span>
            <span className={styles.val}>
              {isMember ? (session.subscription.renewsAt ?? 'Annually') : 'The whole library'}
            </span>
          </div>

          <div className={styles.actions}>
            {isMember ? (
              <Link href="/" className="pill pill--ghost">
                Back to the library
              </Link>
            ) : (
              <button type="button" className="pill" onClick={subscribe}>
                Become a partner — {YEARLY_PRICE_LABEL}/yr
              </button>
            )}
          </div>
        </section>

        <section className={[styles.card, styles.wide].join(' ')}>
          <Eyebrow>The resources kit</Eyebrow>
          <h2 className={styles.cardTitle}>For the serious student</h2>

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
      </div>

      {isStub && <StubNotice />}
    </>
  );
}

/** Says out loud that SSO is not yet wired, rather than letting the stub pass for the real thing. */
function StubNotice() {
  return (
    <div className={styles.stub}>
      <Eyebrow>Development mode</Eyebrow>
      <p className={styles.stubBody}>
        Jubilee Account SSO is not connected. This session is a local stand-in stored in your browser so that
        gating, subscription state, and unlocks can be exercised end to end. Set{' '}
        <code>NEXT_PUBLIC_JUBILEE_SSO_URL</code> to hand off to the real identity service.
      </p>
    </div>
  );
}
