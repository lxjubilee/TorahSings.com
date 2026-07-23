'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { api } from '@/lib/api';
import {
  AdminTable,
  Button,
  ButtonRow,
  EmptyRow,
  Notice,
  Pill,
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';
import styles from './ManageMusic.module.css';

/**
 * Manage Music — the catalogue's control surface.
 *
 * Everything here reads `production.music_album_state` / `music_song_state`,
 * which are populated by a sync from the catalogue manifest. Until that sync has
 * run they are empty, and the API says so via `dashboard.initialized: false` —
 * so the section leads with an explanation rather than a wall of zeros.
 */

type View = 'dashboard' | 'albums' | 'songs' | 'missing' | 'activity' | 'sync';

const VIEWS: { key: View; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'albums', label: 'Albums' },
  { key: 'songs', label: 'Songs' },
  { key: 'missing', label: 'Missing assets' },
  { key: 'activity', label: 'Activity' },
  { key: 'sync', label: 'Sync' },
];

const n = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '0');
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');

interface Dashboard {
  cards: Record<string, number>;
  last_sync: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  initialized: boolean;
}

interface Album {
  album_code: string;
  title: string;
  artist_name: string | null;
  category: string | null;
  release_year: number | null;
  cover_present: boolean;
  song_count: number;
  audio_missing_count: number;
  metadata_complete: boolean;
  visibility: string;
  present_in_manifest: boolean;
  last_synced_at: string | null;
}

interface Song {
  song_id: string;
  album_code: string;
  track_number: number | null;
  title: string;
  duration_seconds: number | null;
  mp3_available: boolean;
  metadata_complete: boolean;
  visibility: string;
}

interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const visTone = (v: string): 'ok' | 'warn' | undefined =>
  v === 'published' ? 'ok' : v === 'hidden' ? 'warn' : undefined;

export function ManageMusic() {
  const [view, setView] = useState<View>('dashboard');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [seed, setSeed] = useState<Record<string, string> | null>(null);

  const loadDash = useCallback(
    () =>
      api
        .get<Dashboard>('/api/admin/music/dashboard')
        .then((d) => {
          setDash(d);
          setErr(null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the dashboard.')),
    [],
  );

  useEffect(() => {
    void loadDash();
  }, [loadDash]);

  const runSync = async (probe: 'none' | 'missing' | 'all') => {
    setSyncing(true);
    setErr(null);
    setMsg(null);
    try {
      await api.post('/api/admin/music/sync', { probe });
      setMsg(probe === 'all' ? 'Full re-probe finished.' : 'Sync finished.');
      await loadDash();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  /** Jump to a filtered list from a dashboard card. */
  const go = (v: View, filters: Record<string, string>) => {
    setSeed(filters);
    setView(v);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <SectionTitle>Manage music</SectionTitle>
          <SectionSub>
            Every album and song the catalogue knows about, what is missing from each, and the sync
            that keeps it current.
          </SectionSub>
        </div>
        <span className={styles.spacer} />
        <ButtonRow>
          <Button small disabled={syncing} onClick={() => void runSync('missing')}>
            {syncing ? 'Syncing…' : 'Sync with CDN'}
          </Button>
          <Button
            small
            disabled={syncing}
            title="Re-probe every cover and track, not just the missing ones"
            onClick={() => void runSync('all')}
          >
            Full re-probe
          </Button>
        </ButtonRow>
      </div>

      {err && <Notice tone="error">{err}</Notice>}
      {msg && <Notice tone="ok">{msg}</Notice>}

      {dash && !dash.initialized && (
        <div className={styles.uninitialised}>
          <div className={styles.uninitialisedHead}>Nothing has been imported yet</div>
          <p className={styles.uninitialisedBody}>
            This section reads the music state tables, which are filled by a sync from the catalogue
            manifest. They are currently empty, so every count below is zero. Run <strong>Sync with
            CDN</strong> above once <code>MANIFEST_PATH</code> is configured on the API, and the
            albums, songs and asset checks will populate.
          </p>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Music views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={styles.tab}
            data-active={view === v.key ? 'yes' : 'no'}
            onClick={() => {
              setSeed(null);
              setView(v.key);
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'dashboard' && <DashboardView dash={dash} onGo={go} />}
      {view === 'albums' && <AlbumsView seed={seed} onChanged={loadDash} />}
      {view === 'songs' && <SongsView seed={seed} />}
      {view === 'missing' && <MissingView />}
      {view === 'activity' && <ActivityView />}
      {view === 'sync' && <SyncView dash={dash} />}
    </>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */

function Card({
  n: value,
  label,
  tone,
  onClick,
}: {
  n: number;
  label: string;
  tone?: 'warn' | 'ok' | 'bad';
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className={styles.cardN}>{n(value)}</div>
      <div className={styles.cardL}>{label}</div>
    </>
  );
  return onClick ? (
    <button type="button" className={styles.card} data-tone={tone} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.card} data-tone={tone}>
      {body}
    </div>
  );
}

function DashboardView({
  dash,
  onGo,
}: {
  dash: Dashboard | null;
  onGo: (v: View, f: Record<string, string>) => void;
}) {
  if (!dash) return <Notice>Loading the dashboard…</Notice>;
  const c = dash.cards ?? {};
  return (
    <>
      <h3 className={styles.groupHead}>Albums</h3>
      <div className={styles.cards}>
        <Card n={c.total_albums_cdn} label="Total albums" onClick={() => onGo('albums', {})} />
        <Card n={c.albums_published} label="Published" tone="ok" onClick={() => onGo('albums', { visibility: 'published' })} />
        <Card n={c.albums_hidden} label="Hidden" onClick={() => onGo('albums', { visibility: 'hidden' })} />
        <Card n={c.albums_pending_review} label="Draft" onClick={() => onGo('albums', { visibility: 'draft' })} />
        <Card n={c.albums_missing_cover} label="Missing cover" tone={c.albums_missing_cover ? 'warn' : undefined} onClick={() => onGo('albums', { cover: 'missing' })} />
        <Card n={c.albums_missing_metadata} label="Missing metadata" tone={c.albums_missing_metadata ? 'warn' : undefined} onClick={() => onGo('albums', { metadata: 'missing' })} />
      </div>

      <h3 className={styles.groupHead}>Songs</h3>
      <div className={styles.cards}>
        <Card n={c.total_songs_cdn} label="Total songs" onClick={() => onGo('songs', {})} />
        <Card n={c.songs_published} label="Published" tone="ok" />
        <Card n={c.songs_hidden} label="Hidden" />
        <Card n={c.songs_missing_audio} label="Missing audio" tone={c.songs_missing_audio ? 'warn' : undefined} onClick={() => onGo('songs', { audio: 'missing' })} />
        <Card n={c.songs_missing_metadata} label="Missing metadata" tone={c.songs_missing_metadata ? 'warn' : undefined} />
        <Card n={c.total_artists} label="Artists" />
      </div>

      {c.broken_references > 0 && (
        <>
          <h3 className={styles.groupHead}>Needs attention</h3>
          <div className={styles.cards}>
            <Card
              n={c.broken_references}
              label="Broken references"
              tone="bad"
              onClick={() => onGo('missing', {})}
            />
          </div>
        </>
      )}

      <p className={styles.syncNote}>
        Last sync: {when(dash.last_sync?.started_at as string)}{' '}
        {dash.last_sync?.status ? `(${dash.last_sync.status})` : ''}
      </p>
    </>
  );
}

/* ── Albums ────────────────────────────────────────────────────────────── */

function AlbumsView({
  seed,
  onChanged,
}: {
  seed: Record<string, string> | null;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Paged<Album> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filters] = useState<Record<string, string>>(seed ?? {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ action: string; label: string } | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50', ...filters });
    if (q.trim()) params.set('q', q.trim());
    setData(null);
    api
      .get<Paged<Album>>(`/api/admin/music/albums?${params}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load albums.'));
  }, [page, q, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setVisibility = async (code: string, visibility: string) => {
    try {
      await api.patch(`/api/admin/music/albums/${code}/visibility`, { visibility });
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not change visibility.');
    }
  };

  const runBulk = async (action: string) => {
    setPending(null);
    setBusy(true);
    try {
      await api.post('/api/admin/music/bulk', { action, album_codes: [...sel] });
      setSel(new Set());
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bulk action failed.');
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 50)));
  const allShown = items.length > 0 && items.every((a) => sel.has(a.album_code));

  return (
    <>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search album, artist or code…"
          value={q}
          aria-label="Search albums"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {Object.keys(filters).length > 0 && (
          <Pill tone="accent">
            {Object.entries(filters).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </Pill>
        )}
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {sel.size > 0 && (
        <div className={styles.bulkBar}>
          <strong>{sel.size}</strong> selected
          <span className={styles.spacer} />
          <ButtonRow>
            <Button small variant="primary" disabled={busy} onClick={() => setPending({ action: 'publish', label: 'Publish' })}>
              Publish
            </Button>
            <Button small disabled={busy} onClick={() => setPending({ action: 'hide', label: 'Hide' })}>
              Hide
            </Button>
            <Button small disabled={busy} onClick={() => setPending({ action: 'draft', label: 'Set to draft' })}>
              Set draft
            </Button>
            <Button small disabled={busy} onClick={() => setPending({ action: 'refresh', label: 'Refresh from CDN' })}>
              Refresh
            </Button>
            <Button small disabled={busy} onClick={() => setPending({ action: 'validate', label: 'Validate' })}>
              Validate
            </Button>
            <Button small onClick={() => setSel(new Set())}>
              Clear
            </Button>
          </ButtonRow>
        </div>
      )}

      <AdminTable
        head={
          <>
            <th className={styles.checkCell}>
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={allShown}
                onChange={() =>
                  setSel(allShown ? new Set() : new Set(items.map((a) => a.album_code)))
                }
              />
            </th>
            <th>Album</th>
            <th>Artist</th>
            <th className={cell.num}>Songs</th>
            <th>Assets</th>
            <th>Visibility</th>
            <th />
          </>
        }
      >
        {data === null && !err && <EmptyRow colSpan={7}>Loading albums…</EmptyRow>}
        {data !== null && items.length === 0 && <EmptyRow colSpan={7}>No albums match.</EmptyRow>}
        {items.map((a) => (
          <tr key={a.album_code}>
            <td className={styles.checkCell}>
              <input
                type="checkbox"
                aria-label={`Select ${a.title}`}
                checked={sel.has(a.album_code)}
                onChange={() =>
                  setSel((s) => {
                    const next = new Set(s);
                    if (next.has(a.album_code)) next.delete(a.album_code);
                    else next.add(a.album_code);
                    return next;
                  })
                }
              />
            </td>
            <td>
              <span className={styles.title}>{a.title}</span>
              <span className={styles.code}>{a.album_code}</span>
            </td>
            <td className={cell.muted}>{a.artist_name ?? '—'}</td>
            <td className={cell.num}>{a.song_count}</td>
            <td>
              <div className={styles.flags}>
                {!a.cover_present && <Pill tone="warn">no cover</Pill>}
                {a.audio_missing_count > 0 && <Pill tone="warn">{a.audio_missing_count} no audio</Pill>}
                {!a.metadata_complete && <Pill>metadata</Pill>}
                {!a.present_in_manifest && <Pill tone="warn">broken ref</Pill>}
                {a.cover_present && a.audio_missing_count === 0 && a.metadata_complete && (
                  <Pill tone="ok">complete</Pill>
                )}
              </div>
            </td>
            <td>
              <Pill tone={visTone(a.visibility)}>{a.visibility}</Pill>
            </td>
            <td>
              <ButtonRow>
                {a.visibility !== 'published' && (
                  <Button small variant="primary" onClick={() => void setVisibility(a.album_code, 'published')}>
                    Publish
                  </Button>
                )}
                {a.visibility !== 'hidden' && (
                  <Button small onClick={() => void setVisibility(a.album_code, 'hidden')}>
                    Hide
                  </Button>
                )}
              </ButtonRow>
            </td>
          </tr>
        ))}
      </AdminTable>

      <Pager page={page} pages={pages} total={data?.total ?? 0} onPage={setPage} />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? ''}
        confirmLabel={pending?.label ?? 'Apply'}
        tone={pending?.action === 'hide' ? 'danger' : 'default'}
        onConfirm={() => pending && void runBulk(pending.action)}
        onCancel={() => setPending(null)}
      >
        Apply <strong>{pending?.label}</strong> to <strong>{sel.size}</strong> album
        {sel.size === 1 ? '' : 's'}?
      </ConfirmDialog>
    </>
  );
}

/* ── Songs ─────────────────────────────────────────────────────────────── */

function SongsView({ seed }: { seed: Record<string, string> | null }) {
  const [data, setData] = useState<Paged<Song> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filters] = useState<Record<string, string>>(seed ?? {});

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50', ...filters });
    if (q.trim()) params.set('q', q.trim());
    setData(null);
    api
      .get<Paged<Song>>(`/api/admin/music/songs?${params}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load songs.'));
  }, [page, q, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setVisibility = async (id: string, visibility: string) => {
    try {
      await api.patch(`/api/admin/music/songs/${id}/visibility`, { visibility });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not change visibility.');
    }
  };

  const items = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 50)));
  const dur = (s: number | null) =>
    s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search song, artist or album code…"
          value={q}
          aria-label="Search songs"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      <AdminTable
        head={
          <>
            <th className={cell.num}>#</th>
            <th>Song</th>
            <th>Album</th>
            <th className={cell.num}>Length</th>
            <th>Assets</th>
            <th>Visibility</th>
            <th />
          </>
        }
      >
        {data === null && !err && <EmptyRow colSpan={7}>Loading songs…</EmptyRow>}
        {data !== null && items.length === 0 && <EmptyRow colSpan={7}>No songs match.</EmptyRow>}
        {items.map((s) => (
          <tr key={s.song_id}>
            <td className={cell.num}>{s.track_number ?? '—'}</td>
            <td>
              <span className={styles.title}>{s.title}</span>
            </td>
            <td className={cell.muted}>
              <span className={styles.code}>{s.album_code}</span>
            </td>
            <td className={cell.num}>{dur(s.duration_seconds)}</td>
            <td>
              <div className={styles.flags}>
                {!s.mp3_available && <Pill tone="warn">no audio</Pill>}
                {!s.metadata_complete && <Pill>metadata</Pill>}
                {s.mp3_available && s.metadata_complete && <Pill tone="ok">complete</Pill>}
              </div>
            </td>
            <td>
              <Pill tone={visTone(s.visibility)}>{s.visibility}</Pill>
            </td>
            <td>
              <ButtonRow>
                {s.visibility !== 'published' && (
                  <Button small variant="primary" onClick={() => void setVisibility(s.song_id, 'published')}>
                    Publish
                  </Button>
                )}
                {s.visibility !== 'hidden' && (
                  <Button small onClick={() => void setVisibility(s.song_id, 'hidden')}>
                    Hide
                  </Button>
                )}
              </ButtonRow>
            </td>
          </tr>
        ))}
      </AdminTable>

      <Pager page={page} pages={pages} total={data?.total ?? 0} onPage={setPage} />
    </>
  );
}

/* ── Missing assets ────────────────────────────────────────────────────── */

interface MissingResponse {
  albums_missing_cover: { album_code: string; title: string; artist_name: string | null }[];
  albums_missing_metadata: { album_code: string; title: string; artist_name: string | null }[];
  songs_missing_audio: { song_id: string; album_code: string; track_number: number | null; title: string }[];
  songs_missing_metadata: { song_id: string; album_code: string; track_number: number | null; title: string }[];
  broken_albums?: { album_code: string; title: string }[];
  broken_songs?: { song_id: string; album_code: string; title: string }[];
}

function MissingView() {
  const [data, setData] = useState<MissingResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MissingResponse>('/api/admin/music/missing')
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load missing assets.'));
  }, []);

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!data) return <Notice>Checking assets…</Notice>;

  const groups: { title: string; rows: { key: string; main: string; sub: string }[] }[] = [
    {
      title: 'Albums missing a cover',
      rows: (data.albums_missing_cover ?? []).map((a) => ({
        key: a.album_code,
        main: a.title,
        sub: `${a.artist_name ?? '—'} · ${a.album_code}`,
      })),
    },
    {
      title: 'Albums missing metadata',
      rows: (data.albums_missing_metadata ?? []).map((a) => ({
        key: a.album_code,
        main: a.title,
        sub: `${a.artist_name ?? '—'} · ${a.album_code}`,
      })),
    },
    {
      title: 'Songs missing audio',
      rows: (data.songs_missing_audio ?? []).map((s) => ({
        key: s.song_id,
        main: s.title,
        sub: `${s.album_code} · track ${s.track_number ?? '—'}`,
      })),
    },
    {
      title: 'Songs missing metadata',
      rows: (data.songs_missing_metadata ?? []).map((s) => ({
        key: s.song_id,
        main: s.title,
        sub: `${s.album_code} · track ${s.track_number ?? '—'}`,
      })),
    },
  ];

  const clean = groups.every((g) => g.rows.length === 0);
  if (clean) return <Notice tone="ok">Nothing is missing — every album and song has its assets.</Notice>;

  return (
    <>
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className={styles.groupHead}>
            {g.title} · {g.rows.length}
          </h3>
          {g.rows.length === 0 ? (
            <Notice tone="ok">None.</Notice>
          ) : (
            <AdminTable
              head={
                <>
                  <th>Item</th>
                  <th>Where</th>
                </>
              }
            >
              {g.rows.slice(0, 200).map((r) => (
                <tr key={r.key}>
                  <td>
                    <span className={styles.title}>{r.main}</span>
                  </td>
                  <td className={cell.muted}>{r.sub}</td>
                </tr>
              ))}
              {g.rows.length > 200 && (
                <EmptyRow colSpan={2}>
                  …and {g.rows.length - 200} more. Fix these first, then re-check.
                </EmptyRow>
              )}
            </AdminTable>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Activity ──────────────────────────────────────────────────────────── */

interface Activity {
  id: string;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

function ActivityView() {
  const [data, setData] = useState<Paged<Activity> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    api
      .get<Paged<Activity>>(`/api/admin/music/activity?page=${page}&limit=50`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the activity log.'));
  }, [page]);

  const items = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 50)));

  if (err) return <Notice tone="error">{err}</Notice>;

  return (
    <>
      <AdminTable
        head={
          <>
            <th>When</th>
            <th>Action</th>
            <th>Target</th>
            <th>Change</th>
            <th>Actor</th>
          </>
        }
      >
        {data === null && <EmptyRow colSpan={5}>Loading activity…</EmptyRow>}
        {data !== null && items.length === 0 && (
          <EmptyRow colSpan={5}>Nothing has been changed yet.</EmptyRow>
        )}
        {items.map((a) => (
          <tr key={a.id}>
            <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
              {when(a.created_at)}
            </td>
            <td>
              <code className={cell.mono}>{a.action}</code>
            </td>
            <td className={cell.muted}>
              {a.target_type}
              {a.target_id ? ` · ${a.target_id}` : ''}
            </td>
            <td className={cell.muted}>
              {a.previous_value || a.new_value
                ? `${a.previous_value ?? '—'} → ${a.new_value ?? '—'}`
                : '—'}
            </td>
            <td>{a.actor_name ?? '—'}</td>
          </tr>
        ))}
      </AdminTable>

      <Pager page={page} pages={pages} total={data?.total ?? 0} onPage={setPage} />
    </>
  );
}

/* ── Sync ──────────────────────────────────────────────────────────────── */

interface SyncRun {
  id: string;
  trigger: string | null;
  status: string | null;
  started_at: string;
  finished_at: string | null;
  albums_seen?: number;
  songs_seen?: number;
}

function SyncView({ dash }: { dash: Dashboard | null }) {
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SyncRun[]>('/api/admin/music/sync/runs?limit=25')
      .then((r) => setRuns(Array.isArray(r) ? r : []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load sync runs.'));
  }, []);

  return (
    <>
      {err && <Notice tone="error">{err}</Notice>}

      <h3 className={styles.groupHead}>Schedule</h3>
      <Notice>
        {dash?.schedule
          ? `${(dash.schedule.enabled as boolean) ? 'Enabled' : 'Disabled'} · ${String(dash.schedule.schedule ?? 'off')}`
          : 'No automatic schedule configured — syncs are run by hand from the button above.'}
      </Notice>

      <h3 className={styles.groupHead}>Recent runs</h3>
      <AdminTable
        head={
          <>
            <th>Started</th>
            <th>Trigger</th>
            <th>Status</th>
            <th className={cell.num}>Albums</th>
            <th className={cell.num}>Songs</th>
            <th>Finished</th>
          </>
        }
      >
        {runs === null && !err && <EmptyRow colSpan={6}>Loading runs…</EmptyRow>}
        {runs !== null && runs.length === 0 && (
          <EmptyRow colSpan={6}>No sync has been run yet.</EmptyRow>
        )}
        {(runs ?? []).map((r) => (
          <tr key={r.id}>
            <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
              {when(r.started_at)}
            </td>
            <td>{r.trigger ?? '—'}</td>
            <td>
              <Pill tone={r.status === 'ok' || r.status === 'success' ? 'ok' : r.status === 'failed' ? 'warn' : undefined}>
                {r.status ?? 'unknown'}
              </Pill>
            </td>
            <td className={cell.num}>{r.albums_seen ?? '—'}</td>
            <td className={cell.num}>{r.songs_seen ?? '—'}</td>
            <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
              {when(r.finished_at)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <p className={styles.syncNote}>
        <strong>Sync with CDN</strong> imports the catalogue manifest and probes only the assets it
        does not already know about. <strong>Full re-probe</strong> re-checks every cover and track —
        slower, and worth running after a bulk upload to the CDN.
      </p>
    </>
  );
}

/* ── Shared ────────────────────────────────────────────────────────────── */

function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className={styles.pager}>
      <ButtonRow>
        <Button small disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <Button small disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </ButtonRow>
      <span>
        Page {page} of {pages} · {n(total)} rows
      </span>
    </div>
  );
}
