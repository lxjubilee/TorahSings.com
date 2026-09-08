#!/usr/bin/env node
/**
 * seed-default-playlists — author the shipped default playlists on the J: drive.
 *
 * Implements the on-disk half of setup/playlist-functionality.md (Section 6):
 * one .json file per playlist under J:\TorahSings.com\playlists\, each carrying
 * the full schema (identity, browse-row copy, image fields, enhancement data,
 * and a song list of real catalog tracks).
 *
 * The song slots are auto-filled by theme/feeling from the real catalog so every
 * slot resolves to a playable track. Slots store album + track *titles* (the
 * human-editable, spec-compliant shape); scripts/build-default-playlists.mjs
 * re-resolves those titles back to catalog code/n when it bakes the content.
 *
 *   node scripts/seed-default-playlists.mjs           # write any that are missing
 *   node scripts/seed-default-playlists.mjs --force   # overwrite existing files
 *
 * This never runs in production and is only re-run when the default set changes.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.PLAYLISTS_ROOT || 'J:/torahsings.com/playlists';
const CATALOG_TS = new URL('../src/content/angels-catalog.ts', import.meta.url);
const FORCE = process.argv.includes('--force');
const SONG_COUNT = 36;

// ---- read the baked catalog (export const angelsCatalog = <JSON>;) -----------
function loadCatalog() {
  const src = readFileSync(CATALOG_TS, 'utf8');
  const start = src.indexOf('= [') + 2;
  const end = src.lastIndexOf(']');
  const categories = JSON.parse(src.slice(start, end + 1));
  const albums = categories.flatMap((c) => c.albums).filter((a) => a.tracks && a.tracks.length);
  const songs = [];
  for (const a of albums) {
    for (const t of a.tracks) {
      songs.push({ album: a.title, book: a.book, track: t.title, code: a.code, n: t.n });
    }
  }
  return { albums, songs };
}

const { songs } = loadCatalog();

// Deterministic shuffle (no Math.random — keeps reseeds stable), seeded per name.
function seededPick(pool, count, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = (h ^ seedStr.charCodeAt(i)) * 16777619 >>> 0;
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 48271) % 2147483647;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

const kw = (words) => (s) => {
  const t = s.track.toLowerCase();
  return words.some((w) => t.includes(w));
};

// Fill exactly SONG_COUNT slots: theme matches first, then a deterministic
// top-up from the whole catalog so no default ships short.
function fillSongs(id, match, book) {
  const seen = new Set();
  const chosen = [];
  const add = (list) => {
    for (const s of list) {
      const key = `${s.code}:${s.n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chosen.push(s);
      if (chosen.length >= SONG_COUNT) return;
    }
  };
  if (book) add(seededPick(songs.filter((s) => s.book === book), SONG_COUNT, id + ':book'));
  if (match) add(seededPick(songs.filter(match), SONG_COUNT, id + ':kw'));
  if (chosen.length < SONG_COUNT) add(seededPick(songs, SONG_COUNT, id + ':fill'));
  return chosen.slice(0, SONG_COUNT).map((s, i) => ({
    slot: i + 1,
    album: s.album,
    track: s.track,
    artist: '',
    description: descFor(s),
  }));
}

// A short, invitation-over-information mood line for a slot (Section 4/5.4).
function descFor(s) {
  return `From “${s.album}.”`;
}

const PLAYLISTS = [
  // ---- Thematic ("Songs by Theme") ----------------------------------------
  {
    id: 'songs-from-genesis',
    title: 'Songs from Genesis',
    type: 'Thematic',
    description: 'Creation, covenant, and the first promises — straight from the beginning.',
    anchorVerse: { reference: 'Genesis 1:1', text: 'In the beginning, Elohim created the heavens and the earth.' },
    imagePrompt: 'A joyful, diverse family of all ages standing together at a golden sunrise over an open wild landscape, faces lit with wonder and hope, real warmth and movement, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['morning'], calendar: [] },
    book: 'Genesis',
    match: null,
  },
  {
    id: 'the-blood-of-yeshua',
    title: 'The Blood of Yeshua',
    type: 'Thematic',
    description: 'Songs of redemption, the lamb, and the price that bought us back.',
    anchorVerse: { reference: 'Leviticus 17:11', text: 'The life of the flesh is in the blood; it is the blood that makes atonement.' },
    imagePrompt: 'A diverse crowd of worshippers embracing one another with tears of relief and gratitude, warm crimson and gold light breaking over them, genuine emotion, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['evening'], calendar: ['passover'] },
    book: null,
    match: kw(['blood', 'lamb', 'cross', 'atone', 'ransom', 'redeem', 'mercy', 'sacrifice']),
  },
  {
    id: 'the-names-of-yahuah',
    title: 'The Names of Yahuah',
    type: 'Thematic',
    description: 'Every name a doorway into who He is.',
    anchorVerse: { reference: 'Exodus 34:6', text: 'Yahuah, Yahuah, a God merciful and gracious, slow to anger, abounding in steadfast love.' },
    imagePrompt: 'A multi-generational gathering of people with hands raised in awe under a vast radiant sky, faces full of reverence and joy, warm gold light, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['morning', 'evening'], calendar: [] },
    book: null,
    match: kw(['name', 'holy', 'yahuah', ' el ', 'adonai', 'shepherd', 'king', 'father', 'most high']),
  },
  {
    id: 'songs-of-the-kingdom',
    title: 'Songs of the Kingdom',
    type: 'Thematic',
    description: 'The throne, the reign, and the crown that never falls.',
    anchorVerse: { reference: 'Psalm 145:13', text: 'Your kingdom is an everlasting kingdom, and Your reign endures through all generations.' },
    imagePrompt: 'A jubilant, diverse procession of people celebrating together with banners and light, triumphant and warm, real movement and joy, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['morning'], calendar: [] },
    book: null,
    match: kw(['king', 'throne', 'reign', 'kingdom', 'crown', 'glory', 'majesty']),
  },
  {
    id: 'the-feasts-of-yahuah',
    title: 'The Feasts of Yahuah',
    type: 'Thematic',
    description: 'The appointed times, from Shabbat to the great harvest.',
    anchorVerse: { reference: 'Leviticus 23:2', text: 'These are the appointed times of Yahuah, holy gatherings you shall proclaim.' },
    imagePrompt: 'A warm outdoor feast at golden hour with a diverse, joyful community sharing a long table, lanterns and real laughter, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['evening'], calendar: ['shabbat', 'passover', 'tabernacles'] },
    book: null,
    match: kw(['feast', 'passover', 'sabbath', 'shabbat', 'harvest', 'atone', 'booth', 'jubilee', 'appointed', 'first']),
  },
  {
    id: 'wisdom-and-the-word',
    title: 'Wisdom and the Word',
    type: 'Thematic',
    description: 'The law that is light and the wisdom that keeps the soul.',
    anchorVerse: { reference: 'Psalm 119:105', text: 'Your word is a lamp to my feet and a light to my path.' },
    imagePrompt: 'A diverse group of people of different ages reading and learning together by warm lamplight, faces alight with discovery, gentle and hopeful, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['morning'], calendar: [] },
    book: null,
    match: kw(['wisdom', 'word', 'law', 'torah', 'light', 'path', 'truth', 'teach', 'learn']),
  },
  // ---- Emotional State ("For Your Season") --------------------------------
  {
    id: 'in-the-waiting',
    title: 'In the Waiting',
    type: 'Emotional State',
    description: 'For the seasons that feel stuck — songs to hold on with.',
    anchorVerse: { reference: 'Psalm 27:14', text: 'Wait for Yahuah; be strong, and let your heart take courage.' },
    imagePrompt: 'A small group of real people sitting together at dawn on a quiet hillside, patient and hopeful, soft first light, gentle warmth, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['night'], calendar: [] },
    journeyStart: true,
    next: 'broken-but-held',
    book: null,
    match: kw(['wait', 'still', 'silence', 'night', 'long', 'patience', 'watch', 'morning', 'hope']),
  },
  {
    id: 'broken-but-held',
    title: 'Broken but Held',
    type: 'Emotional State',
    description: 'Grief that still holds onto hope.',
    anchorVerse: { reference: 'Psalm 34:18', text: 'Yahuah is near to the brokenhearted and saves the crushed in spirit.' },
    imagePrompt: 'Two people holding one another in a tender embrace of comfort, warm light through a window, real tenderness and hope, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['evening'], calendar: [] },
    next: 'overflowing-with-joy',
    book: null,
    match: kw(['grief', 'broken', 'tears', 'sorrow', 'weep', 'ash', 'dust', 'mercy', 'comfort', 'held']),
  },
  {
    id: 'overflowing-with-joy',
    title: 'Overflowing with Joy',
    type: 'Emotional State',
    description: 'Already high and wanting to ride it — pure celebration.',
    anchorVerse: { reference: 'Psalm 126:3', text: 'Yahuah has done great things for us, and we are filled with joy.' },
    imagePrompt: 'A vibrant, diverse crowd of all ages dancing with hands raised, confetti and warm celebratory light, genuine smiles and real energy, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['morning'], calendar: ['shabbat'] },
    book: null,
    match: kw(['joy', 'sing', 'dance', 'glad', 'praise', 'shout', 'rejoice', 'celebrate', 'song']),
  },
  {
    id: 'when-youre-afraid',
    title: "When You're Afraid",
    type: 'Emotional State',
    description: 'For anxiety and worry — a shelter you can run to.',
    anchorVerse: { reference: 'Psalm 91:1', text: 'Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty.' },
    imagePrompt: 'A parent holding a child close and safe in warm golden light, calm and protected, real reassurance and peace, cinematic 16:9 banner, no text.',
    surfacing: { timeOfDay: ['night'], calendar: [] },
    book: null,
    match: kw(['fear', 'afraid', 'storm', 'refuge', 'shadow', 'shelter', 'strong', 'safe', 'rock', 'shield']),
  },
];

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, 'images'), { recursive: true });

let written = 0;
let skipped = 0;
for (const p of PLAYLISTS) {
  const file = join(OUT_DIR, `${p.id}.json`);
  if (existsSync(file) && !FORCE) {
    skipped++;
    console.log(`  · ${p.id} exists (use --force to overwrite)`);
    continue;
  }
  const doc = {
    id: p.id,
    title: p.title,
    type: p.type,
    description: p.description,
    anchorVerse: p.anchorVerse,
    imagePrompt: p.imagePrompt,
    imageAspectRatio: '16:9',
    linkedImage: '',
    journey: { isJourney: Boolean(p.journeyStart), days: null, nextPlaylistId: p.next || null },
    surfacing: p.surfacing || { timeOfDay: [], calendar: [] },
    songCount: SONG_COUNT,
    songs: fillSongs(p.id, p.match, p.book),
  };
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  written++;
  console.log(`  ✓ ${p.id}  (${doc.songs.length} songs, type ${p.type})`);
}

console.log(`\nWrote ${written}, skipped ${skipped}. Folder: ${OUT_DIR}`);
console.log(`On disk now: ${readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')).length} playlist file(s).`);
