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
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';
import styles from './Publish.module.css';

/**
 * Publish to Production — the bridge between the studio drive and the CDN.
 *
 * This section is unusual: the page is served from the public site, but `J:`
 * lives on the studio's local network. The API therefore only does real work
 * when it is running on the studio machine. Everywhere else `/candidates`
 * answers `available: false`, and the page's entire job is to say so clearly
 * rather than present controls that cannot work.
 *
 * Publishing is genuinely destructive-adjacent — it uploads to the CDN and
 * redeploys the site — so it is behind a confirm, and the request is left to
 * run without a client timeout because the orchestrator takes minutes.
 */

interface Candidate {
  code: string;
  title: string;
  artist: string;
  /** Unique tracks on the studio drive. */
  jTracks: number;
  /** Tracks already live on the CDN. */
  live: number;
  path: string;
}

interface CandidatesResponse {
  available: boolean;
  count?: number;
  candidates: Candidate[];
}

interface Step {
  step?: string;
  code?: string;
  done?: boolean;
  ok?: boolean;
  error?: string;
  raw?: string;
  totals?: { playableAlbums?: number; playableTracks?: number };
  [k: string]: unknown;
}

interface PublishResponse {
  ok: boolean;
  steps: Step[];
  codes: string[];
}

export function Publish() {
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResponse | null>(null);
  const [pending, setPending] = useState<{ codes: string[]; tag: string; label: string } | null>(null);

  const load = useCallback(
    () =>
      api
        .get<CandidatesResponse>('/api/admin/publish/candidates')
        .then((r) => {
          setData({ available: !!r?.available, count: r?.count, candidates: r?.candidates ?? [] });
          setErr(null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load candidates.')),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (codes: string[], tag: string) => {
    setPending(null);
    setBusy(tag);
    setErr(null);
    setResult(null);
    try {
      const r = await api.post<PublishResponse>('/api/admin/publish', { codes });
      setResult(r);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publish failed.');
    } finally {
      setBusy(null);
    }
  };

  const cands = data?.candidates ?? [];
  const allCodes = cands.map((c) => c.code);
  const finalStep = result?.steps.find((s) => s.done);
  const publishedCount = result?.steps.filter((s) => s.step === 'published').length ?? 0;

  return (
    <>
      <SectionTitle>Publish to production</SectionTitle>
      <SectionSub>
        Albums whose audio is on the studio drive but not yet fully live on the CDN. Publishing uploads
        the tracks, marks the album live, and redeploys the site.
      </SectionSub>

      {err && <Notice tone="error">{err}</Notice>}

      {/* The common case away from the studio. Explain, do not just disable. */}
      {data && !data.available && (
        <div className={styles.bridge}>
          <div className={styles.bridgeHead}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 2L1 21h22L12 2zm0 15h-2v-2h2v2zm0-4h-2V9h2v4z" />
            </svg>
            The studio drive is not reachable from here
          </div>
          <p className={styles.bridgeBody}>
            Publishing reads the masters off <code>J:</code>, which lives on the studio&apos;s local
            network — so it can only run on the machine where that drive is mounted. Open this page
            there, at <code>http://localhost:3000/admin/publish-to-production</code>, and the album list
            will appear. Nothing on this server can reach the drive, so there is nothing to publish from
            here.
          </p>
        </div>
      )}

      {busy && (
        <div className={styles.running}>
          <span className={styles.spinner} />
          <span>
            Publishing {busy === 'all' ? `all ${allCodes.length} albums` : busy} — uploading to the CDN
            and redeploying. This takes a couple of minutes; keep this tab open.
          </span>
        </div>
      )}

      {result && (
        <Notice tone={result.ok ? 'ok' : 'error'}>
          {result.ok ? 'Published and deployed.' : 'Finished with issues.'} {publishedCount} album
          {publishedCount === 1 ? '' : 's'} published
          {finalStep?.totals
            ? ` · site now ${finalStep.totals.playableAlbums} live albums / ${finalStep.totals.playableTracks} songs`
            : ''}
          .
          {finalStep && finalStep.ok === false ? ` Error: ${finalStep.error || 'see logs'}` : ''}
        </Notice>
      )}

      {/* The orchestrator emits NDJSON; showing it is the only visibility there is. */}
      {result && result.steps.length > 0 && (
        <div className={styles.steps}>
          {result.steps.map((s, i) => (
            <div key={i} className={styles.step}>
              <span className={`${styles.stepName} ${s.ok === false ? styles.stepFail : ''}`}>
                {s.step ?? (s.done ? 'done' : 'log')}
              </span>
              <span className={styles.stepDetail}>
                {s.code ? `${s.code} ` : ''}
                {s.error ?? s.raw ?? (s.done ? (s.ok === false ? 'failed' : 'complete') : '')}
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.available && (
        <>
          <div className={styles.toolbar}>
            <span className={styles.readyCount}>
              <strong>{cands.length}</strong>
              album{cands.length === 1 ? '' : 's'} ready to publish
            </span>
            <span className={styles.spacer} />
            <ButtonRow>
              <Button small disabled={!!busy} onClick={() => void load()}>
                Refresh
              </Button>
              <Button
                variant="primary"
                small
                disabled={!cands.length || !!busy}
                onClick={() =>
                  setPending({
                    codes: allCodes,
                    tag: 'all',
                    label: `all ${cands.length} album${cands.length === 1 ? '' : 's'}`,
                  })
                }
              >
                Publish all ({cands.length})
              </Button>
            </ButtonRow>
          </div>

          <AdminTable
            head={
              <>
                <th>Artist</th>
                <th>Album</th>
                <th className={styles.tracks}>Tracks (studio / live)</th>
                <th />
              </>
            }
          >
            {cands.length === 0 && (
              <EmptyRow colSpan={4}>Everything on the studio drive is already live.</EmptyRow>
            )}
            {cands.map((c) => (
              <tr key={c.code}>
                <td className={cell.muted}>{c.artist}</td>
                <td>
                  <span className={styles.albumTitle}>{c.title}</span>
                  <span className={styles.code}>{c.code}</span>
                </td>
                <td className={styles.tracks}>
                  <span className={styles.tracksNew}>{c.jTracks}</span> / {c.live}
                </td>
                <td className={styles.actionCell}>
                  <Button
                    small
                    variant="primary"
                    disabled={!!busy}
                    onClick={() =>
                      setPending({ codes: [c.code], tag: c.code, label: `${c.title} (${c.code})` })
                    }
                  >
                    {busy === c.code ? 'Publishing…' : 'Publish'}
                  </Button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}

      {data === null && !err && <Notice>Checking the studio drive…</Notice>}

      <ConfirmDialog
        open={pending !== null}
        title="Publish to production"
        confirmLabel="Publish"
        tone="default"
        onConfirm={() => pending && void run(pending.codes, pending.tag)}
        onCancel={() => setPending(null)}
      >
        Publish <strong>{pending?.label}</strong> to the live site? This uploads the audio to the CDN,
        marks it live, and redeploys — it affects what visitors can hear, and takes a couple of
        minutes.
      </ConfirmDialog>
    </>
  );
}
