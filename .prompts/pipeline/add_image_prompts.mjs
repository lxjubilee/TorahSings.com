// TORAH SINGS — IMAGE-PROMPT INSERTER
// Usage:  node add_image_prompts.mjs "<albumFile>" <imagesJson>
//
// Inserts one IMAGE PROMPT block after each song's "Save To:" line, in place.
// <imagesJson> is a JSON object keyed by song number, each value the IMAGE PROMPT *body* (<=1500 chars):
//   { "1": "Photorealistic documentary film still, grain, no illustration. T6 — ...", "2": "...", ... }
// The standard header line is added automatically. The T7 hidden glyph must be chosen PER SONG from that
// song's own derivation (never one catalog-locked glyph) — see the Angelic Image Generation Guide §7.
// Idempotency: run this ONCE on a freshly assembled album (it does not check for pre-existing blocks).
import { readFileSync, writeFileSync } from 'node:fs';

const HDR = 'IMAGE PROMPT (≤1500 chars · first 250 weighted heaviest · standard negative per image guide §7):';
const [albumFile, imagesJson] = process.argv.slice(2);
if (!albumFile || !imagesJson) { console.error('usage: node add_image_prompts.mjs "<albumFile>" <imagesJson>'); process.exit(1); }

const bodies = JSON.parse(readFileSync(imagesJson, 'utf8'));
let doc = readFileSync(albumFile, 'utf8');

// each song ends with a unique "Song Title: NN ..." line immediately followed by its "Save To: ..." line
const pairs = [...doc.matchAll(/^Song Title: (\d+)[^\n]*\n(Save To: [^\n]*)$/gm)];
if (!pairs.length) throw new Error('no "Song Title: NN … / Save To: …" pairs found — is this an assembled album?');

// insert back-to-front so earlier match indices stay valid
for (let k = pairs.length - 1; k >= 0; k--) {
  const m = pairs[k];
  const n = String(parseInt(m[1], 10));
  const body = bodies[n];
  if (!body) { console.warn(`no image body for song ${n} — skipped`); continue; }
  if (body.length > 1500) throw new Error(`song ${n} image body is ${body.length} chars > 1500`);
  const anchorEnd = m.index + m[0].length;
  doc = doc.slice(0, anchorEnd) + `\n\n${HDR}\n${body}` + doc.slice(anchorEnd);
}

writeFileSync(albumFile, doc, 'utf8');
const count = (doc.match(/^IMAGE PROMPT/gm) || []).length;
console.log(`inserted image prompts; file now has ${count} IMAGE PROMPT block(s)`);
// quick glyph-distinctness report
const glyphs = (doc.match(/Paleo-Hebrew ([A-Za-z]+)/g) || []).map(x => x.replace('Paleo-Hebrew ', ''));
console.log(`glyphs used: ${glyphs.join(', ')}  (${new Set(glyphs).size} distinct)`);
