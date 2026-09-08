'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAudio } from '@/components/audio/AudioProvider';
import type { DefaultPlaylist } from '@/lib/default-playlists';
import { defaultPlaylistCover, defaultPlaylistQueue } from '@/lib/default-playlist-play';
import styles from './DefaultPlaylistRow.module.css';

const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';
const NOTE = 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z';

/**
 * One default playlist as a single horizontal browse row (Section 4):
 * thumbnail · title · one-line description · play button.
 *
 * Two intents, no clutter: tapping the row body opens the playlist
 * (/playlists/<id>); the play button starts it instantly without opening. The
 * description line ends with an "Edit Playlist" link into the edit page.
 */
export function DefaultPlaylistRow({ playlist }: { playlist: DefaultPlaylist }) {
  const router = useRouter();
  const { toggle, isCurrent, playing } = useAudio();

  const queue = useMemo(() => defaultPlaylistQueue(playlist.songs), [playlist.songs]);
  const cover = useMemo(
    () => (playlist.linkedImage ? null : defaultPlaylistCover(playlist.songs)),
    [playlist.songs, playlist.linkedImage],
  );

  const active = queue.some((q) => isCurrent(q.id));
  const isPlaying = active && playing;

  const open = () => router.push(`/playlists/${playlist.id}`);
  const play = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!queue.length) return;
    toggle(queue[0], queue);
  };

  return (
    <div
      className={styles.row}
      onClick={open}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open();
      }}
      aria-label={`Open ${playlist.title}`}
    >
      <div className={styles.thumb}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" />
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NOTE} />
          </svg>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{playlist.title}</h3>
          {playlist.anchorVerse && (
            <span className={styles.verse}>{playlist.anchorVerse.reference}</span>
          )}
        </div>
        <p className={styles.desc}>
          <span className={styles.descText}>{playlist.description}</span>
          <Link
            href={`/playlists/${playlist.id}/edit`}
            className={styles.edit}
            onClick={(e) => e.stopPropagation()}
          >
            Edit Playlist
          </Link>
        </p>
      </div>

      <button
        type="button"
        className={styles.play}
        onClick={play}
        disabled={!queue.length}
        aria-label={isPlaying ? `Pause ${playlist.title}` : `Play ${playlist.title}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={isPlaying ? PAUSE : PLAY} />
        </svg>
      </button>
    </div>
  );
}
