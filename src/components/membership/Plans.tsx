'use client';

import Link from 'next/link';
import { YEARLY_PRICE_LABEL } from '@/lib/format';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './Plans.module.css';

interface PlansProps {
  /** Free-tier copy is derived from the data, never asserted independently. */
  freeAlbumCount: string;
  freeSongsPerAlbum: string;
  freeArticleCount: string;
  freeLessonLevel: string;
}

const TREASURY: readonly string[] = [
  'The full Torah Sings library — every album now, and every album to come',
  'Every Hebraic Christianity article, read aloud in the Inspire voice',
  'The complete Learn Hebrew curriculum, with Zev and Zariah',
  'The book explaining the discovery, included',
  'Early access to new topic albums as they release',
  'Behind-the-scenes and exclusive content',
  'The downloadable resources kit — the methodology, at the disclosed level',
  'One Jubilee Account, good across the whole ecosystem',
];

export function Plans({ freeAlbumCount, freeSongsPerAlbum, freeArticleCount, freeLessonLevel }: PlansProps) {
  const { session, entitlement, signIn, subscribe } = useJubileeAccount();

  const isMember = entitlement === 'member';
  const signedIn = session !== null;

  const taste: readonly string[] = [
    `${freeAlbumCount}, streaming in full`,
    `The first ${freeSongsPerAlbum} of every other album`,
    `${freeArticleCount} from the Hebraic Christianity library`,
    freeLessonLevel,
    'The Article and Derivation tabs on every album — always open',
  ];

  return (
    <div className={styles.plans}>
      {/* ---- Free ---- */}
      <div className={styles.plan}>
        <h2 className={styles.name}>The taste</h2>
        <p className={styles.tag}>Enough to know whether this is real.</p>

        <div className={styles.priceRow}>
          <span className={styles.price}>$0</span>
          <span className={styles.per}>Free, always</span>
        </div>

        <ul className={styles.list}>
          {taste.map((item) => (
            <li key={item} className={styles.item}>
              {item}
            </li>
          ))}
        </ul>

        {signedIn ? (
          <Link href="/" className={`pill pill--ghost ${styles.cta}`}>
            Start listening
          </Link>
        ) : (
          <button type="button" className={`pill pill--ghost ${styles.cta}`} onClick={signIn}>
            Start free
          </button>
        )}
      </div>

      {/* ---- Yearly ---- */}
      <div className={[styles.plan, styles.recommended].join(' ')}>
        <span className={styles.ribbon}>Recommended</span>

        <h2 className={styles.name}>The full treasury</h2>
        <p className={styles.tag}>Partners in ongoing revelation.</p>

        <div className={styles.priceRow}>
          <span className={styles.price}>{YEARLY_PRICE_LABEL}</span>
          <span className={styles.per}>Per year</span>
        </div>

        <ul className={styles.list}>
          {TREASURY.map((item) => (
            <li key={item} className={styles.item}>
              {item}
            </li>
          ))}
        </ul>

        {isMember ? (
          <div className={styles.memberState}>
            <span className={styles.memberLabel}>You are a partner</span>
            <p className={styles.memberBody}>
              Renews {session?.subscription.renewsAt ?? 'annually'}. Everything above is already open to you.
            </p>
          </div>
        ) : (
          <>
            <button type="button" className={`pill ${styles.cta}`} onClick={subscribe}>
              Become a partner — {YEARLY_PRICE_LABEL}/yr
            </button>
            <p className={styles.ssoNote}>
              Checkout runs through your Jubilee Account.
              <br />
              One sign-in across the ecosystem.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
