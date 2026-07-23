'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  AdminTable,
  EmptyRow,
  Kpi,
  KpiRow,
  Notice,
  SectionSub,
  SectionTitle,
  cell,
} from './AdminUI';

/**
 * The console's landing section: what the production pipeline is holding, and
 * what has happened lately.
 *
 * Both feeds are independent — a pipeline with no rows must not blank the audit
 * log, and an audit query that fails must not hide the pipeline. They therefore
 * load and fail separately.
 */

/** Ordered as work actually flows; mirrors STAGES in api/src/routes/pipeline.js. */
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

interface PipelineResponse {
  items: unknown[];
  counts: Record<string, number>;
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  actor: string | null;
  created_at: string;
}

const label = (stage: string) => stage.replace(/_/g, ' ');

export function Overview() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [pipelineErr, setPipelineErr] = useState<string | null>(null);
  const [auditErr, setAuditErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PipelineResponse>('/api/pipeline')
      .then((p) => setCounts(p?.counts ?? {}))
      .catch((e) => setPipelineErr(e instanceof Error ? e.message : 'Could not load the pipeline.'));

    api
      .get<AuditRow[]>('/api/admin/audit')
      .then((rows) => setAudit(Array.isArray(rows) ? rows : []))
      .catch((e) => setAuditErr(e instanceof Error ? e.message : 'Could not load recent activity.'));
  }, []);

  // Only stages that actually hold something — ten empty tiles say nothing.
  const occupied = counts ? STAGES.filter((s) => counts[s]) : [];
  const total = counts ? Object.values(counts).reduce((n, v) => n + v, 0) : 0;

  return (
    <>
      <SectionTitle>Pipeline at a glance</SectionTitle>
      <SectionSub>
        Where every song and album currently sits in production. Counts come from the pipeline state
        table, so they move as work is transitioned rather than on a schedule.
      </SectionSub>

      {pipelineErr && <Notice tone="error">{pipelineErr}</Notice>}

      {!pipelineErr && counts === null && <Notice>Loading the pipeline…</Notice>}

      {!pipelineErr && counts !== null && occupied.length === 0 && (
        <Notice>No songs are in the pipeline yet.</Notice>
      )}

      {occupied.length > 0 && (
        <KpiRow>
          <Kpi n={total.toLocaleString()} label="In pipeline" />
          {occupied.map((s) => (
            <Kpi key={s} n={counts![s].toLocaleString()} label={label(s)} />
          ))}
        </KpiRow>
      )}

      <div style={{ marginTop: 32 }}>
        <SectionTitle>Recent activity</SectionTitle>
        <SectionSub>
          The audit log — role grants, cover replacements, account deletions. Newest first.
        </SectionSub>

        {auditErr && <Notice tone="error">{auditErr}</Notice>}

        {!auditErr && (
          <AdminTable
            head={
              <>
                <th>When</th>
                <th>Action</th>
                <th>Target</th>
                <th>Actor</th>
              </>
            }
          >
            {audit === null && <EmptyRow colSpan={4}>Loading recent activity…</EmptyRow>}
            {audit?.length === 0 && <EmptyRow colSpan={4}>No audit entries yet.</EmptyRow>}
            {audit?.map((a) => (
              <tr key={a.id}>
                <td className={cell.muted} style={{ whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td>
                  <code className={cell.mono}>{a.action}</code>
                </td>
                <td className={cell.muted}>{a.target_type ?? '—'}</td>
                <td>{a.actor ?? '—'}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    </>
  );
}
