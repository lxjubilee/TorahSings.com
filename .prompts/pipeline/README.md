# Torah Sings — album production pipeline

Deterministic Node scripts (Node ≥18, no dependencies) that assemble and gate-check album lyric
files. Run them from the workspace root. Full context and the per-album process are in
**`../../HANDOFF - Torah Sings Genesis (Albums VI-IX).md`** §6 and §8.

| Script | Purpose | Usage |
|---|---|---|
| `assemble_album.mjs` | Stitch `header.md` + `stations.json` + `song1..N.md` (in a build dir) into a finished album file | `node ".prompts/pipeline/assemble_album.mjs" <buildDir> "<album.md>"` |
| `verify_album.mjs` | Blocking gate check: LYRICS ≤5000, Styles <900, bare tags, NT-hindsight scan, Jubilee-"celebration", `"twenty-two"` tripwire, Picture-Letters count | `node ".prompts/pipeline/verify_album.mjs" "<album.md>"` |
| `qa_first_person_referent.mjs` | Blocking gate check: flags first-person pronouns conflated with a human/earth noun (must be a marked quote or it fails) | `node ".prompts/pipeline/qa_first_person_referent.mjs" "<album.md>"` |
| `add_image_prompts.mjs` | Insert one IMAGE PROMPT block per song from a `{ "1": "body", … }` JSON (per-song glyph, ≤1500 chars) | `node ".prompts/pipeline/add_image_prompts.mjs" "<album.md>" <images.json>` |

**Build-dir inputs for `assemble_album.mjs`:**
- `header.md` — the album VERSION CONTROL header; must end with a line that is exactly `---`.
- `stations.json` — JSON array of N station-header strings in track order, e.g.
  `["## STATION I — THE CALL (Track 01): *Song Title* — Genesis 24", …]`.
- `song1.md … songN.md` — one finished song block each (`SONG TITLE:` … `Save To:`), N = array length.

**Order of operations:** forge song blocks → assemble → `verify_album.mjs` + `qa_first_person_referent.mjs`
(fix until both clean) → `add_image_prompts.mjs` → re-run `verify_album.mjs` to confirm the sung text
is untouched. The verifiers are aids that catch mechanical failures; a reviewer still confirms voice,
narrative-time, derivation truth, and every first-person referent.

**Known tripwire exception:** `verify_album.mjs` flags any `"twenty-two"`. Album IX's song
"Two Words, Twenty-Two Years" (Gen 45) uses it as a biblical *years* count (Joseph's separation),
which is permitted — confirm it's that usage and keep it. Everywhere else, "twenty-two" (as a
letter-count) must be zero.
