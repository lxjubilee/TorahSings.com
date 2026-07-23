'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { api } from '@/lib/api';
import { useJubileeAccount } from '@/lib/jubilee-account';
import {
  AdminTable,
  Button,
  ButtonRow,
  EmptyRow,
  Kpi,
  KpiRow,
  Notice,
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';
import styles from './UsersRoles.module.css';

/**
 * Every account, with the roles it holds — and the controls to change them.
 *
 * This is the section that makes `admin` grantable without a SQL statement, so
 * it is deliberately careful about two things:
 *
 *  - **You cannot demote or delete yourself.** The API already refuses the
 *    delete (400), but nothing stops an admin dropping their own `admin` tick
 *    and locking the whole team out of the console. The UI locks that row.
 *  - **`viewer` is never shown as a checkbox.** It is the implicit baseline the
 *    API re-adds on every write (`want = new Set(['viewer', ...roles])`), so
 *    offering it as a toggle would be a lie.
 */

/** Mirrors GRANTABLE_ROLES in api/src/routes/admin.js — order is privilege. */
const GRANTABLE_ROLES: { key: string; label: string; hint: string }[] = [
  { key: 'reviewer', label: 'Reviewer', hint: 'Moderate ratings and reviews' },
  { key: 'content_editor', label: 'Content Editor', hint: 'Edit catalogue content' },
  { key: 'executive', label: 'Executive', hint: 'Read the full analytics surface' },
  { key: 'admin', label: 'Admin', hint: 'Full operations console' },
];

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export function UsersRoles() {
  const { session } = useJubileeAccount();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<AdminUser[]>('/api/admin/users')
        .then((rows) => setUsers(Array.isArray(rows) ? rows : []))
        .catch((e) => {
          setUsers([]);
          setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Could not load accounts.' });
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (e: unknown, fallback: string) =>
    setMsg({ tone: 'error', text: e instanceof Error ? e.message : fallback });

  const toggleRole = async (u: AdminUser, role: string) => {
    // Send only the grantable set: `viewer` is the API's business, and posting
    // it back would fail the z.enum(GRANTABLE_ROLES) validator.
    const granted = u.roles.filter((r) => GRANTABLE_ROLES.some((g) => g.key === r));
    const next = granted.includes(role) ? granted.filter((r) => r !== role) : [...granted, role];
    try {
      await api.patch(`/api/admin/users/${u.id}/roles`, { roles: next });
      setMsg({ tone: 'ok', text: `Updated roles for ${u.display_name || u.email}` });
      await load();
    } catch (e) {
      fail(e, 'Could not update roles.');
    }
  };

  const saveName = async (u: AdminUser, first: string, last: string) => {
    try {
      await api.patch(`/api/admin/users/${u.id}`, { first_name: first, last_name: last });
      setMsg({ tone: 'ok', text: `Renamed ${u.email}` });
      await load();
    } catch (e) {
      fail(e, 'Could not save the name.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/users/${pendingDelete.id}`);
      setMsg({ tone: 'ok', text: `Deleted ${pendingDelete.email}` });
      setPendingDelete(null);
      await load();
    } catch (e) {
      fail(e, 'Could not delete the account.');
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const adminCount = users?.filter((u) => u.roles.includes('admin')).length ?? 0;

  return (
    <>
      <SectionTitle>Users &amp; roles</SectionTitle>
      <SectionSub>
        Every account on Torah Sings. <strong>View &amp; play</strong> is the baseline right that every
        account carries and cannot lose; the four toggles below are granted on top of it. Roles set here
        are overwritten on the account&apos;s next Jubilee Account sign-in, which is the authority.
      </SectionSub>

      {msg && (
        <div className={styles.flash}>
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}

      {users !== null && users.length > 0 && (
        <KpiRow>
          <Kpi n={users.length.toLocaleString()} label="Accounts" />
          <Kpi n={adminCount.toLocaleString()} label="Admins" />
          <Kpi n={users.filter((u) => u.is_active).length.toLocaleString()} label="Active" />
        </KpiRow>
      )}

      <AdminTable
        head={
          <>
            <th>Account</th>
            <th>Name</th>
            <th>Roles</th>
            <th>Joined</th>
            <th>Last seen</th>
            <th />
          </>
        }
      >
        {users === null && <EmptyRow colSpan={6}>Loading accounts…</EmptyRow>}
        {users?.length === 0 && <EmptyRow colSpan={6}>No accounts yet.</EmptyRow>}
        {users?.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === session?.userId}
            onToggleRole={toggleRole}
            onSaveName={saveName}
            onDelete={() => setPendingDelete(u)}
          />
        ))}
      </AdminTable>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete account"
        confirmLabel="Delete account"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        Permanently delete <strong>{pendingDelete?.email}</strong>? This removes their ratings, reviews,
        playlists, and sessions. It cannot be undone.
      </ConfirmDialog>
    </>
  );
}

function UserRow({
  user: u,
  isSelf,
  onToggleRole,
  onSaveName,
  onDelete,
}: {
  user: AdminUser;
  isSelf: boolean;
  onToggleRole: (u: AdminUser, role: string) => void;
  onSaveName: (u: AdminUser, first: string, last: string) => void;
  onDelete: () => void;
}) {
  const [first, setFirst] = useState(u.first_name ?? '');
  const [last, setLast] = useState(u.last_name ?? '');

  // Re-sync when a reload brings new values, or the inputs keep stale edits.
  useEffect(() => {
    setFirst(u.first_name ?? '');
    setLast(u.last_name ?? '');
  }, [u.first_name, u.last_name]);

  const dirty = first !== (u.first_name ?? '') || last !== (u.last_name ?? '');
  // The API derives display_name from these, and refuses an empty result.
  const canSave = dirty && Boolean(first.trim() || last.trim());

  return (
    <tr>
      <td>
        <div className={styles.email}>{u.display_name || u.email}</div>
        <div className={styles.sub}>{u.email}</div>
      </td>

      <td>
        <div className={styles.nameEdit}>
          <input
            className={styles.input}
            value={first}
            placeholder="First"
            aria-label={`First name for ${u.email}`}
            onChange={(e) => setFirst(e.target.value)}
          />
          <input
            className={styles.input}
            value={last}
            placeholder="Last"
            aria-label={`Last name for ${u.email}`}
            onChange={(e) => setLast(e.target.value)}
          />
          {dirty && (
            <Button small variant="primary" disabled={!canSave} onClick={() => onSaveName(u, first, last)}>
              Save
            </Button>
          )}
        </div>
      </td>

      <td>
        <div className={styles.roles}>
          <span className={styles.baseline}>View &amp; play</span>
          {GRANTABLE_ROLES.map((r) => {
            // Locking the whole row is blunt but right: the failure it prevents
            // (an admin un-ticking their own admin box) locks everyone out.
            const locked = isSelf;
            return (
              <label key={r.key} className={styles.role} data-locked={locked ? 'yes' : 'no'} title={locked ? 'You cannot change your own roles' : r.hint}>
                <input
                  type="checkbox"
                  checked={u.roles.includes(r.key)}
                  disabled={locked}
                  onChange={() => onToggleRole(u, r.key)}
                />
                {r.label}
              </label>
            );
          })}
        </div>
      </td>

      <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
        {fmtDate(u.created_at)}
      </td>
      <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
        {fmtDate(u.last_login_at)}
      </td>

      <td>
        <ButtonRow>
          {isSelf ? (
            <span className={styles.self}>This is you</span>
          ) : (
            <Button small variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </ButtonRow>
      </td>
    </tr>
  );
}
