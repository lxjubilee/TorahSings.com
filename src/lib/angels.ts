/**
 * The "angels" music catalog — the real album tree under J:\music\angels,
 * scanned at build time into `src/content/angels-catalog.ts`.
 *
 * Books are grouped into the six canonical divisions shown on the home page
 * (Torah · Prophets · Writings · Gospels · Letters · Revelation). Albums whose
 * `tracks` array is non-empty have rendered audio; those mp3s are streamed from
 * the drive by the `/media/[...]` route handler and played through the footer.
 */

import type { PlayableTrack } from '@/components/audio/AudioProvider';

export interface CatalogTrack {
  n: number;
  title: string;
  /** Path relative to the angels music root, forward-slashed. */
  rel: string;
}

export interface CatalogAlbum {
  /** Album code, e.g. "ANSMX1001EN" — also the tile/queue id prefix. */
  code: string;
  title: string;
  /** Source book, e.g. "Genesis". */
  book: string;
  /** 1–66. */
  bookNum: number;
  /** 0–360, seeds the celestial art hue. */
  hue: number;
  /** A Hebrew watermark letter for the art. */
  glyph?: string;
  /** Cover-art URL (a build-time thumbnail of the album's /artwork image),
   *  or null when the album has no artwork — the tile falls back to celestial art. */
  art?: string | null;
  /** Rendered songs, in order. Empty when no audio has landed yet. */
  tracks: CatalogTrack[];
}

export interface CatalogCategory {
  id: string;
  title: string;
  blurb: string;
  albums: CatalogAlbum[];
}

/** Turn a drive-relative path into a URL the `/media` route handler serves. */
export function mediaUrl(rel: string): string {
  return '/media/' + rel.split('/').map(encodeURIComponent).join('/');
}

/** Every rendered song of an album, as a queue the audio engine can play. */
export function albumPlayables(album: CatalogAlbum): PlayableTrack[] {
  return album.tracks.map((t) => ({
    id: `${album.code}:${t.n}`,
    title: t.title,
    subtitle: album.title,
    src: mediaUrl(t.rel),
    seed: `${album.code}:${t.n}`,
    // Where the player's title / maximize button navigates: the album details page.
    href: `/album/${album.code}`,
  }));
}

export const hasAudio = (album: CatalogAlbum): boolean => album.tracks.length > 0;
