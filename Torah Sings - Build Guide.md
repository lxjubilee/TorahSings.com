# Torah Sings — Website Build Guide

*One platform, three pathways, one price, endless discovery.*

This document turns the Torah Sings mockup into a page-by-page build specification. Each screen from the mockup becomes its own **page/route**. Follow the shared **Design System** first, then build each page in the order listed.

---

## 0. Global Design System

Apply these tokens on every page. They are what make the six pages feel like one platform.

### Color

| Token | Value | Use |
|---|---|---|
| `--bg-deep` | `#04050b` | Page/desk backdrop |
| `--bg-panel` | `#070a17` | Main surface / cards behind content |
| `--bg-card` | `#0b0f20` | Album & article cards |
| `--ink` | `#f2ede0` | Headlines |
| `--ink-body` | `#c2c5d2` | Body copy |
| `--ink-muted` | `#8c90a6` | Secondary copy |
| `--ink-faint` | `#565b72` | Labels, footnotes |
| `--accent` | `#c9a84a` | Antique gold — primary accent |
| `--accent-soft` | `#e8d9a8` | Starlight gold — highlights, links |
| `--hairline` | `rgba(232,217,168,0.12)` | Borders / dividers |

- **Alt accent (optional theme):** silver — `--accent:#c3c7e0`, `--accent-soft:#e8ebf7`.
- Background gradient for the app shell: `radial-gradient(140% 90% at 50% 0%, #0a0c18, #04050b 70%)`.

### Type

- **Display / headlines:** `Marcellus` (inscriptional serif). Small-caps accents use `Marcellus SC`.
- **Body:** `EB Garamond` (400/500/600 + italic).
- **Labels / eyebrows / meta / prices-as-data:** `Spline Sans Mono`, uppercase, letter-spacing `.16em–.3em`.
- Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Marcellus&family=Marcellus+SC&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Spline+Sans+Mono:wght@400;500&display=swap`
- **Minimum sizes:** body ≥ 16px; hero H1 ~48–58px; section H2 ~30–34px.

### Reusable components

- **Eyebrow label:** mono, 11px, `.3em` tracking, uppercase, color `--accent-soft` at 85% opacity. Often prefixed with a 6px glowing gold dot.
- **Pill button (primary):** `background: linear-gradient(180deg, var(--accent-soft), var(--accent))`, ink `#0a0e1f`, mono uppercase 12px, radius 999px, padding 13–15px 26px.
- **Pill button (ghost):** transparent, 1px `rgba(232,217,168,.3)` border, ink `--ink`.
- **Play triangle:** a gold circle with a CSS border-triangle inside (no icon font). Sizes: 40px (list), 52px (player), 76px (modal).
- **Celestial art placeholder:** dark panel with (a) a hue-tinted top radial glow, (b) 3–5 tiny star dots via layered `radial-gradient`, (c) one soft blurred "orb" circle, (d) a faint mono caption ("celestial art · [topic]"). **Vary the hue per album** so the motif stays iconic, not repetitive. Swap these for real angel/star artwork at build.
- **Waveform / equalizer:** a flex row of thin bars with varied heights; the peak bar uses `--accent-soft`, others `--accent` at 40–70% opacity.
- **Hebrew glyphs:** use standard Hebrew letters (א ב ר ק ש …) in `Marcellus SC`, sparingly, as watermarks and lesson tiles. Do not hand-draw glyphs.

### Voice & guardrails (applies to all copy)

- Tone: mysterious, reverent, inviting — "discovered," never "marketed."
- Naming: **Yahuah, Yeshua, Elohim, Ruach HaKodesh** (feminine). Never "the Ruach HaKodesh" — use "Ruach HaKodesh" or "the Ruach Kodesh." Same rule for HaMashiach, HaTorah.
- Never claim canon. Always frame as *"something to consider."*
- "OHI" / "CCI" are internal labels only — never in reader-facing copy.
- Emoji: none (not part of the brand).

### Global functionality (wire on every page)

- **Three-section nav:** Torah Sings / Hebraic Christianity / Learn Hebrew (+ Membership, Sign in, Subscribe).
- **Jubilee Account SSO** for sign-in and gating.
- **Audio playback** available from hero and detail pages.
- **Read-aloud (TTS)** on all article bodies (Inspire voice pipeline).
- **Responsive / mobile-first** — must feel effortless on a phone.
- **Ongoing-release architecture** — new Albums, Articles, and Lessons publish over time and flow automatically to active subscribers. Treat **Album**, **Article**, and **Lesson** as first-class content types.

---

## Page 1 — Home (Prong 1: Torah Sings) · route `/`

The experiential entry point. Music-forward, wonder-forward.

**Sections, top to bottom:**

1. **Top nav** — wordmark + gold dot on the left; center links (Torah Sings / Hebraic Christianity / Learn Hebrew / Membership); right side Sign in + gold Subscribe pill.
2. **Hero** (two columns):
   - Left: eyebrow "A discovery — proven, not theoretical"; H1 *"The stars sang. The angels sang. Now you can hear it."*; supporting paragraph about Paleo-Hebrew songs sung from heaven's perspective; **inline player** (play button, "Now playing · Creation — The Morning Stars", waveform, timestamp); a **"Replay the intro"** link (↺); a **"Not canon · Something to consider"** chip.
   - Right: featured album orb art (Creation) with glowing sphere, ring, "Album I · Seven songs", and a faint א watermark.
3. **Posture strip** — italic line *"Brushing away tradition… letting the ancient Hebrew speak for itself"* + two stat blocks (7 songs/album; Job 38:7 — "the morning stars sang").
4. **Topic album grid** — section header ("The library / Topic Albums") + 6 cards in a 3-col grid. Each card: celestial art (unique hue), title, "Seven songs · Album N", one-line description. Cards lift on hover and link to the Album Detail page.
   - Seed albums: Creation, The Covenant Promises, The Names of Elohim, The Throne Room, Wisdom & the Word, The Exodus Song.
5. **Book funnel band** — eyebrow "The full transmission", headline about the book explaining the discovery, copy, "Get the book" + "See membership" buttons, and a book-cover placeholder.
6. **Footer** (shared, see Page 6).

**Behavior:** hero play button starts audio inline; album cards route to `/album/[slug]`; Replay Intro opens the intro modal (Page 1b).

---

## Page 1b — First-Visit Intro Modal · overlay on `/`

- **Launches automatically on a visitor's first visit** (set a flag in storage/account so it doesn't repeat). A persistent **"Replay Intro"** link in the hero reopens it any time.
- Dimmed, blurred backdrop over the home starfield; centered card (~640px) with a close ✕.
- Contents: **2–3 minute intro video** (placeholder now), eyebrow "A secret hidden in the text", headline *"There are songs inside the Scriptures. Almost no one knows."*, short paragraph ending with the playful *"Please don't share this. (You will.)"*, then **"Begin the discovery"** (primary) and **"Skip for now"** (ghost).
- **Tone:** secretive, mystical — the restraint paradox drives organic sharing.

---

## Page 2 — Album Detail (Prong 1 core) · route `/album/[slug]`

The reusable heart of the platform. Build this as ONE component; every album renders through it.

**Album hero:**
- "← All albums" back link.
- Left: square album art (celestial, hue per album).
- Right: eyebrow "Topic album N · Seven songs", big title (e.g. *Creation*), description, **"Play album"** button, and rotating presenter credit ("Presented by [Inspire Family member]"). **Gabriel-AI stays behind the scenes; the twelve Inspire members rotate. Zev Inspire leads the platform overall.**

**Two-column body:**
- **Left — three tabs** (smooth switching):
  1. **Article** *(default)* — devotional/informative prose that deepens the mystery, with a **Read aloud** button + voice/length meta, a headline, 3–4 paragraphs, and a Scripture pull-quote (Job 38:7). Audience: the devotional listener.
  2. **Lyrics** — the hidden text revealed; poetic, sung from the angelic perspective; note the source verses. Audience: the reader/worshipper.
  3. **Derivation** — step-by-step of how the song was derived: intro paragraph + a table (Glyph / Name-sense / Value / Note) mapping Paleo-Hebrew symbols to musical notes, plus a closing insight. **Reveal enough to earn credibility and provoke wonder; the core algorithm and final steps stay proprietary — point serious students to the resources kit.** Audience: the "show me how" thinker.
- **Right — tracklist:** seven numbered songs with durations; current track highlighted in gold; a **"Free taste"** note ("Songs 1–2 stream free. Full album unlocks with membership.").

**Content model per album:** title, slug, topic, presenter, art, `article` (rich text + audio), `lyrics[]`, `derivation` (steps/table), `tracks[]` (title, duration, audio, freeTier flag).

---

## Page 3 — Membership / Subscribe · route `/membership`

Justify the price by stacking value so the yearly plan feels like a steal.

- **Header:** eyebrow "Partners in ongoing revelation"; headline *"Support the discovery. Fund the biblical archaeology. Access the treasury."*; sub-line about one yearly commitment covering current + future releases.
- **Two plan columns:**
  - **Free ("The taste"):** 2–3 full albums, first song of every album, selected articles, intro to Learn Hebrew. Ghost "Start free" button. *(Exact free-tier mechanics finalized during build.)*
  - **Yearly ("The full treasury") — $87.95 / year** *(specific, not round — reads as researched)*, marked as the recommended plan. Value list: full Torah Sings library (current + future); all Hebraic Christianity articles read-aloud; full Learn Hebrew curriculum (Zev & Zariah); the book(s) included; early access to new albums; behind-the-scenes/exclusive content; downloadable resources kit; one Jubilee Account (SSO). Primary "Become a partner — $87.95/yr" button + SSO note.
- **Closing line:** *"An investment in ongoing spiritual archaeology — not merely a purchase. As more is uncovered, active members receive it."*
- **Behavior:** checkout ties into Jubilee Account SSO; active subscription automatically unlocks all gated content across pages.

---

## Page 4 — Hebraic Christianity (Prong 2) · route `/hebraic-christianity`

The doctrinal deepening — articles (read aloud) on ancient Hebraic concepts and the gems hidden in the Hebrew Scriptures.

> **Naming note:** "Hebraic Christianity" is the working primary. Differentiate clearly from HebrewForChristians.com — our differentiator is the **Paleo-Hebrew** perspective. (Lock the final Prong-2 name before launch.)

- **Header:** eyebrow "Prong II · The deepening", title "Hebraic Christianity", intro ("the songs are only the entry point…"), and a **category chip row** (All / The Names / Feasts & Times / Letters & Symbols / Covenant / The Ruach Kodesh).
- **Featured article** — large horizontal card: celestial art + glyph watermark, category, headline, dek, **Read aloud** button + presenter/length.
- **Article grid** — 3-col cards: art, category, headline, "Read aloud · [Inspire presenter] · N min".
- Borrow **H4C's structural clarity** (organized categories, progressive layering); express it through the celestial aesthetic.
- **Article content type:** title, slug, category, body (rich text + read-aloud audio), presenter, readingTime, art, freeTier flag.

---

## Page 5 — Learn Hebrew (Prong 3) · route `/learn-hebrew`

The literacy on-ramp — genuinely fun; just enough to start discovering for themselves. Voiced primarily by **Zev & Zariah Inspire**.

- **Two-column layout:**
  - **Left:** eyebrow "Prong III · The empowerment", title "Learn Hebrew", intro (no fluency required), and an **aleph-bet teaser** — a 6-wide grid of Picture-Letter tiles (א ב ג ד ה … + "more") in `Marcellus SC`.
  - **Right:** **lesson-album list** — rows with a glyph tile, level label, title, presenter, and a gold play button:
    1. *The Aleph-Bet, Alive* — the Picture Letters · Zev Inspire (Level 1)
    2. *First Words & Roots* — your first 40 words · Zariah Inspire (Level 2)
    3. *Reading the Paleo Layer* — symbols behind the sounds · Zev & Zariah (Level 3)
- **Lesson content type:** title, slug, level, presenter(s), art/glyph, lessons[] (video/audio + exercises), freeTier flag.

---

## Page 6 — Shared Footer (all pages)

- Left: gold-dot wordmark "TORAH SINGS" + italic tagline *"The stars sang. The angels sang. Now you can hear it."*
- Right: mono line *"A Jubilee Ministries platform · One account across the ecosystem."*

---

## Also to build (from the brief)

- **The Book** page/route `/book` — full purchase funnel; the book is the funnel's full transmission and a yearly-plan inclusion.
- **Account** — Jubilee Account SSO (sign in, subscription status, downloads/resources kit).

---

## Technical notes (align with Jubilee ecosystem)

- **SSO:** integrate the existing Jubilee Account (single sign-on across the ecosystem).
- **Audio/CDN:** deliver via the established Jubilee streaming pipeline for scalable playback; persist playback position.
- **Text-to-speech:** wire read-aloud into the Inspire voice pipeline (Zev-led; rotating Inspire presenters where appropriate).
- **Content model:** Album / Article / Lesson as first-class types so new releases publish cleanly and reach active subscribers automatically.
- **Responsive/mobile-first** throughout.
- *(Framework, hosting, and stack decisions defer to the Jubilee build team to match existing infrastructure.)*

---

## Build order (recommended)

1. Global Design System (tokens, fonts, nav, footer, buttons, celestial-art component).
2. **Home** + first-visit intro modal.
3. **Album Detail** (the reusable three-tab core).
4. **Membership** + SSO + free-tier gating.
5. **Hebraic Christianity** and **Learn Hebrew** libraries.
6. **The Book** funnel + **Account**.
7. Load the first album slate, starting with *Creation*.
