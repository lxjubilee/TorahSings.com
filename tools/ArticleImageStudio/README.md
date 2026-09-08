# Article Image Studio — TorahSings

A small Windows desktop app (WPF + WebView2) that generates the hero images for
the **Hebraic Christianity** articles by driving *your own logged-in ChatGPT
browser session* — no API key, no per-image cost. You log into ChatGPT by hand
in the embedded browser (a real browser, so Cloudflare's human-check passes
normally); the app then types each article's image prompt, waits for the
picture, converts it to WebP, and saves it beside the article set.

Ported from JubileeVerse and re-pointed at TorahSings. The browser-automation
half is unchanged; only the data layer was re-targeted.

> **Terms of use:** this automates the ChatGPT web UI against your own session,
> which may conflict with OpenAI's Terms. Use at your own discretion.

## What it reads and writes

- **Reads:** `J:\torahsings.com\articles\hebraic\*.md` — the article corpus.
  Each file's `imagePrompt:` frontmatter field is the prompt that gets sent.
  The source `.md` files are **never modified.**
- **Writes:** `J:\torahsings.com\articles\hebraic\images\<slug>.webp`
  (plus `articles.json` in the category folder as a worklist/tracker).
- **Done-tracking:** an article counts as done purely because its
  `images\<slug>.webp` exists — so a stopped or crashed run never loses place,
  and re-running only fills the gaps.

The articles root is configurable in the app (defaults to
`J:\torahsings.com\articles`) and remembered in `studio.config.json`
(git-ignored).

## Prerequisites

- **.NET 10 SDK** (installed) — the project targets `net10.0-windows`.
- **WebView2 Runtime** — ships with Edge on Windows 11 (already present).

## Run it

```
tools\ArticleImageStudio\Build-And-Run.cmd
```

or, from this folder:

```
dotnet build -c Release
bin\Release\net10.0-windows\ImageStudio.exe
```

Then:

1. Log into ChatGPT in the left-hand browser pane (once; the session persists in
   `%LocalAppData%\TorahSings\ArticleImageStudio\webview2`).
2. *(Optional)* open your ChatGPT **Images** project and click
   "Use current page as location" so every generation lands in that project.
3. Click **Generate every pending article** (or **Generate Next** for one). The
   run paces itself 20-45 s between images and stops after 3 failures in a row
   (usually a quota/capacity signal).

## Getting the images onto the site

The images live off-repo on the article drive; two npm scripts (run from the
repo root) connect them to the website:

```
npm run images:wire     # scan the images folder -> src/content/article-images.ts (the manifest the site reads)
npm run images:deploy   # rclone the images up to Cloudflare R2 (see caveat below)
```

`ArticleArt` (`src/components/system/ArticleArt.tsx`) then serves
`https://cdn.torahsings.com/articles/hebraic/images/<slug>.webp` for any article
whose slug has an image, and falls back to the `CelestialArt` placeholder
otherwise. Override the host with `NEXT_PUBLIC_ARTICLE_IMAGE_BASE` if needed.

> ⚠️ **Confirm the deploy target.** `images:deploy` currently syncs to
> `jubilee-r2:torahsings-cdn/articles/hebraic/images`, assuming an R2 bucket
> `torahsings-cdn` fronted by the custom domain `cdn.torahsings.com` (mirroring
> how `jubileeverse-cdn` fronts `cdn.jubileeverse.com`). If that bucket/domain
> isn't set up yet, or the mapping differs, fix the destination in
> `package.json` (and/or point `NEXT_PUBLIC_ARTICLE_IMAGE_BASE` at wherever the
> images actually end up). The rclone remote is `jubilee-r2`, per `docs/DEPLOY.md`.

## Note on the article corpus

`J:\torahsings.com\articles\hebraic\` (a network share,
`\\HDC-INSPIRESERVER\JubileeVerse`) is **not** under git and had no backup at
the time of writing — it is the only copy of those ~49 articles. Back it up
before bulk edits.

## Current slug mismatch (worth knowing)

The site's article list in `src/content/articles/index.ts` is a 7-article sample
whose slugs differ from the ~49 in the corpus. Images generated for the corpus
will therefore only appear on the site once those articles are actually rendered
by it (e.g. when the corpus is imported into the site's content). Until then the
sample articles keep their CelestialArt placeholders, and the wiring lights up
automatically for any slug that gains an image.
