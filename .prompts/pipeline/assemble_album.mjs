// TORAH SINGS — ALBUM ASSEMBLER
// Usage:  node assemble_album.mjs <buildDir> "<outFile>"
//
// Assembles a finished album lyrics file from a build directory of per-song blocks.
// <buildDir> must contain:
//   header.md        — the album's VERSION CONTROL header block; MUST end with a line that is exactly "---"
//   stations.json    — a JSON array of N station-header strings, in track order, e.g.
//                        ["## STATION I — THE CALL (Track 01): *Song Title* — Genesis 12:1–9", ...]
//   song1.md .. songN.md — one finished song block each (SONG TITLE: … through Save To: …),
//                          where N === stations.json length.
//
// Output layout (matches every shipped album):
//   <header ending in --->  \n\n  <station I>\n\n<song1>\n\n---\n\n  <station II>\n\n<song2>\n\n---\n\n ...
import { readFileSync, writeFileSync } from 'node:fs';

const [buildDir, outFile] = process.argv.slice(2);
if (!buildDir || !outFile) { console.error('usage: node assemble_album.mjs <buildDir> "<outFile>"'); process.exit(1); }

const stations = JSON.parse(readFileSync(`${buildDir}/stations.json`, 'utf8'));
const header = readFileSync(`${buildDir}/header.md`, 'utf8').trimEnd(); // must end with '---'
if (!header.endsWith('---')) throw new Error('header.md must end with a line that is exactly "---"');

let out = header + '\n\n';
for (let i = 1; i <= stations.length; i++) {
  const song = readFileSync(`${buildDir}/song${i}.md`, 'utf8').trim();
  out += stations[i - 1] + '\n\n' + song + '\n\n---\n\n';
}
out = out.trimEnd() + '\n';
writeFileSync(outFile, out, 'utf8');
console.log(`assembled ${stations.length} songs -> ${outFile} (${Buffer.byteLength(out, 'utf8')} bytes)`);
