// ============================================================================
// Inbound credential delegation -> JubileeInspire.
//
// When config.loginMode === 'ji' (production), Jubilujah does NOT verify the
// password locally. Instead /api/auth/signin forwards the credentials to JI's
// POST /api/auth/login and trusts JI's verdict; on success we upsert the
// returned user into our own identity.users and mint OUR OWN session (Jubilujah
// stays the session authority — JI is only the credential authority).
//
// JI verifies the Cloudflare Turnstile token itself, so we MUST forward the raw
// token and never call siteverify locally (the token is single-use). The real
// client IP is forwarded as X-Forwarded-For so JI's rate-limit / lockout /
// captcha-remoteip see the visitor, not this server.
//
// Contract (JI /var/www/jubileeinspire.com/api/routes/auth.js):
//   POST {base}/api/auth/login         { email, password, source, cfTurnstileToken, rememberMe, verificationCode? }
//   POST {base}/api/auth/verify-login  { verificationGuid, code }
// Both reply { success, ... }:
//   success      -> { success:true, user:{id,email,displayName,firstName,lastName,role,...}, tokens, trustToken }
//   2FA required -> { success:true, requires2FA:true, email, verificationGuid }
//   failure      -> { success:false, error, captchaFailed?|locked?|lockedUntil? } with a 4xx status
// ============================================================================
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getServiceToken } from './jiSync.js';

const LOGIN_PATH = '/api/auth/login';
const VERIFY_PATH = '/api/auth/verify-login';
const CHECK_EMAIL_PATH = '/api/auth/check-email';

async function jiPost(path, payload, ip) {
  const url = `${config.jiLogin.baseUrl}${path}`;
  const headers = { 'content-type': 'application/json' };
  if (ip) headers['x-forwarded-for'] = ip; // let JI attribute the real visitor
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch (err) {
    logger.error({ err, path }, 'JI login upstream unreachable');
    throw new Error('auth_upstream_unreachable');
  }
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// Initial password submit (and optional inline 2FA re-submit). Returns the raw
// { status, body } from JI for the route to translate.
export function jiLogin({ email, password, cfTurnstileToken, rememberMe, verificationCode, ip }) {
  const payload = { email, password, source: config.jiLogin.source, rememberMe: !!rememberMe };
  if (cfTurnstileToken) payload.cfTurnstileToken = cfTurnstileToken;
  if (verificationCode) payload.verificationCode = verificationCode;
  return jiPost(LOGIN_PATH, payload, ip);
}

// Complete a 2FA challenge JI issued (verificationGuid + the 6-digit code).
export function jiVerifyLogin({ verificationGuid, code, ip }) {
  return jiPost(VERIFY_PATH, { verificationGuid, code }, ip);
}

// Pre-signup guard: does JubileeInspire (the prod credential authority) already
// know this email? In `ji` mode an email can exist on JI with no local row yet,
// so signup's local-only check isn't enough to stop a divergent duplicate.
//   GET {base}/api/auth/check-email?email=<email>  ->  { exists: boolean, ... }
// Best-effort by design — this must never block signup on a JI hiccup:
//   { exists:true|false }  — JI gave a clear answer
//   { unknown:true }       — JI unreachable / non-OK / unparseable => caller
//                            falls through (the first-login provision path still
//                            reconciles a genuine duplicate via a 409).
export async function jiCheckEmail(email) {
  // The check-email guard normally targets the same JI as login (config.jiLogin.baseUrl).
  // JI_CHECK_EMAIL_BASE overrides ONLY this guard, so the duplicate-check can be aimed
  // at a different JI than login delegation.
  const base = (process.env.JI_CHECK_EMAIL_BASE || config.jiLogin.baseUrl).replace(/\/$/, '');
  const url = `${base}${CHECK_EMAIL_PATH}?email=${encodeURIComponent(email)}`;

  // JI PROD requires the client-credentials Bearer here (UAT served it publicly).
  // Without it prod answers 401, which would fall through to `unknown` and quietly
  // stop blocking duplicates — the guard would look alive while doing nothing. No new
  // secret: this is the same token jiSync already mints from JI_SERVICE_CLIENT_ID/SECRET.
  const call = (token) =>
    fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });

  // Present the Bearer ONLY to the host that issued it (config.jiSync.baseUrl =
  // JI_API_BASE). That token carries admin.set_password / admin.provision scopes on
  // JI PROD; sending it to a different check-email host (e.g. a UAT base) would leak
  // a prod credential across a trust boundary. When the bases differ we call
  // unauthenticated — which is all a public UAT check-email needs.
  const issuer = config.jiSync.baseUrl.replace(/\/$/, '');
  let token = null;
  if (base === issuer) {
    try {
      token = await getServiceToken();
    } catch (err) {
      // Creds unconfigured/failed: still try unauthenticated (UAT-style public route).
      logger.warn({ err, email }, 'JI check-email: service token unavailable; calling unauthenticated');
    }
  }

  let res;
  try {
    res = await call(token);
    // Token expired or revoked between cache and use -> re-mint once and retry.
    if (res.status === 401 && token) {
      token = await getServiceToken(true);
      res = await call(token);
    }
  } catch (err) {
    logger.warn({ err, email }, 'JI check-email unreachable — allowing signup to proceed');
    return { unknown: true };
  }
  if (!res.ok) {
    // 401 here means the Bearer was rejected outright — the guard is misconfigured, not
    // merely offline. Log loudly: it fails open, so it is otherwise silent.
    const level = res.status === 401 ? 'error' : 'warn';
    logger[level]({ email, status: res.status, base }, 'JI check-email non-OK — allowing signup to proceed');
    return { unknown: true };
  }
  const body = await res.json().catch(() => null);
  if (!body || typeof body.exists !== 'boolean') {
    logger.warn({ email, body }, 'JI check-email unexpected body — allowing signup to proceed');
    return { unknown: true };
  }
  return { exists: body.exists };
}
