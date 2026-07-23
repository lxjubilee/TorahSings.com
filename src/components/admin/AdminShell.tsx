'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './AdminShell.module.css';

/**
 * The operations console: a vertical section nav beside the selected section.
 *
 * The gate here is presentation, not security. It decides what to draw; it never
 * decides what the caller may do. Every admin endpoint is gated server-side by
 * `requireRole('admin')` (api/src/middleware/rbac.js), so forcing a URL past
 * this gets you a rendered shell and a wall of 403s from the API — which is the
 * correct outcome, not a hole.
 *
 * Mobile App Settings and Languages are deliberately absent: both are out of
 * scope for TorahSings (see docs/ADMIN_PARITY.md).
 */
/**
 * `ready: false` marks a section that is planned but not built yet — it renders
 * as a dimmed label rather than a link, because a nav that 404s is worse than a
 * nav that admits what it does not have. Flip the flag in the same commit that
 * adds the route.
 */
interface AdminSection {
  href: string;
  label: string;
  ready: boolean;
}

// Explicitly typed rather than `as const`: with literal types, narrowing on
// `ready` and then on `href === '/admin'` collapses the remaining member to
// `never` while only one section is live.
const SECTIONS: AdminSection[] = [
  { href: '/admin', label: 'Overview', ready: true },
  { href: '/admin/analytics', label: 'Analytics', ready: true },
  { href: '/admin/active-listeners', label: 'Active Listeners', ready: true },
  { href: '/admin/music', label: 'Manage Music', ready: false },
  { href: '/admin/publish-to-production', label: 'Publish to Production', ready: true },
  { href: '/admin/pipeline', label: 'Pipeline', ready: true },
  { href: '/admin/awards', label: 'Awards', ready: true },
  { href: '/admin/production-history', label: 'Production History', ready: false },
  { href: '/admin/subscribers', label: 'Subscribers', ready: true },
  { href: '/admin/users', label: 'Users & Roles', ready: true },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, status, isAdmin, signIn } = useJubileeAccount();

  if (status === 'loading') {
    return <p className={styles.gate}>Checking access…</p>;
  }

  if (!session) {
    return (
      <div className={styles.gate}>
        <h2 className={styles.gateTitle}>Sign in to continue</h2>
        <p className={styles.gateBody}>The operations console is for administrators of Torah Sings.</p>
        <button type="button" className="pill" onClick={signIn}>
          Sign in
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.gate}>
        <h2 className={styles.gateTitle}>You do not have admin access</h2>
        <p className={styles.gateBody}>
          Signed in as <strong>{session.email}</strong>
          {session.roles.length > 0 && <> with {session.roles.join(', ')}</>}. The admin role is granted in
          your Jubilee Account and arrives here on your next sign-in.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Admin sections">
        <div className={styles.navHead}>Operations Console</div>
        {SECTIONS.map((s) => {
          if (!s.ready) {
            return (
              <span key={s.href} className={styles.navPending} aria-disabled="true">
                {s.label}
                <span className={styles.navPendingTag}>soon</span>
              </span>
            );
          }
          // "/admin" would otherwise match every child route.
          const active = s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={styles.navLink}
              data-active={active ? 'yes' : 'no'}
              aria-current={active ? 'page' : undefined}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.detail}>{children}</div>
    </div>
  );
}
