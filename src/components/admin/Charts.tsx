'use client';

import { useState } from 'react';
import styles from './Charts.module.css';

/**
 * Two chart primitives, inline SVG, no dependency.
 *
 * Both are SINGLE-SERIES on purpose. Two measures of different scale get two
 * panels — never two y-axes, and never a second hue drawn from the site's
 * accents, which fail a colourblind-separation check against this surface
 * (green↔coral, ΔE 3.7 protan). One series also means no legend: the panel
 * title names the measure.
 *
 * Both ship a hover layer, because an SVG chart that cannot be interrogated is
 * a picture of data rather than a view of it.
 */

export interface Point {
  /** X label, e.g. a date or an hour. Shown in the tooltip and on the axis. */
  label: string;
  value: number;
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

function Panel({
  title,
  total,
  children,
}: {
  title: string;
  total?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        {total !== undefined && <span className={styles.total}>{total}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Vertical bars for a distribution over a small, fixed domain — hours of the
 * day, days of the week, star ratings. Data-ends are rounded 4px and anchored
 * to the baseline; a 2px gap separates neighbours.
 */
export function BarChart({
  title,
  total,
  data,
  unit = '',
  height = 130,
}: {
  title: string;
  total?: string;
  data: Point[];
  unit?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <Panel title={title} total={total}>
        <p className={styles.empty}>No data for this period.</p>
      </Panel>
    );
  }

  const W = 320;
  const H = height;
  const padB = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = W / data.length;
  const gap = 2;
  const barW = Math.max(1, slot - gap);
  const plotH = H - padB;

  // Label every bar only when they fit; otherwise first, middle, last.
  const showEvery = data.length <= 12 ? 1 : Math.ceil(data.length / 6);

  return (
    <Panel title={title} total={total}>
      <div className={styles.wrap}>
        <svg className={styles.plot} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
          <line x1="0" y1={plotH} x2={W} y2={plotH} className={styles.grid} />
          {data.map((d, i) => {
            const h = max ? (d.value / max) * (plotH - 6) : 0;
            const x = i * slot + gap / 2;
            return (
              <g key={d.label}>
                <rect
                  x={x}
                  y={plotH - h}
                  width={barW}
                  height={Math.max(h, d.value > 0 ? 2 : 0)}
                  rx={Math.min(4, barW / 2)}
                  className={styles.bar}
                  data-hover={hover === i ? 'yes' : 'no'}
                />
                <rect
                  x={x}
                  y={0}
                  width={barW}
                  height={plotH}
                  className={styles.hit}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h2) => (h2 === i ? null : h2))}
                />
                {i % showEvery === 0 && (
                  <text x={x + barW / 2} y={H - 4} textAnchor="middle" className={styles.axisLabel}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div
            className={styles.tooltip}
            style={{
              left: `${((hover + 0.5) / data.length) * 100}%`,
              top: 0,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className={styles.tooltipK}>{data[hover].label}</div>
            <div>
              {fmt(data[hover].value)}
              {unit}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * A line over time with a soft area beneath. Hovering snaps a crosshair to the
 * nearest point rather than requiring the pointer to land on the mark itself.
 */
export function LineChart({
  title,
  total,
  data,
  unit = '',
  height = 130,
}: {
  title: string;
  total?: string;
  data: Point[];
  unit?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <Panel title={title} total={total}>
        <p className={styles.empty}>Not enough data to plot a trend yet.</p>
      </Panel>
    );
  }

  const W = 320;
  const H = height;
  const padB = 16;
  const plotH = H - padB;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => plotH - (v / max) * (plotH - 8);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${path} L${W},${plotH} L0,${plotH} Z`;

  const step = Math.max(1, Math.floor(data.length / 4));

  return (
    <Panel title={title} total={total}>
      <div className={styles.wrap}>
        <svg
          className={styles.plot}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={title}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const rel = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(data.length - 1, Math.round((rel / W) * (data.length - 1)))));
          }}
        >
          <line x1="0" y1={plotH} x2={W} y2={plotH} className={styles.grid} />
          <path d={areaPath} className={styles.area} />
          <path d={path} className={styles.line} />

          {hover !== null && (
            <>
              <line x1={x(hover)} y1={0} x2={x(hover)} y2={plotH} className={styles.crosshair} />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={4.5} className={styles.marker} />
            </>
          )}

          {data.map((d, i) =>
            i % step === 0 || i === data.length - 1 ? (
              <text
                key={d.label}
                x={x(i)}
                y={H - 4}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                className={styles.axisLabel}
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
        {hover !== null && (
          <div
            className={styles.tooltip}
            style={{ left: `${(hover / (data.length - 1)) * 100}%`, top: 0, transform: 'translate(-50%, -100%)' }}
          >
            <div className={styles.tooltipK}>{data[hover].label}</div>
            <div>
              {fmt(data[hover].value)}
              {unit}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
