/**
 * The shipped default playlists — the on-disk half of
 * setup/playlist-functionality.md (Sections 2, 6).
 *
 * Two default types ship with the site: `Thematic` (shown as "Songs by Theme")
 * and `Emotional State` (shown as "For Your Season"). They live as one JSON file
 * per playlist under J:\TorahSings.com\playlists\, are seeded by
 * scripts/seed-default-playlists.mjs, and baked into src/content/default-playlists.ts
 * by scripts/build-default-playlists.mjs (production has no J: drive).
 *
 * The third type, "My Playlists", is per-user and comes from the database via
 * lib/playlists.ts — it is not part of this module.
 */

import { defaultPlaylists } from '@/content/default-playlists';

export type DefaultPlaylistType = 'Thematic' | 'Emotional State';

export interface AnchorVerse {
  reference: string;
  text: string;
}

export interface DefaultPlaylistSong {
  slot: number;
  /** Catalog album code — the stable id, resolved at build time. */
  code: string;
  /** Track number within the album. */
  n: number;
  /** Display album title (also what the Album dropdown shows). */
  album: string;
  /** Display track title. */
  track: string;
  /** Optional artist, shown italic beside the title when present (Section 5.4). */
  artist: string;
  /** Per-song mood/subject line shown inside the slot (Section 5.4). */
  description: string;
}

export interface DefaultPlaylist {
  id: string;
  title: string;
  type: DefaultPlaylistType;
  /** Single-line browse-row description (Section 4). */
  description: string;
  anchorVerse: AnchorVerse | null;
  imageAspectRatio: string;
  /** Generated banner file under \playlists\images\; blank until one exists. */
  linkedImage: string;
  journey: { isJourney: boolean; days: number | null; nextPlaylistId: string | null };
  surfacing: { timeOfDay: string[]; calendar: string[] };
  songCount: number;
  songs: DefaultPlaylistSong[];
}

/** Public section headings (Section 3) — internal type names are never shown. */
export const SECTION_HEADING: Record<DefaultPlaylistType, string> = {
  Thematic: 'Songs by Theme',
  'Emotional State': 'For Your Season',
};

/** All default playlists, in baked order (Thematic, then Emotional State). */
export function getDefaultPlaylists(): DefaultPlaylist[] {
  return defaultPlaylists;
}

/** Default playlists of one type, in order. */
export function defaultPlaylistsByType(type: DefaultPlaylistType): DefaultPlaylist[] {
  return defaultPlaylists.filter((p) => p.type === type);
}

/** One default playlist by id (matches its file name). */
export function getDefaultPlaylist(id: string): DefaultPlaylist | undefined {
  return defaultPlaylists.find((p) => p.id === id);
}

/** Ids, for static generation of the edit page. */
export function allDefaultPlaylistIds(): string[] {
  return defaultPlaylists.map((p) => p.id);
}

/**
 * Where a generated playlist banner is served from — the same CDN base the
 * article art uses, under /playlists/images/. Blank linkedImage → null, and the
 * caller falls back to a neutral placeholder / first-track album art.
 */
const IMAGE_BASE = (
  process.env.NEXT_PUBLIC_ARTICLE_IMAGE_BASE || 'https://cdn.jubileeverse.com/torahsings'
).replace(/\/+$/, '');

export function playlistImageUrl(linkedImage: string): string | null {
  if (!linkedImage) return null;
  return `${IMAGE_BASE}/playlists/images/${encodeURIComponent(linkedImage)}`;
}
