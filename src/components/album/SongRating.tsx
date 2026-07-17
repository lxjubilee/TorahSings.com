'use client';

import { StarRating } from '@/components/system/StarRating';
import type { ReviewSummary } from '@/lib/reviews';
import styles from './SongRating.module.css';

/**
 * Per-song rating shown in the album track list, ported from JubiLujah's
 * SongRatingControl. Compact: star indicator + rating count, plus a "Rate"
 * affordance. It renders inside a clickable track row, so the container stops
 * click propagation — otherwise rating a song would start playing it.
 *
 * The summary comes straight from production.review_summaries via
 * POST /api/reviews/summaries, batched for the whole album by the caller.
 */
interface Props {
  summary: ReviewSummary | null;
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
