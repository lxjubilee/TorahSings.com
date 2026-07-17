// TorahSings "status" — angel album coverage across all 66 books.
//
//   npm run status          (or: node scripts/status.mjs)
//   ANGELS_ROOT=/path node scripts/status.mjs
//
// Prints one row per book — empty books included, `·` for zero — counting albums
// that have lyrics / .mp3 / a proof .md, and how many have all three.
//
// Notes that matter if you change this:
//   * ONE directory walk. J: is a mapped SMB drive; repeated walks are slow.
//   * lyrics is one combined .md per ALBUM, not per song.
//   * every song declares its title twice (`SONG TITLE:` and `Song Title:`) —
//     dedupe or counts double. Blueprint counts are NOT a reliable song count.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';

// Walk once — J: is a mapped SMB drive, so repeated walks are slow.
function walk(dir, rel = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else if (/\.(md|mp3)$/i.test(e.name)) out.push(r);
  }
  return out;
}
const lines = walk(ROOT);
const allBooks = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d\d_/.test(e.name)).map((e) => e.name).sort();

// book -> album -> counts
const books = new Map();
for (const p of lines) {
  const parts = p.split('/');
  if (parts.length < 3) continue;
  const [book, album] = parts;
  if (!/^\d\d_/.test(book)) continue;
  if (!books.has(book)) books.set(book, new Map());
  const albums = books.get(book);
  if (!albums.has(album)) albums.set(album, { lyrics: 0, mp3: 0, proof: 0, lyrFile: null });
  const a = albums.get(album);
  const sub = parts[2];
  const file = parts[parts.length - 1].toLowerCase();
  if (file.endsWith('.mp3')) a.mp3++;
  else if (sub === 'lyrics' && file.endsWith('.md')) { a.lyrics++; a.lyrFile = p; }
  else if (sub === 'proof' && file.endsWith('.md')) a.proof++;
}

// Songs per album come from the lyrics .md, which is ONE combined file per album.
// Each song declares its title twice (SONG TITLE: and Song Title:) — dedupe or the
// count doubles. Blueprint counts are NOT a reliable song count (stale files exist).
function songCount(lyrFile) {
  if (!lyrFile) return 0;
  try {
    const txt = fs.readFileSync(path.join(ROOT, lyrFile), 'utf8');
    const titles = new Set(
      (txt.match(/^SONG TITLE:\s*(.+)$/gim) || []).map((s) => s.replace(/^SONG TITLE:\s*/i, '').trim().toLowerCase())
    );
    return titles.size;
  } catch { return 0; }
}

const rows = [];
const T = { albums: 0, lyrics: 0, mp3: 0, proof: 0, all3: 0 };
const partial = [];

for (const book of allBooks) {
  const albums = books.get(book) || new Map();
  let lyrics = 0, mp3 = 0, proof = 0, all3 = 0;
  for (const [name, a] of albums) {
    if (a.lyrics > 0) lyrics++;
    if (a.mp3 > 0) mp3++;
    if (a.proof > 0) proof++;
    if (a.lyrics > 0 && a.mp3 > 0 && a.proof > 0) all3++;
    if (a.mp3 > 0) {
      const s = songCount(a.lyrFile);
      if (s > 0 && a.mp3 < s) partial.push(`${book}/${name}  ${a.mp3}/${s}`);
    }
  }
  rows.push({ num: book.slice(0, 2), book: book.replace(/^\d\d_/, ''), n: albums.size, lyrics, mp3, proof, all3 });
  T.albums += albums.size; T.lyrics += lyrics; T.mp3 += mp3; T.proof += proof; T.all3 += all3;
}

const pad = (s, w) => String(s).padEnd(w);
const rp = (s, w) => String(s).padStart(w);
const dash = (v) => (v === 0 ? '·' : v);

console.log('');
console.log('   #   Book                 Albums  Lyrics   MP3   Proof   All 3');
console.log('  ──────────────────────────────────────────────────────────────');
let section = '';
for (const r of rows) {
  const n = Number(r.num);
  const s = n <= 39 ? 'OLD TESTAMENT' : 'NEW TESTAMENT';
  if (s !== section) { section = s; console.log(`  ── ${s} ${'─'.repeat(46 - s.length)}`); }
  console.log(`   ${pad(r.num, 4)}${pad(r.book, 20)}${rp(dash(r.n), 6)}${rp(dash(r.lyrics), 8)}${rp(dash(r.mp3), 6)}${rp(dash(r.proof), 8)}${rp(dash(r.all3), 8)}`);
}
console.log('  ──────────────────────────────────────────────────────────────');
console.log(`   ${pad('', 4)}${pad(`TOTAL (${rows.length} books)`, 20)}${rp(T.albums, 6)}${rp(T.lyrics, 8)}${rp(T.mp3, 6)}${rp(T.proof, 8)}${rp(T.all3, 8)}`);

const empty = rows.filter((r) => r.n === 0);
console.log(`\n  · = zero.  Books with no albums yet: ${empty.length} of ${rows.length}.`);
console.log(`  Audio albums fully tracked: ${T.mp3 - partial.length} of ${T.mp3} — ${partial.length} are missing tracks:`);
partial.forEach((p) => console.log('    ' + p));
