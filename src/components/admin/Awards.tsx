'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { hasAudio } from '@/lib/angels';
import { ApiError, api } from '@/lib/api';
import { allCatalogAlbums } from '@/lib/catalog';
import { albumUuid, songUuid } from '@/lib/ids';
import { Button, ButtonRow, Notice, Pill, SectionSub, SectionTitle } from './AdminUI';
import styles from './Awards.module.css';

/**
 * Awards: the categories open for a year, and the nominees put forward in each.
 *
 * Winners are chosen by hand — nomination count is editorial signal, not a vote,
 * so nothing here ranks or tallies. The year is a control rather than a constant
 * (Jubilujah's page hard-codes 2026, which quietly breaks every January).
 */

/** The API enforces this, and so does a Postgres CHECK. Mirrored for the counter. */
const MIN_REASON = 250;

interface Period {
  id: string;
  category_id: string;
  category_name: string;
  category_description: string | null;
  rateable_type: 'song' | 'album';
  year: number;
  opens_at: string | null;
  closes_at: string | null;
  status: string;
}

interface Nomination {
  id: string;
  period_id: string;
  category_id: string;
  rateable_type: string;
  rateable_id: string;
  nominator_name: string | null;
  reason: string;
  created_at: string;
}

const statusTone = (s: string): 'ok' | 'accent' | 'warn' | undefined => {
  const v = (s || '').toLowerCase();
  if (v === 'open') return 'ok';
  if (v === 'closed' || v === 'archived') return undefined;
  return 'accent';
};

const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : null);

export function Awards() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [noms, setNoms] = useState<Nomination[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nominating, setNominating] = useState<Period | null>(null);

  /**
   * Every catalogue album, indexed by the uuid the API stores. The nomination
   * rows carry only ids — the manifest that would resolve them server-side is
   * unset here, so titles come from the app's own catalogue instead.
   */
  const albumsByUuid = useMemo(() => {
    const m = new Map<string, { code: string; title: string }>();
    for (const a of allCatalogAlbums()) {
      m.set(albumUuid(a.code), { code: a.code, title: a.title });
      for (const t of a.tracks) m.set(songUuid(a.code, t.n), { code: a.code, title: t.title });
    }
    return m;
  }, []);

  const load = useCallback(
    async (y: number) => {
      setPeriods(null);
      setNoms(null);
      setErr(null);
      try {
        const [p, nn] = await Promise.all([
          api.get<Period[]>(`/api/awards/periods/${y}`),
          api.get<Nomination[]>(`/api/awards/nominations?period=${y}`),
        ]);
        setPeriods(Array.isArray(p) ? p : []);
        setNoms(Array.isArray(nn) ? nn : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load awards.');
        setPeriods([]);
        setNoms([]);
      }
    },
    [],
  );

  useEffect(() => {
    void load(year);
  }, [load, year]);

  const countFor = (categoryId: string) =>
    (noms ?? []).filter((n) => n.category_id === categoryId).length;

  const shown = selected ? (noms ?? []).filter((n) => n.category_id === selected) : (noms ?? []);

  const nameOf = (n: Nomination) =>
    albumsByUuid.get(n.rateable_id)?.title ?? `${n.rateable_type} ${n.rateable_id.slice(0, 8)}…`;

  // A sensible span either side of now — awards run per calendar year.
  const years = Array.from({ length: 6 }, (_, i) => thisYear + 1 - i);

  return (
    <>
      <SectionTitle>Awards</SectionTitle>
      <SectionSub>
        The categories open for a year and everything nominated in each. Winners are picked by hand —
        the nominee count is editorial signal, not a vote, so nothing here is ranked.
      </SectionSub>

      <div className={styles.toolbar}>
        <label>
          <span className={styles.fieldLabel} style={{ display: 'inline', marginRight: 8 }}>
            Year
          </span>
          <select
            className={styles.year}
            value={year}
            aria-label="Award year"
            onChange={(e) => {
              setYear(Number(e.target.value));
              setSelected(null);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <Button small onClick={() => setSelected(null)}>
            Show all categories
          </Button>
        )}
      </div>

      {err && <Notice tone="error">{err}</Notice>}
      {msg && <Notice tone="ok">{msg}</Notice>}

      {periods === null && <Notice>Loading awards…</Notice>}

      {periods !== null && periods.length === 0 && !err && (
        <Notice>No award categories are configured for {year}.</Notice>
      )}

      {periods !== null && periods.length > 0 && (
        <div className={styles.periods}>
          {periods.map((p) => {
            const c = countFor(p.category_id);
            const opens = dateOnly(p.opens_at);
            const closes = dateOnly(p.closes_at);
            return (
              <button
                key={p.id}
                type="button"
                className={styles.period}
                data-active={selected === p.category_id ? 'yes' : 'no'}
                aria-pressed={selected === p.category_id}
                onClick={() => setSelected((s) => (s === p.category_id ? null : p.category_id))}
              >
                <div className={styles.periodTop}>
                  <span className={styles.periodName}>{p.category_name}</span>
                  <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                </div>
                {p.category_description && (
                  <div className={styles.periodDesc}>{p.category_description}</div>
                )}
                <div className={styles.periodFoot}>
                  <span className={styles.periodN}>{c}</span>
                  <span className={styles.periodL}>
                    nominee{c === 1 ? '' : 's'} · {p.rateable_type}s
                  </span>
                </div>
                {(opens || closes) && (
                  <div className={styles.window}>
                    {opens && closes ? `${opens} – ${closes}` : opens ? `opens ${opens}` : `closes ${closes}`}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {periods !== null && periods.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <h3 className={styles.groupHead} style={{ margin: 0 }}>
              {selected
                ? `${periods.find((p) => p.category_id === selected)?.category_name} · ${shown.length} nominee${shown.length === 1 ? '' : 's'}`
                : `All nominees · ${shown.length}`}
            </h3>
            <ButtonRow>
              {(selected
                ? periods.filter((p) => p.category_id === selected)
                : periods
              ).map((p) => (
                <Button key={p.id} small variant="primary" onClick={() => setNominating(p)}>
                  Nominate · {p.category_name}
                </Button>
              ))}
            </ButtonRow>
          </div>

          {shown.length === 0 && (
            <Notice>
              {selected ? 'No nominations in this category yet.' : `No nominations for ${year} yet.`}
            </Notice>
          )}

          {shown.map((nm) => (
            <div key={nm.id} className={styles.nomination}>
              <div className={styles.nomHead}>
                <span className={styles.nomTitle}>{nameOf(nm)}</span>
                <Pill>{nm.rateable_type}</Pill>
                <span className={styles.nomBy}>nominated by {nm.nominator_name ?? 'unknown'}</span>
                <span className={styles.nomWhen}>{new Date(nm.created_at).toLocaleDateString()}</span>
              </div>
              <p className={styles.nomReason}>{nm.reason}</p>
            </div>
          ))}
        </>
      )}

      {nominating && (
        <NominateDialog
          period={nominating}
          onClose={() => setNominating(null)}
          onDone={async () => {
            setNominating(null);
            setMsg('Nomination recorded.');
            await load(year);
          }}
          onError={(m) => setErr(m)}
        />
      )}
    </>
  );
}

function NominateDialog({
  period,
  onClose,
  onDone,
  onError,
}: {
  period: Period;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const isSong = period.rateable_type === 'song';

  // Only albums that actually have audio can field a song nomination.
  const options = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const a of allCatalogAlbums()) {
      if (isSong) {
        if (!hasAudio(a)) continue;
        for (const t of a.tracks) out.push({ id: songUuid(a.code, t.n), label: `${t.title} — ${a.title}` });
      } else {
        out.push({ id: albumUuid(a.code), label: a.title });
      }
    }
    return out.sort((x, y) => x.label.localeCompare(y.label));
  }, [isSong]);

  const [target, setTarget] = useState(options[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const len = reason.trim().length;
  const short = Math.max(0, MIN_REASON - len);
  const ready = target !== '' && short === 0;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setLocalErr(null);
    try {
      await api.post('/api/awards/nominations', {
        period_id: period.id,
        rateable_type: period.rateable_type,
        rateable_id: target,
        reason: reason.trim(),
      });
      onDone();
    } catch (e) {
      // 409 means it is already nominated — a statement of fact, not a fault.
      const m =
        e instanceof ApiError && e.status === 409
          ? 'That has already been nominated in this category.'
          : e instanceof Error
            ? e.message
            : 'Could not record the nomination.';
      setLocalErr(m);
      onError(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Nominate · ${period.category_name}`}
      confirmLabel={busy ? 'Submitting…' : 'Submit nomination'}
      tone="default"
      busy={busy || !ready}
      onConfirm={submit}
      onCancel={onClose}
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {isSong ? 'Song' : 'Album'} ({options.length.toLocaleString()} to choose from)
        </span>
        <select
          className={styles.select}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={busy}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Justification</span>
        <textarea
          className={styles.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why does this deserve the award? Be specific."
          disabled={busy}
        />
        <span className={styles.meter}>
          <span
            className={styles.meterFill}
            data-ok={short === 0 ? 'yes' : 'no'}
            style={{ width: `${Math.min(100, (len / MIN_REASON) * 100)}%` }}
          />
        </span>
        <span className={styles.counter} data-short={short > 0 ? 'yes' : 'no'}>
          {short > 0
            ? `${len} / ${MIN_REASON} — ${short} more character${short === 1 ? '' : 's'} needed`
            : `${len} characters — long enough`}
        </span>
      </label>

      {localErr && <Notice tone="error">{localErr}</Notice>}
    </ConfirmDialog>
  );
}
