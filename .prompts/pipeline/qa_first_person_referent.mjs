// TORAH SINGS — FIRST-PERSON REFERENT GATE (automated aid for the WITNESS-PERSPECTIVE / NO-CONFLATION rule)
// Usage:  node qa_first_person_referent.mjs "<path to assembled album lyrics .md>"
// Flags the mechanical danger pattern: a first-person pronoun apposed to / possessing a human-or-earth noun
// (e.g. "we, the dust", "our flesh"). Every I/we/us/our must refer to the Angels or the Picture Letters —
// never a human or an earth-thing. A human/AI reviewer still confirms each first-person referent;
// this catches the classic slip. Marked human QUOTES are the only allowed exception (confirm each hit is one).
import { readFileSync } from 'node:fs';
const F = process.argv[2];
if (!F) { console.error('usage: node qa_first_person_referent.mjs "<album .md>"'); process.exit(1); }
const s = readFileSync(F, 'utf8').replace(/\r\n/g, '\n');

const idx = [...s.matchAll(/^SONG TITLE: (\d+ [^\n]+)$/gm)].map(m => ({ t: m[1], at: m.index }));
idx.push({ at: s.length });

const APPOS = /\b(we|us)\b\s*[,—-]*\s*(the\s+)?(dust|clay|flesh|mortals?|fallen|sinners?|dead|men|mankind)\b/i;
const POSSESS = /\b(our|my|mine)\b\s+(dust|clay|flesh|sins?|guilt|blood|grave|death|mortality|wounds?|bones?)\b/i;
const FP = /\b(I|me|my|mine|we|us|our|ours)\b/i;

let totalFlags = 0;
for (let i = 0; i < idx.length - 1; i++) {
  let block = s.slice(idx[i].at, idx[i + 1].at);
  const lyrStart = block.indexOf('LYRICS:');
  const stylesAt = block.indexOf('\nStyles:');
  if (lyrStart < 0 || stylesAt < 0) continue;
  let lyr = block.slice(lyrStart + 7, stylesAt);
  lyr = lyr.replace(/\[[^\]]*\]/g, ''); // strip [structure tags] — not sung
  const lines = lyr.split('\n').map(l => l.trim()).filter(Boolean);
  const flags = [];
  let fpCount = 0;
  for (const line of lines) {
    if (FP.test(line)) fpCount++;
    if (APPOS.test(line) || POSSESS.test(line)) flags.push(line);
  }
  totalFlags += flags.length;
  console.log(`\n${idx[i].t}`);
  console.log(`   sung lines with first-person: ${fpCount}`);
  if (flags.length) {
    console.log(`   ⚠ CONFLATION-PATTERN HITS (${flags.length}) — confirm each is a marked QUOTE, else FAIL:`);
    flags.forEach(f => console.log(`      » ${f}`));
  } else {
    console.log('   ✓ no first-person/human-noun conflation pattern');
  }
}
console.log(`\n${'='.repeat(60)}`);
console.log(totalFlags === 0
  ? '✓ GATE PASS: no conflation patterns anywhere.'
  : `⚠ ${totalFlags} pattern hit(s) — each must be a clearly-marked human QUOTE to pass; anything else FAILS and must be rewritten to third person.`);
