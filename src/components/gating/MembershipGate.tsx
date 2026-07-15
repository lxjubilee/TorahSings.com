'use client';

import { Eyebrow } from '@/components/system/Eyebrow';
import { YEARLY_PRICE_LABEL } from '@/lib/format';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './MembershipGate.module.css';

interface MembershipGateProps {
  /** Why this is locked, phrased for the reader. */
  reason: string;
  /** Set when the gate follows a teaser, so the text above can dissolve into it. */
  afterTeaser?: boolean;
}

/** Where the free taste ends. It should feel like a threshold, not a wall. */
export function MembershipGate({ reason, afterTeaser = false }: MembershipGateProps) {
  const { session, subscribe, signIn } = useJubileeAccount();

  return (
    <div className={afterTeaser ? styles.wrap : undefined}>
      {afterTeaser && <div className={styles.fade} aria-hidden="true" />}

      <div className={styles.gate}>
        <Eyebrow>The rest is in the treasury</Eyebrow>

        <h2 className={styles.title}>{reason}</h2>

        <p className={styles.body}>
          Membership opens the whole library — every album, every article read aloud, the full Learn Hebrew
          curriculum, the book, and the resources kit. As more is uncovered, it comes to you.
        </p>

        <div className={styles.actions}>
          <button type="button" className="pill" onClick={subscribe}>
            Become a partner — {YEARLY_PRICE_LABEL}/yr
          </button>
        </div>

        {!session && (
          <button type="button" className={styles.signin} onClick={signIn}>
            Already a member? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
