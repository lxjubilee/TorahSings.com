// ============================================================================
// torahsings-api — the TorahSings.com identity service.
//
// A copy of the Jubilujah API mounting ONLY the auth surface (/api/auth/*),
// backed by the `torahsings` database. Same routes, same token model as
// jubilujah-api: stateless `Authorization: Bearer <access JWT>` (1h) plus a
// DB-backed refresh token (30d) via POST /api/auth/refresh. No cookies, no CSRF.
// ============================================================================
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

import { config } from './config.js';
import { logger } from './logger.js';
import { healthCheck } from './db.js';
import { attachSession } from './middleware/session.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRouter from './routes/auth.js';
import adminRouter from './routes/adminUsers.js';
import meRouter from './routes/me.js';
import reviewsRouter from './routes/reviews.js';
import serviceRouter from './routes/service.js';
import serviceTokenRouter from './routes/serviceToken.js';
import { serviceRateKey } from './middleware/serviceAuth.js';

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

// Server-to-server (client-credentials JWT), mounted before the public router.
app.use('/api/auth/service', serviceLimiter, serviceTokenRouter);
app.use('/api/auth/admin', serviceLimiter, serviceRouter);

// Public auth surface: signup / verify-signup / signin / verify-login /
// forgot-password / reset-password / change-password / refresh / me / logout.
app.use('/api/auth', authLimiter, authRouter);

// Public rating + review surface. Reads (summaries) are open; writing a rating
// is requireAuth, so it only became usable once sign-in delegated to JI.
// Rateable ids are UUIDv5 derived from the album code (see ids.js) — the
// catalog itself is not in the database, so nothing here depends on it. The one
// exception is GET /artist/:slug/summary, which reads the catalog manifest;
// with no MANIFEST_PATH configured getManifest() falls back to an empty catalog
// rather than throwing, so that route simply finds nothing.
app.use('/api/reviews', writeLimiter, reviewsRouter);

// Personal account-backed data (likes/favorites, playlists). Whole router is
// requireAuth. Likes key on the same derived album/song uuids as reviews
// (see ids.js); the GET /likes list resolves via the manifest, which is empty
// here, so the web resolves liked uuids against its own catalog instead.
app.use('/api/me', writeLimiter, meRouter);

// Admin surface — GET /api/admin/users etc. The router itself enforces
// requireRole('admin'), so every route here needs an admin user's access token.
app.use('/api/admin', writeLimiter, adminRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env, loginMode: config.loginMode }, 'torahsings-api listening');
});
