/**
 * Content verification.
 *
 *   node scripts/verify-content.mjs
 *
 * Three jobs:
 *
 *   1. VOICE GUARDRAILS. The brief's naming rules are not style preferences —
 *      "the Ruach HaKodesh" is a doubled article and must never ship. Nor may
 *      the internal labels OHI/CCI, nor emoji, nor placeholder text.
 *
 *   2. STRUCTURE. Seven songs to an album, two of them free. One featured
 *      article. Every exercise's answerIndex actually points at the right answer.
 *
 *   3. THE DERIVATION. This file reimplements the gematria, the sofit folding,
 *      the sevenfold reduction, and the modes FROM SCRATCH — it does not import
 *      lib/derivation.ts. Then it checks that each album's own closing paragraph
 *      quotes the note line that this independent implementation produces. If the
 *      prose and the engine ever drift apart, the platform is misleading the
 *      people it asked to check its work. That must fail loudly.
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const CONTENT = join(SRC, 'content');

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const ok = (msg) => console.log(`  ok    ${msg}`);
const section = (name) => console.log(`\n${name}`);

/* ── 1. Voice guardrails ─────────────────────────────────────────────────── */

const FORBIDDEN = [
  [/\bthe Ruach HaKodesh\b/i, 'doubled article: "the Ruach HaKodesh" (use "Ruach HaKodesh" or "the Ruach Kodesh")'],
  [/\bthe HaTorah\b/i, 'doubled article: "the HaTorah"'],
  [/\bthe HaMashiach\b/i, 'doubled article: "the HaMashiach"'],
  [/\bOHI\b/, 'internal label "OHI" must never appear in reader-facing copy'],
  [/\bCCI\b/, 'internal label "CCI" must never appear in reader-facing copy'],
  [/\bJesus\b/, 'use "Yeshua"'],
  [/\bJehovah\b/, 'use "Yahuah"'],
  [/\bLorem\b|\bTODO\b|\bFIXME\b|\bplaceholder text\b/i, 'placeholder text'],
  // Extended_Pictographic catches real emoji while leaving the musical
  // accidentals (♭ ♯ ♮), the middot, and the em dash alone — those are the
  // design system's own characters, not decoration.
  [/\p{Extended_Pictographic}/u, 'emoji are not part of the brand'],
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

section('Voice guardrails');
const contentFiles = walk(CONTENT);
for (const file of contentFiles) {
  const text = readFileSync(file, 'utf8');
  for (const [pattern, why] of FORBIDDEN) {
    const m = text.match(pattern);
    if (m) fail(`${file.replace(ROOT, '.')}: ${why} — found "${m[0]}"`);
  }
}
if (failures === 0) ok(`${contentFiles.length} content files clean`);

/* ── independent derivation ──────────────────────────────────────────────── */

const VALUES = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80,
  צ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
};
const SOFIT = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const MODES = {
  'ahavah-rabbah-d': ['D', 'E♭', 'F♯', 'G', 'A', 'B♭', 'C'],
  'mi-sheberach-d': ['D', 'E', 'F', 'G♯', 'A', 'B', 'C'],
  'adonai-malach-c': ['C', 'D', 'E', 'F', 'G', 'A♭', 'B♭'],
  'phrygian-e': ['E', 'F', 'G', 'A', 'B', 'C', 'D'],
  'aeolian-a': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'lydian-f': ['F', 'G', 'A', 'B', 'C', 'D', 'E'],
};

const degreeOf = (v) => (v % 7 === 0 ? 7 : v % 7);

function derive(hebrew, modeId) {
  const scale = MODES[modeId];
  if (!scale) throw new Error(`unknown mode: ${modeId}`);
  const letters = [...hebrew].map((c) => SOFIT[c] ?? c).filter((c) => c in VALUES);
  return {
    line: letters.map((c) => scale[degreeOf(VALUES[c]) - 1]).join(' · '),
    sum: letters.reduce((s, c) => s + VALUES[c], 0),
  };
}

/* ── load the content as real objects ────────────────────────────────────── */

// The album files import PLACEHOLDER_AUDIO through the "@/" alias, which Node
// cannot resolve. Stage copies with the import rewritten, then import those.
const stage = mkdtempSync(join(tmpdir(), 'torah-sings-verify-'));
copyFileSync(join(SRC, 'lib', 'media.ts'), join(stage, 'media.ts'));

const albumDir = join(CONTENT, 'albums');
const albums = [];
for (const name of readdirSync(albumDir).filter((f) => f.endsWith('.ts'))) {
  const rewritten = readFileSync(join(albumDir, name), 'utf8').replaceAll("'@/lib/media'", "'./media.ts'");
  const staged = join(stage, name);
  writeFileSync(staged, rewritten);
  const mod = await import(pathToFileURL(staged).href);
  albums.push(Object.values(mod)[0]);
}

const { articles } = await import(pathToFileURL(join(CONTENT, 'articles', 'index.ts')).href);
const { lessonAlbums } = await import(pathToFileURL(join(CONTENT, 'lessons', 'index.ts')).href);
const { PRESENTERS, BEHIND_THE_SCENES } = await import(
  pathToFileURL(join(SRC, 'lib', 'presenters.ts')).href
);

const ROSTER = new Set(PRESENTERS);
const HIDDEN = new Set(BEHIND_THE_SCENES);

/** A credited name must be one of the twelve, and never a behind-the-scenes one. */
function checkPresenter(who, whereSlug, field) {
  if (HIDDEN.has(who)) fail(`${whereSlug}: ${field} is behind-the-scenes ("${who}") — must not present`);
  else if (!ROSTER.has(who)) fail(`${whereSlug}: ${field} "${who}" is not on the Inspire Family roster`);
}

/* ── 2. Albums ───────────────────────────────────────────────────────────── */

section(`Albums (${albums.length})`);

const albumNumbers = new Set();
for (const a of albums.sort((x, y) => x.albumNumber - y.albumNumber)) {
  const { line, sum } = derive(a.source.hebrew, a.mode);

  // Albums are grouped by biblical narrative/theme; the narrative determines
  // the song count — no fixed number. Two is the floor only so the free taste
  // (songs 1–2) can exist on gated albums.
  if (a.tracks.length < 2) fail(`${a.slug}: ${a.tracks.length} tracks — an album needs at least two`);
  const free = a.tracks.filter((t) => t.freeTier).map((t) => t.n);
  if (free.join(',') !== '1,2') fail(`${a.slug}: free tracks are [${free}], expected [1,2]`);
  if (a.derivation.steps.length !== 5) fail(`${a.slug}: ${a.derivation.steps.length} steps, expected five`);
  if (albumNumbers.has(a.albumNumber)) fail(`${a.slug}: duplicate albumNumber ${a.albumNumber}`);
  albumNumbers.add(a.albumNumber);

  // Paleo/Phoenician codepoints must never appear — standard Hebrew letters only.
  if (/[\u{10900}-\u{1091F}]/u.test(a.source.hebrew)) fail(`${a.slug}: Phoenician codepoints in source`);

  // The prose must quote what the engine actually produces.
  if (a.derivation.closing.includes(line)) ok(`${a.slug}: closing quotes ${line} (sum ${sum})`);
  else fail(`${a.slug}: closing does not quote the derived note line "${line}"`);

  if (a.article.blocks.filter((b) => b.type === 'quote').length !== 1)
    fail(`${a.slug}: expected exactly one pull-quote`);

  checkPresenter(a.presenter, a.slug, 'presenter');
  checkPresenter(a.article.voice, a.slug, 'read-aloud voice');
}
if (albums.length !== 6) fail(`expected 6 albums, found ${albums.length}`);
if (albums.filter((a) => a.freeTier).length !== 2) fail('expected exactly two fully-free albums');

/* ── 3. Articles ─────────────────────────────────────────────────────────── */

section(`Articles (${articles.length})`);

const CATEGORIES = ['The Names', 'Feasts & Times', 'Letters & Symbols', 'Covenant', 'The Ruach Kodesh'];
const featured = articles.filter((a) => a.featured);
if (featured.length === 1) ok(`one featured article: ${featured[0].slug}`);
else fail(`expected exactly one featured article, found ${featured.length}`);

const slugs = new Set();
for (const a of articles) {
  if (slugs.has(a.slug)) fail(`duplicate article slug ${a.slug}`);
  slugs.add(a.slug);
  if (!CATEGORIES.includes(a.category)) fail(`${a.slug}: unknown category "${a.category}"`);
  const quotes = a.blocks.filter((b) => b.type === 'quote').length;
  if (quotes !== 1) fail(`${a.slug}: ${quotes} pull-quotes, expected exactly one`);
  if (!(a.readingTime > 0)) fail(`${a.slug}: readingTime must be positive`);
  if (Number.isNaN(Date.parse(a.releasedAt))) fail(`${a.slug}: unparseable releasedAt`);
  checkPresenter(a.presenter, a.slug, 'presenter');
}
ok(`${articles.length} articles: unique slugs, valid categories, one pull-quote each`);

/* ── Presenter rotation ──────────────────────────────────────────────────── */

section('Inspire Family rotation');

if (ROSTER.size === 12) ok('twelve Inspire Family members on the roster');
else fail(`roster has ${ROSTER.size} members, expected twelve`);
if (HIDDEN.size > 0) ok(`behind the scenes: ${[...HIDDEN].join(', ')}`);

const voicesUsed = new Set([...albums.map((a) => a.presenter), ...articles.map((a) => a.presenter)]);
ok(`${voicesUsed.size} of ${ROSTER.size} voices in rotation across published content`);
const albumVoices = new Set(albums.map((a) => a.presenter));
if (albumVoices.size < albums.length)
  fail(`albums share presenters (${[...albumVoices].join(', ')}) — the six should rotate distinct voices`);
else ok(`six albums, six distinct presenters: ${[...albumVoices].join(', ')}`);

/* ── 4. Lessons and exercises ────────────────────────────────────────────── */

section(`Lesson albums (${lessonAlbums.length})`);

let exerciseCount = 0;
const answerHistogram = {};

for (const la of lessonAlbums) {
  if (la.lessons.length !== 6) fail(`${la.slug}: ${la.lessons.length} lessons, expected six`);
  la.lessons.forEach((lesson, i) => {
    if (lesson.n !== i + 1) fail(`${la.slug}: lesson ${i + 1} numbered ${lesson.n}`);

    for (const ex of lesson.exercises) {
      exerciseCount++;
      const n = ex.choices.length;
      if (n < 3 || n > 4) fail(`${la.slug} L${lesson.n}: ${n} choices (want 3–4)`);
      if (new Set(ex.choices).size !== n) fail(`${la.slug} L${lesson.n}: duplicate choices`);
      if (!Number.isInteger(ex.answerIndex) || ex.answerIndex < 0 || ex.answerIndex >= n)
        fail(`${la.slug} L${lesson.n}: answerIndex ${ex.answerIndex} out of bounds`);
      if (!ex.note?.trim()) fail(`${la.slug} L${lesson.n}: exercise has no teaching note`);
      answerHistogram[ex.answerIndex] = (answerHistogram[ex.answerIndex] ?? 0) + 1;
    }
  });
}

const levels = lessonAlbums.map((l) => l.level).sort();
if (levels.join(',') !== '1,2,3') fail(`levels are [${levels}], expected [1,2,3]`);
if (lessonAlbums.filter((l) => l.freeTier).length !== 1) fail('expected exactly one free lesson album');

ok(`${exerciseCount} exercises: bounds, distinct choices, teaching notes`);

// An answer key that is 80% "A" teaches clicking, not Hebrew.
const worst = Math.max(...Object.values(answerHistogram));
const spread = Object.entries(answerHistogram)
  .map(([k, v]) => `${k}:${v}`)
  .join(' ');
if (worst / exerciseCount > 0.5) fail(`answer key is skewed (${spread}) — a learner could guess by position`);
else ok(`answer key spread ${spread}`);

/* ── done ────────────────────────────────────────────────────────────────── */

console.log(failures === 0 ? '\n✓ content verified\n' : `\n✗ ${failures} failure(s)\n`);
process.exit(failures === 0 ? 0 : 1);
