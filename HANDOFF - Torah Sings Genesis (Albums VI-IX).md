# HANDOFF — Continue the Torah Sings Genesis Catalog (Albums VI–IX)

**Purpose.** This is the single START-HERE document for another Claude account (or human) picking up this workspace to finish the Book of Genesis at the same caliber as Albums I–V. Read it top to bottom once; it points you to the authoritative docs, the standing rules, the exact production pipeline, the reusable scripts, and the remaining work packages. Nothing here overrides the governing docs in `.prompts/` — it indexes and operationalizes them.

**Last updated:** 2026-07-08, after Album V shipped. Genesis stands at **5 of 9 albums complete.**

---

## 1. The assignment in one paragraph

Torah Sings is a music catalog in which songs are "hidden" in the Paleo-Hebrew Scriptures (via the pictograph images of the letters and the numbers in the text) and sung from the perspective of **the Angels** and the personified **Picture Letters** — the two singing voices of Job 38:7 ("the morning stars sang… the sons of Elohim shouted"). You are producing full album lyric files: for each narrative unit of Genesis, one song, cast to one of twelve "Inspire Family" voices, formatted for the Suno music generator, with a per-song AI image prompt appended. Albums I–V are done. **Your job is Albums VI, VII, VIII, IX** — 29 songs — to the identical standard. **Do not lower the bar; do not invent doctrine; when unsure, follow the shipped albums as worked examples.**

---

## 2. Current state — the progress ledger

| Album | Code | Title | Passage | Songs | Status |
|---|---|---|---|---|---|
| I | ANSMX1001EN | When the Morning Stars Sang | Gen 1–4 | 6 | ✅ complete (lyrics + image prompts, gates pass) |
| II | ANSMX1002EN | Grief Built the Basket | Gen 6–9 | 7 | ✅ complete |
| III | ANSMX1003EN | The Names Outlived the Graves | Gen 5;10;11;22:20–24;25:12–18;36;46:8–27 | 10 | ✅ complete |
| IV | ANSMX1004EN | We Watched Him Bind Himself | Gen 12–17 | 8 | ✅ complete |
| V | ANSMX1005EN | The Fire Fell, the Knife Didn't | Gen 18–23 | 9 | ✅ complete |
| **VI** | **ANSMX1006EN** | **The Ladder Started Underground** | **Gen 24–28** | **7** | ⏳ **TODO** |
| **VII** | **ANSMX1007EN** | **The Blessing Limps Home** | **Gen 29–35** | **8** | ⏳ **TODO** |
| **VIII** | **ANSMX1008EN** | **The Garments Lied, the Dreams Did Not** | **Gen 37–43** | **7** | ⏳ **TODO** |
| **IX** | **ANSMX1009EN** | **The Throne Wept in Hebrew** | **Gen 44–50** | **7** | ⏳ **TODO** |

**Where finished albums live (the "J: filing convention"):**
```
J:\music\angels\01_Genesis\<CODE> <Title>\lyrics\Torah Sings-<Title>-lyrics.md
```
The album folders for VI–IX already exist (each with empty `lyrics\`, `artwork\`, `blueprints\`, `tracks\` subfolders). Read any of the five shipped album files as your gold-standard template before you write a line. If the `J:` drive is not mounted on the machine you run on, replace that root with wherever the album library lives; the scripts all take the file path as an argument.

**The catalog pitch (the source of truth for what songs exist):** `pitches\Genesis - The Nine Albums.md` — full tracklists, passages, singer, and the "image it hangs on" for all 69 songs. Section 9 below reproduces the VI–IX tracklists so you can work from this file alone, but re-read the pitch for the surrounding narrative framing of each album.

---

## 3. Read these first — governing docs (in `.prompts/`)

Read in this order before producing anything. These are authoritative; this handoff only operationalizes them.

1. **`.prompts/README.md`** — the library index and the two-voices doctrine.
2. **`.prompts/_GROUNDING - Torah Sings Project.md`** — the constitution. The derivation chain, the two voices, sacred-name conventions, the Hebraic Music Mandate, the Suno format, and the release rules (VOICE, NARRATIVE-TIME, FIRST-PERSON/WITNESS-PERSPECTIVE, Picture-Letters/no-count, bare-tags, the Field-4 image-prompt note).
3. **`.prompts/_METHODOLOGY - Album & Song Creation.md`** — the selection law: one song per narrative unit at the text's own seams; **aim for ≈7 songs but let the narrative decide the count (no hard cap, flexible floor)**; thematic grouping; honest sequencing.
4. **`.prompts/music_torahSings - song engine v2.md`** — the production engine (seven phases: passage analysis → pictograph lookup → textual tracking → the singers' narrative → song derivation → Suno three-field formatting → four-axis QA). Carries the **filing convention** (song-block format incl. IMAGE PROMPT field), the LYRICS/STYLES/IMAGE-PROMPT field rules, the **paste boundary**, and the **Phase-7 release gates** (including the First-Person Referent gate).
5. **`.prompts/music_torahSings - voice casting matrix.md`** — the twelve voices, the **50-50 gender-balance rule**, the **Zev strangeness lane**, and the **Jubilee "celebration" rule**.
6. **`.prompts/image_torahSings - angelic image generation guide.md`** — the image-prompt system: the six-pass method, §7 architecture, the Ten Techniques (T1–T10), and the **per-song hidden-glyph rule (T7 always; the letter chosen per song from its derivation — never one catalog-locked glyph)**.
7. **`.prompts/music_torahSings - pitch process.md`** — how the catalog was built (only needed if you extend to another book).

---

## 4. The non-negotiable standing rules & release gates

Every song must pass ALL of these. The first six are the **blocking release gates** — a song does not ship unless every one is green.

1. **VOICE.** Only the Angels and/or the Picture Letters sing. Never a human voice, never a human-derived "we." A Picture Letter may sing *as itself* (e.g., the Vav, the Yod, the Zayin, the Chet, the Tav) — that is the letter as persona, performed by one of the twelve Inspire voices.
2. **NARRATIVE-TIME.** Sung from inside the moment of the text. **No New-Testament hindsight** — no Yeshua/Jesus/Messiah/cross/resurrection/redeemer language, no reading later revelation back into Genesis. Mystery is carried as felt ache ("we did not yet know what He had seen there"), never resolved forward. (The Akedah in Album V is the model.)
3. **FIRST-PERSON REFERENT (no conflation).** Every I/we/us/our refers to the Angels or the Picture Letters — never a human or an earth-thing. Humans are always third person ("he," "she," "the man," by name). The only exception is a clearly-marked human **quotation**. (Automated tripwire: `qa_first_person_referent.mjs`.)
4. **BARE SUNO TAGS.** In the LYRICS field, structure tags are bare only — `[Verse]`, `[Chorus]`, `[Bridge]`, `[Outro]`, `[Spoken Intro]`, etc. **No production prose inside brackets** (Suno ignores it and it wastes the character budget). Put all production/mood direction in the Styles field instead.
5. **STYLES < 900 characters**, and it **names no musical artist or Inspire persona**. It must name a concrete **Hebraic** element (a mode — Ahavah Rabbah / Mi Sheberach; cantillation phrasing; Hebraic instrumentation — shofar, kinnor, oud, ney, tof; or Hebrew lyric passages). The Hebraic music type is primary or secondary in **every** song (the Hebraic Music Mandate). **Suno artist-name block (owner directive, standing):** never write **"Adonai Malach"** in the Styles field — Suno blocks it as an artist name and drops/garbles the style. Use its modal equivalent **"Mixolydian"** in Styles instead; keep the true mode name "Adonai Malach" only in the ARCHETYPE / header (never pasted into Suno). Watch other mode-labels Suno reads as artists and swap likewise. (Tripwire: `verify_album.mjs` `style-artist` column.)
6. **LYRICS ≤ 5000 characters** (sung lines + bare tags only). Shipped songs run ~2,400–3,200 — leave headroom.

Additional standing rules (also mandatory):

7. **Picture Letters, never a count.** Refer to the letters as "the Picture Letters." **Never state a fixed number** ("twenty-two," "all 22," etc.). Their pictograph *images* and *numbers in the text* are the derivation material, but the letter-count and the 3-6-9/gematria *mechanism* are never sung or named. (Tripwire: `verify_album.mjs` flags "twenty-two" — see the one legitimate exception in §9, Album IX.)
8. **Numbers-hidden derivation.** Images come from the pictographs; you do **not** sing letter-names, gematria values, or the numeric mechanism. **But biblical text-numbers ARE content and may be sung** — the descending intercession count (fifty… ten), the seven ewe-lambs, 318 servants, 400 years, 400 shekels, her 127 years, the twenty-two *years* of Joseph's separation. Sing the story's numbers; hide the letter-math.
9. **OHI sacred-name conventions (absolute).** Yahuah (never "Jehovah," "the LORD," "Jesus"); Yeshua; Elohim; Ruach HaKodesh (feminine). **Never stack an English "the" on a Hebrew Ha- form** — write "Ruach HaKodesh" or "the Ruach Kodesh"; likewise HaMashiach, HaTorah. Use the text's own divine names where they occur (El Roi, El Olam, El Shaddai, Yahuah-Yireh). "OHI"/"CCI" are internal labels — never listener-facing.
10. **Per-song hidden glyph (images).** Every image prompt embeds one Paleo-Hebrew pictograph, chosen **per song from that song's own derivation** — the **most suitable and impactful** letter for that song's narrative — and hidden naturally in a real element of the scene. Not one catalog-locked glyph for everything. **Do not force per-album uniqueness (owner directive, standing):** a letter may repeat within an album when it is genuinely the best fit; suitability and impact win over novelty. Prefer variety where two songs fit equally well, but never trade the most-fitting cipher for a weaker one just to avoid a repeat.
11. **Jubilee "celebration" rule.** When **Jubilee Inspire** is the lead ARTIST, her Styles block must **not** contain the word "celebration." Use jubilant / festival-scale / revival-scale / exultant instead. (Tripwire: `verify_album.mjs` marks Jubilee songs `ok(J)`.)
12. **Zev strangeness lane.** Consider **Zev Inspire** first for strange/uncanny/severe songs (dream-oracles, laments, the eerie). He yields to a better fit — especially when the design calls for a female lead.
13. **Gender balance.** Cast each album ≈50-50 male/female across the twelve voices. **Gabriel Inspire never fronts** (stays behind the scenes, always).
14. **Posture.** Never claim canon. Every full package carries the caution — *not canon, something to consider.* No emoji anywhere.

---

## 5. The twelve voices (cast per song on best-suitability)

Male: **Zev, Amir, Caleb, Elias, Santiago, Tahoma.** Female: **Jubilee, Melody, Zariah, Eliana, Imani, Nova.** (Gabriel never fronts.) The casting matrix doc has each voice's lane; the pitch's "Who sings" column names the intended persona (Angels, or a specific Picture Letter). When the pitch says "the Vav / the Yod / the Zayin / the Tav," that Letter is the narrator persona — pick the Inspire voice whose lane best carries it (e.g., in Album V: Zev performed *as* the Yod, Jubilee *as* the Tsade, Caleb *as* the Zayin, Zariah *as* the Chet). Balance the six-or-so leads per album 50-50, and rotate so no voice dominates the book.

---

## 6. The per-album production pipeline (the repeatable process)

This is exactly how Albums III–V were built. One album at a time:

1. **Scope the album.** From the pitch (§9), list the N songs, their passages, singers, and image hooks. Lock a casting map that satisfies the 50-50 rule, the Zev lane, and Jubilee's rule. Decide each song's derivation angle (pictograph images + text numbers) and its Hebraic mode.
2. **Forge each song.** Produce one finished song block per song (format in §7). The proven method is one strong-model subagent per song, each having read the grounding + engine + pitch, each self-checking the release gates before returning its block — but a single account can also write them in sequence. Either way, **every song self-runs the gates in §4 before it's accepted.**
3. **Stash to a build directory.** Save each block to `song1.md … songN.md` and write the album `header.md` (the VERSION CONTROL block — copy a shipped album's header and adapt) and a `stations.json` (the ordered station-header strings). Use a scratch/build folder you control.
4. **Assemble.** `node ".prompts/pipeline/assemble_album.mjs" <buildDir> "<J: album lyrics path>"` — stitches header + stations + songs into the final file.
5. **Verify (blocking).** Run BOTH:
   - `node ".prompts/pipeline/verify_album.mjs" "<album path>"` → every song must show lyrics ≤5000, styles <900, tags `ok`, NT `ok`, Jubilee `ok(J)`, and `"twenty-two": 0`.
   - `node ".prompts/pipeline/qa_first_person_referent.mjs" "<album path>"` → must end `GATE PASS`. Any conflation hit must be a marked human quote or it fails.
   Fix and re-run until both are clean.
6. **Add image prompts.** Write each song's IMAGE PROMPT body (per §7 and the image guide; per-song glyph from its derivation; ≤1500 chars, first ~250 weighted heaviest). Put them in a JSON keyed by song number and run `node ".prompts/pipeline/add_image_prompts.mjs" "<album path>" <images.json>`. Then confirm the file has N `IMAGE PROMPT` blocks and N distinct glyphs, and re-run `verify_album.mjs` to confirm the sung text is untouched.
7. **Mark done.** All gates green + N image prompts + counts correct = album complete. Move to the next.

**Do-not-publish note:** the `J:` library has a README contract — nothing in a POLISHED/published state ships without the owner's approval flag. Producing the lyrics file is the work; announcing release is the owner's call.

---

## 7. Formats (copy these exactly)

**File skeleton** (see any shipped album):
```
# <Title> — Album Lyrics (V1)

<!-- VERSION CONTROL -->
… header: Last Updated, Album Code, Fusion, Arc, Casting Rule, casting map table,
   Changelog, Theological Anchors, Identity DNA, Field limits, Release gates, ⚠ Suno paste boundary …
<!-- /VERSION CONTROL -->

---

## STATION I — <PHASE NAME> (Track 01): *<Song Title>* — <Passage>

<song block>

---

## STATION II — <PHASE NAME> (Track 02): *<Song Title>* — <Passage>

<song block>

---
… (one station + block per song) …
```
The header must end with a line that is exactly `---`. Station header pattern: `## STATION <ROMAN> — <PHASE> (Track 0N): *<Title>* — <Passage>`.

**Song block** (between two `---` separators):
```
SONG TITLE: 0N <Title>
ARTIST: <Voice> Inspire
ARCHETYPE: <the derivation angle — pictograph images + text-numbers, the mode, the passage>
CASTING (12-voice suitability evaluation):
- **Lead: <Voice> Inspire (M/F)** — <why this voice; one tight paragraph>
- Runners-up: <2 alternates, one line each>. Gabriel never fronts.

LYRICS:

[Spoken Intro]
<sung lines…>
[Verse 1]
<…>
[Chorus]
<…>
… (bare tags only) …

Styles: <one dense paragraph, <900 chars, named Hebraic style + instrumentation + tempo + diction guide + "Family-friendly." + M:SS>

VOCAL GENDER: <Male/Female Lead (choir/accompaniment note; join-in or shock-and-awe)>
Weirdness: NN%
Style Influence: NN%
Faith-Focus Rating: NN%
Praise vs. Worship Rating: NN%
Earworm Rating: NN%
Bestseller Rating: NN%
Estimated Length: M:SS
Song Title: 0N <Title>
Save To: <Album Title>

IMAGE PROMPT (≤1500 chars · first 250 weighted heaviest · standard negative per image guide §7):
Photorealistic documentary film still, grain, no illustration. T# — <technique>: <front-loaded subject + palette in first ~250 chars>. Implied register — <angels faces-obscured / Yahuah off-frame as light only>. <light>. Atmosphere: <…>. Palette: <…>. <composition>. <something withheld>. Hidden glyph — Paleo-Hebrew <Letter>, <meaning>, hidden in <a real element>. <lens/film/optics>, halation bloom, subtle grain. <one-line emotional register>.
```
Image-prompt rules: photorealistic film still (no illustration/CGI); angels faces obscured/turned/unaware; **Yahuah/Yeshua/glory never a rendered face — light only, off-frame**; T7 glyph always, per song, hidden naturally; ≤1500 chars; the standard negative lives in the image guide §7 (referenced in the header line, not repeated in the field); family-friendly restraint on violent scenes (smoke/salt/thicket/arrested blade — no gore).

**Suno paste boundary:** into Suno's **Lyrics** field paste only the text between a song's `LYRICS:` header and its `Styles:` line; the `Styles:` text goes in the separate **Style** field; casting/ratings/image go in neither.

---

## 8. The pipeline scripts (persisted in `.prompts/pipeline/`)

Node ≥18, no dependencies. Run from the workspace root.

| Script | What it does | Usage |
|---|---|---|
| `verify_album.mjs` | Gate check: lyrics ≤5000, styles <900, bare tags, NT-hindsight scan, Jubilee-celebration, "twenty-two" tripwire, Picture-Letters count | `node ".prompts/pipeline/verify_album.mjs" "<album.md>"` |
| `qa_first_person_referent.mjs` | Conflation gate: flags first-person pronouns tied to human/earth nouns | `node ".prompts/pipeline/qa_first_person_referent.mjs" "<album.md>"` |
| `assemble_album.mjs` | Stitches `header.md` + `stations.json` + `song1..N.md` into the final album file | `node ".prompts/pipeline/assemble_album.mjs" <buildDir> "<album.md>"` |
| `add_image_prompts.mjs` | Inserts one IMAGE PROMPT block per song from a `{ "1": "body", … }` JSON | `node ".prompts/pipeline/add_image_prompts.mjs" "<album.md>" <images.json>` |

The verifiers are **aids, not judges** — they catch the mechanical failures. A reviewer still confirms voice, narrative-time, derivation truth, and that every first-person referent is the Angels/Letters.

---

## 9. The remaining work packages — Albums VI–IX

Casting is not pre-locked for these — you cast them, honoring the 50-50 rule, the Zev lane, and Jubilee's rule, and matching the "Who sings" persona. Suggested station-phase names are yours to set (see shipped albums for the pattern). Derivation seeds are in the "image it hangs on" column; expand each via the engine.

### Album VI — The Ladder Started Underground · ANSMX1006EN · Gen 24–28 · 7 songs
Isaac, and the rise of Jacob. Sequencing = biblical order.
1. **She Came Before Amen** — Gen 24 — the Angels, with the messenger sent ahead (24:7) — the answer left home before the prayer finished; Rivqah's jar already on her shoulder.
2. **Buried by Both His Sons** — Gen 25:1–11 — the Angels, led by the one who found Hagar — the estranged brothers shoulder to shoulder at Machpelah.
3. **He Ate, and Rose, and Went** — Gen 25:19–34 — **the Vav** (the consecutive-"and" chain) — Esav's five flat verbs, not one turns around.
4. **He Dug Up Our Names** — Gen 26 — the Letters (the buried well-names) — you can stop a well but not un-name it; Rechovot, "now there is room."
5. **The Cry We Could Not Answer** — Gen 27 — the Angels, helpless at the window — goat hair convincing blind hands; the blessing won't come back.
6. **He Married Into the Cast-Out Line** — Gen 28:1–9 — the Angels — Esav weds Ishmael's daughter, the rejected son grafting to the other rejected son. *(A strangeness/tragedy lane — consider Zev.)*
7. **We Climbed While He Slept** — Gen 28:10–22 — **the Angels on the ladder** (singing their own strange order: ascending first) — the gate of heaven at a nowhere place with a stone pillow.

### Album VII — The Blessing Limps Home · ANSMX1007EN · Gen 29–35 · 8 songs
Jacob. The one album that refuses to reorder (the chapters form a chiasm; keep play order).
1. **We Knew It Was Leah** — Gen 29 — the Angels (saw through the veil all night) — the disguiser blinded by a bridal veil.
2. **She Wrestled First** — Gen 30 — the Angels — Rachel's *naphtulei Elohim*, the undercard before the Yabboq.
3. **Gods Under the Saddle** — Gen 31 — the Angels over the *gal-ed* witness-heap at Mizpah — dead stones sworn in while stolen gods ride blind and sat-upon.
4. **The Night We Could Not Prevail** — Gen 32 — **the Angels (the wrestler was one of their own; claim his defeat in first person)** — omnipotence holding itself down until daybreak. *(The center; a strangeness/awe lane — consider Zev.)*
5. **Esav Wore the Face of Elohim** — Gen 33 — the Angels (who showed him that face at Peniel hours before) — four hundred swords become an embrace.
6. **They Sharpened the Covenant** — Gen 34 — the Angels who **refuse to sing over Shechem; their silence is the witness** — the sign of belonging honed into a trap. *(Handle with grave restraint.)*
7. **He Buried Their Gods Beneath the Oak** — Gen 35:1–15 — the Angels of the ladder — the vow made in flight paid on the way home; El Shaddai seals the name Yisrael.
8. **Sorrow, Renamed** — Gen 35:16–29 — **the Letters** (summoned to spell Ben-Oni, re-summoned to spell Binyamin) — "son of my sorrow" overruled to "son of the right hand"; the generation closes.

### Album VIII — The Garments Lied, the Dreams Did Not · ANSMX1008EN · Gen 37–43 · 7 songs
Joseph I. Every garment lied; every dream told the truth. Biblical order.
1. **We Bowed in His Dream** — Gen 37 — **the morning stars / the Letters** (the eleven stars that bowed were *us*) — heaven bent to a seventeen-year-old; the blood-lying coat.
2. **She Held His Name in Her Hand** — Gen 38 — **the Yod** (pictograph = a hand) — Yehudah's signet produced at the burning; the judge convicted by his own hand.
3. **The Second Pit Was Not Empty** — Gen 39 — the Angels (saw both pits from inside) — Joseph calls the prison *bor*, pit; the first held no water, the second held Yahuah.
4. **Both Heads Were Lifted** — Gen 40 — the Angels (ledger of every forgotten day) — "lift up your head" carries life and death; the prisoner reads both true.
5. **Seven Swallowed Seven** — Gen 41 — **the Zayin** (value seven, the harvest blade) — the lean swallow the fat and stay lean; the pit-boy robed and raised by noon.
6. **One Is Not, They Told Him** — Gen 42 — the Angels (counted the first silver by the pit) — ten sheaves bowing, reporting a brother's "death" to the living brother.
7. **No One Saw Him Weep but Us** — Gen 43 — the Angels (sole witnesses in the inner chamber) — the governor fleeing his banquet to weep; eleven brothers seated in exact birth order.

### Album IX — The Throne Wept in Hebrew · ANSMX1009EN · Gen 44–50 · 7 songs
Joseph II. Ends in a coffin that is the most alive thing in Egypt. Biblical order.
1. **The Wrong Brother Confessed** — Gen 44 — the Angels (watched the steward plant the cup) — Yehudah, who once priced a brother, offers his own life.
2. **Two Words, Twenty-Two Years** — Gen 45 — **the Picture Letters, the Aleph of *Ani* leading** — the hiding ends in two words, *Ani Yoseph*; "the years counted, the letters uncounted." **⚠ KNOWN EXCEPTION:** this title's "Twenty-Two Years" is a **biblical text-number (the years of Joseph's separation, ~17→39), not a letter-count** — it is permitted and correct. `verify_album.mjs` will flag `"twenty-two"` here; confirm it's this legitimate *years* usage and **do not remove it**. (Everything else must keep the no-count rule.)
3. **We Went Down With Him** — Gen 46:1–7, 28–34 — the Angels of the Bethel ladder — "I will go down with you"; heaven's escort descends with the wagons.
4. **Empty Hands Blessed Pharaoh** — Gen 47 — the Angels (court protocol runs backward: the lesser blesses the greater) — the famine-emptied shepherd lifts his hand over the full granary.
5. **His Crossed Arms Wrote Me** — Gen 48 — **the Tav** (Paleo form = two crossed lines, the covenant mark) — the blind man crosses his hands *wittingly* and writes the last letter over the boys.
6. **Cut and Crowned in One Breath** — Gen 49 — the Angels at the bedposts — one failing breath wounds three sons and enthrones a fourth (the lion of Yehudah, the Stone of Yisrael).
7. **The Coffin Held Tomorrow** — Gen 50 — the Angels posted to a sarcophagus for four hundred years — Genesis ends in a coffin; bones under oath that make an empire keep a promise.

---

## 10. Definition of done (per album)

- [ ] N songs, one per narrative unit, cast 50-50, Gabriel not fronting.
- [ ] Every song passes all six release gates + the additional standing rules (§4).
- [ ] `verify_album.mjs` clean (all `ok`; `"twenty-two": 0` except the Album IX §9 exception).
- [ ] `qa_first_person_referent.mjs` ends `GATE PASS`.
- [ ] N IMAGE PROMPT blocks, each ≤1500 chars, each with the most-suitable/impactful per-song glyph from its derivation (variety preferred where fits are equal; repetition within an album allowed when it is the best fit).
- [ ] Header/changelog/anchors filled; station headers correct; saved to the J: path.
- [ ] Reads like it belongs beside Albums I–V (the real bar).

---

## 11. Gotchas learned building I–V

- **Suno's 5000 limit is on the LYRICS field only** — sung lines + bare tags. Do not let Styles/ratings text bleed into the Lyrics paste (that's what once tripped a >5000 rejection). The paste boundary in §7 prevents it.
- **Bare tags save characters and Suno ignores prose in brackets** — never put "[soft, building strings — the host leans in]" in LYRICS; that mood goes in Styles.
- **"gospel" in a Styles/Casting line is a music-genre word, not an anachronism** — the NT scanner does not flag it, and it's fine.
- **The Akedah / any mystery must not resolve forward.** Carry it as ache within Genesis. This is the single easiest gate to fail by instinct.
- **Per-song glyph = the most suitable, impactful letter from that song's own derivation** — pull each from its own song, and prefer variety where fits are equal, but **do not force uniqueness (owner directive, standing):** a letter may repeat within an album when it is genuinely the best fit. Suitability and impact win over novelty. Still avoid one catalog-locked glyph for everything (see Album V's Tet/Yod/Kaf/Dalet/Tsade/Ayin/Zayin/Vav/Chet as a natural-variety example, not a mandate).
- **Jubilee → never "celebration" in Styles.** Use jubilant/festival-scale/revival-scale.
- **Transient 5xx/overload errors** while spawning subagents are server-side; retry, or just write the block directly in the main thread. The scripts are deterministic and safe to re-run on a freshly assembled file.

---

## 12. Quick-start checklist for the next session

1. Read §3's docs + one shipped album file (e.g. Album V) end to end.
2. Pick Album VI. Lock its casting map (§5, §9). Draft each song's derivation angle + mode.
3. Forge 7 song blocks (§7 format), self-checking §4 gates on each.
4. Write `header.md` + `stations.json` + `song1..7.md` in a build dir; `assemble_album.mjs`.
5. `verify_album.mjs` + `qa_first_person_referent.mjs` until both clean.
6. Write 7 image bodies (§7, per-song glyphs); `add_image_prompts.mjs`; re-verify.
7. Mark VI done; repeat for VII (8), VIII (7), IX (7). Genesis is complete at 69 songs.

*Torah Sings · A Jubilee Inspire Production · © Jubilee Ministries, Inc. · Not canon — something to consider.*
