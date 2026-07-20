'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAudio, type PlayableTrack } from '@/components/audio/AudioProvider';
import { mediaUrl, type CatalogAlbum } from '@/lib/angels';
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

  const firstCover = detail.items.map((i) => bySongId.get(i.song_id)?.album.art).find(Boolean) ?? null;

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
                  className={`${styles.row} ${active ? styles.playing : ''}`}
                  onClick={() => playable && toggle(playable, queue)}
                >
                  <span className={styles.num}>{i + 1}</span>
                  <span className={styles.name}>
                    <span className={styles.songTitle}>{it.song_title || hit?.track.title || 'Unknown track'}</span>
                    <span className={styles.sub}>
                      {it.album_title || hit?.album.title || ''}
                      {it.artist_name ? ` · ${it.artist_name}` : ''}
                    </span>
                  </span>
                  <span className={styles.noAudio}>{playable ? '' : 'No audio'}</span>
                  {/*
                   * One control, two faces: a green tick marking the song as in
                   * this playlist, which becomes a cut icon on row hover so the
                   * same spot removes it. The icon can only read "cut" while the
                   * pointer is over the row, so a click never removes silently.
                   */}
                  <button
                    type="button"
                    className={styles.mark}
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(it.id);
                    }}
                    aria-label={`Remove ${it.song_title ?? hit?.track.title ?? 'track'} from this playlist`}
                  >
                    <svg className={styles.tick} viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8.2 12.3l2.6 2.6 5-5.2" />
                    </svg>
                    <svg className={styles.cut} viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
