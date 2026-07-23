'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasAudio } from '@/lib/angels';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { allCatalogAlbums } from '@/lib/catalog';
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

/** Material-style paths, inline so the console carries no icon dependency. */
const ICN = {
  overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  trends: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
  albums: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',
  songs: 'M12 3v10.55A4 4 0 1014 17V7h4V3h-6z',
  users: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  reviews: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  dollar: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  play: 'M8 5v14l11-7z',
  card: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  disc: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z',
  print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
} as const;

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: ICN.overview },
  { key: 'trends', label: 'Trends', icon: ICN.trends },
  { key: 'albums', label: 'Albums', icon: ICN.albums },
  { key: 'songs', label: 'Songs', icon: ICN.songs },
  { key: 'users', label: 'Users', icon: ICN.users },
  { key: 'ratings', label: 'Ratings', icon: ICN.star },
  { key: 'reviews', label: 'Reviews', icon: ICN.reviews },
];

const n = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—');
const hrs = (seconds: number) => `${(Math.round((seconds / 3600) * 10) / 10).toLocaleString()}h`;
const stars = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)}★`);
const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const money = (cents: number | null | undefined, currency = 'usd') =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

/**
 * What the live catalogue would have cost through a traditional studio, on
 * Jubilujah's stated rule of thumb: 12 tracks ≈ 8 months and $35,000. Shown as
 * "YEARS.MM" — integer years plus two-digit months, not decimal years.
 */
function tradProductionLine(songs: number): string {
  const totalMonths = Math.round((songs * 8) / 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const cost = Math.round((songs * 35000) / 12);
  return `Traditional studio production: ~${years}.${String(months).padStart(2, '0')} years' work (~$${cost.toLocaleString('en-US')})`;
}

export function Analytics() {
  const [tab, setTab] = useState<Tab>('overview');
  const [err, setErr] = useState<string | null>(null);

  // One cache per tab, so switching back does not refetch.
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [subs, setSubs] = useState<SubscribersResponse | null>(null);
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
      // Revenue lives on the admin router, not the analytics one. It is a
      // secondary panel, so a failure here must not blank the whole overview.
      api.get<SubscribersResponse>('/api/admin/subscribers').then(setSubs).catch(() => setSubs(null));
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
      <div className={styles.head}>
        <div>
          <SectionTitle>Media analytics</SectionTitle>
          <SectionSub>Catalogue, audience, revenue and reception — at a glance.</SectionSub>
        </div>
        <div className={styles.printBtn}>
          <Button small onClick={() => window.print()}>
            <Icon d={ICN.print} className={styles.tabIcon} /> Print / PDF
          </Button>
        </div>
      </div>

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
            <Icon d={t.icon} className={styles.tabIcon} />
            {t.label}
          </button>
        ))}
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {!err && tab === 'overview' && <OverviewTab data={overview} subs={subs} />}
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

/** The shared shape of anything the Top Performers row can render. `name`
 *  covers the listener card, which has a person rather than a title. */
interface Named {
  title?: string;
  artist?: string;
  album?: string;
  cover?: string | null;
  name?: string;
}

interface PlanRollup {
  plan: string;
  count: number;
  monthly_cents_each: number;
  subtotal_cents: number;
}

interface SubscribersResponse {
  currency: string;
  count: number;
  monthly_total_cents: number;
  by_plan: PlanRollup[];
}

/** One figure with an icon chip. `tone` colours the chip and the corner disc. */
function HeroTile({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: string;
  tone: 'violet' | 'green' | 'gold' | 'peach';
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={styles.heroTile} data-tone={tone}>
      <span className={styles.heroIcon}>
        <Icon d={icon} />
      </span>
      <div className={styles.heroV}>{value}</div>
      <div className={styles.heroL}>{label}</div>
      {hint && <div className={styles.heroH}>{hint}</div>}
    </div>
  );
}

function Panel({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>
          <Icon d={icon} />
        </span>
        <h3 className={styles.sectionTitle}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'gold' | 'green' }) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <div className={styles.statV}>{value}</div>
      <div className={styles.statL}>{label}</div>
    </div>
  );
}

/** A two-segment composition bar. Always paired with a legend below it. */
function Ratio({
  label,
  ok,
  other,
  okLabel = 'available',
}: {
  label: string;
  ok: number;
  other: number;
  okLabel?: string;
}) {
  const a = Math.max(0, ok || 0);
  const b = Math.max(0, other || 0);
  const total = a + b || 1;
  const pct = Math.round((a / total) * 100);
  return (
    <div className={styles.ratio}>
      <div className={styles.ratioTop}>
        <span>{label}</span>
        <span>
          <b>{pct}%</b> {okLabel}
        </span>
      </div>
      <div className={styles.ratioBar}>
        <span className={styles.ratioOk} style={{ width: `${(a / total) * 100}%` }} />
        <span className={styles.ratioOther} style={{ width: `${(b / total) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Generic over the item so each caller keeps its own shape — an album carries
 * `plays`, a listener carries `hours`. Constraining to `Named` (whose fields are
 * all optional) is enough to read title/artist/cover without casts.
 */
function Performer<T extends Named>({
  title,
  item,
  sub,
  name,
}: {
  title: string;
  item: T | null | undefined;
  sub: (x: T) => string;
  name?: (x: T) => string;
}) {
  return (
    <div className={styles.performer}>
      <div className={styles.performerT}>{title}</div>
      {item ? (
        <>
          {item.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.performerCover} src={item.cover} alt="" />
          )}
          <div className={styles.performerName}>{name ? name(item) : item.title || '—'}</div>
          {item.artist && <div className={styles.performerArtist}>{item.artist}</div>}
          <div className={styles.performerSub}>{sub(item)}</div>
        </>
      ) : (
        <div className={styles.performerEmpty}>No data yet.</div>
      )}
    </div>
  );
}

function OverviewTab({
  data,
  subs,
}: {
  data: Record<string, unknown> | null;
  subs: SubscribersResponse | null;
}) {
  /**
   * Album and song counts come from the app's own catalogue, not the API.
   * `/api/analytics/overview` derives those from the manifest, and MANIFEST_PATH
   * is unset on TorahSings — so the API reports zero while the site is serving
   * hundreds of albums. Everything else here (plays, users, ratings) is real
   * database data and comes from the API.
   */
  const catalogue = useMemo(() => {
    const albums = allCatalogAlbums();
    const live = albums.filter(hasAudio);
    return {
      totalAlbums: albums.length,
      liveAlbums: live.length,
      pendingAlbums: albums.length - live.length,
      liveSongs: live.reduce((sum, a) => sum + a.tracks.length, 0),
    };
  }, []);

  if (!data) return <Notice>Loading the overview…</Notice>;

  const d = data as Record<string, number | null> & {
    most_played_album?: (Named & { plays: number }) | null;
    most_played_song?: (Named & { plays: number }) | null;
    most_active_listener?: { name: string; plays: number; hours: number } | null;
    most_rated_album?: (Named & { rating_count: number }) | null;
    most_reviewed_album?: (Named & { review_count: number }) | null;
  };

  const registered = d.total_users ?? 0;
  const active = d.active_users ?? 0;

  return (
    <>
      <div className={styles.liveBanner}>
        <span className={styles.liveIcon}>
          <Icon d={ICN.disc} />
        </span>
        <div className={styles.liveHeadWrap}>
          <div className={styles.liveHead}>Live on the website</div>
          <div className={styles.liveSub}>{tradProductionLine(catalogue.liveSongs)}</div>
        </div>
        <div className={styles.liveStats}>
          <div className={styles.liveStat}>
            <div className={styles.liveN}>{n(catalogue.liveAlbums)}</div>
            <div className={styles.liveL}>Live albums</div>
          </div>
          <span className={styles.liveSep} />
          <div className={styles.liveStat}>
            <div className={styles.liveN}>{n(catalogue.liveSongs)}</div>
            <div className={styles.liveL}>Live songs</div>
          </div>
          <span className={styles.liveSep} />
          <div className={styles.liveStat}>
            <div className={styles.liveN}>{n(catalogue.totalAlbums)}</div>
            <div className={styles.liveL}>Catalogued</div>
          </div>
        </div>
      </div>

      <div className={styles.heroRow}>
        <HeroTile
          icon={ICN.users}
          tone="violet"
          label="Subscribers"
          value={subs ? n(subs.count) : '—'}
          hint={subs ? `${n(subs.count)} on paid plans` : 'paid plans'}
        />
        <HeroTile
          icon={ICN.dollar}
          tone="green"
          label="Monthly revenue"
          value={subs ? money(subs.monthly_total_cents, subs.currency) : '—'}
          hint="recurring / month"
        />
        <HeroTile
          icon={ICN.trends}
          tone="gold"
          label="Active listeners"
          value={n(active)}
          hint={`of ${n(registered)} registered · last 30d`}
        />
        <HeroTile
          icon={ICN.play}
          tone="peach"
          label="Total plays"
          value={n(d.total_plays)}
          hint={`${n(d.total_listening_hours)}h listened`}
        />
      </div>

      <div className={styles.sections}>
        <Panel icon={ICN.disc} title="Catalogue">
          <div className={styles.statGrid}>
            <Stat label="Total albums" value={n(catalogue.totalAlbums)} />
            <Stat label="Live songs" value={n(catalogue.liveSongs)} />
          </div>
          <Ratio
            label="Albums"
            ok={catalogue.liveAlbums}
            other={catalogue.pendingAlbums}
            okLabel="live"
          />
          <div className={styles.legend}>
            <span>
              <i className={`${styles.dot} ${styles.dotOk}`} />
              Live
            </span>
            <span>
              <i className={`${styles.dot} ${styles.dotOther}`} />
              Awaiting audio
            </span>
          </div>
        </Panel>

        <Panel icon={ICN.card} title="Subscriptions & revenue">
          <div className={styles.statGrid}>
            <Stat label="Subscribers" value={subs ? n(subs.count) : '—'} />
            <Stat
              label="Monthly revenue"
              tone="green"
              value={subs ? money(subs.monthly_total_cents, subs.currency) : '—'}
            />
          </div>
          {!subs && <Notice>Subscription data unavailable.</Notice>}
          {subs && subs.by_plan.length === 0 && <Notice>No paying subscribers yet.</Notice>}
          {subs &&
            subs.by_plan.map((p) => {
              const max = Math.max(1, ...subs.by_plan.map((x) => x.subtotal_cents || 0));
              return (
                <div className={styles.planBar} key={p.plan}>
                  <div className={styles.planTop}>
                    <span>
                      <strong>{p.plan}</strong> · {n(p.count)}{' '}
                      {p.count === 1 ? 'subscriber' : 'subscribers'}
                    </span>
                    <span className={styles.planAmt}>{money(p.subtotal_cents, subs.currency)}</span>
                  </div>
                  <span className={styles.planTrack}>
                    <span
                      className={styles.planFill}
                      style={{ width: `${((p.subtotal_cents || 0) / max) * 100}%` }}
                    />
                  </span>
                </div>
              );
            })}
        </Panel>

        <Panel icon={ICN.users} title="Audience">
          <div className={styles.statGrid}>
            <Stat label="Registered" value={n(registered)} />
            <Stat label="Active · 30d" value={n(active)} />
            <Stat label="Listening" value={`${n(d.total_listening_hours)}h`} />
          </div>
          <Ratio
            label="Engaged in the last 30 days"
            ok={active}
            other={Math.max(0, registered - active)}
            okLabel="active"
          />
          <div className={styles.legend}>
            <span>
              <i className={`${styles.dot} ${styles.dotOk}`} />
              Active
            </span>
            <span>
              <i className={`${styles.dot} ${styles.dotOther}`} />
              Idle
            </span>
          </div>
        </Panel>

        <Panel icon={ICN.star} title="Engagement">
          <div className={styles.statGrid}>
            <Stat label="Total ratings" value={n(d.total_ratings)} />
            <Stat label="Total reviews" value={n(d.total_reviews)} />
            <Stat label="Avg album ★" tone="gold" value={stars(d.avg_album_rating ?? null)} />
            <Stat label="Avg song ★" tone="gold" value={stars(d.avg_song_rating ?? null)} />
          </div>
          <Ratio
            label="Plays heard to the end"
            ok={d.completed_plays ?? 0}
            other={d.skipped_plays ?? 0}
            okLabel="completed"
          />
          <div className={styles.legend}>
            <span>
              <i className={`${styles.dot} ${styles.dotOk}`} />
              Completed
            </span>
            <span>
              <i className={`${styles.dot} ${styles.dotOther}`} />
              Skipped
            </span>
          </div>
        </Panel>
      </div>

      <h3 className={styles.subHead}>Top performers</h3>
      <div className={styles.performers}>
        <Performer
          title="Most played album"
          item={d.most_played_album}
          sub={(x) => `${n(x.plays)} plays`}
        />
        <Performer
          title="Most played song"
          item={d.most_played_song}
          sub={(x) => `${n(x.plays)} plays`}
        />
        <Performer
          title="Most active listener"
          item={d.most_active_listener}
          name={(x) => x.name ?? '—'}
          sub={(x) => `${n(x.plays)} plays · ${n(x.hours)}h`}
        />
        <Performer
          title="Most rated album"
          item={d.most_rated_album}
          sub={(x) => `${n(x.rating_count)} ratings`}
        />
        <Performer
          title="Most reviewed album"
          item={d.most_reviewed_album}
          sub={(x) => `${n(x.review_count)} reviews`}
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

      <div className={styles.performers}>
        <Performer
          title="Most reviewed album"
          item={data.most_reviewed_album}
          sub={(x) => `${n(x.review_count)} reviews`}
        />
        <Performer
          title="Most reviewed song"
          item={data.most_reviewed_song}
          sub={(x) => `${n(x.review_count)} reviews`}
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
