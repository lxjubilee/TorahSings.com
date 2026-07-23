'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  AdminTable,
  Button,
  ButtonRow,
  EmptyRow,
  Kpi,
  KpiRow,
  Notice,
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';
import { BarChart, LineChart, type Point } from './Charts';
import styles from './Analytics.module.css';

/**
 * The media analytics dashboard: seven views over production.playback_events
 * and the review summaries.
 *
 * Each tab fetches only when first opened — the overview alone runs nine
 * queries server-side, so loading all seven up front would make every visit pay
 * for six views nobody asked for.
 */

type Tab = 'overview' | 'trends' | 'albums' | 'songs' | 'users' | 'ratings' | 'reviews';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends', label: 'Trends' },
  { key: 'albums', label: 'Albums' },
  { key: 'songs', label: 'Songs' },
  { key: 'users', label: 'Users' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'reviews', label: 'Reviews' },
];

const n = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—');
const hrs = (seconds: number) => `${(Math.round((seconds / 3600) * 10) / 10).toLocaleString()}h`;
const stars = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)}★`);
const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function Analytics() {
  const [tab, setTab] = useState<Tab>('overview');
  const [err, setErr] = useState<string | null>(null);

  // One cache per tab, so switching back does not refetch.
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [ratings, setRatings] = useState<RatingsResponse | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);

  const fail = useCallback((e: unknown) => {
    setErr(e instanceof Error ? e.message : 'Could not load analytics.');
  }, []);

  useEffect(() => {
    setErr(null);
    if (tab === 'overview' && !overview) {
      api.get<Record<string, unknown>>('/api/analytics/overview').then(setOverview).catch(fail);
    } else if (tab === 'trends' && !trends) {
      api.get<TrendsResponse>('/api/analytics/trends?days=90').then(setTrends).catch(fail);
    } else if (tab === 'ratings' && !ratings) {
      api.get<RatingsResponse>('/api/analytics/ratings').then(setRatings).catch(fail);
    } else if (tab === 'reviews' && !reviews) {
      api.get<ReviewsResponse>('/api/analytics/reviews').then(setReviews).catch(fail);
    }
  }, [tab, overview, trends, ratings, reviews, fail]);

  return (
    <>
      <SectionTitle>Media analytics</SectionTitle>
      <SectionSub>
        Plays, listeners, and reception across the catalogue. Figures come from the playback event log,
        so they reflect what was actually streamed rather than what was published.
      </SectionSub>

      <div className={styles.tabs} role="tablist" aria-label="Analytics views">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={styles.tab}
            data-active={tab === t.key ? 'yes' : 'no'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {!err && tab === 'overview' && <OverviewTab data={overview} />}
      {!err && tab === 'trends' && <TrendsTab data={trends} />}
      {!err && tab === 'albums' && <TableTab key="albums" kind="albums" />}
      {!err && tab === 'songs' && <TableTab key="songs" kind="songs" />}
      {!err && tab === 'users' && <TableTab key="users" kind="users" />}
      {!err && tab === 'ratings' && <RatingsTab data={ratings} />}
      {!err && tab === 'reviews' && <ReviewsTab data={reviews} />}
    </>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────── */

function Highlight({ label, title, meta }: { label: string; title?: string; meta?: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardTitle}>{title || '—'}</div>
      {meta && <div className={styles.cardMeta}>{meta}</div>}
    </div>
  );
}

interface Named {
  title?: string;
  artist?: string;
  album?: string;
}

function OverviewTab({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <Notice>Loading the overview…</Notice>;
  const d = data as Record<string, number | null> & {
    most_played_album?: (Named & { plays: number }) | null;
    most_played_song?: (Named & { plays: number }) | null;
    most_active_listener?: { name: string; plays: number; hours: number } | null;
    most_rated_album?: (Named & { rating_count: number }) | null;
    most_reviewed_album?: (Named & { review_count: number }) | null;
  };

  return (
    <>
      <KpiRow>
        <Kpi n={n(d.total_plays)} label="Total plays" />
        <Kpi n={`${n(d.total_listening_hours)}h`} label="Listening hours" />
        <Kpi n={n(d.active_users)} label="Active listeners" />
        <Kpi n={n(d.total_users)} label="Accounts" />
      </KpiRow>
      <KpiRow>
        <Kpi n={n(d.total_albums)} label="Albums" />
        <Kpi n={n(d.total_songs)} label="Songs" />
        <Kpi n={n(d.completed_plays)} label="Completed plays" />
        <Kpi n={n(d.skipped_plays)} label="Skipped plays" />
      </KpiRow>
      <KpiRow>
        <Kpi n={n(d.total_ratings)} label="Ratings" />
        <Kpi n={n(d.total_reviews)} label="Reviews" />
        <Kpi n={stars(d.avg_album_rating ?? null)} label="Avg album rating" />
        <Kpi n={stars(d.avg_song_rating ?? null)} label="Avg song rating" />
      </KpiRow>

      <div className={styles.highlight}>
        <Highlight
          label="Most played album"
          title={d.most_played_album?.title}
          meta={d.most_played_album ? `${n(d.most_played_album.plays)} plays` : undefined}
        />
        <Highlight
          label="Most played song"
          title={d.most_played_song?.title}
          meta={d.most_played_song ? `${n(d.most_played_song.plays)} plays` : undefined}
        />
        <Highlight
          label="Most active listener"
          title={d.most_active_listener?.name}
          meta={d.most_active_listener ? `${n(d.most_active_listener.plays)} plays · ${d.most_active_listener.hours}h` : undefined}
        />
        <Highlight
          label="Most rated album"
          title={d.most_rated_album?.title}
          meta={d.most_rated_album ? `${n(d.most_rated_album.rating_count)} ratings` : undefined}
        />
      </div>
    </>
  );
}

/* ── Trends ────────────────────────────────────────────────────────────── */

interface TrendsResponse {
  daily: { day: string; plays: number; hours: number; completed: number; skipped: number }[];
  dau: { day: string; users: number }[];
  monthly: { month: string; plays: number; hours: number }[];
  peak_hours: { hour: number; plays: number }[];
  peak_days: { dow: number; plays: number }[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TrendsTab({ data }: { data: TrendsResponse | null }) {
  if (!data) return <Notice>Loading trends…</Notice>;

  const daily = data.daily ?? [];
  const plays: Point[] = daily.map((d) => ({ label: shortDay(d.day), value: d.plays }));
  const hours: Point[] = daily.map((d) => ({ label: shortDay(d.day), value: d.hours }));
  const dau: Point[] = (data.dau ?? []).map((d) => ({ label: shortDay(d.day), value: Number(d.users) }));
  const byHour: Point[] = (data.peak_hours ?? []).map((h) => ({ label: String(h.hour), value: h.plays }));
  const byDow: Point[] = (data.peak_days ?? []).map((d) => ({ label: DOW[d.dow] ?? String(d.dow), value: d.plays }));

  const totalPlays = daily.reduce((a, d) => a + d.plays, 0);
  const totalHours = daily.reduce((a, d) => a + d.hours, 0);

  return (
    <>
      <SectionSub>
        The last 90 days. Each measure gets its own panel rather than sharing an axis — plays and hours
        are different scales, and stacking them on one chart would misrepresent both.
      </SectionSub>
      <div className={styles.chartGrid}>
        <LineChart title="Plays per day" total={n(totalPlays)} data={plays} />
        <LineChart title="Listening hours per day" total={`${Math.round(totalHours)}h`} data={hours} unit="h" />
        <LineChart title="Daily active listeners" data={dau} />
        <BarChart title="Plays by hour of day" data={byHour} />
        <BarChart title="Plays by day of week" data={byDow} />
      </div>
    </>
  );
}

/* ── Albums / Songs / Users tables ─────────────────────────────────────── */

interface TableResponse {
  total: number;
  page: number;
  limit: number;
  items: Record<string, unknown>[];
}

const COLUMNS: Record<string, { key: string; label: string; sortable?: boolean; render?: (r: Record<string, unknown>) => React.ReactNode }[]> = {
  albums: [
    { key: 'title', label: 'Album' },
    { key: 'artist', label: 'Artist' },
    { key: 'plays', label: 'Plays', sortable: true },
    { key: 'listeners', label: 'Listeners', sortable: true },
    { key: 'listening_seconds', label: 'Hours', sortable: true, render: (r) => hrs(Number(r.listening_seconds) || 0) },
    { key: 'avg_rating', label: 'Rating', sortable: true, render: (r) => stars(r.avg_rating as number | null) },
  ],
  songs: [
    { key: 'title', label: 'Song' },
    { key: 'album', label: 'Album' },
    { key: 'plays', label: 'Plays', sortable: true },
    { key: 'listeners', label: 'Listeners', sortable: true },
    { key: 'listening_seconds', label: 'Hours', sortable: true, render: (r) => hrs(Number(r.listening_seconds) || 0) },
    { key: 'avg_rating', label: 'Rating', sortable: true, render: (r) => stars(r.avg_rating as number | null) },
  ],
  users: [
    { key: 'name', label: 'Listener' },
    { key: 'email', label: 'Email' },
    { key: 'plays', label: 'Plays' },
    { key: 'songs', label: 'Songs' },
    { key: 'listening_seconds', label: 'Hours', render: (r) => hrs(Number(r.listening_seconds) || 0) },
    { key: 'last_listen', label: 'Last heard', render: (r) => (r.last_listen ? new Date(String(r.last_listen)).toLocaleDateString() : '—') },
  ],
};

function TableTab({ kind }: { kind: 'albums' | 'songs' | 'users' }) {
  const [data, setData] = useState<TableResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  // The users endpoint has no sort parameter — only albums and songs do.
  const [sort, setSort] = useState('plays');
  const cols = COLUMNS[kind];

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (q.trim()) params.set('q', q.trim());
    if (kind !== 'users') params.set('sort', sort);
    setData(null);
    setErr(null);
    api
      .get<TableResponse>(`/api/analytics/${kind}?${params}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the table.'));
  }, [kind, page, q, sort]);

  /**
   * CSV comes back as a file, not JSON, so it bypasses the api client and is
   * fetched directly with the bearer token, then handed to the browser as a
   * blob. A plain <a href> could not carry the Authorization header.
   */
  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/analytics/export?kind=${kind}`, {
        headers: { authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `torahsings-analytics-${kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (data?.limit || 25)));

  return (
    <>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder={`Search ${kind}…`}
          value={q}
          aria-label={`Search ${kind}`}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Button small onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {!err && (
        <>
          <AdminTable
            head={
              <>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={c.sortable ? styles.sortable : undefined}
                    onClick={c.sortable ? () => { setSort(c.key); setPage(1); } : undefined}
                  >
                    {c.label}
                    {c.sortable && sort === c.key && <span className={styles.sortArrow}>▾</span>}
                  </th>
                ))}
              </>
            }
          >
            {data === null && <EmptyRow colSpan={cols.length}>Loading…</EmptyRow>}
            {data?.items.length === 0 && <EmptyRow colSpan={cols.length}>Nothing recorded yet.</EmptyRow>}
            {data?.items.map((row, i) => (
              <tr key={String(row.album_id ?? row.song_id ?? row.user_id ?? i)}>
                {cols.map((c) => (
                  <td key={c.key} className={typeof row[c.key] === 'number' ? cell.num : undefined}>
                    {c.render ? c.render(row) : (row[c.key] as React.ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </AdminTable>

          {total > 0 && (
            <div className={styles.pager}>
              <ButtonRow>
                <Button small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button small disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </ButtonRow>
              <span>
                Page {page} of {pages} · {n(total)} rows
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── Ratings ───────────────────────────────────────────────────────────── */

interface RatingsResponse {
  total_album_ratings: number;
  total_song_ratings: number;
  average_rating: number | null;
  raters: number;
  distribution: Record<string, number> | { stars: number; count: number }[];
  highest_rated_albums?: (Named & { avg_stars?: number; rating_count?: number })[];
  lowest_rated_albums?: (Named & { avg_stars?: number; rating_count?: number })[];
}

function RatingsTab({ data }: { data: RatingsResponse | null }) {
  if (!data) return <Notice>Loading ratings…</Notice>;

  // The endpoint may express the distribution as a map or as rows; accept both.
  // Bound to a local so the Array.isArray check actually narrows the union —
  // re-reading data.distribution inside the ternary does not.
  const raw = data.distribution;
  const dist: Point[] = Array.isArray(raw)
    ? raw.map((d) => ({ label: `${d.stars}★`, value: d.count }))
    : [1, 2, 3, 4, 5].map((s) => ({ label: `${s}★`, value: Number(raw?.[String(s)] ?? 0) }));

  return (
    <>
      <KpiRow>
        <Kpi n={stars(data.average_rating)} label="Average rating" />
        <Kpi n={n(data.raters)} label="Raters" />
        <Kpi n={n(data.total_album_ratings)} label="Album ratings" />
        <Kpi n={n(data.total_song_ratings)} label="Song ratings" />
      </KpiRow>

      <div className={styles.chartGrid}>
        <BarChart title="Rating distribution" data={dist} />
      </div>

      <RatedList title="Highest rated albums" rows={data.highest_rated_albums} />
      <RatedList title="Lowest rated albums" rows={data.lowest_rated_albums} />
    </>
  );
}

function RatedList({ title, rows }: { title: string; rows?: (Named & { avg_stars?: number; rating_count?: number })[] }) {
  if (!rows?.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      <AdminTable
        head={
          <>
            <th>Album</th>
            <th>Artist</th>
            <th>Rating</th>
            <th>Ratings</th>
          </>
        }
      >
        {rows.map((r, i) => (
          <tr key={`${r.title}-${i}`}>
            <td>{r.title ?? '—'}</td>
            <td className={cell.muted}>{r.artist ?? '—'}</td>
            <td className={cell.num}>{stars(r.avg_stars ?? null)}</td>
            <td className={cell.num}>{n(r.rating_count)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

/* ── Reviews ───────────────────────────────────────────────────────────── */

interface ReviewsResponse {
  total_album_reviews: number;
  total_song_reviews: number;
  reviewers: number;
  avg_review_length: number;
  pending_moderation: number;
  most_reviewed_album?: (Named & { review_count: number }) | null;
  most_reviewed_song?: (Named & { review_count: number }) | null;
  latest?: {
    title?: string;
    target_type: string;
    stars: number;
    body: string | null;
    by: string | null;
    created_at: string;
  }[];
}

function ReviewsTab({ data }: { data: ReviewsResponse | null }) {
  if (!data) return <Notice>Loading reviews…</Notice>;

  return (
    <>
      <KpiRow>
        <Kpi n={n(data.total_album_reviews)} label="Album reviews" />
        <Kpi n={n(data.total_song_reviews)} label="Song reviews" />
        <Kpi n={n(data.reviewers)} label="Reviewers" />
        <Kpi n={n(Math.round(data.avg_review_length || 0))} label="Avg length (chars)" />
        <Kpi n={n(data.pending_moderation)} label="Pending moderation" />
      </KpiRow>

      <div className={styles.highlight}>
        <Highlight
          label="Most reviewed album"
          title={data.most_reviewed_album?.title}
          meta={data.most_reviewed_album ? `${n(data.most_reviewed_album.review_count)} reviews` : undefined}
        />
        <Highlight
          label="Most reviewed song"
          title={data.most_reviewed_song?.title}
          meta={data.most_reviewed_song ? `${n(data.most_reviewed_song.review_count)} reviews` : undefined}
        />
      </div>

      <SectionTitle>Latest reviews</SectionTitle>
      {!data.latest?.length && <Notice>No reviews yet.</Notice>}
      {data.latest?.map((r, i) => (
        <div key={i} className={styles.reviewRow}>
          <div className={styles.reviewHead}>
            <span className={styles.reviewStars} aria-label={`${r.stars} of 5 stars`}>
              {'★'.repeat(r.stars)}
              {'☆'.repeat(Math.max(0, 5 - r.stars))}
            </span>
            <span className={styles.reviewTitle}>{r.title ?? r.target_type}</span>
            <span className={styles.reviewBy}>
              {r.by ?? 'Anonymous'} · {new Date(r.created_at).toLocaleDateString()}
            </span>
          </div>
          {r.body && <p className={styles.reviewBody}>{r.body}</p>}
        </div>
      ))}
    </>
  );
}
