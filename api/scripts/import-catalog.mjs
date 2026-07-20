// ============================================================================
// Catalog importer — mirrors src/content/angels-catalog.ts into catalog.* using
// the deterministic UUIDv5 mapping (src/ids.js), so tables that store a derived
// album/song id can join to real catalog rows.
//
// Adapted from JubiLujah's db/import-catalog.js. Same contract: the catalog file
// stays the source of truth for browsing; this is a one-way mirror, safe to
// re-run (idempotent via ON CONFLICT).
//
// It exists because production.user_playlist_items.song_id has a FOREIGN KEY to
// catalog.songs(id) — playlists cannot store anything until the songs are here.
// Ratings and likes don't need it (they're polymorphic with no FK).
//
//   node scripts/import-catalog.mjs --dry     # report only, write nothing
//   node scripts/import-catalog.mjs           # apply
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { albumUuid, songUuid } from '../src/ids.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const CATALOG = path.join(__dirname, '..', '..', 'src', 'content', 'angels-catalog.ts');
const DRY = process.argv.includes('--dry');

// The catalog is auto-generated with JSON-quoted keys, so the array literal
// parses directly once the TypeScript wrapper is sliced off.
function readCatalog() {
  const src = fs.readFileSync(CATALOG, 'utf8');
  // Start AFTER the `=`, otherwise the empty brackets in the type annotation
  // (`: CatalogCategory[] =`) are matched instead of the array literal.
  const decl = src.indexOf('angelsCatalog');
  const eq = src.indexOf('=', decl);
  const start = src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  if (decl < 0 || eq < 0 || start < 0 || end < 0) {
    throw new Error('could not locate the angelsCatalog array literal');
  }
  return JSON.parse(src.slice(start, end + 1));
}

// One artist for the whole catalog — the album pages already credit
// "Sung by the Angels", and catalog.albums.artist_id is NOT NULL.
const ARTIST = { slug: 'sung-by-the-angels', name: 'Sung by the Angels', grouping: 'other_initiatives' };

async function main() {
  const categories = readCatalog();
  const albums = categories.flatMap((c) => c.albums || []);
  const trackCount = albums.reduce((n, a) => n + (a.tracks?.length || 0), 0);
  console.log(`catalog file: ${categories.length} categories, ${albums.length} albums, ${trackCount} tracks`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const before = await counts(client);
  console.log(`before: artists=${before.artists} albums=${before.albums} songs=${before.songs}`);

  if (DRY) {
    console.log('--dry: nothing written.');
    await client.end();
    return;
  }

  try {
    await client.query('BEGIN');

    const artist = await client.query(
      `INSERT INTO catalog.artists (slug, display_name, grouping)
            VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id`,
      [ARTIST.slug, ARTIST.name, ARTIST.grouping],
    );
    const artistId = artist.rows[0].id;

    let albumsWritten = 0;
    let songsWritten = 0;

    for (const album of albums) {
      const id = albumUuid(album.code);
      await client.query(
        `INSERT INTO catalog.albums (id, artist_id, slug, title, is_published)
              VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
        [id, artistId, String(album.code).toLowerCase(), album.title],
      );
      albumsWritten += 1;

      for (const t of album.tracks || []) {
        await client.query(
          `INSERT INTO catalog.songs (id, album_id, track_number, title)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
          [songUuid(album.code, t.n), id, t.n, t.title],
        );
        songsWritten += 1;
      }
    }

    await client.query('COMMIT');
    console.log(`upserted: ${albumsWritten} albums, ${songsWritten} songs`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const after = await counts(client);
  console.log(`after:  artists=${after.artists} albums=${after.albums} songs=${after.songs}`);
  await client.end();
}

async function counts(client) {
  const q = async (t) => Number((await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n);
  return { artists: await q('catalog.artists'), albums: await q('catalog.albums'), songs: await q('catalog.songs') };
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
