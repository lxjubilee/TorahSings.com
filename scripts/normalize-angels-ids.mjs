/**
 * Normalise album codes under J:\music\angels.
 *
 *   1. Resolve DUPLICATE codes: within a duplicate group, delete the folders
 *      that are completely empty (stale leftovers from a re-title), keeping the
 *      one that actually holds content. If more than one folder in a group has
 *      content, it is SKIPPED and reported — never guessed at.
 *   2. Zero-pad every code to 5 digits: ANSMX1001EN -> ANSMX01001EN, renaming
 *      the album folder and any code-named files inside it (e.g. artwork).
 *
 * Dry-run by default (prints the plan). Pass --apply to make changes.
 *
 *   node scripts/normalize-angels-ids.mjs            # preview
 *   node scripts/normalize-angels-ids.mjs --apply    # execute
 */
import { readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const APPLY = process.argv.includes('--apply');
const CODE_RE = /^(ANSMX)(\d+)(EN)$/;
const pad5 = (d) => d.padStart(5, '0');

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const listDirs = (p) => { try { return readdirSync(p).filter((n) => isDir(join(p, n))); } catch { return []; } };

function countFiles(p) {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else n += 1;
    }
  };
  walk(p);
  return n;
}

function scan() {
  const albums = [];
  for (const bookDir of listDirs(ROOT).sort()) {
    for (const albumDir of listDirs(join(ROOT, bookDir)).sort()) {
      const code = albumDir.split(' ')[0];
      const m = CODE_RE.exec(code);
      if (!m) continue;
      const path = join(ROOT, bookDir, albumDir);
      albums.push({ bookDir, albumDir, code, digits: m[2], path, files: countFiles(path) });
    }
  }
  return albums;
}

let deletes = 0, renames = 0, skips = 0, fileRenames = 0;
const act = (label) => console.log(`${APPLY ? 'APPLY ' : 'DRY   '}${label}`);

// ---- Phase 1: duplicates -------------------------------------------------
let albums = scan();
const groups = new Map();
for (const a of albums) {
  if (!groups.has(a.code)) groups.set(a.code, []);
  groups.get(a.code).push(a);
}

console.log('== Phase 1: duplicate resolution ==');
for (const [code, list] of groups) {
  if (list.length < 2) continue;
  const nonEmpty = list.filter((a) => a.files > 0);
  const empty = list.filter((a) => a.files === 0);

  if (nonEmpty.length > 1) {
    skips += 1;
    console.log(`  SKIP ${code}: ${nonEmpty.length} folders have content — resolve by hand:`);
    nonEmpty.forEach((a) => console.log(`         ${a.bookDir}/${a.albumDir} (${a.files} files)`));
    continue;
  }
  // keep the single non-empty (or, if all empty, the first); delete the rest-if-empty
  const keep = nonEmpty[0] ?? list[0];
  for (const a of list) {
    if (a === keep) continue;
    if (a.files !== 0) { skips += 1; console.log(`  SKIP delete (not empty): ${a.albumDir}`); continue; }
    act(`delete empty dup: ${a.bookDir}/${a.albumDir}`);
    deletes += 1;
    if (APPLY) {
      // re-verify empty right before removing
      if (countFiles(a.path) === 0) rmSync(a.path, { recursive: true, force: true });
      else console.log(`      ! became non-empty, skipped: ${a.path}`);
    }
  }
  console.log(`  keep ${code}: ${keep.albumDir} (${keep.files} files)`);
}

// ---- Phase 2: zero-pad to 5 digits --------------------------------------
albums = scan(); // re-scan after deletions
console.log('\n== Phase 2: zero-pad codes to 5 digits ==');
for (const a of albums) {
  if (a.digits.length === 5) continue;
  const newCode = `ANSMX${pad5(a.digits)}EN`;
  const newAlbumDir = a.albumDir.replace(a.code, newCode);
  const newPath = join(ROOT, a.bookDir, newAlbumDir);

  if (isDir(newPath)) { skips += 1; console.log(`  SKIP (target exists): ${newAlbumDir}`); continue; }

  act(`${a.bookDir}/  ${a.albumDir}  ->  ${newAlbumDir}`);
  renames += 1;
  if (APPLY) {
    try {
      renameSync(a.path, newPath);
      // rename any code-named files inside (e.g. artwork/ANSMX1001EN.png)
      const relFiles = [];
      const walk = (d, rel) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, e.name);
          if (e.isDirectory()) walk(full, join(rel, e.name));
          else if (e.name.startsWith(a.code)) relFiles.push([full, join(d, e.name.replace(a.code, newCode))]);
        }
      };
      walk(newPath, '');
      for (const [from, to] of relFiles) { renameSync(from, to); fileRenames += 1; console.log(`        file: ${from.split(/[\\/]/).pop()} -> ${to.split(/[\\/]/).pop()}`); }
    } catch (err) {
      skips += 1;
      console.log(`      ! rename failed (${err.code || err.message}) — likely a drive lock; retry later`);
    }
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${deletes} deletes · ${renames} folder renames · ${fileRenames} file renames · ${skips} skipped`);
if (!APPLY) console.log('Re-run with --apply to execute.');
