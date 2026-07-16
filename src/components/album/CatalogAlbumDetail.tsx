'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAudio } from '@/components/audio/AudioProvider';
import { CelestialArt } from '@/components/system/CelestialArt';
import { StarRating } from '@/components/system/StarRating';
import { albumPlayables, hasAudio, type CatalogAlbum } from '@/lib/angels';
import { SongRating, type SongSummary } from './SongRating';
import styles from './CatalogAlbumDetail.module.css';

/**
 * Where a visitor's own ratings live until the reviews API is wired.
 *
 * There is no ratings backend yet, so a rating never leaves this browser and no
 * aggregate is invented: if you have rated, the count is 1 (you) — otherwise 0.
 * When the reviews router comes up, replace readSongRatings/saveRating with
 * GET/PUT /api/reviews/:type/:id (docs/API.md §7) and the components above need
 * no change — SongSummary already mirrors the API's ReviewSummary shape.
 */
const songKey = (code: string, n: number) => `ts.rating.song.${code}.${n}`;
const albumKey = (code: string) => `ts.rating.${code}`;

/** Lightweight album shape for the side-column lists (no track payload). */
export interface MiniAlbum {
  code: string;
  title: string;
  book: string;
  art: string | null;
  hue: number;
  glyph: string | null;
}

/** Material-style icon paths (24×24). */
const ICON = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * The catalog album details page — JubiLujah's three-column album layout
 * (`jv-app-grid`) minus the banner. The center card mirrors JubiLujah's
 * `jv-center` panel: cover + eyebrow · serif title · meta, a ratings box, an
 * action row (big play · add to playlist · follow), then the tracklist.
 *
 * The center column is the only in-flow height; the two side panels stretch to
 * match it and scroll internally.
 */
export function CatalogAlbumDetail({
  album,
  categoryTitle,
  library,
  more,
}: {
  album: CatalogAlbum;
  categoryTitle?: string;
  library: MiniAlbum[];
  more: MiniAlbum[];
}) {
  const { current, playing, toggle, isCurrent } = useAudio();
  const playable = hasAudio(album);
  const queue = albumPlayables(album);

  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());

  // Per-song ratings. Read in an effect, never during render — localStorage does
  // not exist on the server and reading it inline would break hydration.
  const [songRatings, setSongRatings] = useState<Record<number, number>>({});
  const [rateTarget, setRateTarget] = useState<{ type: 'album' | 'song'; n: number; label: string } | null>(null);

  useEffect(() => {
    const out: Record<number, number> = {};
    try {
      for (const t of album.tracks) {
        const v = Number(window.localStorage.getItem(songKey(album.code, t.n)));
        if (v) out[t.n] = v;
      }
    } catch {
      /* storage unavailable — ratings simply will not persist */
    }
    setSongRatings(out);
  }, [album.code, album.tracks]);

  const songSummary = (n: number): SongSummary | null => {
    const mine = songRatings[n];
    return mine ? { average: mine, rating_count: 1, mine } : null;
  };

  const openRate = (type: 'album' | 'song', n: number, label: string) =>
    setRateTarget({ type, n, label });

  const saveRating = (stars: number) => {
    if (!rateTarget) return;
    const key = rateTarget.type === 'album' ? albumKey(album.code) : songKey(album.code, rateTarget.n);
    try {
      window.localStorage.setItem(key, String(stars));
    } catch {
      /* storage unavailable */
    }
    if (rateTarget.type === 'song') {
      setSongRatings((prev) => ({ ...prev, [rateTarget.n]: stars }));
    } else {
      // The album box owns its own state; tell it to re-read.
      window.dispatchEvent(new CustomEvent('ts:album-rating', { detail: stars }));
    }
    setRateTarget(null);
  };

  const onAlbum = queue.some((q) => isCurrent(q.id));
  const albumPlaying = onAlbum && playing;

  const playFrom = (i: number) => {
    if (queue[i]) toggle(queue[i], queue);
  };
  const playAlbum = () => {
    if (!playable) return;
    if (onAlbum && current) toggle(current, queue);
    else playFrom(0);
  };
  const toggleAdded = (n: number) =>
    setAdded((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(n)) nextSet.delete(n);
      else nextSet.add(n);
      return nextSet;
    });

  const related = more.length ? more : library.filter((a) => a.code !== album.code);

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Link href="/#library" className={styles.back}>
          &#8592; All albums
        </Link>
      </div>

      <div className={styles.grid}>
        {/* LEFT — library list. Height follows the center column; list scrolls. */}
        <aside className={`${styles.panel} ${styles.side}`}>
          <div className={styles.sideInner}>
            <div className={styles.sideHead}>{categoryTitle ?? 'Library'}</div>
            <div className={styles.sideList}>
              {library.map((item) => (
                <MiniRow key={item.code} item={item} active={item.code === album.code} />
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — the album card (drives the shared height). */}
        <section className={`${styles.panel} ${styles.center}`}>
          <div className={styles.centerHead}>
            <div className={styles.coverWrap}>
              {album.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={album.art} alt="" decoding="async" />
              ) : (
                <CelestialArt
                  seed={album.code}
                  hue={album.hue}
                  topic={album.book}
                  glyph={album.glyph}
                  ratio="1 / 1"
                />
              )}
            </div>

            <div className={styles.centerInfo}>
              <div className={styles.eyebrow}>Album</div>
              <h1 className={styles.title}>{album.title}</h1>
              <div className={styles.sub}>
                <span>Sung by the Angels</span>
                <span className={styles.dot}>·</span>
                <span>
                  {playable
                    ? `${album.tracks.length} song${album.tracks.length === 1 ? '' : 's'}`
                    : 'Coming soon'}
                </span>
                <span className={styles.dot}>·</span>
                <span className={styles.genrePill}>{album.book}</span>
                {playable && <span className={styles.hd}>HD</span>}
                {categoryTitle && (
                  <>
                    <span className={styles.dot}>·</span>
                    <span className={styles.secondaryGenre}>{categoryTitle}</span>
                  </>
                )}
              </div>

              <AlbumRating code={album.code} onRate={() => openRate('album', 0, album.title)} />
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.bigplay}
              onClick={playAlbum}
              disabled={!playable}
              aria-label={albumPlaying ? 'Pause album' : 'Play album'}
            >
              <Icon d={albumPlaying ? ICON.pause : ICON.play} />
            </button>

            <button
              type="button"
              className={`${styles.addpl} ${saved ? styles.addplOn : ''}`}
              onClick={() => setSaved((s) => !s)}
              aria-pressed={saved}
            >
              {saved ? 'Added to Playlist' : 'Add to Playlist'}
            </button>

            <button
              type="button"
              className={styles.follow}
              onClick={() => setFollowing((f) => !f)}
              aria-pressed={following}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          </div>

          {playable && (
            <div className={styles.tracks}>
              <div className={styles.trackHead}>
                <span>#</span>
                <span>Title</span>
                <span aria-hidden="true" />
                <span className={styles.thDur} aria-hidden="true">
                  🕑
                </span>
              </div>
              <ol className={styles.trackList}>
                {album.tracks.map((t, i) => {
                  const p = queue[i];
                  const active = p ? isCurrent(p.id) : false;
                  return (
                    <li
                      key={t.n}
                      className={`${styles.trackRow} ${active ? styles.playing : ''}`}
                      onClick={() => playFrom(i)}
                      data-active={active ? 'yes' : 'no'}
                    >
                      <span className={styles.tnumWrap}>
                        <span className={styles.tnum}>{t.n}</span>
                        <span className={styles.tplay}>
                          <Icon d={active && playing ? ICON.pause : ICON.play} />
                        </span>
                      </span>
                      <span className={styles.tname}>
                        <span className={styles.ttitle}>{t.title}</span>
                        <SongRating
                          summary={songSummary(t.n)}
                          onRate={() => openRate('song', t.n, t.title)}
                        />
                      </span>
                      <span className={styles.tadd}>
                        <button
                          type="button"
                          className={added.has(t.n) ? styles.tAddOn : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAdded(t.n);
                          }}
                          aria-label={added.has(t.n) ? 'Remove from My List' : 'Add to My List'}
                        >
                          <Icon d={added.has(t.n) ? ICON.check : ICON.add} />
                        </button>
                      </span>
                      <span className={styles.tdur}>--:--</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        {/* RIGHT — related albums. Also follows the center height and scrolls. */}
        <aside className={`${styles.panel} ${styles.side}`}>
          <div className={styles.sideInner}>
            <div className={styles.sideHead}>
              {more.length ? `More from ${album.book}` : `More in ${categoryTitle ?? 'the catalog'}`}
            </div>
            <div className={styles.sideList}>
              {related.map((item) => (
                <MiniRow key={item.code} item={item} active={false} />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {rateTarget && (
        <RateDialog
          type={rateTarget.type}
          label={rateTarget.label}
          initial={rateTarget.type === 'song' ? (songRatings[rateTarget.n] ?? 0) : 0}
          onSave={saveRating}
          onClose={() => setRateTarget(null)}
        />
      )}
    </div>
  );
}

/**
 * The rate popup, modelled on JubiLujah's ReviewComposer: one dialog serves both
 * "Rate this Album" and a track's "Rate". Stars are required; the note is
 * optional.
 *
 * Stars are kept (locally); the note is NOT — there is nowhere to store review
 * text until the reviews API is wired, so the dialog says so rather than
 * pretending to file it.
 */
function RateDialog({
  label,
  type,
  initial,
  onSave,
  onClose,
}: {
  label: string;
  type: 'album' | 'song';
  initial: number;
  onSave: (stars: number) => void;
  onClose: () => void;
}) {
  const [stars, setStars] = useState(initial);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Escape closes, as it does on JubiLujah.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.rateBackdrop} onClick={onClose}>
      <div
        className={styles.rateModal}
        role="dialog"
        aria-modal="true"
        aria-label={`Rate this ${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.rateHead}>
          <h3 className={styles.rateTitle}>Rate this {type}</h3>
          <button type="button" className={styles.rateX} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className={styles.rateTarget}>{label}</p>

        <div className={styles.rateStars}>
          <StarRating
            value={stars}
            onChange={(n) => {
              setStars(n);
              setErr(null);
            }}
            size="lg"
            ariaLabel={`Your rating for ${label}`}
          />
        </div>

        <label className={styles.rateField}>
          <span>Add a note (optional)</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you hear in it?"
          />
        </label>

        <p className={styles.rateNotice}>
          Your stars are kept on this device only. Notes are not saved yet — reviews arrive with your Jubilee
          Account.
        </p>

        {err && <p className={styles.rateErr}>{err}</p>}

        <div className={styles.rateActions}>
          <button type="button" className={styles.rateCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.rateSave}
            onClick={() => {
              if (stars < 1) {
                setErr('Please choose a star rating.');
                return;
              }
              onSave(stars);
            }}
          >
            Save rating
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * JubiLujah's `rv-album-rating` box. There's no ratings backend yet, so this is
 * an honest local control: the visitor's own star rating, persisted in
 * localStorage — no invented aggregate score.
 */
function AlbumRating({ code, onRate }: { code: string; onRate: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [showReviews, setShowReviews] = useState(false);
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(`ts.rating.${code}`));
      if (v) setRating(v);
    } catch {
      /* storage unavailable */
    }
  }, [code]);

  // The rate dialog lives in the parent, so it announces saves rather than
  // reaching in here.
  useEffect(() => {
    const onSaved = (e: Event) => setRating((e as CustomEvent<number>).detail);
    window.addEventListener('ts:album-rating', onSaved);
    return () => window.removeEventListener('ts:album-rating', onSaved);
  }, []);

  const rate = (n: number) => {
    setRating(n);
    try {
      window.localStorage.setItem(`ts.rating.${code}`, String(n));
    } catch {
      /* storage unavailable */
    }
  };

  const shown = hover || rating;

  return (
    <div className={styles.ratingBox}>
      <div className={styles.ratingMain}>
        <div className={styles.stars} ref={starsRef} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className={styles.star}
              data-on={i <= shown ? 'yes' : 'no'}
              onMouseEnter={() => setHover(i)}
              onClick={() => rate(i)}
              aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
        <span className={`${styles.ratingNum} ${rating ? '' : styles.ratingNumNone}`}>
          {rating ? rating.toFixed(1) : '—'}
        </span>
        <span className={styles.ratingCount}>
          {rating ? 'Your rating' : 'No ratings yet — be the first'}
        </span>
      </div>

      <div className={styles.ratingActions}>
        <button type="button" className={styles.rateBtn} onClick={onRate}>
          {rating ? 'Update rating' : 'Rate this Album'}
        </button>
        <button
          type="button"
          className={styles.reviewsLink}
          onClick={() => setShowReviews((s) => !s)}
        >
          Ratings &amp; Reviews &rarr;
        </button>
      </div>

      {showReviews && <div className={styles.reviewsNote}>No reviews yet — be the first.</div>}
    </div>
  );
}

function MiniRow({ item, active }: { item: MiniAlbum; active: boolean }) {
  return (
    <Link href={`/album/${item.code}`} className={styles.mini} data-active={active ? 'yes' : 'no'}>
      <span className={styles.miniThumb} style={{ backgroundColor: `hsl(${item.hue} 45% 22%)` }}>
        {item.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.art} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.miniGlyph} aria-hidden="true">
            {item.glyph ?? '♪'}
          </span>
        )}
      </span>
      <span className={styles.miniText}>
        <span className={styles.miniTitle}>{item.title}</span>
        <span className={styles.miniSub}>{item.book}</span>
      </span>
    </Link>
  );
}
