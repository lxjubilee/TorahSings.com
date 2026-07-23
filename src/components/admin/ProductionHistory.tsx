import {
  ALBUM_QUOTA,
  SONG_QUOTA,
  productionHistory,
  type WeekRow,
} from '@/lib/productionHistory';
import { AdminTable, EmptyRow, Kpi, KpiRow, Notice, SectionSub, SectionTitle, cell } from './AdminUI';
import styles from './ProductionHistory.module.css';

/**
 * Weekly output against the target.
 *
 * A server component on purpose: this is pure computation over two generated
 * modules, so there is nothing for the browser to fetch, no loading state, and
 * no admin endpoint to gate. The console's role gate still hides the page.
 */

const scoreColour = (pct: number) =>
  pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--accent)' : 'var(--accent-peach)';

function Meter({ pct }: { pct: number }) {
  return (
    <div className={styles.meter}>
      <span className={styles.track}>
        <span
          className={styles.fill}
          data-tone={pct >= 100 ? 'ok' : pct < 70 ? 'low' : undefined}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
      <span className={styles.pct}>{pct}%</span>
    </div>
  );
}

export function ProductionHistory() {
  const { weeks, totalLiveAlbums, totalLiveSongs, undated } = productionHistory();
  const current: WeekRow | undefined = weeks.find((w) => w.isCurrent) ?? weeks[0];

  return (
    <>
      <SectionTitle>Production history</SectionTitle>
      <SectionSub>
        Albums and songs made live, bucketed by the workweek they were completed on the studio drive
        (Sunday–Saturday, Pacific). Completion dates never move, so past weeks settle permanently.
      </SectionSub>

      {current && (
        <div className={styles.current}>
          <div>
            <div className={styles.currentLabel}>
              {current.isCurrent ? 'This week · in progress' : 'Most recent week'} · {current.yyww}
            </div>
            <div className={styles.currentRange}>{current.rangeLabel}</div>
          </div>
          <div className={styles.currentScore}>
            <div className={styles.currentN} style={{ color: scoreColour(current.quotaScore) }}>
              {current.quotaScore}%
            </div>
            <div className={styles.currentSub}>
              {current.albums} albums · {current.songs} songs
            </div>
          </div>
        </div>
      )}

      <KpiRow>
        <Kpi n={totalLiveAlbums.toLocaleString()} label="Total live albums" />
        <Kpi n={totalLiveSongs.toLocaleString()} label="Total live songs" />
        <Kpi n={weeks.length.toLocaleString()} label="Weeks recorded" />
        <Kpi
          n={`${ALBUM_QUOTA} / ${SONG_QUOTA}`}
          label="Weekly target (albums / songs)"
        />
      </KpiRow>

      {undated > 0 && (
        <Notice tone="error">
          {undated} live album{undated === 1 ? ' has' : 's have'} no completion date on the drive, so
          {undated === 1 ? ' it is' : ' they are'} counted in the totals above but not in any week.
          Re-run <code>node scripts/gen-completion-dates.mjs</code> after the drive is next updated.
        </Notice>
      )}

      <AdminTable
        head={
          <>
            <th>Week</th>
            <th>Dates</th>
            <th className={cell.num}>Albums</th>
            <th>vs target</th>
            <th className={cell.num}>Songs</th>
            <th>vs target</th>
            <th className={cell.num}>Score</th>
            <th className={cell.num}>Cumulative</th>
          </>
        }
      >
        {weeks.length === 0 && (
          <EmptyRow colSpan={8}>
            No completion dates yet — run <code>node scripts/gen-completion-dates.mjs</code>.
          </EmptyRow>
        )}
        {weeks.map((w) => (
          <tr key={w.yyww}>
            <td>
              <span className={styles.week}>{w.yyww}</span>
              {w.isCurrent && <span className={styles.inProgress}>live</span>}
            </td>
            <td className={`${cell.muted} ${styles.range}`}>{w.rangeLabel}</td>
            <td className={cell.num}>{w.albums}</td>
            <td>
              <Meter pct={w.albumPct} />
            </td>
            <td className={cell.num}>{w.songs}</td>
            <td>
              <Meter pct={w.songPct} />
            </td>
            <td className={styles.score} style={{ color: scoreColour(w.quotaScore) }}>
              {w.quotaScore}%
            </td>
            <td className={cell.num}>
              {w.cumAlbums.toLocaleString()} / {w.cumSongs.toLocaleString()}
            </td>
          </tr>
        ))}
      </AdminTable>

      <p className={styles.note}>
        <span className={styles.warn}>The weekly target is provisional.</span> Every percentage here
        is relative to <strong>{ALBUM_QUOTA} albums</strong> and <strong>{SONG_QUOTA} songs</strong> a
        week, which were set from the cadence observed on the drive rather than agreed with the
        studio. Change them in <code>src/lib/productionHistory.ts</code>; nothing else needs touching.
        The current week is still open, so its score only settles when the week closes.
      </p>
    </>
  );
}
