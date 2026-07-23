import { completionDates } from '@/content/completion-dates';
import { angelsCatalog } from '@/content/angels-catalog';
import { hasAudio } from './angels';

/**
 * Production History — weekly output against a target.
 *
 * Every live album is bucketed by the US workweek (Sunday–Saturday, Pacific) in
 * which it was completed. Completion dates come from the studio drive and never
 * move, so a past week's figures are permanent by construction rather than by
 * being frozen.
 *
 * Pure computation over two generated modules — no API, no fetch.
 */

/**
 * PLACEHOLDER. The weekly target has not been set for Torah Sings. These are
 * Jubilujah's numbers scaled to the cadence actually observed on the drive
 * (~90 albums a week at peak, ~6 songs an album). Confirm them with the studio
 * before treating a score as a verdict — every percentage on the page is
 * relative to these two constants and nothing else.
 */
export const ALBUM_QUOTA = 90;
export const SONG_QUOTA = 560;

export interface WeekRow {
  /** Two-digit year + two-digit US week, e.g. "2629". */
  yyww: string;
  year: number;
  week: number;
  rangeLabel: string;
  albums: number;
  songs: number;
  albumPct: number;
  songPct: number;
  quotaScore: number;
  cumAlbums: number;
  cumSongs: number;
  isCurrent: boolean;
}

/** Pacific calendar date for an instant — the studio's working day. */
function pacificYMD(iso: string): { y: number; m: number; day: number } {
  const s = new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [m, day, y] = s.split(/[/,\s]+/).map((x) => parseInt(x, 10));
  return { y, m, day };
}

const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

function dayOfYear(y: number, m: number, d: number): number {
  const days = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = d;
  for (let i = 0; i < m - 1; i++) n += days[i];
  return n;
}

/** 0 = Sunday. */
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** US week number (strftime %U): week 1 starts on the first Sunday. */
function usWeek(y: number, m: number, d: number): number {
  const doy = dayOfYear(y, m, d);
  const firstSunday = 1 + ((7 - dow(y, 1, 1)) % 7);
  const weekStart = doy - dow(y, m, d);
  if (weekStart < firstSunday) return 0;
  return Math.floor((weekStart - firstSunday) / 7) + 1;
}

const yywwOf = (y: number, w: number) => String(y).slice(-2) + String(w).padStart(2, '0');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekRange(y: number, w: number): { start: Date; end: Date } {
  const firstSunday = 1 + ((7 - dow(y, 1, 1)) % 7);
  const startDoy = w === 0 ? 1 : firstSunday + (w - 1) * 7;
  return {
    start: new Date(Date.UTC(y, 0, startDoy)),
    end: new Date(Date.UTC(y, 0, startDoy + 6)),
  };
}

export interface ProductionHistory {
  weeks: WeekRow[];
  totalLiveAlbums: number;
  totalLiveSongs: number;
  /** Live albums the drive has no completion date for — excluded from the weeks. */
  undated: number;
  currentYyww: string;
}

export function productionHistory(): ProductionHistory {
  const live = angelsCatalog
    .flatMap((c) => c.albums)
    .filter(hasAudio)
    .map((a) => ({ code: a.code, songs: a.tracks.length }));

  const totalLiveAlbums = live.length;
  const totalLiveSongs = live.reduce((s, a) => s + a.songs, 0);

  const buckets = new Map<string, { y: number; w: number; albums: number; songs: number }>();
  let undated = 0;

  for (const album of live) {
    const iso = completionDates[album.code];
    // An album with no completion date is still live; it simply cannot be
    // attributed to a week. Counting it in a week would invent a date.
    if (!iso) {
      undated += 1;
      continue;
    }
    const { y, m, day } = pacificYMD(iso);
    const w = usWeek(y, m, day);
    const key = yywwOf(y, w);
    const b = buckets.get(key) ?? { y, w, albums: 0, songs: 0 };
    b.albums += 1;
    b.songs += album.songs;
    buckets.set(key, b);
  }

  const today = pacificYMD(new Date().toISOString());
  const currentYyww = yywwOf(today.y, usWeek(today.y, today.m, today.day));

  let cumAlbums = 0;
  let cumSongs = 0;
  const rows = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, b]) => {
      cumAlbums += b.albums;
      cumSongs += b.songs;
      const { start, end } = weekRange(b.y, b.w);
      const albumPct = Math.round((b.albums / ALBUM_QUOTA) * 100);
      const songPct = Math.round((b.songs / SONG_QUOTA) * 100);
      return {
        yyww: key,
        year: b.y,
        week: b.w,
        rangeLabel: `${MON[start.getUTCMonth()]} ${start.getUTCDate()} – ${MON[end.getUTCMonth()]} ${end.getUTCDate()}, ${b.y}`,
        albums: b.albums,
        songs: b.songs,
        albumPct,
        songPct,
        quotaScore: Math.round((albumPct + songPct) / 2),
        cumAlbums,
        cumSongs,
        isCurrent: key === currentYyww,
      };
    });

  rows.reverse(); // newest first
  return { weeks: rows, totalLiveAlbums, totalLiveSongs, undated, currentYyww };
}
