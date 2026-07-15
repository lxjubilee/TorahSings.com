/**
 * READ-ONLY audit of album codes under J:\music\angels.
 *  - flags codes not matching ANSMX<digits>EN
 *  - lists duplicate codes (the React "same key" bug)
 *  - shows which codes need zero-padding to 5 digits (ANSMX1001EN -> ANSMX01001EN)
 *  - checks whether padding alone resolves or creates collisions
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const dirs = (p) => { try { return readdirSync(p).filter((n) => isDir(join(p, n))); } catch { return []; } };

const CODE_RE = /^(ANSMX)(\d+)(EN)$/;
const pad5 = (digits) => digits.padStart(5, '0');

const albums = []; // { book, bookNum, albumDir, code, digits, ok }
for (const bookDir of dirs(ROOT).sort()) {
  const bm = /^(\d+)_/.exec(bookDir);
  const bookNum = bm ? Number(bm[1]) : null;
  for (const albumDir of dirs(join(ROOT, bookDir)).sort()) {
    const code = albumDir.split(' ')[0];
    const m = CODE_RE.exec(code);
    albums.push({
      book: bookDir,
      bookNum,
      albumDir,
      code,
      digits: m ? m[2] : null,
      ok: !!m,
    });
  }
}

console.log(`Total album folders: ${albums.length}`);

const bad = albums.filter((a) => !a.ok);
console.log(`\n== Codes NOT matching ANSMX<digits>EN: ${bad.length} ==`);
bad.forEach((a) => console.log(`  ${a.book} / ${a.albumDir}  (code="${a.code}")`));

const byCode = new Map();
for (const a of albums.filter((x) => x.ok)) {
  if (!byCode.has(a.code)) byCode.set(a.code, []);
  byCode.get(a.code).push(a);
}
const dups = [...byCode.entries()].filter(([, v]) => v.length > 1);
console.log(`\n== DUPLICATE current codes: ${dups.length} ==`);
for (const [code, list] of dups) {
  console.log(`  ${code}  (x${list.length}):`);
  list.forEach((a) => console.log(`      ${a.book} / ${a.albumDir}`));
}

const needPad = albums.filter((a) => a.ok && a.digits.length !== 5);
console.log(`\n== Codes needing pad to 5 digits: ${needPad.length} ==`);
const lenCounts = {};
albums.filter((a) => a.ok).forEach((a) => { lenCounts[a.digits.length] = (lenCounts[a.digits.length] || 0) + 1; });
console.log(`   digit-length distribution:`, lenCounts);

// After padding, do any NEW collisions appear?
const afterPad = new Map();
for (const a of albums.filter((x) => x.ok)) {
  const nc = `ANSMX${pad5(a.digits)}EN`;
  if (!afterPad.has(nc)) afterPad.set(nc, []);
  afterPad.get(nc).push(a);
}
const afterDups = [...afterPad.entries()].filter(([, v]) => v.length > 1);
console.log(`\n== DUPLICATES remaining AFTER padding to 5: ${afterDups.length} ==`);
for (const [code, list] of afterDups) {
  console.log(`  ${code}  (x${list.length}):`);
  list.forEach((a) => console.log(`      book ${String(a.bookNum).padStart(2, '0')} · ${a.albumDir}`));
}

// Cross-check: does the code's book-part match the folder's book number?
console.log(`\n== Code book-digits vs folder book number mismatches ==`);
let mism = 0;
for (const a of albums.filter((x) => x.ok)) {
  const padded = pad5(a.digits);
  const codeBook = Number(padded.slice(0, 2));
  if (a.bookNum != null && codeBook !== a.bookNum) {
    mism++;
    if (mism <= 25) console.log(`  folder book ${a.bookNum} but code says ${codeBook}: ${a.albumDir}`);
  }
}
console.log(`  total mismatches: ${mism}`);
