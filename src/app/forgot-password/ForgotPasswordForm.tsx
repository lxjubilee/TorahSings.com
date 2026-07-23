'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AuthHero } from '../signin/AuthHero';
import styles from '../signin/SignInForm.module.css';

/**
 * Forgot password — step 1 of the reset flow (docs/API.md §7). Collects the
 * account email and asks the API to email a single-use reset link. The API is
 * deliberately anti-enumeration: POST /api/auth/forgot-password ALWAYS answers
 * 200 with the same message whether or not an account exists, so the UI must
 * show the identical confirmation on success AND on error — never leaking, via
 * timing or status, whether the email is registered. The link lands the visitor
 * on /reset-password?token=… (step 2).
 *
 * Reuses the split-screen chrome + hero from /signin (same CSS module and
 * AuthHero) so the whole auth surface reads as one design.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Lock the page behind the fixed overlay so only the left panel scrolls —
  // same behaviour as the sign-in screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always show the same confirmation (anti-enumeration) — even on a network
    // or server error, so nothing observable reveals whether the account exists.
    try {
      await api.post('/api/auth/forgot-password', { email });
    } catch {
      /* intentionally ignored — the confirmation is identical either way */
    }
    setSent(true);
    setBusy(false);
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

            <p className={styles.switch}>
              Remembered it?{' '}
              <Link href="/signin" className={styles.switchBtn}>
                Sign In
              </Link>
            </p>

            {sent ? (
              <p className={styles.info}>
                If an account exists for that email, we&rsquo;ve sent a link to reset your
                password. Check your inbox (and your spam folder).
              </p>
            ) : (
              <form onSubmit={submit}>
                <p className={styles.lead}>
                  Enter your account email and we&rsquo;ll send you a link to reset your
                  password.
                </p>

                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button type="submit" className={styles.submit} disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
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
