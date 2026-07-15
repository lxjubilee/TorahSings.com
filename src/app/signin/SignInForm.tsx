'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { AuthHero } from './AuthHero';
import styles from './SignInForm.module.css';

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
 * Sign in / sign up, in JubiLujah's split-screen auth style: a form panel on the
 * left, a celestial hero with a quote on the right (collapsing to one column on
 * phones). One page toggles between the two modes. Submitting hands off to the
 * Jubilee Account — real SSO when it is wired, the local stub otherwise — then
 * drops the visitor at their account.
 */
export function SignInForm() {
  const { signIn, isStub } = useJubileeAccount();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isSignup = mode === 'signup';

  // Lock the page behind the fixed overlay so the only scroll is the left
  // panel's — the right hero never scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <button type="button" className={styles.switchBtn} onClick={() => setMode('signin')}>
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don&rsquo;t have an account?{' '}
                  <button type="button" className={styles.switchBtn} onClick={() => setMode('signup')}>
                    Sign Up
                  </button>
                </>
              )}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                signIn();
                // In stub mode signIn() is synchronous, so send the visitor to
                // their account. Real SSO redirects on its own — don't override.
                if (isStub) window.location.assign('/account');
              }}
            >
              {isSignup && (
                <div className={styles.nameRow}>
                  <div className={styles.field}>
                    <label htmlFor="firstName">First Name</label>
                    <input id="firstName" name="firstName" type="text" required autoComplete="given-name" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lastName">Last Name</label>
                    <input id="lastName" name="lastName" type="text" required autoComplete="family-name" />
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {isSignup && (
                <div className={styles.field}>
                  <label htmlFor="dob">Date of Birth</label>
                  <input id="dob" name="dob" type="date" required autoComplete="bday" />
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className={styles.eye}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <Eye open={showPw} />
                </button>
              </div>

              {isSignup && (
                <div className={styles.field}>
                  <label htmlFor="confirm">Confirm Password</label>
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <Eye open={showConfirm} />
                  </button>
                </div>
              )}

              {isSignup ? (
                <label className={styles.check}>
                  <input type="checkbox" required />
                  <span>
                    I agree to the <Link href="/membership">Terms of Use</Link> and{' '}
                    <Link href="/membership">Privacy Policy</Link>.
                  </span>
                </label>
              ) : (
                <div className={styles.forgot}>
                  <Link href="/account">Forgot password?</Link>
                </div>
              )}

              <button type="submit" className={styles.submit}>
                {isSignup ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <p className={styles.foot}>One Jubilee Account, good across the whole ecosystem.</p>
          </div>
        </div>

        <AuthHero />
      </div>
    </>
  );
}
