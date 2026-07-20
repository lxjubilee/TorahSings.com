'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudio, type PlayableTrack } from '@/components/audio/AudioProvider';
import { mediaUrl, type CatalogAlbum } from '@/lib/angels';
import { allCatalogAlbums } from '@/lib/catalog';
import { songUuid } from '@/lib/ids';
import { useJubileeAccount } from '@/lib/jubilee-account';
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listMyPlaylists,
  type UserPlaylist,
} from '@/lib/playlists';
import styles from './PlaylistsGrid.module.css';

const NOTE = 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z';
const PLAY = 'M8 5v14l11-7z';

type Track = CatalogAlbum['tracks'][number];

/**
 * The visitor's playlists, following JubiLujah's /playlists: an inline create
 * form (name + description), then a card per playlist with Play / Open / Delete.
 * "Open" goes to /playlist?id=<uuid> — their URL shape, so links match.
 *
 * GET /api/me/playlists auto-provisions the default "My Favorites" list, so a
 * signed-in visitor always has at least one.
 */
export function PlaylistsGrid() {
  const { session, status, signIn } = useJubileeAccount();
  const router = useRouter();
  const { toggle } = useAudio();
  const [lists, setLists] = useState<UserPlaylist[] | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // song uuid -> catalog album/track, for covers and for building a play queue.
  const bySongId = useMemo(() => {
    const m = new Map<string, { album: CatalogAlbum; track: Track }>();
    for (const album of allCatalogAlbums()) {
      for (const track of album.tracks) m.set(songUuid(album.code, track.n), { album, track });
    }
    return m;
  }, []);

  useEffect(() => {
    if (!session) {
      setLists(null);
      return;
    }
    let cancelled = false;
    listMyPlaylists()
      .then((r) => {
        if (!cancelled) setLists(r ?? []);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const pl = await createPlaylist({ name: n, description: desc.trim() || undefined });
      setLists((prev) => [{ ...pl, item_count: 0 }, ...(prev ?? [])]);
      setName('');
      setDesc('');
    } catch {
      setErr('Could not create that playlist.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (pl: UserPlaylist) => {
    if (!window.confirm(`Delete "${pl.name}"? This cannot be undone.`)) return;
    setLists((prev) => prev?.filter((p) => p.id !== pl.id) ?? prev);
    try {
      await deletePlaylist(pl.id);
    } catch {
      listMyPlaylists().then(setLists).catch(() => {});
    }
  };

  /** Load the playlist and start its first playable track. */
  const onPlay = async (pl: UserPlaylist) => {
    try {
      const d = await getPlaylist(pl.id);
      const queue: PlayableTrack[] = [];
      for (const it of d.items) {
        const hit = bySongId.get(it.song_id);
        if (!hit) continue;
        queue.push({
          id: `${hit.album.code}:${hit.track.n}`,
          title: hit.track.title,
          subtitle: hit.album.title,
          src: mediaUrl(hit.track.rel),
          seed: `${hit.album.code}:${hit.track.n}`,
          href: `/album/${hit.album.code}`,
        });
      }
      if (queue.length) toggle(queue[0], queue);
    } catch {
      /* nothing to play */
    }
  };

  if (status === 'loading') return <p className={styles.loading}>Loading your account…</p>;

  if (!session) {
    return (
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>Sign in to see your playlists</h2>
        <p className={styles.stateBody}>
          Playlists live with your Jubilee Account, so the mixes you build here follow you across the
          ecosystem.
        </p>
        <button type="button" className="pill" onClick={signIn}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>My Playlists</h2>
        {lists && <span className={styles.sectionCount}>{lists.length}</span>}
      </div>

      <form className={styles.createRow} onSubmit={onCreate}>
        <input
          className={styles.field}
          placeholder="New Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          aria-label="Playlist name"
        />
        <input
          className={styles.field}
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={2000}
          aria-label="Playlist description"
        />
        <button type="submit" className={styles.create} disabled={busy || !name.trim()}>
          + Create
        </button>
      </form>

      {err && <p className={styles.err}>{err}</p>}

      {lists === null && <p className={styles.loading}>Loading your playlists…</p>}

      {lists && lists.length === 0 && (
        <p className={styles.emptyNote}>
          No playlists yet — name one above, or use <strong>Add to Playlist</strong> on any album.
        </p>
      )}

      {lists && lists.length > 0 && (
        <div className={styles.grid}>
          {lists.map((p) => {
            // The API sends cover: null (it reads a manifest we don't have), so
            // fall back to the album art of the playlist's first track.
            const cover = p.cover ?? (p.first_song_id ? bySongId.get(p.first_song_id)?.album.art ?? null : null);
            return (
            <div key={p.id} className={styles.card}>
              <button
                type="button"
                className={styles.art}
                onClick={() => router.push(`/playlist?id=${p.id}`)}
                aria-label={`Open ${p.name}`}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.artImg} src={cover} alt="" loading="lazy" />
                ) : (
                  <svg className={styles.note} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={NOTE} />
                  </svg>
                )}
                <span className={styles.badge}>
                  {p.item_count ?? 0} {(p.item_count ?? 0) === 1 ? 'track' : 'tracks'}
                </span>
              </button>

              <div className={styles.body}>
                <h3 className={styles.name}>{p.name}</h3>
                {p.is_default && <span className={styles.default}>Default</span>}
              </div>

              <div className={styles.cardActions}>
                <button type="button" className={styles.play} onClick={() => onPlay(p)}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={PLAY} />
                  </svg>
                  Play
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => router.push(`/playlist?id=${p.id}`)}
                >
                  Open
                </button>
                <button type="button" className={styles.ghost} onClick={() => onDelete(p)}>
                  Delete
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}
