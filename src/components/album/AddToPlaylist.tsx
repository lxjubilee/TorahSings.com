'use client';

import { useEffect, useRef, useState } from 'react';
import { showAuthGate } from '@/lib/auth-gate';
import { useJubileeAccount } from '@/lib/jubilee-account';
import {
  bulkAddToPlaylist,
  createPlaylist,
  listMyPlaylists,
  type UserPlaylist,
} from '@/lib/playlists';
import styles from './AddToPlaylist.module.css';

/**
 * "Add album to playlist", ported from JubiLujah's AddToPlaylist.
 *
 * The caller supplies the song ids LAZILY (`getSongIds`) rather than upfront —
 * on the hover card we only know the album code, and resolving every tile's
 * tracks on hover would cost a fetch per tile. We resolve at click time instead.
 *
 * Playlists load on first open (not on mount), so an unopened menu costs
 * nothing. Guests get the shared sign-in gate rather than a dead control.
 */
export function AddToPlaylist({
  getSongIds,
  children,
  onOpenChange,
}: {
  /** Resolved when the menu opens — the album's derived song uuids. */
  getSongIds: () => string[];
  /** The trigger (the caller styles its own button). */
  children: (open: () => void) => React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const { session } = useJubileeAccount();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<UserPlaylist[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const setOpenState = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  // Close on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenState(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lazy-load the caller's playlists the first time the menu opens.
  useEffect(() => {
    if (!open || !session || lists !== null) return;
    listMyPlaylists()
      .then(setLists)
      .catch(() => setLists([]));
  }, [open, session, lists]);

  const trigger = () => {
    if (!session) {
      showAuthGate();
      return;
    }
    setOpenState(!open);
  };

  const addTo = async (playlistId: string) => {
    if (busy) return;
    const ids = getSongIds();
    if (!ids.length) {
      setDone('This album has no tracks to add.');
      return;
    }
    setBusy(true);
    try {
      const res = await bulkAddToPlaylist(playlistId, ids);
      setDone(
        res.added > 0
          ? `Added ${res.added} track${res.added === 1 ? '' : 's'}.`
          : 'Already in that playlist.',
      );
      // Reflect the new count without a refetch.
      setLists((prev) =>
        prev?.map((p) =>
          p.id === playlistId ? { ...p, item_count: (p.item_count ?? 0) + res.added } : p,
        ) ?? prev,
      );
      setTimeout(() => setOpenState(false), 900);
    } catch {
      setDone('Could not add to that playlist.');
    } finally {
      setBusy(false);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const pl = await createPlaylist({ name });
      setNewName('');
      setLists((prev) => (prev ? [...prev, pl] : [pl]));
      await addTo(pl.id);
    } catch {
      setDone('Could not create that playlist.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      {children(trigger)}

      {open && session && (
        <div className={styles.menu} role="dialog" aria-label="Add album to playlist">
          <div className={styles.head}>Add album to playlist</div>

          {lists === null && <p className={styles.state}>Loading your playlists…</p>}

          {lists !== null && (
            <>
              <div className={styles.list}>
                {lists.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.row}
                    onClick={() => addTo(p.id)}
                    disabled={busy}
                  >
                    <span className={styles.name}>{p.name}</span>
                    {p.is_default && <span className={styles.badge}>Default</span>}
                    <span className={styles.count}>{p.item_count ?? 0}</span>
                  </button>
                ))}
              </div>

              {lists.length === 0 && <p className={styles.empty}>No playlists yet — create one below.</p>}

              <div className={styles.newRow}>
                <input
                  className={styles.input}
                  placeholder="New Playlist…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void createAndAdd();
                    }
                  }}
                  maxLength={200}
                />
                <button
                  type="button"
                  className={styles.add}
                  onClick={createAndAdd}
                  disabled={busy || !newName.trim()}
                >
                  Add
                </button>
              </div>
            </>
          )}

          {done && <p className={styles.done}>{done}</p>}
        </div>
      )}
    </div>
  );
}
