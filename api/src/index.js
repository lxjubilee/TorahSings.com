// ============================================================================
// torahsings-api — the TorahSings.com application service.
//
// A copy of the Jubilujah API, backed by the `torahsings` database. Same routes,
// same token model as jubilujah-api: stateless `Authorization: Bearer <access
// JWT>` (1h) plus a DB-backed refresh token (30d) via POST /api/auth/refresh.
// No cookies, no CSRF.
//
// ENDPOINT PARITY (2026-07-20): expanded from the auth-only surface to the full
// Jubilujah router set. Mounts are grouped below into:
//   (A) LIVE      — backed by tables the torahsings DB already has.
//   (B) NEEDS DB  — mount cleanly (all imports resolve, no boot crash) but each
//                   route 500s until the tables listed alongside it exist in the
//                   torahsings database. Port the matching Lujah migration first.
// See docs/API_PARITY.md for the full endpoint + table-dependency map.
//
// NOT ported: Lujah admin.js cover/subscriber/active-listener/audit endpoints —
// they require util/r2.js + util/albumCovers.js, which do not exist here.
// ============================================================================
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger } from './logger.js';
import { healthCheck } from './db.js';
import { attachSession } from './middleware/session.js';
import { notFound, errorHandler } from './middleware/error.js';

// Auth + account surface (LIVE — identity/production tables present).
import authRouter from './routes/auth.js';
// Full Jubilujah admin surface (users + roles + delete + subscribers +
// active-listeners + covers + audit + publish), plus Torah's GET /users/:id.
// Supersedes the old trimmed adminUsers.js. Cover uploads need util/r2.js + the
// AWS SDK; active-listeners/subscribers need the analytics/subscription tables.
import adminRouter from './routes/admin.js';
import meRouter from './routes/me.js';
import reviewsRouter from './routes/reviews.js';
import serviceRouter from './routes/service.js';
import serviceTokenRouter from './routes/serviceToken.js';
// Expanded surface (see group tags at the mount points below).
import catalogRouter from './routes/catalog.js';
import ratingsRouter from './routes/ratings.js';
import commentsRouter from './routes/comments.js';
import tracksRouter from './routes/tracks.js';
import appVersionRouter from './routes/appVersion.js';
import mobileRouter from './routes/mobile.js';
import mobileAdminRouter from './routes/mobileAdmin.js';
import analyticsRouter from './routes/analytics.js';
import awardsRouter from './routes/awards.js';
import pipelineRouter from './routes/pipeline.js';
import radioRouter from './routes/radio.js';
import subscriptionsRouter from './routes/subscriptions.js';
import subscriptionsWebhookRouter from './routes/subscriptionsWebhook.js';
import listeningRouter from './routes/listening.js';
import musicAdminRouter from './routes/music.js';
import reviewsAdminRouter from './routes/reviewsAdmin.js';
import publishRouter from './routes/publish.js';
import { serviceRateKey } from './middleware/serviceAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (req, res, err) => (res.statusCode >= 500 || err ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
}));

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));

// Gateway webhook MUST see the raw, unparsed body to verify the signature, so it
// is mounted with express.raw BEFORE the global JSON parser. (No session needed.)
// [NEEDS DB] production.subscriptions + subscription_*/family_*/payment_records.
app.use(
  ['/api/billing/webhook', '/api/subscriptions/webhook'],
  express.raw({ type: '*/*' }),
  subscriptionsWebhookRouter,
);

app.use(express.json({ limit: '256kb' }));
app.use(attachSession);   // resolves req.auth from the Bearer access JWT (no cookies)

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
});
const serviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: config.service.rateLimitMax,
  standardHeaders: true, legacyHeaders: false, keyGenerator: serviceRateKey,
});

app.get('/health', async (req, res) => {
  const db = await healthCheck();
  res.status(db ? 200 : 503).json({
    status: db ? 'healthy' : 'degraded', db, service: 'torahsings-api', loginMode: config.loginMode,
  });
});

app.get('/api/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

// Server-to-server (client-credentials JWT), mounted before the public router.
app.use('/api/auth/service', serviceLimiter, serviceTokenRouter);
app.use('/api/auth/admin', serviceLimiter, serviceRouter);

// Public auth surface: signup / verify-signup / signin / verify-login /
// forgot-password / reset-password / change-password / refresh / me / logout.
app.use('/api/auth', authLimiter, authRouter);

// ===========================================================================
// (A) LIVE — backed by tables the torahsings DB already has.
// ===========================================================================
// Public catalog. Reads the manifest, which is empty here (no MANIFEST_PATH),
// so these resolve to empty results rather than 500 — the web uses its own
// generated catalog content instead.
app.use('/api', catalogRouter);
// Ratings (production.ratings) + comments (production.comments) — both tables
// are already used by the live review surface.
app.use('/api/ratings', writeLimiter, ratingsRouter);
app.use('/api/comments', writeLimiter, commentsRouter);
// Public Rating & Review module (production.user_reviews/review_summaries/…).
app.use('/api/reviews', writeLimiter, reviewsRouter);
// Personal account-backed data (likes/favorites, playlists). Whole router is
// requireAuth. The GET /likes list resolves titles via the (empty) manifest, so
// the web resolves liked uuids against its own catalog instead.
app.use('/api/me', writeLimiter, meRouter);
// Audio track admin (production.cover_updates). NOTE: the raw-body upload needs
// R2 credentials configured; without them the upload route fails closed (503).
app.use('/api/admin/tracks', writeLimiter, tracksRouter);

// ===========================================================================
// (B) NEEDS DB — mounts cleanly, but each route 500s until the tables noted
//     alongside it exist in the torahsings database. Port the matching Lujah
//     migration before relying on these. See docs/API_PARITY.md.
// ===========================================================================
app.use('/api/app-version', appVersionRouter);                    // production.mobile_app_versions
app.use('/api/mobile', mobileRouter);                             // production.mobile_* (7 tables)
app.use('/api/analytics', writeLimiter, analyticsRouter);         // production.playback_events, analytics_daily, now_playing
app.use('/api/awards', writeLimiter, awardsRouter);               // production.award_categories, award_periods
app.use('/api/pipeline', writeLimiter, pipelineRouter);           // production.pipeline_history
app.use('/api', writeLimiter, radioRouter);                       // radio.stations/programs/playlists/playlist_items
app.use('/api/subscriptions', writeLimiter, subscriptionsRouter); // production.subscription_*/family_*/payment_records (+ Stripe cfg)
app.use('/api/listening', writeLimiter, listeningRouter);         // production.daily_listening_counters, subscription_plans
// Admin sub-routers are mounted BEFORE the generic /api/admin router so their
// more specific paths win.
app.use('/api/admin/reviews', writeLimiter, reviewsAdminRouter);  // production.review_moderation_log
app.use('/api/admin/music', writeLimiter, musicAdminRouter);      // production.music_* (7 tables)
app.use('/api/admin/mobile', writeLimiter, mobileAdminRouter);    // production.mobile_* + music_activity_log
app.use('/api/admin/publish', writeLimiter, publishRouter);       // pipeline candidates (production.pipeline_state — present)

// Generic admin surface (GET /api/admin/users etc.) — mounted LAST so the
// /api/admin/* sub-routers above take precedence. requireRole('admin').
app.use('/api/admin', writeLimiter, adminRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env, loginMode: config.loginMode }, 'torahsings-api listening');
});
