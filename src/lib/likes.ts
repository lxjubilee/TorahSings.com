'use client';

/**
 * Account-backed favorites ("likes"), mirroring JubiLujah's lib/likes.ts.
 * Backed by /api/me/likes (the whole router is requireAuth), all same-origin
 * through the next.config rewrite.
 *
 * Album/song ids are the derived uuids from lib/ids.ts — the same scheme the
 * ratings use, so the catalog never needs to be in the database.
 *
 * NOTE: the server's GET /api/me/likes resolves titles/covers via the catalog
 * manifest, which is empty on TorahSings — so the Liked page uses the flat id
 * set (listLikeIds) and resolves each uuid against the local catalog instead.
 */

import { useSyncExternalStore } from 'react';
import { api } from './api';

export type LikeType = 'album' | 'song';

/** Returns the liked targets as a set of `"album:<uuid>"` / `"song:<uuid>"`. */
export const listLikeIds = () => api.get<{ ids: string[] }>('/api/me/likes/ids');

export const likeTarget = (target_type: LikeType, target_id: string) =>
  api.post<{ liked: boolean }>('/api/me/likes', { target_type, target_id });

export const unlikeTarget = (target_type: LikeType, target_id: string) =>
  api.del<{ liked: boolean }>(`/api/me/likes/${target_type}/${target_id}`);

export const likeKey = (type: LikeType, id: string) => `${type}:${id}`;

/* ---------------------------------------------------------------------------
 * Shared likes store.
 *
 * One source of truth for every like button — the hover-preview thumb, the
 * album-detail heart, the Liked page — so liking in one place lights up
 * everywhere without each component fetching its own state. Module-level (no
 * provider needed); components read it with useLikedSet().
 * ------------------------------------------------------------------------- */
let likedSet = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
// Reference is stable until a mutation swaps in a new Set, so useSyncExternalStore
// re-renders exactly when the set changes.
function snapshot() {
  return likedSet;
}

export function useLikedSet(): Set<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Fetch the caller's likes once (idempotent). Call when signed in. */
export async function ensureLikesLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const r = await listLikeIds();
    likedSet = new Set(r.ids);
    emit();
  } catch {
    loaded = false; // let a later mount retry
  }
}

/** Clear on sign-out so the next visitor doesn't inherit these likes. */
export function resetLikes(): void {
  likedSet = new Set();
  loaded = false;
  emit();
}

/** Optimistic toggle: flip immediately, reconcile with the API, revert on error. */
export async function toggleLikeStored(type: LikeType, id: string): Promise<void> {
  const key = likeKey(type, id);
  const wasLiked = likedSet.has(key);
  const next = new Set(likedSet);
  if (wasLiked) next.delete(key);
  else next.add(key);
  likedSet = next;
  emit();
  try {
    if (wasLiked) await unlikeTarget(type, id);
    else await likeTarget(type, id);
  } catch {
    const rev = new Set(likedSet);
    if (wasLiked) rev.add(key);
    else rev.delete(key);
    likedSet = rev;
    emit();
  }
}
