import Link from 'next/link';
import { CelestialArt } from '@/components/system/CelestialArt';
import { toRoman } from '@/lib/format';
import type { Album } from '@/lib/types';
import styles from './AlbumTile.module.css';

/**
 * The JubiLujah "visual card": a square artwork tile that scales up on hover,
 * with the title riding a gradient at the foot. Torah Sings has no photographic
 * covers, so the deterministic CelestialArt stands in as the artwork.
 */
export function AlbumTile({ album }: { album: Album }) {
  return (
    <Link href={`/album/${album.slug}`} className={styles.tile} title={album.title}>
      <CelestialArt
        className={styles.art}
        seed={album.slug}
        hue={album.art.hue}
        topic={album.topic}
        glyph={album.art.glyph}
        ratio="1 / 1"
      />

      <span className={styles.grad} aria-hidden="true" />

      <span className={styles.label}>
        <span className={styles.title}>{album.title}</span>
        <span className={styles.role}>
          {album.topic} · Album {toRoman(album.albumNumber)}
        </span>
      </span>

      {album.freeTier && <span className={styles.free}>Free</span>}
    </Link>
  );
}
