import type { ReactNode } from 'react';
import styles from './AdminUI.module.css';

/**
 * The admin console's shared vocabulary.
 *
 * Jubilujah's console expresses these as global CSS classes (`.admin-table`,
 * `.kpi-row`, `.notice`, `.section-title`) applied by hand, with a lot of inline
 * style alongside. This repo is CSS Modules end to end, so the same vocabulary
 * is a handful of tiny components instead — same look, no globals, and a table
 * cannot be built with the header markup half-remembered.
 */

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

export function SectionSub({ children }: { children: ReactNode }) {
  return <p className={styles.sectionSub}>{children}</p>;
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className={styles.kpiRow}>{children}</div>;
}

/** One figure and its label. `n` is pre-formatted — this does not localise. */
export function Kpi({ n, label, tone }: { n: ReactNode; label: string; tone?: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiN} style={tone ? { color: tone } : undefined}>
        {n}
      </div>
      <div className={styles.kpiL}>{label}</div>
    </div>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'error' | 'ok' }) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'accent' | 'ok' | 'warn' }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant,
  small,
  disabled,
  title,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger';
  small?: boolean;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${small ? styles.btnSm : ''}`}
      data-variant={variant}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className={styles.btnRow}>{children}</div>;
}

/**
 * A table in its own horizontally scrolling box. Admin tables are wide by
 * nature; the page itself must never scroll sideways.
 */
export function AdminTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A full-width "nothing here" row, sized to the table it sits in. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.empty}>
        {children}
      </td>
    </tr>
  );
}

export const cell = {
  num: styles.num,
  muted: styles.muted,
  mono: styles.mono,
};
