'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AuthHero } from '../signin/AuthHero';
import styles from '../signin/SignInForm.module.css';

function Eye({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Reset password — step 2 of the flow (docs/API.md §7). The single-use token
 * arrives in the URL (?token=…) from the emailed link; the visitor sets a new
 * password, which POST /api/auth/reset-password redeems (min 8 chars, matching
 * the API's zod rule). On success the API has already revoked every existing
 * session, so we bounce to /signin?reset=1 where a banner confirms the change.
 *
 * A missing/blank token is handled up front — the API would only 400 later, so
 * we point the visitor back to /forgot-password to request a fresh link.
 */
function ResetInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Lock the page behind the fixed overlay — parity with /signin.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr('Please choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('Those passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      // Every session was revoked server-side; send them to sign in afresh.
      window.location.assign('/signin?reset=1');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not reset your password. Please try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.topbar} aria-hidden="true" />

      <div className={styles.split}>
        <div className={styles.panel}>
          <div className={styles.inner}>
            <Link href="/" className={styles.brandLink} aria-label="Torah Sings — home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.avatar} src="/zev-circle.png" alt="" width={100} height={100} />
              <div className={styles.brand}>
                <span className={styles.b1}>Torah</span>
                <span className={styles.b2}>Sings</span>
                <span className={styles.b1}>.com</span>
              </div>
            </Link>

            <p className={styles.switch}>Set a new password</p>

            {err && (
              <p className={styles.error} role="alert">
                {err}
              </p>
            )}

            {!token ? (
              <p className={styles.error}>
                This reset link is missing or malformed.{' '}
                <Link href="/forgot-password" className={styles.switchBtn}>
                  Request a new link.
                </Link>
              </p>
            ) : (
              <form onSubmit={submit}>
                <div className={styles.field}>
                  <label htmlFor="password">New password</label>
                  <input
                    id="password"
                    name="password"
                    type={show ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    <Eye open={show} />
                  </button>
                </div>

                <div className={styles.field}>
                  <label htmlFor="confirm">Confirm new password</label>
                  <input
                    id="confirm"
                    name="confirm"
                    type={show ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                {confirm.length > 0 && confirm !== password && (
                  <p className={styles.mismatch} aria-live="polite">
                    Passwords don&rsquo;t match
                  </p>
                )}

                <button type="submit" className={styles.submit} disabled={busy}>
                  {busy ? 'Saving…' : 'Reset password'}
                </button>
              </form>
            )}

            <p className={styles.foot}>
              <Link href="/signin">&larr; Back to sign in</Link>
            </p>
          </div>
        </div>

        <AuthHero />
      </div>
    </>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className={styles.split} />}>
      <ResetInner />
    </Suspense>
  );
}
