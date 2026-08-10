'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { setTokens } from '@/lib/auth';
import { AuthHero } from './AuthHero';
import styles from './SignInForm.module.css';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SITE_NAME = 'Torah Sings';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Youngest permitted account holder. The identity schema stores no date of
 * birth for a NEW local account (docs/AUTH_API.md §1.1 takes only
 * name/email/password), so on Outcome C this is a CLIENT-SIDE gate only.
 */
const MIN_AGE = 13;

function passwordStrength(pw: string): { score: 1 | 2 | 3 | 4; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  if (pw.length < 8) s = Math.min(s, 1);
  const score = Math.min(4, Math.max(1, s)) as 1 | 2 | 3 | 4;
  const meta = {
    1: { label: 'Weak', color: '#e94560' },
    2: { label: 'Fair', color: '#ff8a6b' },
    3: { label: 'Good', color: '#feca57' },
    4: { label: 'Strong', color: '#4ac26b' },
  }[score];
  return { score, ...meta };
}

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

interface SignInResponse {
  success?: boolean;
  tokens?: { accessToken: string; refreshToken: string; expiresAt?: string | null };
  requires2FA?: boolean;
  verificationGuid?: string;
  needsProfile?: boolean;
  profile?: { first_name?: string; last_name?: string; date_of_birth?: string | null };
  user?: { id: string; email: string; displayName?: string };
}
interface SignUpResponse {
  success?: boolean;
  requiresVerification?: boolean;
  email?: string;
  verificationGuid?: string;
}
interface ResendResponse { resendsRemaining?: number }
interface LookupResponse { exists?: boolean; existsInSso?: boolean; existsLocally?: boolean; available?: boolean }

declare global {
  // eslint-disable-next-line no-var
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
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

// Inline heading styles (the module has no per-screen heading class).
const hStyle: React.CSSProperties = { fontSize: 21, fontWeight: 800, textAlign: 'center', margin: '2px 0 8px', color: '#fff', lineHeight: 1.3 };
const subStyle: React.CSSProperties = { fontSize: 13.5, textAlign: 'center', margin: '0 0 18px', lineHeight: 1.55, color: 'rgba(255,255,255,0.72)' };
const acctStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, background: 'rgba(255,255,255,0.03)', margin: '0 0 18px', fontSize: 14 };

/**
 * The "one door" (Jubilee ID Sign-in guidelines): /signin and /signup render the
 * same email-first flow. Screen 1 asks for the EMAIL only, looks it up at the
 * Jubilee ID authority, then routes —
 *   welcome     : returning Torah Sings member → password → sign in
 *   confirm     : has a Jubilee ID, new here → confirm password …
 *   createlinked: … then Create-account (First/Last/DOB, no password)
 *   new         : no Jubilee ID → create one → 6-digit email verification
 */
type Phase = 'email' | 'welcome' | 'confirm' | 'createlinked' | 'new' | 'code';

export function SignInForm(_props: { initialMode?: 'signin' | 'signup' } = {}) {
  const [phase, setPhase] = useState<Phase>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');          // Jubilee ID password (welcome/confirm) OR create password (new)
  const [confirm, setConfirm] = useState('');            // Outcome C only
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agree, setAgree] = useState(false);

  // OTP — a new-account signup code OR a login 2FA code
  const [codeMode, setCodeMode] = useState<'signup' | 'login'>('signup');
  const [guid, setGuid] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [locked, setLocked] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const AFTER = '/';

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // One-time banner after a password reset (/reset-password → ?reset=1).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('reset') === '1') {
      setInfo('Your password was updated. Please sign in.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ---- Cloudflare Turnstile (Screen 1 only, human verification) ------------
  // Client-side gate: in SSO mode the credential is verified at the trusted
  // Jubilee ID authority, which does not require this token. Fail-safe — if
  // the widget can't render (e.g. domain not allow-listed) it never blocks.
  const [tnToken, setTnToken] = useState('');
  const [tnFailed, setTnFailed] = useState(false);
  const tnRef = useRef<HTMLDivElement>(null);       // inner 300px render target (scaled)
  const tnBoxRef = useRef<HTMLDivElement>(null);    // outer full-width wrapper (measured)
  const widgetId = useRef<string | null>(null);
  const renderTurnstile = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !tnRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(tnRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'dark',
      size: 'normal',
      callback: (t: string) => { setTnToken(t); setTnFailed(false); },
      'error-callback': () => { setTnToken(''); setTnFailed(true); },
      'expired-callback': () => setTnToken(''),
    });
  }, []);
  useEffect(() => {
    if (phase === 'email') {
      renderTurnstile();
      const t = setTimeout(() => setTnFailed(true), 8000);
      return () => clearTimeout(t);
    }
    if (TURNSTILE_SITE_KEY && window.turnstile && widgetId.current) {
      try { window.turnstile.remove(widgetId.current); } catch { /* gone */ }
    }
    widgetId.current = null;
    setTnToken(''); setTnFailed(false);
  }, [phase, renderTurnstile]);

  // The 'normal' widget is a fixed 300px; CSS-scale it to the measured container
  // width so the captcha is exactly as wide as the email textbox at any viewport.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || phase !== 'email') return;
    const box = tnBoxRef.current, inner = tnRef.current;
    if (!box || !inner) return;
    const TN_W = 300, TN_H = 65;
    const apply = () => {
      const s = box.clientWidth / TN_W;
      inner.style.transform = `scale(${s})`;
      box.style.height = `${TN_H * s}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [phase]);

  // Lock body scroll so only the left panel scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const errMsg = (e: unknown, fb: string) => (e instanceof ApiError ? e.message : fb);
  const finish = (res?: SignInResponse) => { setTokens(res?.tokens); window.location.assign(AFTER); };

  function useDifferentEmail() {
    setPhase('email'); setErr(null); setInfo(null);
    setPassword(''); setConfirm(''); setFirstName(''); setLastName(''); setDob('');
  }

  // ---- Screen 1: email → look up the Jubilee ID, then route ----
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    const addr = email.trim();
    if (!EMAIL_RE.test(addr)) { setErr('Please enter a valid email address.'); return; }
    if (TURNSTILE_SITE_KEY && !tnToken && !tnFailed) { setErr('Please complete the human verification.'); return; }
    setBusy(true);
    try {
      const look = await api.get<LookupResponse>(`/api/auth/lookup?email=${encodeURIComponent(addr)}`);
      if (look?.existsLocally) setPhase('welcome');        // Outcome A — returning member
      else if (look?.existsInSso) setPhase('confirm');     // Outcome B — has a Jubilee ID, new here
      else setPhase('new');                                // Outcome C — brand new
    } catch {
      // Fail open to full sign-up; a genuine collision is caught at create time.
      setPhase('new');
    } finally { setBusy(false); }
  }

  // ---- Screen 2A: returning member → verify password → sign in ----
  async function submitWelcome(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!password) { setErr('Please enter your password.'); return; }
    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/signin', { email: email.trim(), password, rememberMe });
      if (res?.requires2FA) {
        setCodeMode('login'); setGuid(res.verificationGuid ?? ''); setCode('');
        setPhase('code'); setCooldown(60);
        setInfo('We emailed you a 6-digit code. Enter it below to finish signing in.');
        setBusy(false); return;
      }
      if (res?.needsProfile) {   // defensive: no local account after all → create it
        const p = res.profile || {};
        setFirstName(p.first_name || ''); setLastName(p.last_name || '');
        setDob(String(p.date_of_birth || '').slice(0, 10));
        setPhase('createlinked'); setBusy(false); return;
      }
      finish(res);
    } catch (e) {
      setErr(errMsg(e, 'That password does not match. Try again, or reset it below.'));
      setBusy(false);
    }
  }

  // ---- Screen 2B-1: existing Jubilee ID, new here → confirm password ----
  async function submitConfirmPw(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!password) { setErr('Please enter your password.'); return; }
    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/signin', { email: email.trim(), password, rememberMe, preview: true });
      if (res?.success && res?.tokens) { finish(res); return; }   // edge: local exists
      if (res?.needsProfile) {
        const p = res.profile || {};
        setFirstName(p.first_name || ''); setLastName(p.last_name || '');
        setDob(String(p.date_of_birth || '').slice(0, 10));
        setPhase('createlinked'); setBusy(false); return;
      }
      setPhase('new'); setBusy(false);   // no Jubilee ID after all
    } catch (e) {
      setErr(errMsg(e, 'That password does not match. Try again, or reset it below.'));
      setBusy(false);
    }
  }

  // ---- Screen 2B-2: create the linked account (no password; edits sync to SSO) ----
  async function submitCreateLinked(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!firstName.trim() || !lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    setBusy(true);
    try {
      const res = await api.post<SignInResponse>('/api/auth/signin', {
        email: email.trim(), password, rememberMe, provision: true,
        first_name: firstName.trim(), last_name: lastName.trim(), date_of_birth: dob || undefined,
      });
      finish(res);
    } catch (e) {
      setErr(errMsg(e, 'Could not create your account. Please try again.'));
      setBusy(false);
    }
  }

  // ---- Screen 2C: create a brand-new Jubilee ID → email a code ----
  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!firstName.trim() || !lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    if (password !== confirm) { setErr('Those passwords do not match.'); return; }
    if (password.length < 8) { setErr('Please choose a password of at least 8 characters.'); return; }
    const age = ageFromDob(dob);
    if (Number.isNaN(age)) { setErr('Please enter your date of birth.'); return; }
    if (age < MIN_AGE) { setErr(`You must be at least ${MIN_AGE} years old to create an account.`); return; }
    if (!agree) { setErr('Please agree to the Terms of Use and Privacy Policy.'); return; }
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    setBusy(true);
    try {
      const res = await api.post<SignUpResponse>('/api/auth/signup', { name, email: email.trim(), password });
      setCodeMode('signup'); setGuid(res?.verificationGuid ?? ''); setCode('');
      setPhase('code'); setCooldown(60);
      setInfo('We emailed you a 6-digit code. Enter it below to finish creating your account.');
      setBusy(false);
    } catch (e) {
      setErr(errMsg(e, 'Could not reach the server. Please try again.'));
      setBusy(false);
    }
  }

  // ---- OTP step: verify the code ----
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    setBusy(true);
    try {
      const res = codeMode === 'login'
        ? await api.post<SignInResponse>('/api/auth/signin', { email: email.trim(), password, rememberMe, verificationGuid: guid, verificationCode: code })
        : await api.post<SignInResponse>('/api/auth/verify-signup', { verificationGuid: guid, verificationCode: code, rememberMe });
      finish(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 423 || e.body?.locked)) setLocked(true);
      if (e instanceof ApiError && (e.status === 429 || e.status === 409) && codeMode === 'signup') {
        setPhase('new'); setGuid(''); setCode('');
      }
      setErr(errMsg(e, 'Could not verify the code.'));
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || locked) return;
    setErr(null); setInfo(null);
    try {
      const res = codeMode === 'login'
        ? await api.post<ResendResponse>('/api/auth/send-login-verification', { email: email.trim(), verificationGuid: guid })
        : await api.post<ResendResponse>('/api/auth/send-signup-verification', { verificationGuid: guid });
      setCooldown(60);
      const left = typeof res?.resendsRemaining === 'number' ? ` (${res.resendsRemaining} resend${res.resendsRemaining === 1 ? '' : 's'} left)` : '';
      setInfo(`A new code is on its way${left}.`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 423 || e.body?.locked) setLocked(true);
        else if (e.status === 429 && typeof e.body?.cooldownSeconds === 'number') setCooldown(e.body.cooldownSeconds as number);
        else if (e.body?.exhausted && codeMode === 'signup') { setPhase('new'); setGuid(''); setCode(''); }
      }
      setErr(errMsg(e, 'Could not resend the code.'));
    }
  }

  const accountRow = (
    <div style={acctStyle}>
      <span style={{ wordBreak: 'break-all' }}>{email}</span>
      <button type="button" className={styles.linkBtn} onClick={useDifferentEmail} style={{ whiteSpace: 'nowrap' }}>Use a different email</button>
    </div>
  );

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={renderTurnstile} />
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

            {info && <p className={styles.info}>{info}</p>}
            {err && <p className={styles.error} role="alert">{err}</p>}

            {/* ── Screen 1: the one door — email only ── */}
            {phase === 'email' && (
              <form onSubmit={submitEmail}>
                <h1 style={hStyle}>Sign in with your Jubilee ID</h1>
                <p style={subStyle}>One Jubilee ID works across all our sites.</p>
                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required autoFocus placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {TURNSTILE_SITE_KEY && (
                  <div className={styles.turnstile} ref={tnBoxRef}>
                    <div className={styles.turnstileInner} ref={tnRef} />
                  </div>
                )}
                <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
                <p style={{ ...subStyle, margin: '16px 0 0', fontSize: 12.5 }}>No account yet? We&rsquo;ll set one up for you.</p>
              </form>
            )}

            {/* ── Screen 2A: Welcome back ── */}
            {phase === 'welcome' && (
              <form onSubmit={submitWelcome}>
                <h1 style={hStyle}>Welcome back</h1>
                {accountRow}
                <div className={styles.field}>
                  <label htmlFor="w-pw">Password</label>
                  <input id="w-pw" type={showPw ? 'text' : 'password'} required autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className={styles.eye} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}><Eye open={showPw} /></button>
                </div>
                <div className={styles.forgot}><Link href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}>Forgot your password?</Link></div>
                <label className={styles.check}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Keep me signed in on this device</span>
                </label>
                <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
              </form>
            )}

            {/* ── Screen 2B-1: Confirm it's you ── */}
            {phase === 'confirm' && (
              <form onSubmit={submitConfirmPw}>
                <h1 style={hStyle}>Confirm it&rsquo;s you</h1>
                <p style={subStyle}>This email already has a Jubilee ID. Enter your password to continue and create your account on {SITE_NAME}.</p>
                {accountRow}
                <div className={styles.field}>
                  <label htmlFor="c-pw">Jubilee ID password</label>
                  <input id="c-pw" type={showPw ? 'text' : 'password'} required autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className={styles.eye} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}><Eye open={showPw} /></button>
                </div>
                <div className={styles.forgot}><Link href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}>Forgot your password?</Link></div>
                <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
              </form>
            )}

            {/* ── Screen 2B-2: Create your Torah Sings account (no password) ── */}
            {phase === 'createlinked' && (
              <form onSubmit={submitCreateLinked}>
                <h1 style={hStyle}>Create your {SITE_NAME} account</h1>
                <p style={subStyle}>Your Jubilee ID is confirmed. Add a few details to finish creating your account here.</p>
                <div className={styles.nameRow}>
                  <div className={styles.field}>
                    <label htmlFor="cl-first">First Name</label>
                    <input id="cl-first" type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="cl-last">Last Name</label>
                    <input id="cl-last" type="text" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="cl-dob">Date of Birth</label>
                  <input id="cl-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <label className={styles.check}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Keep me signed in on this device</span>
                </label>
                <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
                <div className={styles.codeActions}>
                  <button type="button" className={styles.linkBtn} onClick={useDifferentEmail}>Use a different email</button>
                </div>
              </form>
            )}

            {/* ── Screen 2C: Create your Jubilee ID ── */}
            {phase === 'new' && (
              <form onSubmit={submitNew}>
                <h1 style={hStyle}>Let&rsquo;s create your Jubilee ID</h1>
                <p style={subStyle}>One account gives you access to {SITE_NAME} and everything else across Jubilee. It only takes a moment.</p>
                <div className={styles.nameRow}>
                  <div className={styles.field}>
                    <label htmlFor="firstName">First Name</label>
                    <input id="firstName" type="text" required autoFocus autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lastName">Last Name</label>
                    <input id="lastName" type="text" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="dob">Date of Birth</label>
                  <input id="dob" type="date" required autoComplete="bday" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="s-email">Email</label>
                  <input id="s-email" type="email" readOnly value={email} style={{ opacity: 0.7 }} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Create a Password</label>
                  <input id="password" type={showPw ? 'text' : 'password'} required autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className={styles.eye} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}><Eye open={showPw} /></button>
                </div>
                {password.length > 0 && (() => {
                  const st = passwordStrength(password);
                  return (
                    <div className={styles.strength} aria-live="polite">
                      <div className={styles.strengthTrack}><div className={styles.strengthBar} style={{ width: `${st.score * 25}%`, background: st.color }} /></div>
                      <span className={styles.strengthLabel} style={{ color: st.color }}>{st.label} password</span>
                    </div>
                  );
                })()}
                <div className={styles.field}>
                  <label htmlFor="confirm">Confirm Password</label>
                  <input id="confirm" type={showConfirm ? 'text' : 'password'} required autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  <button type="button" className={styles.eye} onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'}><Eye open={showConfirm} /></button>
                </div>
                {confirm.length > 0 && confirm !== password && (<p className={styles.mismatch} aria-live="polite">Passwords don&rsquo;t match</p>)}
                <label className={styles.check}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Keep me signed in on this device</span>
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>I agree to the <Link href="/terms">Terms of Use</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
                </label>
                <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Creating account…' : 'Create my Jubilee ID'}</button>
                <div className={styles.codeActions}>
                  <button type="button" className={styles.linkBtn} onClick={useDifferentEmail}>Use a different email</button>
                </div>
              </form>
            )}

            {/* ── OTP verification (new-account signup code or login 2FA) ── */}
            {phase === 'code' && (
              <form onSubmit={submitCode}>
                <h1 style={hStyle}>Check your email</h1>
                <p style={subStyle}>Enter the 6-digit code we sent to <strong style={{ color: '#feca57' }}>{email}</strong>.</p>
                <div className={styles.field}>
                  <label htmlFor="code">6-digit code</label>
                  <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </div>
                <button type="submit" className={styles.submit} disabled={busy || locked || code.length !== 6}>
                  {busy ? 'Verifying…' : codeMode === 'login' ? 'Verify & sign in' : 'Verify & create account'}
                </button>
                <div className={styles.codeActions}>
                  <button type="button" className={styles.linkBtn} onClick={resend} disabled={cooldown > 0 || locked}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => { setPhase(codeMode === 'login' ? 'welcome' : 'new'); setCode(''); setErr(null); setInfo(null); setLocked(false); }}>
                    {codeMode === 'login' ? 'Use a different account' : 'Edit details'}
                  </button>
                </div>
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
