# TORAH SINGS — ALBUM & SONG PITCH PROCESS
## Repeatable Method v1.0 — How the Genesis Pitch Was Built, and How to Build the Next One

**Produces:** a book-level pitch document (album titles + song titles + sequencing + coverage ledger), ready for the production pipeline. No lyrics at this stage.
**First run:** `pitches/Genesis - The Nine Albums.md` (nine albums, sixty-nine songs, no honest zeros — every narrative unit sung after the "don't leave songs behind" re-cut).
**Governed by:** `_METHODOLOGY - Album & Song Creation.md` (the signed selection law) and `_GROUNDING - Torah Sings Project.md` (the project constitution). Read both before starting. This document adds the *how* on top of their *what*.

---

## THE PROCESS AT A GLANCE

```
Read-first  →  1. Map narrative units   →  2. Group albums    →  3. Forge titles        →  4. Assemble & QA
(grounding,    (at the text's seams;      (theme/arc; 7 target,  (two competing smiths     (pitch doc + coverage
methodology,    honest zeros named)        ceiling; §3.3 splits)   per album + a judge)      ledger + scans)
ref tracks)
```

Steps 1–2 are **structural** — done by one mind with the text open, because unit boundaries and groupings must be defensible as a single coherent judgment. Step 3 is **competitive** — parallel creative agents beat a single pass. Step 4 is **editorial** — one mind again, for catalog-level coherence.

## MODEL ASSIGNMENT (owner's standing directive, 2026-07-08)

When orchestrating any Torah Sings generation with AI agents:
- **GENERATION runs on the Opus model** — title smiths, lyric writers (architect/cantor), and any agent whose job is creative output.
- **VERIFICATION runs on the Fable model** — judges, trace auditors, adversarial verifiers, coherence/continuity checks, and QA gates.
- In workflow scripts this means `model: 'opus'` on writer agents and `model: 'fable'` on judge/verify agents. The split applies to every stage of the pipeline: pitch forge, song identification review, lyric forge, remasters.

**TEMPORARY OVERRIDE (owner directive, 2026-07-08 — while the Fable session limit is hit):** use **Opus for verification too** — generation AND audit both run on Opus until the Fable limit resets. When the main assistant already holds both source drafts (e.g., combining/blending existing verified songs, or judging drafts whose writer agents already succeeded), do the blend + audit **inline** rather than spawning a subagent, to avoid hitting the shared session cap. Revert to the Opus-generate / Fable-verify split once Fable is available again.

---

## STEP 0 — READ FIRST (never skip)

1. `_GROUNDING - Torah Sings Project.md` — the two singing voices (the morning stars = the Picture Letters; the sons of Elohim = the Angels, Job 38:7), the witness-or-join-in posture, the Hebraic Music Mandate, sacred-name conventions.
2. `_METHODOLOGY - Album & Song Creation.md` — one song per narrative unit; seven-song target; flexible floor; §3.3 distribution; **biblical-narrative-order sequencing** (NARRATIVE-ORDER RULE — supersedes the methodology's original "artistic sequencing"); honest titling.
3. The four reference tracks in `import/` — the register every title must sit beside: *The Letters Sang*, *The Garden Broke*, *Our Brothers Fell*, *Hidden Frequencies*.

---

## STEP 1 — MAP THE NARRATIVE UNITS

Work through the whole book with the text open. For every chapter, draw unit boundaries **at the text's own seams**:

- **In Genesis:** the *toledot* formulas ("these are the generations of…") are the primary seams — the book's own outline. Other books supply their own: itinerary formulas ("and they journeyed…") in Exodus/Numbers, speech openings in Deuteronomy, regnal formulas in Kings, oracle headings in the prophets.
- Within a toledot section, split at character / setting / time / genre changes (Genesis 4 = three units: Cain and Abel; the line of Cain; Seth).
- **One unit = at most one song. Never two songs from one story.**
- **Name any honest zeros — but the bar is high, and "don't leave songs behind" governs.** A unit yields no song only when it is a pure connective bridge with no story, image, or theological turn of its own. On the Genesis re-cut, the four first-pass zeros (11:27–32; 20; 21:22–34; 28:1–9) were re-examined and **all promoted to songs** — each held a real narrative or a divine-name reveal. Zeros should be rare; when you name one, write the one-line reason. Never use a zero to protect a song count, and never split one story into two to inflate one.

Deliverable of this step: a table of every unit — passage, one-line description, song yes/no.

## STEP 2 — GROUP THE ALBUMS

- Group by **theme and story arc**, never by verse blocks. Each album must answer *why are these songs together?* in one sentence.
- **Seven is the target, not a cap; the narrative governs the count and the floor flexes** (Genesis run after the re-cut: albums of 6, 7, 10, 8, 9, 7, 8, 7, 7 — the count follows the stories, never a ceiling).
- **Use §3.3 aggressively:** genealogies pulled out of five different chapters made *The Names Outlived the Graves* — a stronger record than leaving each list stranded on a narrative album. Look for the same move in every book (census lists in Numbers; tribal allotments in Joshua).
- Assign each album's arc position from the grounding's seven-station template (Veil → Benediction) loosely — it guides sequencing later.

## STEP 3 — FORGE THE TITLES (the competitive core)

For **each album**, run two competing title-smiths in parallel, then one judge. (First run: a background workflow — 18 smiths + 9 judges; the same structure works run by hand, one album at a time.)

**Smith A — the Paradox Smith.** Forges titles around inversions and impossibilities the text makes true: *the weapon hung pointing away, the famine that fed, the blessing that limps.*

**Smith B — the Witness Smith.** Forges titles as the celestial witnesses' own testimony — what the Angels confess they saw and felt, what a Letter carried: interiority, grief, awe, the personal stake (*Our Brothers Fell*).

Each smith delivers: **3 album-title candidates** (with one line of why each is honest to the grouping), **one song title per unit** with a **voice line** (who sings — always the Angels and/or a named Letter, per the VOICE RULE; impersonal creation the text supplies — a well, a heap, a vine, the ground — may be *invoked as image*, never made the singer) and an **image line** (the paradox or picture it hangs on), and a proposed **sequence in biblical narrative order** with rationale.

**The judge** then, per album: picks or blends the strongest album title; picks/refines the stronger song title per unit; enforces the craft rules below; picks or improves the sequence; writes a 2–3 sentence album pitch paragraph in the house voice.

### The Craft Rules (give these to every smith and judge, verbatim)

- **Song titles are written from the Angel and/or Hebrew Letter perspective** — the witness speaking: what WE saw, what the Letter carried. First-person-plural possessives, letter-voice, and witness verbs are the native register.
- **Emotionally shocking but reverent** — the gut-punch of *Our Brothers Fell*; never camp, never cute, never a pun for its own sake.
- **Paradox is prized** where the text supports it. A great paradox title states an impossibility the passage makes true.
- **Concrete over abstract. 2–7 words.** Ellipses and commas sparingly.
- **Hebrew terms welcome** when singable and honest (tevah, tov, Peniel, lech lecha, El Roi). Sacred-name conventions absolute; no doubled article on Ha- forms; no anglicized divine names; no emoji.
- **Honesty rule (methodology §5):** a listener seeing title + passage must recognize the story.
- **No two titles in a set share a formula or cadence.**
- For each song title, state **whose voice it is** and **the image it hangs on** — these lines feed the lyric engine later.

### Patterns that won the first run (reuse them)

- **The text's own words as title:** *Come, Let Us Go Down* (Gen 11:7) · *One Is Not, They Told Him* (Gen 42).
- **The possessive that wounds:** *Our Maker Knelt in Dust* · *Our Hands Were Not Enough* · *The Sword We Held Was Mercy*.
- **Letter-voice keyed to pictograph or value:** the Yod (hand, value ten) sings the signet in a fist and the count that stopped at ten; the Tsade opens *tsachaq*, the laugh-root inside Yitschaq; the Tav — two crossed lines in Paleo-Hebrew — sings the crossed arms of Genesis 48; the Zayin (value seven) sings the seven lean years; the Vav confesses its own consecutive chain (*He Ate, and Rose, and Went*).
- **The witness with a stake:** the cherubim of Genesis 3 singing their own sword; the two angels of Genesis 19 singing the wrists they gripped; the wrestler of Genesis 32 claiming the defeat in first person.
- **Impersonal witnesses the text supplies, invoked as images (never as the singer):** the well of Beer Lahai Roi, the heap of stones at Mizpah, the vine of Genesis 9 — the Angels or the Letters sing *around* them and point to them. *(The first run's "blood of Abel as singer" is retired by the VOICE RULE: a victim's blood reads as the human voice and breaks the conceit. The witnesses now lament the first death from heaven's side.)*
- **Sequencing moves (inside biblical order — NARRATIVE-ORDER RULE):** the running order IS the text's own chronology; do **not** reorder for drama — the first-run moves that placed Abel's blood *after* Lamech's boast, or held Tamar's signet back to the pit-bottom of the Joseph descent, are **retired** (they confuse the listener following the story). Craft still operates *within* the order: an opener that establishes and a closer that lands (the Veil principle — the hushed thing opens when it comes first in the text), and a Selah allowed to fall where the text's own still point falls. When the chapters already form a chiasm (Genesis 29–35), the native order IS the artistic shape — say so.

## STEP 4 — ASSEMBLE AND QA

Assemble the pitch document with, per album: the title + one-line *why*, the pitch paragraph, the **play-order tracklist** (song · passage · who sings · the image it hangs on) — where **play order equals biblical narrative order** (NARRATIVE-ORDER RULE), so the tracklist and the receipt below now run in the same sequence — the **sequencing rationale**, and the **narrative-unit receipt** in biblical order proving one-song-per-unit. Close the document with:

- **The Coverage Ledger** — every chapter of the book accounted for, including the honest zeros with reasons. This table is the whole defense in one place.
- **Compliance notes** — sacred names, Hebraic Music Mandate, the not-canon posture, and the pointer to the next pipeline stage.

**QA gates before shipping (all were run on Genesis):**
1. **Fidelity spot-checks** — verify each title's claim against the text (e.g., *Both Heads Were Lifted* = Gen 40:13/19 verbatim device; *She Wrestled First* = *naphtulei Elohim*, Gen 30:8, two chapters before Peniel; *Two Words, Twenty-Two Years* = *Ani Yoseph* + the traditional chronology).
2. **Formula-duplication scan** — across the whole catalog, no repeated title shape within an album; across albums, the house "We…" register is allowed but watch for near-twins.
3. **Sacred-name scan** — grep the finished document for the doubled article, anglicized names, internal labels, emoji.
4. **Unit-receipt audit** — every song maps to exactly one unit; every unit appears exactly once in the book's ledger (or is a named zero).

Then hand off: titles + voice/image lines feed `music_torahSings - song engine v2.md` per song → Tahoma four-axis QA → Suno production → CDN.

## STEP 5 — ASSIGN CODES AND SCAFFOLD THE WAREHOUSE

Every pitched album gets a catalog code and a folder on the J: drive (the warehouse — see `J:\README-CONTRACT.md`):

- **Code scheme:** `ANSMX` + book number + album number (3 digits) + language suffix. Genesis: `ANSMX1001EN`–`ANSMX1009EN` (`1` = Book 01, `EN` = English master; translations swap the suffix per the Jubilee translation catalog SOP).
- **Folder layout:** `J:\music\angels\NN_<Book>\<CODE> <Album Title>\` with `lyrics\`, `blueprints\`, `tracks\`, `artwork\` subfolders. **Filing rule:** `lyrics\` holds exactly ONE file per album — the album lyrics file in the Jubilee album-lyrics format (Caleb Inspire standard), named `Torah Sings-<Album Title>-lyrics.md` (never "suno_ready" in filenames); each song is a block with a `CASTING (12-voice suitability evaluation)` per `music_torahSings - voice casting matrix.md`. The full derivation package files in `blueprints\` (`NN_song_title_blueprint.md`).
- **Catalog file:** a `~index.md` in the book folder — codes, titles, arcs, song counts, status column, pointer back to the pitch. Update the status column as albums move through the pipeline (Pitched → Identification → Lyrics → Production → Approved).
- Record the codes back in the pitch document's catalog table so the two stay in lockstep.

**STYLES FIELD RULE (owner directive, standing):** every song's `Styles:` / Music Style field must be **under 900 characters** and must **name no musical artist** — no real-world artists/composers/bands/works (copyright), and no Inspire persona names (the persona lives in `ARTIST:`/`CASTING` only). Pure sonic description: voice type, genre/fusion, Hebraic mode, instrumentation, dynamics/BPM, diction, mood, length.

**LYRICS FIELD RULE (owner directive, standing; updated 2026-07-08 after Suno-doc review):** every song's `LYRICS:` block (all content between `LYRICS:` and `Styles:`) must not exceed **5000 characters total** (Suno's lyrics-field ceiling). Use **bare Suno structure tags only** (`[Intro]`, `[Verse 1]`, `[Chorus]`, `[Bridge]`, `[Outro]`, `[End]`, …) — no production commentary inside the brackets. Suno recognizes only the tag word and ignores prose, which merely burns the character budget; all production intent lives in the Style field and the blueprint. Never cut sung lines the derivation needs.

**IMAGE-PROMPT RULE (owner directive, standing, 2026-07-08):** every finished song block ends with an **`IMAGE PROMPT:`** field — a photorealistic angelic-marketing-art prompt generated *from the lyrics* per `image_torahSings - angelic image generation guide.md` (**≤1500 chars, first ~250 weighted heaviest**; the T7 hidden-glyph in every image; the standard negative prompt lives in the guide, not the field). Governing question: *what were the angels doing while this song was being sung?* — angels mid-song, faces obscured, unaware of the lens; **Yahuah/Yeshua never a rendered face**; vary vantage/register/placement/scale/technique across the catalog.

---

## NOTES FROM THE FIRST RUN

- Two smiths with **different creative doctrines** genuinely beat one: roughly half the final titles came from each, and several winners were judge-forged blends neither smith proposed alone.
- The judges' best interventions were **vetoes of self-repetition** — killing titles that echoed already-shipped songs (*Our Brothers Fell* cadences kept reappearing) — and **cross-album variety enforcement** in the voice assignments (Angel-heavy sets got a Letter or an alternate witness swapped in).
- The **image line matters as much as the title** — it is the seed the lyric engine will grow from. A title without a stated image is a title that will drift in production.
- Budget observed: ~27 agents (≈930k tokens) for a 50-chapter book. Scale expectation linearly by chapter count.

---

*Torah Sings · A Jubilee Inspire Production · © Jubilee Ministries, Inc.*
