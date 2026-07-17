'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { setTokens } from '@/lib/auth';
import { AuthHero } from './AuthHero';
import styles from './SignInForm.module.css';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

/**
 * Youngest permitted account holder. The identity schema stores no date of
 * birth (docs/AUTH_API.md §1.1 takes only name/email/password), so this is a
 * CLIENT-SIDE gate only — it mirrors the ≥13 rule the admin provision route
 * enforces server-side. The date itself is never sent.
 */
const MIN_AGE = 13;

/** Whole years from an ISO `yyyy-mm-dd` date to today; NaN when unparseable. */
function ageFromDob(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/**
 * POST /api/auth/signin answers one of two ways (docs/API.md §7.2): a session,
 * or a 2FA challenge to complete. In `ji` mode the verdict comes from
 * JubileeInspire and torahsings-api relays it.
 */
interface SignInResponse {
  tokens?: { accessToken: string; refreshToken: string; expiresAt?: string | null };
  requires2FA?: boolean;
  verificationGuid?: string;
  user?: { id: string; email: string; displayName?: string };
}

/**
 * POST /api/auth/signup is phase 1 of a two-phase, email-verified flow
 * (docs/AUTH_API.md §1.1): NO account is created here. The API stores a pending
 * sign-up, emails a 6-digit code, and returns the guid identifying it. Phase 2
 * (/verify-signup) creates the account and returns the token pair.
 */
interface SignUpResponse {
  success?: boolean;
  requiresVerification?: boolean;
  email?: string;
  verificationGuid?: string;
}

interface ResendResponse {
  resendsRemaining?: number;
}

declare global {
  // eslint-disable-next-line no-var
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}

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
export function SignInForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' } = {}) {
  // Which pane this route shows. /signin and /signup are both real, linkable
  // URLs (as on JubiLujah), and the toggle between them NAVIGATES rather than
  // flipping local state — so the address bar always matches the visible pane,
  // Back works, and either pane can be linked to or bookmarked. The route is the
  // single source of truth; there is no mode state that can drift out of sync
  // with the URL. Navigating remounts this component, which also clears any
  // in-flight verification step for free.
  const isSignup = initialMode === 'signup';
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Credentials, held across step 1 → step 2 (JI's flow re-submits the password
  // alongside the code).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign-up-only fields. The API takes a single `name` (1–120 chars), so first
  // and last are folded together on submit. `dob` never leaves the browser — it
  // only feeds the MIN_AGE gate above.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [confirm, setConfirm] = useState('');

  // Step 2 (2FA) state.
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [guid, setGuid] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [locked, setLocked] = useState(false);

  const returnTo = '/account';

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ---- Cloudflare Turnstile ------------------------------------------------
  // The widget's smallest size is a fixed 300x65 box. To keep it exactly as wide
  // as the inputs at any viewport, render it at native size into an inner div and
  // CSS-scale that div to whatever width the outer wrapper measures.
  const TN_W = 300;
  const TN_H = 65;
  const [tnToken, setTnToken] = useState('');
  const tnRef = useRef<HTMLDivElement>(null);
  const tnBoxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const renderTurnstile = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !tnRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(tnRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'dark',
      size: 'normal',
      callback: (t: string) => setTnToken(t),
      'error-callback': () => setTnToken(''),
      'expired-callback': () => setTnToken(''),
    });
  }, []);

  useEffect(() => {
    renderTurnstile();
  }, [renderTurnstile]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const box = tnBoxRef.current;
    const inner = tnRef.current;
    if (!box || !inner) return;
    const apply = () => {
      const s = box.clientWidth / TN_W;
      inner.style.transform = `scale(${s})`;
      box.style.height = `${TN_H * s}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const resetTurnstile = useCallback(() => {
    setTnToken('');
    if (TURNSTILE_SITE_KEY && window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current);
    }
  }, []);

  /**
   * Step 1 — email + password.
   *
   * The Turnstile token is forwarded RAW to torahsings-api, which relays it to
   * JubileeInspire. JI verifies it itself and the token is single-use, so we
   * must NOT call siteverify here first — doing so would burn the token and
   * JI's check would then fail.
   *
   * JI may answer "signed in" or "2FA required"; the latter moves us to step 2.
   */
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (TURNSTILE_SITE_KEY && !tnToken) {
      setErr('Please complete the human verification.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/signin', {
        email,
        password,
        rememberMe,
        cfTurnstileToken: TURNSTILE_SITE_KEY ? tnToken : undefined,
      });

      if (res?.requires2FA) {
        setGuid(res.verificationGuid ?? '');
        setStep('code');
        setCooldown(60);
        setInfo('We emailed you a 6-digit code. Enter it below to finish signing in.');
        setBusy(false);
        return;
      }

      setTokens(res?.tokens);
      window.location.assign(returnTo);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not reach the server. Please try again.');
      // The token is spent either way — Turnstile is single-use.
      resetTurnstile();
      setBusy(false);
    }
  }

  /**
   * Step 2 — the 6-digit code. Per JI's documented flow this re-POSTs to
   * /signin with the code (no captcha on re-entry); the password is still in
   * component state from step 1.
   */
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/signin', {
        email,
        password,
        rememberMe,
        verificationGuid: guid,
        verificationCode: code,
      });
      setTokens(res?.tokens);
      window.location.assign(returnTo);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 423 || e.body?.locked)) setLocked(true);
      setErr(e instanceof ApiError ? e.message : 'Could not verify the code.');
      setBusy(false);
    }
  }

  /** Ask JI to send another code. */
  async function resend() {
    if (cooldown > 0 || locked) return;
    setErr(null);
    setInfo(null);
    try {
      const res = await api.post<ResendResponse>('/api/auth/send-login-verification', {
        email,
        verificationGuid: guid,
      });
      setCooldown(60);
      const left =
        typeof res?.resendsRemaining === 'number'
          ? ` (${res.resendsRemaining} resend${res.resendsRemaining === 1 ? '' : 's'} left)`
          : '';
      setInfo(`A new code is on its way${left}.`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 423 || e.body?.locked) setLocked(true);
        else if (e.status === 429 && typeof e.body?.cooldownSeconds === 'number') {
          setCooldown(e.body.cooldownSeconds as number);
        }
      }
      setErr(e instanceof ApiError ? e.message : 'Could not resend the code.');
    }
  }

  /**
   * Sign-up step 1 — POST /api/auth/signup (docs/AUTH_API.md §1.1).
   *
   * No account is created here. The API stashes the details behind a 6-digit
   * code and emails it, so an unverified address never yields an account; we
   * move to the shared code step, which in this mode redeems at
   * /verify-signup.
   *
   * `rememberMe` is NOT accepted at phase 1 — it is held in component state and
   * sent at phase 2, where it maps to the extended (1-year) refresh lifetime.
   *
   * Confirm-password and the age gate are enforced here only; neither is part of
   * the API contract.
   */
  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    if (password !== confirm) {
      setErr('Those passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setErr('Please choose a password of at least 8 characters.');
      return;
    }
    const age = ageFromDob(dob);
    if (Number.isNaN(age)) {
      setErr('Please enter your date of birth.');
      return;
    }
    if (age < MIN_AGE) {
      setErr(`You must be at least ${MIN_AGE} years old to create an account.`);
      return;
    }

    // The API takes one `name` field; fold first + last into it.
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();

    setBusy(true);
    try {
      const res = await api.post<SignUpResponse>('/api/auth/signup', { name, email, password });
      setGuid(res?.verificationGuid ?? '');
      setCode('');
      setStep('code');
      setCooldown(60);
      setInfo('We emailed you a 6-digit code. Enter it below to finish creating your account.');
      setBusy(false);
    } catch (e) {
      // 409 = an active account already owns this email → point them at sign-in.
      setErr(e instanceof ApiError ? e.message : 'Could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  /**
   * Sign-up step 2 — POST /api/auth/verify-signup (docs/AUTH_API.md §1.2).
   * On 201 the account exists and the response carries the token pair, so the
   * visitor is signed in immediately — no second trip through /signin.
   */
  async function submitSignupCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/verify-signup', {
        verificationGuid: guid,
        verificationCode: code,
        rememberMe,
      });
      setTokens(res?.tokens);
      window.location.assign(returnTo);
    } catch (e) {
      // 429 (attempts spent) and 409 (email claimed meanwhile) both kill this
      // pending sign-up — send them back to the form rather than let them retype
      // a code that can never work. A wrong code (400) keeps them here; the
      // message carries `attemptsRemaining`.
      if (e instanceof ApiError && (e.status === 429 || e.status === 409)) {
        setStep('password');
        setGuid('');
        setCode('');
      }
      setErr(e instanceof ApiError ? e.message : 'Could not verify the code.');
      setBusy(false);
    }
  }

  /** Ask for a fresh sign-up code — 60s cooldown, 2 resends (3 codes total). */
  async function resendSignup() {
    if (cooldown > 0) return;
    setErr(null);
    setInfo(null);
    try {
      const res = await api.post<ResendResponse>('/api/auth/send-signup-verification', {
        verificationGuid: guid,
      });
      setCooldown(60);
      const left =
        typeof res?.resendsRemaining === 'number'
          ? ` (${res.resendsRemaining} resend${res.resendsRemaining === 1 ? '' : 's'} left)`
          : '';
      setInfo(`A new code is on its way${left}.`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429 && typeof e.body?.cooldownSeconds === 'number') {
          setCooldown(e.body.cooldownSeconds as number);
        } else if (e.body?.exhausted) {
          // Resend cap hit — this pending sign-up is spent; start over.
          setStep('password');
          setGuid('');
          setCode('');
        }
      }
      setErr(e instanceof ApiError ? e.message : 'Could not resend the code.');
    }
  }

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
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}
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
                  <Link href="/signin" className={styles.switchBtn}>
                    Sign In
                  </Link>
                </>
              ) : (
                <>
                  Don&rsquo;t have an account?{' '}
                  <Link href="/signup" className={styles.switchBtn}>
                    Sign Up
                  </Link>
                </>
              )}
            </p>

            {info && <p className={styles.info}>{info}</p>}

            {err && (
              <p className={styles.error} role="alert">
                {err}
              </p>
            )}

            {/* ---- Step 2: the 6-digit code JubileeInspire emailed ---- */}
            {step === 'code' ? (
              <form onSubmit={isSignup ? submitSignupCode : submitCode}>
                <div className={styles.field}>
                  <label htmlFor="code">6-digit code</label>
                  <input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.submit}
                  disabled={busy || locked || code.length !== 6}
                >
                  {busy ? 'Verifying…' : isSignup ? 'Verify & create account' : 'Verify & sign in'}
                </button>

                <div className={styles.codeActions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={isSignup ? resendSignup : resend}
                    disabled={cooldown > 0 || locked}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      setStep('password');
                      setCode('');
                      setGuid('');
                      setErr(null);
                      setInfo(null);
                      setLocked(false);
                      resetTurnstile();
                    }}
                  >
                    {isSignup ? 'Start over' : 'Use a different account'}
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={isSignup ? submitSignup : submitPassword}>
              {isSignup && (
                <div className={styles.nameRow}>
                  <div className={styles.field}>
                    <label htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {isSignup && (
                <div className={styles.field}>
                  <label htmlFor="dob">Date of Birth</label>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    required
                    autoComplete="bday"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
                <>
                  {/* Carried in state and sent at /verify-signup (phase 2) — the
                      signup endpoint itself does not accept it. */}
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Keep me signed in on this device</span>
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" required />
                    <span>
                      I agree to the <Link href="/terms">Terms of Use</Link> and{' '}
                      <Link href="/privacy">Privacy Policy</Link>.
                    </span>
                  </label>
                </>
              ) : (
                <>
                  <div className={styles.forgot}>
                    <Link href="/account">Forgot password?</Link>
                  </div>
                  {/* Sent as `rememberMe` — it maps to the extended refresh-token
                      lifetime (1 year vs 30 days). See docs/API.md §3. */}
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Keep me signed in on this device</span>
                  </label>
                </>
              )}

              {TURNSTILE_SITE_KEY && (
                <div className={styles.turnstile} ref={tnBoxRef}>
                  <div className={styles.turnstileInner} ref={tnRef} />
                </div>
              )}

              <button type="submit" className={styles.submit} disabled={busy}>
                {busy
                  ? isSignup
                    ? 'Creating account…'
                    : 'Signing in…'
                  : isSignup
                    ? 'Create Account'
                    : 'Sign In'}
              </button>
            </form>
            )}

            <p className={styles.foot}>
              © {new Date().getFullYear()} TorahSings.com &nbsp;|&nbsp;{' '}
              <Link href="/terms">Terms of Use</Link> &nbsp;|&nbsp;{' '}
              <Link href="/privacy">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <AuthHero />
      </div>
    </>
  );
}
