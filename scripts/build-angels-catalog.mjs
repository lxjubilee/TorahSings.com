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
 * Each track also carries its length in seconds, read here from the mp3 itself,
 * so the tracklist can print a running time without the browser fetching 300
 * files just to learn how long they are.
 *
 * Run: node scripts/build-angels-catalog.mjs
 */

import { closeSync, openSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const OUT = new URL('../src/content/angels-catalog.ts', import.meta.url);
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

/* ── mp3 length ──────────────────────────────────────────────────────────────
 * Layer III frame maths, straight from the spec — no decoder and no extra
 * dependency for what is a header read. Only the first 64 KB is loaded: enough
 * for the ID3v2 tag, the first frame, and the Xing/VBRI table a VBR encoder
 * writes there. A constant-bitrate file has no such table, so its length comes
 * from the audio byte count instead. Checked against ffprobe: within 0.05 s.
 */
const MPEG1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
// Keyed by the header's version bits: 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5.
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** ID3v2 sizes are 28-bit: the high bit of each byte is never used. */
const syncsafe = (b, o) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

/** Seconds of audio in an mp3, or null if no frame header could be found. */
function mp3Seconds(file) {
  let fd;
  try {
    const size = statSync(file).size;
    fd = openSync(file, 'r');
    const head = Buffer.alloc(Math.min(size, 1 << 16));
    readSync(fd, head, 0, head.length, 0);

    // Skip the ID3v2 tag, if any, so cover art isn't mistaken for a frame sync.
    let start = 0;
    if (head.length > 10 && head.toString('latin1', 0, 3) === 'ID3') {
      start = 10 + syncsafe(head, 6) + (head[5] & 0x10 ? 10 : 0); // + footer
    }

    for (let i = start; i + 4 <= head.length; i++) {
      if (head[i] !== 0xff || (head[i + 1] & 0xe0) !== 0xe0) continue; // frame sync
      const version = (head[i + 1] >> 3) & 3;
      const layer = (head[i + 1] >> 1) & 3;
      const rateIdx = (head[i + 2] >> 2) & 3;
      const brIdx = (head[i + 2] >> 4) & 15;
      // 1 = reserved version, layer 1 = Layer III, and free/bad bitrates are unusable.
      if (version === 1 || layer !== 1 || rateIdx === 3 || brIdx === 0 || brIdx === 15) continue;

      const mpeg1 = version === 3;
      const sampleRate = SAMPLE_RATES[version][rateIdx];
      const bitrate = (mpeg1 ? MPEG1_L3_KBPS : MPEG2_L3_KBPS)[brIdx] * 1000;
      const perFrame = mpeg1 ? 1152 : 576; // samples
      const mono = ((head[i + 3] >> 6) & 3) === 3;

      // VBR: a frame count beats any average. Xing sits after the side info,
      // whose width depends on version and channel mode; VBRI is always at +32.
      const xing = i + 4 + (mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17);
      const marker = xing + 8 <= head.length ? head.toString('latin1', xing, xing + 4) : '';
      if ((marker === 'Xing' || marker === 'Info') && head.readUInt32BE(xing + 4) & 1) {
        const frames = head.readUInt32BE(xing + 8);
        if (frames > 0) return (frames * perFrame) / sampleRate;
      }
      const vbri = i + 4 + 32;
      if (vbri + 18 <= head.length && head.toString('latin1', vbri, vbri + 4) === 'VBRI') {
        const frames = head.readUInt32BE(vbri + 14);
        if (frames > 0) return (frames * perFrame) / sampleRate;
      }

      // CBR: audio bytes ÷ bitrate. A trailing ID3v1 tag is 128 bytes of "TAG…".
      let end = size;
      if (size > 128) {
        const tail = Buffer.alloc(128);
        readSync(fd, tail, 0, 128, size - 128);
        if (tail.toString('latin1', 0, 3) === 'TAG') end = size - 128;
      }
      return ((end - i) * 8) / bitrate;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* already gone */
      }
    }
  }
}

// bucket id -> albums[]
const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));

let albumCount = 0;
let audioAlbumCount = 0;
let trackCount = 0;
let untimedCount = 0;
let artCount = 0;
// Defense-in-depth: even if the drive ever regrows a duplicate code, the app
// must never render two tiles with the same React key. First one wins.
const seenCodes = new Set();

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
        // An unreadable header costs the row its running time, nothing more —
        // the tracklist falls back to "--:--".
        const secs = mp3Seconds(join(tracksDir, f));
        if (secs === null) untimedCount += 1;
        return {
          n: tm ? Number(tm[1]) : 0,
          title: tm ? tm[2].trim() : f.replace(/\.mp3$/i, ''),
          rel: `${bookDir}/${albumDir}/tracks/${f}`,
          // Floored, as every player displays it — and the frame maths reads a
          // few hundredths high, so rounding up would print 4:33 for a 4:32 song.
          ...(secs === null ? {} : { secs: Math.floor(secs) }),
        };
      })
      .sort((a, b) => a.n - b.n)
      .map((t, i) => ({ ...t, n: t.n || i + 1 }));

    // Cover. Both the webp and the png of a cover sit in artwork/ and both ride
    // the same rclone sync to R2, so prefer the webp: same picture, ~6× lighter
    // (0.5 MB against 3 MB). An album with no artwork gets null and renders the
    // celestial-art placeholder — that is most of the catalogue.
    const artDir = join(ROOT, bookDir, albumDir, 'artwork');
    const artFiles = files(artDir).filter((f) => ART_RE.test(f));
    const artFile =
      artFiles.find((f) => f.toLowerCase() === `${code.toLowerCase()}.webp`) ||
      artFiles.find((f) => /\.webp$/i.test(f)) ||
      artFiles.find((f) => f.startsWith(code)) ||
      artFiles[0] ||
      null;

    const h = hashOf(code);
    const album = {
      code,
      title,
      book,
      bookNum,
      hue: h % 360,
      glyph: ALEPHBET[h % ALEPHBET.length],
      art: artFile ? `${bookDir}/${albumDir}/artwork/${artFile}` : null,
      tracks,
    };
    byCategory[cat].push(album);
    if (artFile) artCount += 1;

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

const header = `// AUTO-GENERATED by scripts/build-angels-catalog.mjs — do not edit by hand.
// Source: ${ROOT}
// ${albumCount} albums · ${audioAlbumCount} with audio · ${artCount} with cover art · ${trackCount} tracks.
import type { CatalogCategory } from '@/lib/angels';

export const angelsCatalog: CatalogCategory[] = `;

writeFileSync(OUT, header + JSON.stringify(catalog, null, 2) + ';\n', 'utf8');

console.log(
  `Wrote ${OUT.pathname.replace(/^\//, '')}\n` +
    `  ${albumCount} albums · ${audioAlbumCount} with audio · ${artCount} with cover art · ${trackCount} tracks` +
    (untimedCount ? `\n  ! ${untimedCount} track(s) had no readable length — those rows show --:--` : ''),
);
for (const c of catalog) {
  const withAudio = c.albums.filter((a) => a.tracks.length).length;
  console.log(`  ${c.title.padEnd(12)} ${String(c.albums.length).padStart(3)} albums (${withAudio} with audio)`);
}
