'use client';

import type { DefaultPlaylist } from '@/lib/default-playlists';
import { DefaultPlaylistRow } from './DefaultPlaylistRow';
import styles from './DefaultSection.module.css';

/**
 * One default section on the PLAYLISTS page — a public heading (Section 3) over
 * a stack of browse rows (Section 4). Used for both "Songs by Theme" (Thematic)
 * and "For Your Season" (Emotional State).
 */
export function DefaultSection({
  heading,
  blurb,
  playlists,
}: {
  heading: string;
  blurb: string;
  playlists: DefaultPlaylist[];
}) {
  if (!playlists.length) return null;
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{heading}</h2>
        <span className={styles.count}>{playlists.length}</span>
      </div>
      <p className={styles.blurb}>{blurb}</p>
      <div className={styles.rows}>
        {playlists.map((p) => (
          <DefaultPlaylistRow key={p.id} playlist={p} />
        ))}
      </div>
    </section>
  );
}
