// TORAH SINGS — ALBUM GATE VERIFIER
// Usage:  node verify_album.mjs "<path to assembled album lyrics .md>"
// Checks every song block against the blocking release gates:
//   (4) bare Suno tags   (5) Styles < 900   (6) LYRICS <= 5000
//   + no NT-hindsight terms   + Jubilee "celebration" rule   + no letter-count   + Picture Letters present
// A human/AI reviewer still confirms voice, narrative-time, and derivation — this catches the mechanical failures.
import { readFileSync } from 'node:fs';
const F = process.argv[2];
const s = readFileSync(F, 'utf8').replace(/\r\n/g, '\n');
const idx = [...s.matchAll(/^SONG TITLE: (\d+ [^\n]+)$/gm)].map(m => ({ t: m[1], at: m.index })); idx.push({ at: s.length });
const NT = /\byeshua\b|\bjesus\b|\bmessiah\b|\bmashiach\b|\bcalvary\b|the cross\b|golgotha|resurrection|new testament|the lamb of god|redeemer|saviou?r/gi;
// Suno blocks certain mode-labels as ARTIST NAMES in the Style field. Never let them into Styles.
// Write the modal equivalent instead (Adonai Malach -> Mixolydian). Keep true mode names in ARCHETYPE/header only.
const STYLE_ARTIST = /adonai\s*malach/i;
let ok = true;
console.log('song                                     lyrics  styles  tags  NT   celeb  style-artist');
for (let i = 0; i < idx.length - 1; i++) {
  const b = s.slice(idx[i].at, idx[i + 1].at);
  const l = b.indexOf('LYRICS:'), st = b.indexOf('\nStyles:');
  if (l < 0 || st < 0) continue;
  const lyr = b.slice(l + 7, st).replace(/^\n+/, '').replace(/\n+$/, '');
  const styles = (b.slice(st + 1).split('\n')[0] || '').replace(/^Styles:\s*/, '');
  const verbose = [...lyr.matchAll(/\[[^\]]*\]/g)].map(m => m[0]).filter(t => /[—:]/.test(t) || t.length > 18);
  const nt = [...b.matchAll(NT)].map(m => m[0]);
  const isJub = /ARTIST: Jubilee Inspire/.test(b);
  const celeb = isJub && /celebration/i.test(styles);
  const styleArtist = STYLE_ARTIST.test(styles); // Suno-blocked artist-name token in the Style field
  const lyrOver = lyr.length > 5000, styOver = styles.length >= 900;
  if (lyrOver || styOver || verbose.length || nt.length || celeb || styleArtist) ok = false;
  console.log(`${idx[i].t.padEnd(40)} ${String(lyr.length).padStart(4)}${lyrOver?'X':' '}  ${String(styles.length).padStart(3)}${styOver?'X':' '}   ${verbose.length?'X':'ok'}   ${nt.length?'X'+JSON.stringify(nt):'ok'}  ${isJub?(celeb?'X':'ok(J)'):'-'}    ${styleArtist?'X'+JSON.stringify(styles.match(STYLE_ARTIST)):'ok'}`);
}
const tt = (s.match(/twenty-two|all 22\b/gi) || []).length;
const pic = (s.match(/Picture Letters/g) || []).length;
console.log('\n"twenty-two":', tt, tt===0?'ok':'X', '· "Picture Letters":', pic);
console.log(ok ? '\nOK: lyrics <=5000 · styles <900 · bare tags · no NT-hindsight · Jubilee no-celebration · no Suno artist-name in Styles' : '\nISSUES above');
