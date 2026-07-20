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

import { api } from './api';

export type LikeType = 'album' | 'song';

/** Returns the liked targets as a set of `"album:<uuid>"` / `"song:<uuid>"`. */
export const listLikeIds = () => api.get<{ ids: string[] }>('/api/me/likes/ids');

export const likeTarget = (target_type: LikeType, target_id: string) =>
  api.post<{ liked: boolean }>('/api/me/likes', { target_type, target_id });

export const unlikeTarget = (target_type: LikeType, target_id: string) =>
  api.del<{ liked: boolean }>(`/api/me/likes/${target_type}/${target_id}`);

export const likeKey = (type: LikeType, id: string) => `${type}:${id}`;
