'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Kpi, KpiRow, Notice, SectionSub, SectionTitle } from './AdminUI';
import styles from './ActiveListeners.module.css';

/**
 * Who is listening right now.
 *
 * The API counts a session as live if its now_playing row was touched in the
 * last 45 seconds, so this polls at 5s — often enough that a listener appears
 * promptly, slow enough that an admin leaving the tab open overnight does not
 * quietly issue 17,000 requests.
 *
 * Polling stops when the tab is hidden and resumes (with an immediate fetch) on
 * return. A background tab has nobody watching it; continuing to poll would
 * only spend the server's time.
 */

const POLL_MS = 5_000;
/** Matches the API's liveness window — see WHERE updated_at > NOW() - 45s. */
const LIVE_WINDOW_S = 45;

interface Listener {
  session_id: string;
  name: string;
  location: string | null;
  album: string;
  track: number | null;
  song: string;
  code: string | null;
  cover: string | null;
  since: string;
}

interface Response {
  count: number;
  listeners: Listener[];
}

/** Cover art, falling back to a note glyph when absent or broken. */
function CoverThumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  if (!src || broken) {
    return (
      <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
        </svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.thumb} src={src} alt={alt} onError={() => setBroken(true)} />;
}

/** Five bars on staggered delays, so no two rows pulse in lockstep. */
function Equalizer({ seed }: { seed: number }) {
  return (
    <span className={styles.eq} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={styles.eqBar}
          style={{
            animationDelay: `${((seed * 37 + i * 91) % 700) / 1000}s`,
            animationDuration: `${700 + ((seed * 13 + i * 53) % 500)}ms`,
          }}
        />
      ))}
    </span>
  );
}

const elapsed = (sinceIso: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

export function ActiveListeners() {
  const [data, setData] = useState<Response | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // Ticks once a second so the elapsed column counts up between polls.
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    () =>
      api
        .get<Response>('/api/admin/active-listeners')
        .then((r) => {
          setData(r);
          setErr(null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load listeners.')),
    [],
  );

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const start = () => {
      if (timer.current) return;
      void load();
      timer.current = setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setPaused(true);
      } else {
        setPaused(false);
        start();
      }
    };

    if (!document.hidden) start();
    else setPaused(true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const listeners = data?.listeners ?? [];

  return (
    <>
      <SectionTitle>Active listeners</SectionTitle>
      <SectionSub>
        Sessions that reported in within the last {LIVE_WINDOW_S} seconds, refreshed every{' '}
        {POLL_MS / 1000} seconds. The bars are a visualiser, not the actual waveform — the server
        cannot tap a listener&apos;s audio stream.
      </SectionSub>

      <div className={styles.head}>
        <span className={styles.live}>
          <span className={styles.dot} data-paused={paused ? 'yes' : 'no'} />
          {paused ? 'Paused — tab in background' : 'Live'}
        </span>
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {!err && (
        <>
          <KpiRow>
            <Kpi n={data ? data.count.toLocaleString() : '—'} label="Listening now" />
            <Kpi
              n={data ? new Set(listeners.map((l) => l.album)).size.toLocaleString() : '—'}
              label="Albums in play"
            />
          </KpiRow>

          {data === null && <Notice>Connecting…</Notice>}

          {data !== null && listeners.length === 0 && (
            <Notice>Nobody is listening right now.</Notice>
          )}

          {listeners.map((l, i) => (
            <div key={l.session_id} className={styles.row}>
              <CoverThumb src={l.cover} alt={l.album} />

              <div className={styles.who}>
                <div className={styles.name}>{l.name}</div>
                <div className={styles.song}>
                  {l.track != null && <>{l.track}. </>}
                  {l.song}
                </div>
                <div className={styles.meta}>
                  {l.album}
                  {l.location ? ` · ${l.location}` : ''}
                </div>
              </div>

              <span className={styles.elapsed}>{elapsed(l.since, now)}</span>
              <Equalizer seed={i + 1} />
            </div>
          ))}
        </>
      )}
    </>
  );
}
