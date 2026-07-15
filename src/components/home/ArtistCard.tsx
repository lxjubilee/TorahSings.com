import Link from 'next/link';
import type { CSSProperties } from 'react';
import styles from './ArtistCard.module.css';

/**
 * A Featured-Artists card: a circular, hue-tinted avatar monogram over the
 * presenter's name. The Inspire Family voices these albums, so each avatar
 * links through to the album that presenter carries.
 */
export function ArtistCard({ name, href, hue }: { name: string; href: string; hue: number }) {
  // First two letters of the given name — every persona is "… Inspire", so
  // initials-of-each-word would collide (Zev/Zariah → "ZI"). This keeps them
  // distinct: Zev → ZE, Zariah → ZA, Imani → IM.
  const initials = (name.trim().split(/\s+/)[0] ?? name).slice(0, 2).toUpperCase();

  return (
    <Link href={href} className={styles.card} title={name} style={{ '--hue': hue } as CSSProperties}>
      <span className={styles.avatar}>
        <span className={styles.initials} aria-hidden="true">
          {initials}
        </span>
      </span>
      <span className={styles.name}>{name}</span>
    </Link>
  );
}
