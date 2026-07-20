'use client';

/**
 * Typed client for the personal playlist API (/api/me/playlists), mirroring
 * JubiLujah's lib/playlists.ts. Every endpoint requires an authenticated
 * session; lib/api attaches the Bearer token and refreshes it transparently.
 *
 * Unlike ratings and likes — which are polymorphic and key on a DERIVED uuid
 * with no foreign key — playlist items store `song_id` with a real FK to
 * catalog.songs. That is why the catalog had to be mirrored into the database
 * (api/scripts/import-catalog.mjs) before any of this could store a row.
 */

import { api } from './api';

export interface UserPlaylist {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  /** True for the auto-provisioned "My Favorites" list. */
  is_default?: boolean;
  item_count?: number;
  cover?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: string;
  song_id: string;
  position: number;
  /** Resolved server-side by joining catalog.songs/albums/artists. */
  song_title?: string;
  album_title?: string;
  artist_name?: string;
  /** Null here — the API resolves these from the manifest, which we don't use. */
  cover?: string | null;
  url?: string | null;
}

export interface PlaylistDetail extends UserPlaylist {
  items: PlaylistItem[];
}

export const listMyPlaylists = () => api.get<UserPlaylist[]>('/api/me/playlists');

export const createPlaylist = (body: { name: string; description?: string; is_public?: boolean }) =>
  api.post<UserPlaylist>('/api/me/playlists', body);

export const getPlaylist = (id: string) => api.get<PlaylistDetail>(`/api/me/playlists/${id}`);

export const deletePlaylist = (id: string) => api.del<void>(`/api/me/playlists/${id}`);

export const addToPlaylist = (id: string, songId: string) =>
  api.post<{ playlist_id: string; song_id: string; duplicate?: boolean }>(
    `/api/me/playlists/${id}/items`,
    { song_id: songId },
  );

/** Add many songs at once (a whole album). Returns how many were newly added. */
export const bulkAddToPlaylist = (id: string, songIds: string[]) =>
  api.post<{ playlist_id: string; added: number; total: number }>(
    `/api/me/playlists/${id}/items/bulk`,
    { song_ids: songIds },
  );

export const removeFromPlaylist = (id: string, itemId: string) =>
  api.del<void>(`/api/me/playlists/${id}/items/${itemId}`);

/**
 * Distinct song ids (with a per-song count) across all of the caller's
 * playlists — drives the "✓ already added" state without opening the menu.
 */
export const listPlaylistSongIds = () =>
  api.get<{ counts: Record<string, number> }>('/api/me/playlist-song-ids');
