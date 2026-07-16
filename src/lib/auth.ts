'use client';

/**
 * Token storage for the Jubilee Account session.
 *
 * Mirrors JubiLujah's lib/auth.ts: the access + refresh tokens live in
 * localStorage and travel as an `Authorization: Bearer` header — there are no
 * cookies anywhere, and torahsings-api has no cookie/CSRF layer at all.
 *
 * Tokens are minted by torahsings-api (the session authority) even though
 * JubileeInspire checked the password (the credential authority).
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 expiry of the ACCESS token (the refresh token outlives it). */
  expiresAt?: string | null;
}

const ACCESS_KEY = 'torah-sings.access-token';
const REFRESH_KEY = 'torah-sings.refresh-token';
const EXPIRES_KEY = 'torah-sings.expires-at';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const getAccessToken = () => read(ACCESS_KEY);
export const getRefreshToken = () => read(REFRESH_KEY);

/** True when there is no access token, or it is within 30s of expiring. */
export function accessTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;
  const at = read(EXPIRES_KEY);
  if (!at) return false; // no expiry recorded — let the server be the judge
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? false : ms - Date.now() < 30_000;
}

export function setTokens(tokens: AuthTokens | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (!tokens?.accessToken) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    if (tokens.expiresAt) window.localStorage.setItem(EXPIRES_KEY, tokens.expiresAt);
  } catch {
    /* storage unavailable — the session simply will not survive a reload */
  }
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  try {
    [ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY].forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
