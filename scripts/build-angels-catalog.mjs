/**
 * Scan the angels music tree and emit src/content/angels-catalog.ts.
 *
 *   J:\music\angels\{NN}_{Book}\{CODE} {Album Title}\tracks\{NN Song}.mp3
 *
 * Books are bucketed into the six home-page divisions. Every album folder is
 * catalogued (title from the folder name); mp3s found under an album's tracks/
 * folder become its playable songs, stored as drive-relative paths that the
 * /media route handler streams at runtime.
 *
 * Run: node scripts/build-angels-catalog.mjs
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const OUT = new URL('../src/content/angels-catalog.ts', import.meta.url);
// Resized cover thumbnails land here (served statically from /angels/art/...).
const ART_OUT = join(process.cwd(), 'public', 'angels', 'art');
const ART_RE = /\.(png|jpe?g|webp)$/i;

const CATEGORIES = [
  { id: 'torah', title: 'Torah', blurb: 'The Five Books — Genesis through Deuteronomy.' },
  { id: 'prophets', title: 'Prophets', blurb: 'The Former and Latter Prophets — Joshua through Malachi.' },
  { id: 'writings', title: 'Writings', blurb: 'The Ketuvim — Psalms, the wisdom books, and the scrolls.' },
  { id: 'gospels', title: 'Gospels', blurb: 'The four Gospels and the Acts of the Apostles.' },
  { id: 'letters', title: 'Letters', blurb: 'The Epistles — Romans through Jude.' },
  { id: 'revelation', title: 'Revelation', blurb: 'The Unveiling.' },
];

const ALEPHBET = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];

function categoryOf(n) {
  if (n >= 1 && n <= 5) return 'torah';
  if ([6, 7, 9, 10, 11, 12, 23, 24, 26].includes(n) || (n >= 28 && n <= 39)) return 'prophets';
  if ([8, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 27].includes(n)) return 'writings';
  if (n >= 40 && n <= 44) return 'gospels';
  if (n >= 45 && n <= 65) return 'letters';
  if (n === 66) return 'revelation';
  return null;
}

function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const dirs = (p) => {
  try {
    return readdirSync(p).filter((name) => {
      try {
        return statSync(join(p, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};

const files = (p) => {
  try {
    return readdirSync(p).filter((name) => {
      try {
        return statSync(join(p, name)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};

// bucket id -> albums[]
const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));

let albumCount = 0;
let audioAlbumCount = 0;
let trackCount = 0;
// Defense-in-depth: even if the drive ever regrows a duplicate code, the app
// must never render two tiles with the same React key. First one wins.
const seenCodes = new Set();
// Albums with an /artwork image → {album, src} to thumbnail after the walk.
const artJobs = [];

for (const bookDir of dirs(ROOT).sort()) {
  const m = /^(\d+)_(.+)$/.exec(bookDir);
  if (!m) continue;
  const bookNum = Number(m[1]);
  const book = m[2];
  const cat = categoryOf(bookNum);
  if (!cat) continue;

  for (const albumDir of dirs(join(ROOT, bookDir)).sort()) {
    // "ANSMX1001EN The Morning Stars Sang" -> code + title
    const sp = albumDir.indexOf(' ');
    const code = sp === -1 ? albumDir : albumDir.slice(0, sp);
    const title = sp === -1 ? albumDir : albumDir.slice(sp + 1).trim();

    if (seenCodes.has(code)) {
      console.warn(`  ! duplicate code skipped: ${code}  (${bookDir}/${albumDir})`);
      continue;
    }
    seenCodes.add(code);

    const tracksDir = join(ROOT, bookDir, albumDir, 'tracks');
    const tracks = files(tracksDir)
      .filter((f) => f.toLowerCase().endsWith('.mp3'))
      .map((f) => {
        const tm = /^(\d+)[\s._-]+(.+)\.mp3$/i.exec(f);
        return {
          n: tm ? Number(tm[1]) : 0,
          title: tm ? tm[2].trim() : f.replace(/\.mp3$/i, ''),
          rel: `${bookDir}/${albumDir}/tracks/${f}`,
        };
      })
      .sort((a, b) => a.n - b.n)
      .map((t, i) => ({ ...t, n: t.n || i + 1 }));

    const artDir = join(ROOT, bookDir, albumDir, 'artwork');
    const artFiles = files(artDir).filter((f) => ART_RE.test(f));
    const artFile = artFiles.find((f) => f.startsWith(code)) || artFiles[0] || null;

    const h = hashOf(code);
    const album = {
      code,
      title,
      book,
      bookNum,
      hue: h % 360,
      glyph: ALEPHBET[h % ALEPHBET.length],
      art: null,
      tracks,
    };
    byCategory[cat].push(album);
    if (artFile) artJobs.push({ album, src: join(artDir, artFile) });

    albumCount += 1;
    if (tracks.length) audioAlbumCount += 1;
    trackCount += tracks.length;
  }
}

const catalog = CATEGORIES.map((c) => ({
  id: c.id,
  title: c.title,
  blurb: c.blurb,
  albums: byCategory[c.id].sort((a, b) => a.bookNum - b.bookNum || a.code.localeCompare(b.code)),
}));

// Build cover thumbnails from each album's /artwork image (heavy PNGs → light webp).
let artCount = 0;
if (artJobs.length) {
  mkdirSync(ART_OUT, { recursive: true });
  for (const { album, src } of artJobs) {
    const outName = `${album.code}.webp`;
    try {
      await sharp(src)
        .resize(500, 500, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80 })
        .toFile(join(ART_OUT, outName));
      album.art = `/angels/art/${outName}`;
      artCount += 1;
    } catch (err) {
      console.warn(`  ! artwork thumbnail failed for ${album.code}: ${err.message}`);
    }
  }
}

const header = `// AUTO-GENERATED by scripts/build-angels-catalog.mjs — do not edit by hand.
// Source: ${ROOT}
// ${albumCount} albums · ${audioAlbumCount} with audio · ${artCount} with cover art · ${trackCount} tracks.
import type { CatalogCategory } from '@/lib/angels';

export const angelsCatalog: CatalogCategory[] = `;

writeFileSync(OUT, header + JSON.stringify(catalog, null, 2) + ';\n', 'utf8');

console.log(
  `Wrote ${OUT.pathname.replace(/^\//, '')}\n` +
    `  ${albumCount} albums · ${audioAlbumCount} with audio · ${artCount} with cover art · ${trackCount} tracks`,
);
for (const c of catalog) {
  const withAudio = c.albums.filter((a) => a.tracks.length).length;
  console.log(`  ${c.title.padEnd(12)} ${String(c.albums.length).padStart(3)} albums (${withAudio} with audio)`);
}
