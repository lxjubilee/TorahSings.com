'use client';

import { useEffect, useState } from 'react';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { listMyPlaylists, type UserPlaylist } from '@/lib/playlists';
import styles from './PlaylistsGrid.module.css';

const NOTE = 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z';

/**
 * The visitor's playlists. GET /api/me/playlists auto-provisions the default
 * "My Favorites" list, so a signed-in visitor always sees at least one.
 */
export function PlaylistsGrid() {
  const { session, status, signIn } = useJubileeAccount();
  const [lists, setLists] = useState<UserPlaylist[] | null>(null);

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

  if (lists === null) return <p className={styles.loading}>Loading your playlists…</p>;

  if (lists.length === 0) {
    return (
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>No playlists yet</h2>
        <p className={styles.stateBody}>
          Use <strong>Add to Playlist</strong> on any album to start one.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {lists.map((p) => (
        <div key={p.id} className={styles.card}>
          <div className={styles.art}>
            {p.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.artImg} src={p.cover} alt="" loading="lazy" decoding="async" />
            ) : (
              <svg className={styles.note} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={NOTE} />
              </svg>
            )}
            <span className={styles.badge}>
              {p.item_count ?? 0} {(p.item_count ?? 0) === 1 ? 'track' : 'tracks'}
            </span>
          </div>
          <div className={styles.body}>
            <h3 className={styles.name}>{p.name}</h3>
            {p.is_default && <span className={styles.default}>Default</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
