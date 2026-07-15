import type { ReactNode } from 'react';
import styles from './TileRow.module.css';

/**
 * One JubiLujah "browse row": a bold title (with an optional count riding the
 * right) above a wrapping track of fixed-width square tiles — six across on
 * desktop, three on tablet, two on phones.
 */
export function TileRow({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.row}>
      <div className={`wrap ${styles.head}`}>
        <h2 className={styles.title}>{title}</h2>
        {count && <span className={styles.count}>{count}</span>}
      </div>
      <div className={`wrap ${styles.track}`}>{children}</div>
    </section>
  );
}
