# TODO — Job Lyrics Update (2026-07-19)

Job (18_Job) — the cornerstone book (Job 38:7 names the platform's two voices). 7 albums, 39 songs, all shipped. This file tracks (A) the one change **applied** so far, and (B) the audit findings **still pending** owner go-ahead.

---

## A. APPLIED — mp3 re-render required

### ⚠ Album II · Track 04 — "No Hand to Lay on Both of Them" (Job 9–10)
**File:** `J:\music\angels\18_Job\ANSMX18002EN Physicians of No Value\lyrics\Torah Sings-Physicians of No Value-lyrics.md`
**Rendered audio:** `…\ANSMX18002EN Physicians of No Value\tracks\04 No Hand to Lay on Both of Them.mp3`

- [ ] **RE-RENDER this track's mp3** — the sung lyrics changed (below), so the existing audio is stale.

**What changed (2026-07-19, owner-flagged constellation accuracy + language):**
- Sung chorus ×2: "He made Arcturus, and **the Orion belt**, / the Pleiades, the chambers of the south" → "He made **the Bear**, He made **Kesil**, **Kimah**, / and the hidden chambers of the south."
  - "Orion's Belt" is a Greek/Hellenistic asterism the Joban author would not have known. The Hebrew **Kesil** (Job 9:9) is the whole bound-giant figure, not the three belt-stars, and "belt" appears in neither the Hebrew nor the KJV — it was a lyricist addition (anachronism + unauthorized addition, against the project's "add nothing" rule).
  - "Arcturus" was also corrected: the Hebrew **ʿAsh** = the Bear (Ursa Major), not the star Arcturus (a KJV translation artifact).
  - Restored to the book's own Hebrew star-names, matching the album's Hebrew-diction convention (Yahuah, Iyov, Eloah, Sheol, go'el, Livyatan…).
- Sung intro constellation line aligned: "Which maketh Arcturus, Orion, and Pleiades" → "Who made the Bear, and Kesil, and Kimah."
- Folded in this song's KJV-archaism cleanup (sung intro + verse 2 + outro): removeth/overturneth/shaketh/spreadeth/treadeth → modern; betwixt → between; "what doest Thou" → "what do You do"; "show me wherefore… Thou contendest" → "show me why… You contend".
- ARCHETYPE metadata constellation mentions aligned. Both gates re-run: **PASS**. Backup: scratchpad `job-backup-2026-07-19\`.
- Left as-is (non-sung metadata, optional follow-up): the **Theological Anchors** line still cites the KJV of Job 9:8–9 verbatim ("maketh Arcturus, Orion, and Pleiades") as the scholarly source; the **IMAGE PROMPT** still says "Orion and the Pleiades" (visual art, not audio).

---

## B. PENDING — audited but NOT yet fixed (awaiting owner go-ahead)

A full read-only audit of all 7 Job albums (2026-07-19) found the book is **strong on voice doctrine** but **weak on the KJV-modernization directive**, plus a few voice soft-spots. Both pipeline gates pass on all 7 albums (the gates don't test for archaisms or unframed recitation), so these are gaps the gates miss. Every affected mp3 would need re-rendering after a fix.

**Cornerstone handled well:** Album VI's opening 38:7 antiphon (the Angels and morning stars answering the whirlwind from inside the foundation-morning) is exemplary — do not touch that celestial voice.

### Language (systemic across all 7 albums)
Nearly every **[Spoken Intro]** is pasted verbatim KJV and never modernized (~135 archaisms in albums I–III alone; ~47 in VI, ~15 in VII; ~30 each in IV and V), plus **[Outro] blocks** that echo raw-KJV fragments back into sung sections. Worst songs by archaism count: III-01 "Were You There Before the Hills" (18), I-02 "We Came to Present Ourselves" (15), I-05 "Skin for Skin" (15), II-04 (now fixed), II-05 "Higher Than Heaven, Deeper Than Sheol" (12).

### Voice (fewer; concentrated in the first-person speeches)
- [ ] **Album IV · Track 02 "He Shall Come Forth as Gold" (Job 23–24)** — 15 unframed human-first-person lines: Job's oath ("My foot has held His steps… I have not declined") sung as bare "I" in the chorus/pre-chorus/outro. Its sibling Track 04 already shows the correct fix ("Till I die, **he said**, I will not put away my integrity") — apply the same framing.
- [ ] **Album V · Track 01 "Eyes to the Blind, Feet to the Lame" (Job 29)** — 15 lines: Job's honor-oath ("I was a father to the poor… I made the widow's heart to sing") sung unframed. Track 05 (Elihu, fully framed) is the model.
- [ ] **Album V · Tracks 02, 03, 04, 06** — unframed first-person [Spoken Intros] (Job's/Elihu's "I" with no "he said" frame), e.g. T04 "I am young, and ye are very old." ~30 human lines total across the album.
- [ ] **Album VII · Track 01 "Dust and Ashes No Answer Given" (Job 42)** — Job's "I abhor myself, and turn in dust and ashes" sung in the repeated chorus with only distal framing; contradicts the song's own ARCHETYPE (which claims third-person) and VI-Track 04's cleaner in-chorus "he said." Add an in-chorus frame or convert.
- [ ] **Album VI · Track 04** — one body leak: "yea, twice" in the sung chorus/outro (modernize "yea").

### Soft flags (owner eye, not hard violations)
- [ ] **Album II · Track 03 "If the Children Sinned"** — the Angels sing "we had carried those ten children home… we laid those ten to rest." Defensible as angelic ministry, but it's the one celestial "we" claiming a quasi-physical, mortal-adjacent act. Decide whether to keep.

### Per-album verdicts
| Album | Passage | Voice | Language | Verdict |
|-------|---------|-------|----------|---------|
| I — A Wager He Never Heard | Job 1–3 | clean | ~47 archaisms | language only |
| II — Physicians of No Value | Job 4–14 | clean (T04 done) | ~46 (T04 done) | language (+T03 soft flag) |
| III — I Know That My Go'el Lives | Job 15–21 | clean | ~42 archaisms | language only |
| IV — Where Shall Wisdom Be Found? | Job 22–28 | T02 (15 human) | ~30 archaisms | both |
| V — Let Shaddai Answer Me | Job 29–37 | T01 + 4 intros (30 human) | ~29 archaisms | both |
| VI — When the Morning Stars Sang Together | Job 38–41 | clean (cornerstone excellent) | ~47 archaisms | language (+T04 "yea") |
| VII — Now My Eye Has Seen You | Job 42 | T01 soft | ~15 archaisms | language + 1 voice tighten |

**If the full Job fix pass is authorized:** it would mirror the Psalms/Proverbs/Ecclesiastes/Song-of-Songs sweeps (frame/convert every unmarked human line incl. intros, modernize all archaisms in sung text, keep the divine whirlwind speech framed, preserve the VI cornerstone antiphon), re-run both gates, update changelogs, and flag every touched track's mp3 for re-render. Also note: the folder/title for Album III reads "Go'el" on disk but the index lists "Redeemer" — reconcile.

---

**Also (housekeeping):** `J:\music\angels\18_Job\~index.md` still says "Lyrics drafted: 0 / 7" (last refreshed 2026-07-09) — stale; refresh when convenient.
