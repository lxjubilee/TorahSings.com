'use client';

import { useMemo, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { waveformBars } from '@/lib/seed';
import styles from './Waveform.module.css';

interface WaveformProps {
  /** Seeds the bar heights. Same seed, same shape, every render. */
  seed: string;
  /** 0–1. Bars behind the playhead brighten. */
  progress?: number;
  /** Adds the breathing animation. */
  active?: boolean;
  bars?: number;
  /** When provided the waveform becomes a seek control. */
  onSeek?: (fraction: number) => void;
  className?: string;
}

/**
 * A flex row of thin bars with varied heights. The tallest bar is starlight
 * gold; the rest are antique gold at 40–70%.
 */
export function Waveform({ seed, progress = 0, active = false, bars = 32, onSeek, className }: WaveformProps) {
  const ref = useRef<HTMLDivElement>(null);
  const heights = useMemo(() => waveformBars(seed, bars), [seed, bars]);
  const peakIndex = useMemo(() => heights.indexOf(Math.max(...heights)), [heights]);

  const clamped = Math.min(1, Math.max(0, progress));

  const seekFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el || !onSeek) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => seekFromClientX(e.clientX);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(1, clamped + step));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, clamped - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(1);
    }
  };

  const interactive = Boolean(onSeek);

  return (
    <div
      ref={ref}
      className={[styles.wave, active ? styles.active : '', interactive ? styles.seekable : '', className]
        .filter(Boolean)
        .join(' ')}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? 'slider' : 'presentation'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Seek' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(clamped * 100) : undefined}
      aria-valuetext={interactive ? `${Math.round(clamped * 100)} percent` : undefined}
    >
      {heights.map((h, i) => {
        const isPlayed = i / heights.length < clamped;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={[styles.bar, isPlayed ? styles.played : '', i === peakIndex ? styles.peak : '']
              .filter(Boolean)
              .join(' ')}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
