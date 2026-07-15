# Torah Sings

*One platform, three pathways, one price, endless discovery.*

Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules. No UI dependencies.

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + content verification + production build
```

---

## What is here

Six routes, built to `Torah Sings - Build Guide.md`:

| Route | Prong | Notes |
|---|---|---|
| `/` | I — Torah Sings | Hero + inline player, posture strip, album grid, book funnel |
| `/album/[slug]` | I | The reusable core. Three tabs + gated tracklist |
| `/hebraic-christianity` | II | Category chips, featured card, article grid |
| `/hebraic-christianity/[slug]` | II | Read-aloud article; gated pieces show a teaser |
| `/learn-hebrew` | III | Aleph-bet teaser + three lesson levels |
| `/learn-hebrew/[slug]` | III | Lessons with working exercises |
| `/membership` | — | Free tier vs. $87.95/yr |
| `/book` | — | Purchase funnel |
| `/account` | — | Jubilee Account: status, resources kit |

The first-visit intro modal overlays `/` and is reopened by **Replay the intro** in the hero.

---

## The derivation engine

`src/lib/derivation.ts` is the disclosed layer of the method, and it is **real code, not a
transcription**. Each album declares a Hebrew source phrase and a mode. The engine reads the phrase
symbol by symbol, folds each letter's standard value by seven onto a degree, and sounds that degree
in the album's mode. The Derivation tab renders whatever the engine produces.

```
בראשית → 2, 200, 1, 300, 10, 400
       → degrees 2, 4, 1, 6, 3, 1
       → E♭ · G · D · B♭ · F♯ · D   (Ahavah Rabbah on D)
```

`npm run verify` reimplements all of this **from scratch** — it deliberately does not import
`derivation.ts` — and asserts that each album's own closing paragraph quotes the note line the
independent implementation produces. If the prose and the engine ever drift apart, the build fails.
A platform that invites people to check its work cannot afford to be wrong in public.

**Withheld by design:** the ordering/interleave layer that turns a degree sequence into melody,
rhythm and octave placement, and the voice-assignment pass. Stated plainly on every album page.

---

## Integration points

Everything below is a clearly-marked seam. Nothing pretends to be finished.

### 1. Jubilee Account SSO — `src/lib/jubilee-account.tsx`

Set `NEXT_PUBLIC_JUBILEE_SSO_URL` and the provider hands off to the real service:

- `signIn()` → `{SSO}/authorize?redirect_uri=…`
- `subscribe()` → `{SSO}/checkout?plan=yearly&…`
- `purchaseBook()` → `{SSO}/checkout?product=book&…`
- session read from `GET /api/session` (implement against your identity service)

**Unset, it runs a local stub** that persists a fake session to `localStorage`, so gating,
subscription state, and unlocks can be exercised end to end. The account page says so out loud
rather than letting the stub pass for the real thing.

### 2. Audio / CDN — `src/lib/media.ts`

Every `Track.audioUrl` currently points at `/audio/placeholder-ambient.wav`, a **synthesized drone**
(`npm run audio:placeholder`). It is not music and not a Torah Sings production. It exists so the
transport, waveform, scrubber, duration, and playback-position persistence run against a real
`<audio>` element. Swap `audioUrl` for CDN URLs — set `NEXT_PUBLIC_JUBILEE_CDN` to prefix relative
keys — and delete the WAV plus its generator.

### 3. Read-aloud / Inspire voice — `src/components/reading/useReadAloud.ts`

When an Article or Album carries an `audioUrl`, that pre-rendered Inspire-voice read is handed to
the shared audio engine. All are `null` today, so it **falls back to the browser's speech
synthesis** — and the button says "Browser voice" rather than crediting a presenter who did not
speak.

### 4. Intro video — `src/components/intro/IntroModal.tsx`

Set `INTRO_VIDEO_URL` and the placeholder plate disappears. Until then the modal says
"film pending" instead of miming a player that plays nothing.

### 5. Presenter roster — `src/lib/presenters.ts`

All **twelve Inspire Family members** are on the roster and sing where suitable — Zev Inspire leads
the platform. Gabriel Inspire (Gabriel-AI) is listed in `BEHIND_THE_SCENES` and never presents;
`npm run verify` enforces both rules on all published content.

---

## Content model

`Album`, `Article`, and `Lesson` are first-class types (`src/lib/types.ts`). Adding a release is
adding a file and a line in `src/content/index.ts`.

Every read goes through `src/lib/content.ts`, which filters on `releasedAt`. **Date a release in the
future and it stays hidden until its hour comes** — pages revalidate hourly, so a new album surfaces
to active subscribers without a deploy.

When this moves behind a CMS, keep the three exports from `src/content/index.ts` and nothing
downstream notices.

## Gating — `src/lib/access.ts`

The per-track `freeTier` flag is the single source of truth. The membership page reads the actual
data to write its own free-tier copy, so it can never advertise a taste the gating does not serve.
The album article and derivation tabs are **always open** — they are the invitation.

Auto-advance is entitlement-aware: locked songs are never queued, so a guest is never walked into a
paywall mid-listen.

---

## Design system

Tokens live in `src/app/globals.css` and are normative. Fonts: Marcellus, Marcellus SC, EB Garamond,
Spline Sans Mono (self-hosted via `next/font`). Hebrew glyphs are standard letters — never hand-drawn.
Celestial art is seeded from each slug, so the stars scatter identically on server and client.

An optional silver theme ships behind `<html data-accent="silver">`.

---

## Verification

`npm run verify` enforces, across all content:

- **Voice guardrails** — no `the Ruach HaKodesh` (doubled article), no `the HaTorah`/`the HaMashiach`,
  no `OHI`/`CCI`, no emoji, no `Jesus`/`Jehovah` (use Yeshua/Yahuah), no placeholder text.
  Musical accidentals (♭ ♯) and typographic characters are explicitly allowed.
- **Structure** — albums sized by their narrative (no fixed track count; two is the floor so the
  free taste can exist), tracks 1–2 free on gated albums, one featured article, one pull-quote each.
- **Exercises** — every `answerIndex` in bounds, choices distinct, teaching note present, and the
  answer key not skewed toward one position.
- **The derivation** — independently recomputed and matched against the prose.

---

## Known open decisions

- **Prong II name.** "Hebraic Christianity" is the working primary. Lock before launch.
- **Book price.** `BOOK_PRICE_LABEL` in `src/lib/format.ts` is a **placeholder** — the brief prices
  the yearly plan but never the standalone book.
- **Free tier.** The Build Guide says "songs 1–2 stream free" on the album page and "first song of
  every album" on the membership page. The data implements 1–2 and the membership copy follows the
  data. Change the flags and every surface follows.
