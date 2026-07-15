import Link from 'next/link';
import { CelestialArt } from '@/components/system/CelestialArt';
import { songCountLabel, toRoman } from '@/lib/format';
import type { Album } from '@/lib/types';
import styles from './AlbumCard.module.css';

export function AlbumCard({ album }: { album: Album }) {
  return (
    <Link href={`/album/${album.slug}`} className={styles.card}>
      <CelestialArt
        className={styles.art}
        seed={album.slug}
        hue={album.art.hue}
        topic={album.topic}
        glyph={album.art.glyph}
        ratio="16 / 10"
      />

      <div className={styles.body}>
        <h3 className={styles.title}>{album.title}</h3>
        <span className={styles.meta}>
          {songCountLabel(album.tracks.length)} · Album {toRoman(album.albumNumber)}
        </span>
        <p className={styles.oneLiner}>{album.oneLiner}</p>
        {album.freeTier && <span className={styles.freeFlag}>Streams free</span>}
      </div>
    </Link>
  );
}
