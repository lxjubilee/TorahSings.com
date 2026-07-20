'use client';

import { useEffect, useMemo, useState } from 'react';
import { CatalogAlbumTile } from '@/components/home/CatalogAlbumTile';
import { HoverPreviewProvider } from '@/components/home/HoverPreview';
import { allCatalogAlbums } from '@/lib/catalog';
import { albumUuid } from '@/lib/ids';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { likeKey, listLikeIds } from '@/lib/likes';
import styles from './LikedGrid.module.css';

/**
 * The visitor's liked albums.
 *
 * The API's GET /api/me/likes resolves titles/covers via the catalog manifest,
 * which is empty here — so we take the flat id set (GET /api/me/likes/ids) and
 * resolve each `album:<uuid>` against the local catalog by matching
 * albumUuid(code). Same derivation as the like button, so a liked album always
 * maps back to its tile.
 */
export function LikedGrid() {
  const { session, status, signIn } = useJubileeAccount();
  const [likedIds, setLikedIds] = useState<Set<string> | null>(null);

  // A stable index of every album by its derived like-key.
  const byKey = useMemo(() => {
    const m = new Map<string, ReturnType<typeof allCatalogAlbums>[number]>();
    for (const a of allCatalogAlbums()) m.set(likeKey('album', albumUuid(a.code)), a);
    return m;
  }, []);

  useEffect(() => {
    if (!session) {
      setLikedIds(null);
      return;
    }
    let cancelled = false;
    listLikeIds()
      .then((r) => {
        if (!cancelled) setLikedIds(new Set(r.ids));
      })
      .catch(() => {
        if (!cancelled) setLikedIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (status === 'loading') {
    return <p className={styles.loading}>Loading your account…</p>;
  }

  if (!session) {
    return (
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>Sign in to see your liked albums</h2>
        <p className={styles.stateBody}>
          Browsing is open to everyone — but liking albums needs a free account, so your favorites follow you
          across the ecosystem.
        </p>
        <button type="button" className="pill" onClick={signIn}>
          Sign in
        </button>
      </div>
    );
  }

  if (likedIds === null) {
    return <p className={styles.loading}>Loading your liked albums…</p>;
  }

  const albums = [...likedIds].map((k) => byKey.get(k)).filter((a): a is NonNullable<typeof a> => Boolean(a));

  if (albums.length === 0) {
    return (
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>No liked albums yet</h2>
        <p className={styles.stateBody}>
          Tap the <strong>Like</strong> button on any album and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <HoverPreviewProvider>
      <div className={styles.grid}>
        {albums.map((a) => (
          <CatalogAlbumTile key={a.code} album={a} />
        ))}
      </div>
    </HoverPreviewProvider>
  );
}
