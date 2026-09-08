'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import { useAudio } from '@/components/audio/AudioProvider';
import type { DefaultPlaylist } from '@/lib/default-playlists';
import { playlistImageUrl } from '@/lib/default-playlists';
import { defaultPlaylistCover, defaultPlaylistQueue, resolveSong } from '@/lib/default-playlist-play';
import styles from './DefaultPlaylistDetail.module.css';

const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';

/**
 * A default playlist "opened" for a look (Section 4 — the row-body intent):
 * banner (generated 16:9 image, or first-track cover as a fallback), the anchor
 * verse, the running order, and a big play. Editing is a separate page reached
 * from the "Edit Playlist" action here or on the browse row.
 */
export function DefaultPlaylistDetail({ playlist }: { playlist: DefaultPlaylist }) {
  const { toggle, isCurrent, playing, current } = useAudio();

  const queue = useMemo(() => defaultPlaylistQueue(playlist.songs), [playlist.songs]);
  const banner = playlist.linkedImage
    ? playlistImageUrl(playlist.linkedImage)
    : defaultPlaylistCover(playlist.songs);

  const onList = queue.some((q) => isCurrent(q.id));
  const listPlaying = onList && playing;

  const playAll = () => {
    if (!queue.length) return;
    if (onList && current) toggle(current, queue);
    else toggle(queue[0], queue);
  };

  return (
    <section className={styles.panel}>
      <div className={[styles.banner, banner ? '' : styles.bannerEmpty].join(' ')}>
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" />
        )}
        <div className={styles.bannerShade} />
        <div className={styles.bannerText}>
          <div className={styles.eyebrow}>{playlist.type === 'Thematic' ? 'Songs by Theme' : 'For Your Season'}</div>
          <h1 className={styles.title}>{playlist.title}</h1>
          <p className={styles.desc}>{playlist.description}</p>
        </div>
      </div>

      {playlist.anchorVerse && (
        <blockquote className={styles.verse}>
          “{playlist.anchorVerse.text}”
          <cite>{playlist.anchorVerse.reference}</cite>
        </blockquote>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.bigplay}
          onClick={playAll}
          disabled={!queue.length}
          aria-label={listPlaying ? 'Pause playlist' : 'Play playlist'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={listPlaying ? PAUSE : PLAY} />
          </svg>
          {listPlaying ? 'Pause' : 'Play'}
        </button>
        <Link href={`/playlists/${playlist.id}/edit`} className={styles.editLink}>
          Edit Playlist
        </Link>
        <Link href="/playlists" className={styles.allLink}>
          All Playlists
        </Link>
        <span className={styles.count}>{playlist.songs.length} songs</span>
      </div>

      <ol className={styles.list}>
        {playlist.songs.map((s, i) => {
          const hit = resolveSong(s);
          const playable = hit ? queue.find((q) => q.id === `${hit.album.code}:${hit.track.n}`) : null;
          const active = playable ? isCurrent(playable.id) : false;
          return (
            <li
              key={`${s.code}:${s.n}:${i}`}
              className={[styles.row, active ? styles.playing : ''].filter(Boolean).join(' ')}
              onClick={() => playable && toggle(playable, queue)}
            >
              <span className={styles.num}>
                <span className={styles.numText}>{i + 1}</span>
                {playable && (
                  <span className={styles.cue} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d={active && playing ? PAUSE : PLAY} />
                    </svg>
                  </span>
                )}
              </span>
              <span className={styles.name}>
                <span className={styles.songTitle}>
                  {s.track}
                  {s.artist && <em className={styles.artist}> — {s.artist}</em>}
                </span>
                <span className={styles.sub}>
                  {s.album}
                  {s.description ? ` · ${s.description}` : ''}
                </span>
              </span>
              {!playable && <span className={styles.noAudio}>No audio</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
