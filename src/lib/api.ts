'use client';

/**
 * Browser-side client for torahsings-api, ported from JubiLujah's lib/api.ts.
 *
 * Calls are SAME-ORIGIN (`/api/...`); next.config.mjs rewrites them to
 * NEXT_PUBLIC_API_BASE. That keeps CORS out of the browser and keeps the API
 * hostname out of the bundle.
 *
 * Auth is `Authorization: Bearer` only — `credentials: 'omit'` so no cookie ever
 * rides along. The access token is refreshed transparently so a visitor stays
 * signed in until they log out or the refresh token is revoked/expires:
 *
 *   - PROACTIVELY, before a request, when the access token is missing/expired
 *     but a refresh token exists. This matters because /api/auth/me returns 200
 *     (not 401) when unauthenticated, so a reactive-only refresh would never
 *     fire on load after the access token expired.
 *   - REACTIVELY, on a 401 — then the original request is replayed once.
 *
 * Tokens are cleared ONLY when the refresh token is definitively rejected, never
 * on a transient/network error, so a blip does not sign the user out.
 */

import {
  accessTokenExpired,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  type AuthTokens,
} from './auth';

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;
  constructor(status: number, body: Record<string, unknown> | null) {
    super(
      (body?.message as string) || (body?.error as string) || `HTTP ${status}`,
    );
    this.status = status;
    this.body = body;
  }
}

const REFRESH_PATH = '/api/auth/refresh';

type RefreshResult = 'ok' | 'invalid' | 'error';

/** Single-flight: concurrent callers share one /refresh round-trip. */
let refreshing: Promise<RefreshResult> | null = null;

async function tryRefresh(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshResult> => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return 'invalid';
      try {
        const res = await fetch(REFRESH_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ refreshToken }),
        });
        if (res.status === 401 || res.status === 400) return 'invalid';
        if (!res.ok) return 'error';
        const body = await res.json().catch(() => null);
        const tokens = body?.tokens as AuthTokens | undefined;
        if (!tokens?.accessToken) return 'error';
        setTokens(tokens);
        return 'ok';
      } catch {
        return 'error'; // network blip — do NOT sign the user out
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Proactive refresh — see the note above about /me returning 200.
  if (path !== REFRESH_PATH && accessTokenExpired() && getRefreshToken()) {
    const r = await tryRefresh();
    if (r === 'invalid') clearTokens();
  }

  const send = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(path, {
      method,
      headers,
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await send();

  // Reactive refresh, then replay once.
  if (res.status === 401 && path !== REFRESH_PATH && getRefreshToken()) {
    const r = await tryRefresh();
    if (r === 'ok') res = await send();
    else if (r === 'invalid') clearTokens();
  }

  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T,>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T,>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
