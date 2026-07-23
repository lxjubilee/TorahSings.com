'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAudio, type PlayableTrack } from '@/components/audio/AudioProvider';
import { artUrl, mediaUrl, type CatalogAlbum } from '@/lib/angels';
import { allCatalogAlbums } from '@/lib/catalog';
import { songUuid } from '@/lib/ids';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { getPlaylist, removeFromPlaylist, type PlaylistDetail as Detail } from '@/lib/playlists';
import styles from './PlaylistDetail.module.css';

const NOTE = 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z';
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';

type Track = CatalogAlbum['tracks'][number];

/**
 * One playlist rendered as a music page — JubiLujah's /playlist?id=<uuid>.
 *
 * The API resolves song/album/artist names by joining catalog.* (populated by
 * scripts/import-catalog.mjs), but `cover` and the audio `url` come back null
 * because it looks those up in the catalog manifest, which we don't use. We
 * resolve both here instead, mapping each song_id back through the same
 * songUuid() derivation to the album and track it came from.
 */
export function PlaylistDetail({ id }: { id: string }) {
  const { session, status, signIn } = useJubileeAccount();
  const { current, playing, toggle, isCurrent } = useAudio();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);

  // song uuid -> the catalog album/track it came from.
  const bySongId = useMemo(() => {
    const m = new Map<string, { album: CatalogAlbum; track: Track }>();
    for (const album of allCatalogAlbums()) {
      for (const track of album.tracks) m.set(songUuid(album.code, track.n), { album, track });
    }
    return m;
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getPlaylist(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, id]);

  // Playable queue — only the items we can actually resolve audio for.
  const queue = useMemo<PlayableTrack[]>(() => {
    if (!detail) return [];
    const out: PlayableTrack[] = [];
    for (const it of detail.items) {
      const hit = bySongId.get(it.song_id);
      if (!hit) continue;
      out.push({
        id: `${hit.album.code}:${hit.track.n}`,
        title: hit.track.title,
        subtitle: hit.album.title,
        src: mediaUrl(hit.track.rel),
        seed: `${hit.album.code}:${hit.track.n}`,
        href: `/album/${hit.album.code}`,
      });
    }
    return out;
  }, [detail, bySongId]);

  const onPlaylist = queue.some((q) => isCurrent(q.id));
  const playlistPlaying = onPlaylist && playing;

  const playAll = () => {
    if (!queue.length) return;
    if (onPlaylist && current) toggle(current, queue);
    else toggle(queue[0], queue);
  };

  const remove = async (itemId: string) => {
    if (!detail) return;
    setDetail({ ...detail, items: detail.items.filter((i) => i.id !== itemId) });
    try {
      await removeFromPlaylist(id, itemId);
    } catch {
      // Put it back if the server refused.
      getPlaylist(id).then(setDetail).catch(() => {});
    }
  };

  if (status === 'loading') return <p className={styles.loading}>Loading…</p>;

  if (!session) {
    return (
      <div className={styles.state}>
        <p>Sign in to view this playlist.</p>
        <button type="button" className="pill" onClick={signIn} style={{ marginTop: 16 }}>
          Sign in
        </button>
      </div>
    );
  }

  if (error) return <p className={styles.state}>That playlist could not be found.</p>;
  if (!detail) return <p className={styles.loading}>Loading playlist…</p>;

  const firstArt = detail.items.map((i) => bySongId.get(i.song_id)?.album.art).find(Boolean) ?? null;
  const firstCover = firstArt ? artUrl(firstArt) : null;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.cover}>
          {firstCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstCover} alt="" />
          ) : (
            <svg className={styles.note} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={NOTE} />
            </svg>
          )}
        </div>
        <div className={styles.meta}>
          <div className={styles.eyebrow}>Playlist</div>
          <h1 className={styles.title}>{detail.name}</h1>
          <div className={styles.count}>
            {detail.items.length} {detail.items.length === 1 ? 'song' : 'songs'}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.bigplay}
          onClick={playAll}
          disabled={!queue.length}
          aria-label={playlistPlaying ? 'Pause playlist' : 'Play playlist'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={playlistPlaying ? PAUSE : PLAY} />
          </svg>
        </button>
        <Link href="/playlists" className={styles.allLink}>
          All Playlists
        </Link>
      </div>

      {detail.items.length === 0 ? (
        <p className={styles.state}>This playlist is empty. Use “Add to Playlist” on any album.</p>
      ) : (
        <>
          <div className={styles.rowHead}>
            <span>#</span>
            <span>Title</span>
            <span />
            <span />
          </div>
          <ol className={styles.list}>
            {detail.items.map((it, i) => {
              const hit = bySongId.get(it.song_id);
              const playable = hit ? queue.find((q) => q.id === `${hit.album.code}:${hit.track.n}`) : null;
              const active = playable ? isCurrent(playable.id) : false;
              return (
                <li
                  key={it.id}
                  className={[
                    styles.row,
                    active ? styles.playing : '',
                    active && !playing ? styles.paused : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => playable && toggle(playable, queue)}
                >
                  {/*
                   * One cell, three faces: the track number, a play/pause glyph
                   * while the row is hovered, and an equaliser once the row is
                   * the playing track. Stacked in a single grid area so swapping
                   * between them never shifts the row.
                   */}
                  <span className={styles.num}>
                    <span className={styles.numText}>{i + 1}</span>
                    {playable && (
                      <span className={styles.cue} aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d={active && playing ? PAUSE : PLAY} />
                        </svg>
                      </span>
                    )}
                    {active && (
                      <span className={styles.bars} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </span>
                  <span className={styles.name}>
                    <span className={styles.songTitle}>{it.song_title || hit?.track.title || 'Unknown track'}</span>
                    <span className={styles.sub}>
                      {it.album_title || hit?.album.title || ''}
                      {it.artist_name ? ` · ${it.artist_name}` : ''}
                    </span>
                  </span>
                  <span className={styles.noAudio}>{playable ? '' : 'No audio'}</span>
                  {/*
                   * The green tick is a status marker — every song here is in
                   * this playlist — so it stays put. The cut icon is a separate
                   * control that appears beside it on row hover, which is the
                   * only thing that removes.
                   */}
                  <span className={styles.marks}>
                    <span
                      className={styles.tick}
                      title="In this playlist"
                      aria-label="In this playlist"
                      role="img"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8.2 12.3l2.6 2.6 5-5.2" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      className={styles.cut}
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(it.id);
                      }}
                      aria-label={`Remove ${it.song_title ?? hit?.track.title ?? 'track'} from this playlist`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
