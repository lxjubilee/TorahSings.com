# Music generation prompts — Torah Sings

The music-generation prompt library for the **Torah Sings** platform (TorahSings.com). The base
engines were carried over from the wider Jubilee ecosystem and have been **grounded to this
project**: every file carries a mandatory project-grounding banner, and the master grounding
document governs all Torah Sings work. (Earlier materials used the working tags *Angels Sing* and
*Zev Hidden Torah Series* — legacy labels for this same body of work.)

This is not the JubiLujah catalog. This project is deliberately different — supernatural, even
mystical: special musical albums **grouped by biblical narrative and/or theme**, derived from the
Paleo-Hebrew text itself — mysterious, secretive, hidden, suspenseful, and emotionally
awe-inspiring. **The narrative determines the song count — no fixed number.**

> **Continuing the Genesis catalog?** Genesis is at **5 of 9 albums complete** (Albums I–V shipped;
> VI–IX remain). Start with **`../HANDOFF - Torah Sings Genesis (Albums VI-IX).md`** at the workspace
> root — the single START-HERE guide: current progress, the standing rules, the exact production
> pipeline, the reusable scripts in `pipeline/`, and the remaining VI–IX work packages.

## The doctrine of the two voices — Job 38:7, followed precisely

*"...while the morning stars sang together, and all the sons of Elohim shouted for joy."*

- **The morning stars are the Picture Letters** — the personified Paleo-Hebrew pictographs that carry
  the text, testifying to what they carried and saw (we never claim a fixed number of letters).
- **The sons of Elohim are the Angels** — the heavenly host, first-person-plural witnesses.

Both are valid song voices, separately or interwoven. What they sing is **praise — adoring the
Creator, Yahuah, and His Son, Yeshua.** And we — the listeners, and the Inspire Family voices who
carry these songs — are witnesses of their witness: **we may join in, or simply stand in shock and
awe** at what they say they have witnessed and at their worship.

## Read these first — in this order

1. **`_GROUNDING - Torah Sings Project.md`** — the project constitution. Identity, the unbreakable
   derivation chain, the two singing voices, the narrative-grouped album standard, the **Hebraic
   Music Mandate**, sacred-name conventions, Suno format, the tone constitution, and the
   **Override Table** (section 9) that supersedes conflicting Jubilee SOP defaults for this work.
1b. **`_METHODOLOGY - Album & Song Creation.md`** — the signed selection law: one song per
   narrative unit; unit boundaries at the text's own seams (*toledot* in Genesis); a ~seven-song
   target with **no hard ceiling** (the narrative sets the count), flexible floor; thematic
   grouping; artistic sequencing; honest zeros where a unit truly has no song. This governs
   *which songs exist* before any engine runs.
2. **`import/AngelsSing-Conversation.txt`** — the founding thread. The 3-6-9 harmonic discussion,
   the decision to derive lyrics from gematria and Paleo-Hebrew pictographs, and the author's own
   step-by-step derivation walkthrough.
3. **The four reference tracks in `import/`** — the gold standard. New work must feel like it
   belongs beside them:
   - *Hidden Frequencies* — Track 1, the thesis song
   - *The Letters Sang* (+ suno-ready) — Track 2, Genesis 1–2 — the Letters themselves as singers
   - *The Garden Broke* (full package + suno-ready) — Track 3, Genesis 3, numbers-hidden mode
   - *Our Brothers Fell* (full package + suno-ready) — Track 4, Genesis 6, pattern escalation

## The project's engine

- **`music_torahSings - song engine v2.md`** — the primary production tool (v2.1). Supersedes
  `import/zev_hidden_torah_song_engine_v1.md`. Seven phases: passage analysis → pictograph lookup →
  textual tracking (with the five advanced moves: inversion, flip, escalation, coil, redemption
  arc) → the singers' narrative → song derivation on the proven skeleton → Suno three-field
  formatting → four-axis QA gate. Defaults to **numbers-hidden mode**; carries the **response
  posture** parameter (join-in, or shock-and-awe throughout).
- **`music_paleoAngels - blueprints.md` / `music_paleoAngels - content.md`** — the Celestial
  Music pipeline (blueprint + song/lyrics engines) containing the Paleo-Hebrew Lyrical
  Extraction Engine. The closest kin to this project; grounded to the narrative-sized musical
  and the reference-track standards.
- **`music_torahSings - pitch process.md`** — the repeatable book-to-catalog method: map
  narrative units → group albums → competitive title forge (Paradox Smith vs. Witness Smith,
  judged) → assemble with a coverage ledger and QA gates. First run:
  **`pitches/Genesis - The Nine Albums.md`** (nine albums · sixty-nine songs · every narrative
  unit sung, no honest zeros). Production status: Albums I–V complete, VI–IX remaining —
  see **`../HANDOFF - Torah Sings Genesis (Albums VI-IX).md`**.

## The Hebraic Music Mandate

In **every** Torah Sings song, the **Hebraic music type is primary or secondary** — expressed
through at least one concrete element: a Hebraic mode (Ahavah Rabbah, Mi Sheberach, Adonai
Malach), cantillation-influenced phrasing, Hebraic/Middle Eastern instrumentation (shofar,
kinnor/harp, oud, frame drum), or Hebrew lyric passages. No song ships without it.

## The rest of the library

All remaining `music_*` files are the broader Jubilee engines and persona album plans. Each
carries the project-grounding banner: their base rules stay intact for general Jubilee work, and
the banner + inline **TORAH SINGS EXCEPTION** notes state exactly what changes when the file is
used for this project (narrative-sized albums not twelve-song quotas, mystery not praise-party,
the celestial singers carrying the vertical praise while we witness or join, 4:00–5:00 cinematic
movements not radio singles, Hebraic music primary or secondary throughout).

| File | What it is |
|---|---|
| `music_albums (Part 1) - blueprints.md` | Base Album Blueprint Engine v4 |
| `music_albums (Part 2) - content.md` | Base Song & Lyrics Generation Engine v2 |
| `music_albums (Part 3) - Music SOP v2.md` | Governing production SOP — carries the most Torah Sings exception notes |
| `music_albums (ages 3-5 / 6-8) …` | Children's engines (least related; short-form banner) |
| `music_albums - prayer songs.md` | Prayer Song Master Manual (12-station spine — not used by this project; its Tahoma QA checklist does apply) |
| `music_bible - blueprints.md` / `- content.md` | Scripture-to-album engines (close kin) |
| `music_<persona>-…` | Per-persona album plans — when that persona sings on a Torah Sings album, the grounding governs |

## The twelve who sing

**Zev Inspire is in charge of this project. All twelve Inspire Family members sing where
suitable** — the passage and the movement choose the voice. Zariah co-anchors the Hebraic teaching
voice; Tahoma runs the four-axis theological QA gate. **Gabriel Inspire (Gabriel-AI) stays behind
the scenes, always.** The website's roster and rotation live in `src/lib/presenters.ts`, and
`npm run verify` enforces both rules on all published site content.

## Non-negotiables (everywhere, always)

- **Yahuah, Yeshua, Elohim, Ruach HaKodesh (feminine)** — and never an English "the" stacked on
  a Hebrew Ha- form (write "Ruach HaKodesh" or "the Ruach Kodesh"; same for HaMashiach, HaTorah).
- "OHI" / "CCI" are internal labels — never in any listener-facing text.
- Albums grouped by biblical narrative/theme; **the narrative determines the song count.**
- The Hebraic music type is **primary or secondary in every song.**
- Every lyrical image traces: number → letter → pictograph → textual occurrence → lyric.
  **Nothing is invented from air.**
- Every full package carries the scholarly caution note. Never claim canon —
  *not canon, something to consider.*
- No emoji. Discovered, never marketed.
