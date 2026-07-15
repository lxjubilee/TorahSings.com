import type { ReactNode } from 'react';

import styles from './LegalDoc.module.css';

/**
 * The legal-document shell, ported 1:1 from jubilujah.com/terms: a rose-bordered
 * hero (eyebrow · title · lead) over an 880px prose column that opens with an
 * "effective" line and closes with a contact card. Pass the numbered sections as
 * plain <h2>/<p>/<ul> children — the stylesheet's descendant rules style them.
 */
export function LegalDoc({
  eyebrow = 'Legal',
  title,
  lead,
  effective,
  children,
  contact,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  effective?: string;
  children: ReactNode;
  contact?: ReactNode;
}) {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1 className={styles.title}>{title}</h1>
          {lead && <p className={styles.lead}>{lead}</p>}
        </div>
      </section>

      <section className={styles.standard}>
        <div className={styles.container}>
          <article className={styles.legal}>
            {effective && <div className={styles.updated}>{effective}</div>}
            {children}
            {contact && <div className={styles.contact}>{contact}</div>}
          </article>
        </div>
      </section>
    </>
  );
}
