import { Eyebrow } from '@/components/system/Eyebrow';
import { ALEPH_BET } from '@/lib/derivation';
import styles from './AlephBetTeaser.module.css';

/** Five letters and a promise. Twenty-two in all. */
const SHOWN = 5;

export function AlephBetTeaser() {
  const shown = ALEPH_BET.slice(0, SHOWN);
  const remaining = ALEPH_BET.length - SHOWN;

  return (
    <div className={styles.teaser}>
      <Eyebrow className={styles.label}>Twenty-two letters</Eyebrow>

      <div className={styles.grid}>
        {shown.map((letter) => (
          <span key={letter.name} className={`glyph ${styles.tile}`} title={`${letter.name} — ${letter.sense}`}>
            {letter.letter}
          </span>
        ))}
        <span className={[styles.tile, styles.more].join(' ')}>{`+${remaining}`}</span>
      </div>

      <p className={styles.caption}>
        Each one was a picture before it was a sound. An ox. A house. A door. Learn what they meant and the text
        starts speaking twice.
      </p>
    </div>
  );
}
