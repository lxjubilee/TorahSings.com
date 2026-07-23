'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  AdminTable,
  EmptyRow,
  Kpi,
  KpiRow,
  Notice,
  Pill,
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';
import styles from './Subscribers.module.css';

/**
 * Every paying customer with a live subscription, and what they are worth per
 * month.
 *
 * The API normalises annual plans to their monthly equivalent
 * (`price_cents / 12`) so the total is a true MRR rather than a mix of
 * cadences — which is why the Monthly column can differ from what a yearly
 * subscriber was actually charged.
 */

interface Subscriber {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  plan_code: string;
  plan_name: string;
  currency: string;
  billing_interval: 'month' | 'year';
  price_cents: number;
  monthly_cents: number;
  status: 'active' | 'past_due';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  started_at: string | null;
}

interface PlanRollup {
  plan: string;
  count: number;
  monthly_cents_each: number;
  subtotal_cents: number;
}

interface Response {
  currency: string;
  count: number;
  monthly_total_cents: number;
  by_plan: PlanRollup[];
  subscribers: Subscriber[];
}

const money = (cents: number | null | undefined, currency = 'usd') =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
        cents / 100,
      );

const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export function Subscribers() {
  const [data, setData] = useState<Response | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Response>('/api/admin/subscribers')
      .then((r) => setData(r))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load subscribers.'));
  }, []);

  const subs = data?.subscribers ?? [];
  const pastDue = subs.filter((s) => s.status === 'past_due').length;
  const cancelling = subs.filter((s) => s.cancel_at_period_end).length;
  const maxPlan = Math.max(1, ...(data?.by_plan ?? []).map((p) => p.subtotal_cents || 0));

  return (
    <>
      <SectionTitle>Subscribers</SectionTitle>
      <SectionSub>
        Every customer on a live subscription — active or past due — and the recurring revenue they
        represent. Annual plans are shown as their monthly equivalent, so the total is comparable
        month to month.
      </SectionSub>

      {err && <Notice tone="error">{err}</Notice>}

      {!err && (
        <>
          <KpiRow>
            <Kpi
              n={data ? money(data.monthly_total_cents, data.currency) : '—'}
              label="Monthly total (MRR)"
            />
            <Kpi n={data ? data.count.toLocaleString() : '—'} label="Paying subscribers" />
            <Kpi
              n={data ? pastDue.toLocaleString() : '—'}
              label="Past due"
              tone={pastDue > 0 ? 'var(--accent-peach)' : undefined}
            />
            <Kpi
              n={data ? cancelling.toLocaleString() : '—'}
              label="Cancelling at period end"
              tone={cancelling > 0 ? 'var(--accent-peach)' : undefined}
            />
          </KpiRow>

          {data && data.by_plan.length > 0 && (
            <div className={styles.planRow}>
              {data.by_plan.map((p) => (
                <div className={styles.plan} key={p.plan}>
                  <div className={styles.planAmt}>{money(p.subtotal_cents, data.currency)}</div>
                  <div className={styles.planL}>
                    {p.count}× {p.plan} · {money(p.monthly_cents_each, data.currency)}/mo
                  </div>
                  <span className={styles.planBar}>
                    <span
                      className={styles.planFill}
                      style={{ width: `${((p.subtotal_cents || 0) / maxPlan) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}

          <AdminTable
            head={
              <>
                <th>Customer</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
                <th className={cell.num}>Monthly</th>
                <th>Renews</th>
                <th>Since</th>
              </>
            }
          >
            {data === null && <EmptyRow colSpan={7}>Loading subscribers…</EmptyRow>}
            {data !== null && subs.length === 0 && (
              <EmptyRow colSpan={7}>No paying subscribers yet.</EmptyRow>
            )}
            {subs.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className={styles.name}>{s.display_name || '—'}</span>
                </td>
                <td className={styles.email}>{s.email}</td>
                <td>
                  {s.plan_name}
                  {s.billing_interval === 'year' && (
                    <span className={styles.yearly}>(billed yearly)</span>
                  )}
                </td>
                <td>
                  <Pill tone={s.status === 'active' ? 'ok' : 'warn'}>
                    {s.status === 'past_due' ? 'past due' : 'active'}
                  </Pill>
                  {s.cancel_at_period_end && (
                    <span className={styles.cancels}>cancels at period end</span>
                  )}
                </td>
                <td className={styles.amount}>{money(s.monthly_cents, s.currency)}</td>
                <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
                  {dateOnly(s.current_period_end)}
                </td>
                <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
                  {dateOnly(s.started_at)}
                </td>
              </tr>
            ))}
            {data !== null && subs.length > 0 && (
              <tr className={styles.totalRow}>
                <td colSpan={4} className={styles.totalLabel}>
                  Monthly total
                </td>
                <td className={styles.amount}>{money(data.monthly_total_cents, data.currency)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </AdminTable>

          <p className={styles.note}>
            Only paid plans with a live subscription appear here. Cancelled and expired subscriptions
            are excluded, so this is what is currently billable rather than everyone who has ever
            subscribed.
          </p>
        </>
      )}
    </>
  );
}
