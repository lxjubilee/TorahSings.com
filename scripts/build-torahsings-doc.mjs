/**
 * Generate /TorahSings.md — a human-readable catalog of every music album and
 * the book + chapters it covers.
 *
 * Album list & titles come from the live folders on J:\music\angels (so they
 * match the website); the book/chapter range and theme for each album come from
 * that book's ~index.md "Arc" column, joined by (book number, album number).
 *
 *   node scripts/build-torahsings-doc.mjs
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const OUT = join(process.cwd(), 'TorahSings.md');

const CATEGORIES = [
  { id: 'torah', title: 'Torah', blurb: 'The Five Books — Genesis through Deuteronomy.' },
  { id: 'prophets', title: 'Prophets', blurb: 'The Former and Latter Prophets — Joshua through Malachi.' },
  { id: 'writings', title: 'Writings', blurb: 'The Ketuvim — Psalms, the wisdom books, and the scrolls.' },
  { id: 'gospels', title: 'Gospels', blurb: 'The four Gospels and the Acts of the Apostles.' },
  { id: 'letters', title: 'Letters', blurb: 'The Epistles — Romans through Jude.' },
  { id: 'revelation', title: 'Revelation', blurb: 'The Unveiling.' },
];

function categoryOf(n) {
  if (n >= 1 && n <= 5) return 'torah';
  if ([6, 7, 9, 10, 11, 12, 23, 24, 26].includes(n) || (n >= 28 && n <= 39)) return 'prophets';
  if ([8, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 27].includes(n)) return 'writings';
  if (n >= 40 && n <= 44) return 'gospels';
  if (n >= 45 && n <= 65) return 'letters';
  if (n === 66) return 'revelation';
  return null;
}

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const listDirs = (p) => { try { return readdirSync(p).filter((n) => isDir(join(p, n))); } catch { return []; } };
const CODE_RE = /^ANSMX(\d+)EN$/;

/** "09_1Samuel" -> "1 Samuel", "22_SongOfSongs" -> "Song of Songs". */
const prettyBook = (raw) =>
  raw
    .replace(/^(\d)([A-Za-z])/, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bOf\b/g, 'of');

/** Album number = last three digits of the code; book number = the rest. */
function codeParts(code) {
  const m = CODE_RE.exec(code);
  if (!m) return null;
  const digits = m[1];
  return { bookNum: Number(digits.slice(0, -3)), albumNum: digits.slice(-3) };
}

// Parse a book's ~index.md into a map: albumNum -> { chapters, theme, songs }.
function parseIndex(bookDir, prettyName) {
  const p = join(ROOT, bookDir, '~index.md');
  const map = new Map();
  if (!isFile(p)) return map;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!/^\|\s*ANSMX/.test(line)) continue;
    const cols = line.split('|').map((c) => c.trim());
    // | code | album | arc | songs | status |
    const code = cols[1];
    const arc = cols[3] || '';
    const songs = Number.parseInt(cols[4], 10);
    const parts = codeParts(code);
    if (!parts) continue;

    // Trailing "(...)" of the arc is the scripture ref; the rest is the theme.
    const paren = arc.match(/\(([^)]*)\)\s*$/);
    const ref = paren ? paren[1] : null;
    const theme = arc.replace(/\s*\([^)]*\)\s*$/, '').trim();

    // Pull the trailing chapter/verse range from the ref (anchored to the end,
    // so a numbered book like "1 Chron 1–9" or "2 Kgs 1–8" keeps just "1–9").
    const cm = ref && ref.match(/(\d+(?::\d+)?(?:\s*[–—-]\s*\d+(?::\d+)?)?)\s*$/);
    let covers = prettyName;
    if (cm) {
      covers += ` ${cm[1]}`;
      if (theme) covers += ` · ${theme}`;
    } else {
      // no chapter range (e.g. a distribution album) — lead with the theme,
      // keep any non-scripture note as a trailing parenthetical.
      if (theme) covers += ` · ${theme}`;
      if (ref) covers += ` (${ref})`;
    }

    map.set(parts.albumNum, { covers, songs: Number.isFinite(songs) ? songs : null });
  }
  return map;
}

function mp3Count(albumPath) {
  const tracks = join(albumPath, 'tracks');
  try {
    return readdirSync(tracks).filter((f) => f.toLowerCase().endsWith('.mp3')).length;
  } catch {
    return 0;
  }
}

// ---- walk books & albums -------------------------------------------------
const books = new Map(); // bookNum -> { name, pretty, albums: [] }
let totalAlbums = 0;
let totalAudio = 0;

for (const bookDir of listDirs(ROOT).sort()) {
  const bm = /^(\d+)_(.+)$/.exec(bookDir);
  if (!bm) continue;
  const bookNum = Number(bm[1]);
  const pretty = prettyBook(bm[2]);
  const idx = parseIndex(bookDir, pretty);

  const albums = [];
  for (const albumDir of listDirs(join(ROOT, bookDir)).sort()) {
    const code = albumDir.split(' ')[0];
    const parts = codeParts(code);
    if (!parts) continue;
    const title = albumDir.slice(code.length).trim() || code;
    const audio = mp3Count(join(ROOT, bookDir, albumDir));
    const meta = idx.get(parts.albumNum) || {};
    albums.push({
      code,
      title,
      albumNum: parts.albumNum,
      covers: meta.covers || `${pretty} · (chapters TBD)`,
      songs: meta.songs ?? (audio || null),
      audio: audio > 0,
    });
    totalAlbums += 1;
    if (audio > 0) totalAudio += 1;
  }
  albums.sort((a, b) => a.albumNum.localeCompare(b.albumNum));
  books.set(bookNum, { name: bm[2], pretty, albums });
}

// ---- emit markdown -------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const esc = (s) => s.replace(/\|/g, '\\|');
const out = [];

out.push('# Torah Sings — Album Catalog');
out.push('');
out.push(
  'Every music album in the Torah Sings library, with the book and chapters each album ' +
    'draws its songs from, and its narrative arc. Albums are grouped into the six divisions ' +
    'shown on the home page. **♪** marks albums whose audio has been rendered (playable on the site).',
);
out.push('');
out.push(
  `*Generated from \`J:\\music\\angels\` — ${totalAlbums} albums across 66 books · ` +
    `${totalAudio} with audio · ${today}. Regenerate with \`node scripts/build-torahsings-doc.mjs\`.*`,
);
out.push('');

// contents
out.push('| Division | Books | Albums |');
out.push('|---|---|---|');
for (const cat of CATEGORIES) {
  const nums = [...books.keys()].filter((n) => categoryOf(n) === cat.id).sort((a, b) => a - b);
  const albumTotal = nums.reduce((s, n) => s + books.get(n).albums.length, 0);
  const bookNames = nums.map((n) => books.get(n).pretty).join(', ');
  out.push(`| [${cat.title}](#${cat.id}) | ${bookNames} | ${albumTotal} |`);
}
out.push('');

for (const cat of CATEGORIES) {
  const nums = [...books.keys()].filter((n) => categoryOf(n) === cat.id).sort((a, b) => a - b);
  const albumTotal = nums.reduce((s, n) => s + books.get(n).albums.length, 0);
  out.push('---');
  out.push('');
  out.push(`## ${cat.title}`);
  out.push('');
  out.push(`*${cat.blurb} — ${albumTotal} albums.*`);
  out.push('');

  for (const n of nums) {
    const b = books.get(n);
    if (!b.albums.length) continue;
    out.push(`### ${b.pretty} · ${b.albums.length} ${b.albums.length === 1 ? 'album' : 'albums'}`);
    out.push('');
    out.push('| Code | Album | Covers | Songs |');
    out.push('|---|---|---|---|');
    for (const a of b.albums) {
      const name = `${esc(a.title)}${a.audio ? ' ♪' : ''}`;
      out.push(`| ${a.code} | ${name} | ${esc(a.covers)} | ${a.songs ?? '—'} |`);
    }
    out.push('');
  }
}

writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(`Wrote ${OUT}\n  ${totalAlbums} albums · ${totalAudio} with audio`);
