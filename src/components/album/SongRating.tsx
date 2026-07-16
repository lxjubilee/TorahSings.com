'use client';

import { StarRating } from '@/components/system/StarRating';
import styles from './SongRating.module.css';

/**
 * Per-song rating shown in the album track list, ported from JubiLujah's
 * SongRatingControl. Compact: star indicator + rating count, plus a "Rate"
 * affordance. It renders inside a clickable track row, so the container stops
 * click propagation — otherwise rating a song would start playing it.
 *
 * `summary` mirrors the API's ReviewSummary shape (see docs/API.md §7), so when
 * the reviews router comes up this component needs no change — only its caller
 * swaps a local summary for GET /api/reviews/song/:id/summary.
 */
export interface SongSummary {
  /** Aggregate average across all raters, or null when nobody has rated. */
  average: number | null;
  rating_count: number;
  /** The caller's own stars, or null. */
  mine: number | null;
}

interface Props {
  summary: SongSummary | null;
  onRate: () => void;
}

export function SongRating({ summary, onRate }: Props) {
  const avg = summary?.average ?? null;
  const count = summary?.rating_count ?? 0;
  const rated = !!summary?.mine;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <span className={styles.song} onClick={(e) => e.stopPropagation()}>
      <StarRating value={avg ?? 0} size="sm" />
      <span className={styles.count}>({count.toLocaleString()})</span>
      <button
        type="button"
        className={`${styles.rate} ${rated ? styles.rated : ''}`}
        onClick={onRate}
        title={rated ? 'Edit your rating' : 'Rate this song'}
      >
        {rated ? '★ Your rating' : 'Rate'}
      </button>
    </span>
  );
}
