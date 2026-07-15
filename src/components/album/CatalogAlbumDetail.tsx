'use client';

import Link from 'next/link';
import { useAudio } from '@/components/audio/AudioProvider';
import { CelestialArt } from '@/components/system/CelestialArt';
import { Eyebrow } from '@/components/system/Eyebrow';
import { albumPlayables, hasAudio, type CatalogAlbum } from '@/lib/angels';
import styles from './CatalogAlbumDetail.module.css';

/** Lightweight album shape for the side-column lists (no track payload). */
export interface MiniAlbum {
  code: string;
  title: string;
  book: string;
  art: string | null;
  hue: number;
  glyph: string | null;
}

/**
 * The catalog album details page — JubiLujah's three-column album layout
 * (`jv-app-grid`) minus the banner: a left "library" list, the center album
 * (cover · meta · tracklist), and a right "related" list.
 *
 * The center column is the only in-flow height; the two side panels stretch to
 * match it (their inner content is absolutely positioned, so a long list can
 * never make a side column taller than the center — it just scrolls). When the
 * center shrinks — a short album, or "coming soon" — the side columns shrink with
 * it, always to the same height.
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
  const { toggle, isCurrent, playing } = useAudio();
  const playable = hasAudio(album);
  const queue = albumPlayables(album);
  const playFrom = (i: number) => {
    if (queue[i]) toggle(queue[i], queue);
  };

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

        {/* CENTER — the album. This column drives the shared height. */}
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
              <Eyebrow>{album.book}</Eyebrow>
              <h1 className={styles.title}>{album.title}</h1>
              <div className={styles.sub}>
                <span>Sung by the Angels</span>
                <span className={styles.dot}>·</span>
                <span>
                  {playable
                    ? `${album.tracks.length} song${album.tracks.length === 1 ? '' : 's'}`
                    : 'Coming soon'}
                </span>
                {categoryTitle && (
                  <>
                    <span className={styles.dot}>·</span>
                    <span>{categoryTitle}</span>
                  </>
                )}
              </div>
              <div className={styles.actions}>
                <button type="button" className="pill" onClick={() => playFrom(0)} disabled={!playable}>
                  {playable ? 'Play album' : 'Audio coming soon'}
                </button>
              </div>
            </div>
          </div>

          {playable && (
            <div className={styles.tracks}>
              <div className={styles.trackHead}>
                <span aria-hidden="true" />
                <span>#</span>
                <span>Title</span>
              </div>
              <ol className={styles.trackList}>
                {album.tracks.map((t, i) => {
                  const p = queue[i];
                  const active = p ? isCurrent(p.id) : false;
                  return (
                    <li key={t.n} className={styles.trackRow} data-active={active ? 'yes' : 'no'}>
                      <button
                        type="button"
                        className={styles.tplay}
                        onClick={() => playFrom(i)}
                        aria-label={active && playing ? `Pause ${t.title}` : `Play ${t.title}`}
                      >
                        {active && playing ? <PauseIcon /> : <PlayIcon />}
                      </button>
                      <span className={styles.tnum}>{t.n}</span>
                      <span className={styles.tname}>{t.title}</span>
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

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
