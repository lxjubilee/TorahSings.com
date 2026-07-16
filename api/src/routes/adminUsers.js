// ============================================================================
// TorahSings admin — user surface only.
//
// Deliberately NOT a copy of jubilujah's routes/admin.js: that router also
// carries cover-art uploads (which write to the jubileeverse-cdn R2 bucket),
// manifest publishing, and radio/subscriber reporting — none of which belong on
// the TorahSings identity API, and which drag in @aws-sdk/client-s3 and the
// catalog manifest. This exposes just the account-management endpoints.
//
// Every route is admin-only: requireRole('admin') is applied at the router.
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../util/async.js';
import { query } from '../db.js';
import { isUuid } from '../ids.js';
import { HttpError, requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireRole('admin'));

// GET /api/admin/users — every account with its granted roles.
router.get('/users', ah(async (req, res) => {
  const r = await query(
    `SELECT u.id, u.email, u.display_name, u.first_name, u.last_name,
            u.is_active, u.last_login_at, u.created_at,
            COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
       FROM identity.users u
       LEFT JOIN identity.user_roles ur ON ur.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at`
  );
  res.json(r.rows);
}));

// GET /api/admin/users/:id — a single account.
router.get('/users/:id', ah(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new HttpError(400, 'invalid user id');
  const r = await query(
    `SELECT u.id, u.email, u.display_name, u.first_name, u.last_name,
            u.is_active, u.last_login_at, u.created_at,
            COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
       FROM identity.users u
       LEFT JOIN identity.user_roles ur ON ur.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id`,
    [id]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'user not found');
  res.json(r.rows[0]);
}));

// PATCH /api/admin/users/:id — rename. display_name stays the derived "First Last".
const nameSchema = z.object({
  first_name: z.string().trim().max(120).optional().default(''),
  last_name: z.string().trim().max(120).optional().default(''),
});
router.patch('/users/:id', validate(nameSchema), ah(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) throw new HttpError(400, 'invalid user id');
  const first = req.body.first_name || null;
  const last = req.body.last_name || null;
  const display = [first, last].filter(Boolean).join(' ').trim();
  if (!display) throw new HttpError(400, 'a first or last name is required');

  const r = await query(
    `UPDATE identity.users
        SET first_name = $2, last_name = $3, display_name = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, display_name, first_name, last_name`,
    [id, first, last, display]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'user not found');
  await query(
    `INSERT INTO identity.audit_log (actor_user_id, action, target_type, target_id, payload)
       VALUES ($1, 'user.rename', 'user', $2, $3)`,
    [req.auth.user.id, id, JSON.stringify({ first_name: first, last_name: last })]
  );
  res.json(r.rows[0]);
}));

export default router;
