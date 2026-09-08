/**
 * Turn a default playlist's baked song slots into things the site can play and
 * show: a PlayableTrack queue for the audio engine, and a cover derived from the
 * first resolvable track's album art (used until a real banner is generated).
 *
 * The slots already carry the catalog `code` + track `n` (resolved at build
 * time), so this is a direct lookup — no uuid round-trip needed for playback.
 */

import type { PlayableTrack } from '@/components/audio/AudioProvider';
import { artUrl, mediaUrl, type CatalogAlbum } from '@/lib/angels';
import { allCatalogAlbums } from '@/lib/catalog';
import type { DefaultPlaylistSong } from '@/lib/default-playlists';

let albumByCode: Map<string, CatalogAlbum> | null = null;
function albums(): Map<string, CatalogAlbum> {
  if (!albumByCode) {
    albumByCode = new Map();
    for (const a of allCatalogAlbums()) albumByCode.set(a.code, a);
  }
  return albumByCode;
}

/** The catalog album + track a slot points at, if it still exists. */
export function resolveSong(song: Pick<DefaultPlaylistSong, 'code' | 'n'>) {
  const album = albums().get(song.code);
  if (!album) return null;
  const track = album.tracks.find((t) => t.n === song.n);
  if (!track) return null;
  return { album, track };
}

/** A playable queue from a default playlist's slots (skips anything unresolved). */
export function defaultPlaylistQueue(songs: DefaultPlaylistSong[]): PlayableTrack[] {
  const out: PlayableTrack[] = [];
  for (const s of songs) {
    const hit = resolveSong(s);
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
}

/** Cover art derived from the first resolvable track's album, or null. */
export function defaultPlaylistCover(songs: DefaultPlaylistSong[]): string | null {
  for (const s of songs) {
    const hit = resolveSong(s);
    if (hit?.album.art) return artUrl(hit.album.art);
  }
  return null;
}
