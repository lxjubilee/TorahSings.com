'use client';

/**
 * Jubilee Account — single sign-on across the ecosystem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * INTEGRATION POINT FOR THE JUBILEE TEAM
 *
 * Set NEXT_PUBLIC_JUBILEE_SSO_URL and this provider hands off to the real
 * Jubilee Account: `signIn()` redirects to the SSO authorize endpoint, and the
 * session is read back from `/api/session` (implement against your identity
 * service — it should return a JubileeSession or 401).
 *
 * With that variable unset, the provider runs a LOCAL STUB that persists a fake
 * session to localStorage. The stub exists so the whole gating surface — free
 * tier, member unlocks, subscription state, the account page — can be exercised
 * before SSO is wired. `isStub` is exposed so the UI can say so out loud rather
 * than pretending. Nothing about the stub should ship to production.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Entitlement } from './access';

export interface JubileeSubscription {
  status: 'active' | 'none';
  plan: 'yearly' | null;
  /** ISO date. Null when there is no active plan. */
  renewsAt: string | null;
}

export interface JubileeSession {
  userId: string;
  displayName: string;
  email: string;
  subscription: JubileeSubscription;
}

type Status = 'loading' | 'ready';

interface JubileeContextValue {
  session: JubileeSession | null;
  status: Status;
  entitlement: Entitlement;
  /** True while the local stub is standing in for real SSO. */
  isStub: boolean;
  signIn: () => void;
  signOut: () => void;
  /** Begins checkout. Against real SSO this hands off to Jubilee billing. */
  subscribe: () => void;
  /** Buys the book on its own. Null when no billing endpoint is configured. */
  purchaseBook: (() => void) | null;
}

const STORAGE_KEY = 'torah-sings.jubilee-session';
const SSO_URL = process.env.NEXT_PUBLIC_JUBILEE_SSO_URL;

const JubileeContext = createContext<JubileeContextValue | null>(null);

function readStoredSession(): JubileeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JubileeSession;
    if (!parsed?.userId || !parsed?.subscription) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(session: JubileeSession | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — session simply will not persist */
  }
}

function stubSession(subscribed: boolean): JubileeSession {
  return {
    userId: 'stub-user',
    displayName: 'Friend of the Discovery',
    email: 'you@example.com',
    subscription: subscribed
      ? { status: 'active', plan: 'yearly', renewsAt: nextYearISO() }
      : { status: 'none', plan: null, renewsAt: null },
  };
}

function nextYearISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function JubileeAccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<JubileeSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const isStub = !SSO_URL;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (SSO_URL) {
        // Real SSO: the session cookie is set by the Jubilee identity service.
        try {
          const res = await fetch('/api/session', { credentials: 'include' });
          if (!cancelled) setSession(res.ok ? ((await res.json()) as JubileeSession) : null);
        } catch {
          if (!cancelled) setSession(null);
        }
      } else if (!cancelled) {
        setSession(readStoredSession());
      }
      if (!cancelled) setStatus('ready');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    if (SSO_URL) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${SSO_URL}/authorize?redirect_uri=${next}`;
      return;
    }
    const next = stubSession(false);
    persist(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    if (SSO_URL) {
      window.location.href = `${SSO_URL}/logout`;
      return;
    }
    persist(null);
    setSession(null);
  }, []);

  const subscribe = useCallback(() => {
    if (SSO_URL) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `${SSO_URL}/checkout?plan=yearly&redirect_uri=${next}`;
      return;
    }
    const next = stubSession(true);
    persist(next);
    setSession(next);
  }, []);

  /**
   * The standalone book purchase. Null under the stub rather than a button that
   * quietly does nothing — the UI reads the null and says so.
   */
  const purchaseBook = useMemo(() => {
    if (!SSO_URL) return null;
    return () => {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `${SSO_URL}/checkout?product=book&redirect_uri=${next}`;
    };
  }, []);

  const value = useMemo<JubileeContextValue>(
    () => ({
      session,
      status,
      entitlement: session?.subscription.status === 'active' ? 'member' : 'guest',
      isStub,
      signIn,
      signOut,
      subscribe,
      purchaseBook,
    }),
    [session, status, isStub, signIn, signOut, subscribe, purchaseBook],
  );

  return <JubileeContext.Provider value={value}>{children}</JubileeContext.Provider>;
}

export function useJubileeAccount(): JubileeContextValue {
  const ctx = useContext(JubileeContext);
  if (!ctx) throw new Error('useJubileeAccount must be used inside <JubileeAccountProvider>');
  return ctx;
}
