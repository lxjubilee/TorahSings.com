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
import styles from './Pipeline.module.css';

/**
 * The production pipeline: what is in flight, and where.
 *
 * Jubilujah's equivalent is read-only — counts and a table. The API underneath
 * carries two more endpoints (transition and history), and an `admin` clears the
 * `executive` bar transitions require, so this section drives the whole surface.
 * A board you cannot move anything on is half a feature.
 */

/** Mirrors STAGES in api/src/routes/pipeline.js — the order IS the workflow. */
const STAGES = [
  'concept',
  'lyrics_drafting',
  'lyrics_approved',
  'song_generation',
  'qa_review',
  'engineering',
  'sunil_approval',
  'final_approval',
  'published',
  'distributed',
] as const;

type Stage = (typeof STAGES)[number];

interface Item {
  rateable_type: string;
  rateable_id: string;
  current_stage: string;
  assignee_user_id: string | null;
  entered_stage_at: string;
  updated_at: string;
}

interface PipelineResponse {
  items: Item[];
  counts: Record<string, number>;
}

interface Hop {
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  occurred_at: string;
  actor: string | null;
}

const label = (s: string) => s.replace(/_/g, ' ');

/** How long something has sat where it is — the number that matters on a board. */
function dwell(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** Late stages read as progress; anything sitting a fortnight reads as stuck. */
function tone(stage: string, since: string): 'accent' | 'ok' | 'warn' | undefined {
  if (stage === 'published' || stage === 'distributed') return 'ok';
  const days = (Date.now() - new Date(since).getTime()) / 86_400_000;
  if (days > 14) return 'warn';
  return 'accent';
}

export function Pipeline() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Hop[] | 'loading' | 'error'>>({});
  const [moving, setMoving] = useState<Item | null>(null);

  const load = useCallback(
    () =>
      api
        .get<PipelineResponse>('/api/pipeline')
        .then((r) => {
          setData({ items: r?.items ?? [], counts: r?.counts ?? {} });
          setErr(null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the pipeline.')),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const key = (i: Item) => `${i.rateable_type}:${i.rateable_id}`;

  /** History is fetched per item, only when its row is opened. */
  const toggleHistory = async (i: Item) => {
    const k = key(i);
    if (open === k) {
      setOpen(null);
      return;
    }
    setOpen(k);
    if (history[k] && history[k] !== 'error') return;
    setHistory((h) => ({ ...h, [k]: 'loading' }));
    try {
      const rows = await api.get<Hop[]>(`/api/pipeline/${i.rateable_type}/${i.rateable_id}/history`);
      setHistory((h) => ({ ...h, [k]: Array.isArray(rows) ? rows : [] }));
    } catch {
      setHistory((h) => ({ ...h, [k]: 'error' }));
    }
  };

  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items = (data?.items ?? []).filter((i) => !filter || i.current_stage === filter);
  const maxCount = Math.max(1, ...STAGES.map((s) => counts[s] ?? 0));

  return (
    <>
      <SectionTitle>Production pipeline</SectionTitle>
      <SectionSub>
        Every song and album in flight, and the stage it currently sits in. Select a stage to narrow the
        list. Moving an item records who moved it and why, so the history below each row is the audit
        trail.
      </SectionSub>

      {err && <Notice tone="error">{err}</Notice>}
      {msg && <Notice tone="ok">{msg}</Notice>}

      {!err && (
        <>
          <div className={styles.stages}>
            {STAGES.map((s) => {
              const c = counts[s] ?? 0;
              return (
                <button
                  key={s}
                  type="button"
                  className={styles.stage}
                  data-active={filter === s ? 'yes' : 'no'}
                  data-empty={c === 0 ? 'yes' : 'no'}
                  aria-pressed={filter === s}
                  onClick={() => setFilter((f) => (f === s ? null : s))}
                >
                  <div className={styles.stageN}>{c.toLocaleString()}</div>
                  <div className={styles.stageL}>{label(s)}</div>
                  <span className={styles.rail}>
                    <span className={styles.railFill} style={{ width: `${(c / maxCount) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.filterBar}>
            <span>
              {filter ? (
                <>
                  Showing <strong>{label(filter)}</strong> — {items.length} of {total}
                </>
              ) : (
                <>
                  {total.toLocaleString()} item{total === 1 ? '' : 's'} in the pipeline
                </>
              )}
            </span>
            {filter && (
              <Button small onClick={() => setFilter(null)}>
                Clear filter
              </Button>
            )}
          </div>

          <AdminTable
            head={
              <>
                <th>Type</th>
                <th>Id</th>
                <th>Stage</th>
                <th>In stage</th>
                <th>Entered</th>
                <th />
              </>
            }
          >
            {data === null && <EmptyRow colSpan={6}>Loading the pipeline…</EmptyRow>}
            {data !== null && items.length === 0 && (
              <EmptyRow colSpan={6}>
                {filter ? `Nothing in ${label(filter)}.` : 'Nothing is in the pipeline yet.'}
              </EmptyRow>
            )}
            {items.map((i) => {
              const k = key(i);
              const rows = history[k];
              return (
                <>
                  <tr key={k}>
                    <td className={styles.type}>{i.rateable_type}</td>
                    <td>
                      <span className={styles.id} title={i.rateable_id}>
                        {i.rateable_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td>
                      <Pill tone={tone(i.current_stage, i.entered_stage_at)}>
                        {label(i.current_stage)}
                      </Pill>
                    </td>
                    <td className={cell.num}>{dwell(i.entered_stage_at)}</td>
                    <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
                      {new Date(i.entered_stage_at).toLocaleString()}
                    </td>
                    <td>
                      <ButtonRow>
                        <Button small onClick={() => void toggleHistory(i)}>
                          {open === k ? 'Hide' : 'History'}
                        </Button>
                        <Button small variant="primary" onClick={() => setMoving(i)}>
                          Move
                        </Button>
                      </ButtonRow>
                    </td>
                  </tr>

                  {open === k && (
                    <tr key={`${k}-history`} className={styles.historyRow}>
                      <td colSpan={6}>
                        <div className={styles.history}>
                          <div className={styles.historyHead}>Stage history</div>
                          {rows === 'loading' && <span className={cell.muted}>Loading…</span>}
                          {rows === 'error' && (
                            <span className={cell.muted}>Could not load the history.</span>
                          )}
                          {Array.isArray(rows) && rows.length === 0 && (
                            <span className={cell.muted}>
                              No recorded transitions — this item has not moved since it was created.
                            </span>
                          )}
                          {Array.isArray(rows) &&
                            rows.map((h, idx) => (
                              <div className={styles.hop} key={idx}>
                                <span>{h.from_stage ? label(h.from_stage) : 'created'}</span>
                                <span className={styles.hopArrow}>→</span>
                                <strong>{label(h.to_stage)}</strong>
                                <span className={cell.muted}>by {h.actor ?? 'unknown'}</span>
                                <span className={styles.hopWhen}>
                                  {new Date(h.occurred_at).toLocaleString()}
                                </span>
                                {h.note && <span className={styles.hopNote}>“{h.note}”</span>}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </AdminTable>
        </>
      )}

      {moving && (
        <MoveDialog
          item={moving}
          onClose={() => setMoving(null)}
          onDone={async (to) => {
            setMoving(null);
            setMsg(`Moved to ${label(to)}.`);
            // The row's history is now stale; drop it so it refetches on open.
            setHistory((h) => {
              const next = { ...h };
              delete next[key(moving)];
              return next;
            });
            await load();
          }}
          onError={(m) => {
            setMoving(null);
            setErr(m);
          }}
        />
      )}
    </>
  );
}

function MoveDialog({
  item,
  onClose,
  onDone,
  onError,
}: {
  item: Item;
  onClose: () => void;
  onDone: (to: Stage) => void;
  onError: (msg: string) => void;
}) {
  // Default to the next stage in the flow — the overwhelmingly common move.
  const at = STAGES.indexOf(item.current_stage as Stage);
  const [to, setTo] = useState<Stage>(STAGES[Math.min(STAGES.length - 1, at < 0 ? 0 : at + 1)]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/pipeline/${item.rateable_type}/${item.rateable_id}/transition`, {
        to_stage: to,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onDone(to);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not move the item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title="Move stage"
      confirmLabel={busy ? 'Moving…' : 'Move'}
      tone="default"
      busy={busy}
      onConfirm={submit}
      onCancel={onClose}
    >
      <div className={styles.current}>
        <strong className={styles.type}>{item.rateable_type}</strong>{' '}
        <span className={styles.id}>{item.rateable_id.slice(0, 8)}…</span> is currently in{' '}
        <strong>{label(item.current_stage)}</strong>.
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Move to</span>
        <select
          className={styles.select}
          value={to}
          onChange={(e) => setTo(e.target.value as Stage)}
          disabled={busy}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
              {s === item.current_stage ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Note (optional)</span>
        <textarea
          className={styles.note}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is it moving?"
          disabled={busy}
        />
      </label>
    </ConfirmDialog>
  );
}
