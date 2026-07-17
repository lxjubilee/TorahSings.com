'use client';

/**
 * Client + types for the public Rating & Review surface, mirroring JubiLujah's
 * lib/reviews.ts. All calls go through lib/api (Bearer auth, transparent token
 * refresh) and are same-origin — next.config rewrites /api/* to the API.
 *
 * How this works, end to end (see docs/API.md):
 *   PUT /api/reviews/:type/:id  (requireAuth)
 *     → upserts production.user_reviews, keyed (target_type, target_id, user)
 *     → the trg_user_review_summary trigger recalculates
 *       production.review_summaries — nothing is averaged on read
 *   POST /api/reviews/summaries (public)
 *     → reads review_summaries for MANY targets in one round-trip, plus the
 *       caller's own stars as `mine` when signed in
 *
 * `id` is always a derived uuid — see lib/ids.ts.
 */

import { api } from './api';

export type TargetType = 'album' | 'song';
export type ReviewSort = 'recent' | 'highest' | 'lowest' | 'helpful';

export interface Distribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface MyReview {
  id: string;
  stars: number;
  title: string | null;
  body: string | null;
  status: string;
  helpful_count: number;
  created_at: string;
  edited?: boolean;
}

export interface ReviewSummary {
  target_type: TargetType;
  target_id: string;
  /** Aggregate across all raters; null when nobody has rated. */
  average: number | null;
  rating_count: number;
  review_count: number;
  distribution: Distribution;
  /** The caller's own rating, when signed in. */
  mine?: MyReview | null;
}

export interface Target {
  type: TargetType;
  id: string;
}

// ---- Reads (public) --------------------------------------------------------

export const getSummary = (type: TargetType, id: string) =>
  api.get<ReviewSummary>(`/api/reviews/${type}/${id}/summary`);

/** One round-trip for a whole album's worth of targets. */
export const batchSummaries = (targets: Target[]) =>
  api.post<{ summaries: Record<string, ReviewSummary> }>('/api/reviews/summaries', { targets });

// ---- Writes (require auth) -------------------------------------------------

export const upsertReview = (
  type: TargetType,
  id: string,
  body: { stars: number; title?: string | null; body?: string | null },
) => api.put<{ review: MyReview; summary: ReviewSummary }>(`/api/reviews/${type}/${id}`, body);

export const deleteReview = (type: TargetType, id: string) =>
  api.del<{ deleted: boolean; summary: ReviewSummary }>(`/api/reviews/${type}/${id}`);

// ---- Profile ---------------------------------------------------------------

export interface Contributions {
  albums_rated: number;
  songs_rated: number;
  reviews_written: number;
  total_contributions: number;
  helpful_received: number;
}

export const getContributions = () => api.get<Contributions>('/api/reviews/me/contributions');

export const getMyReviews = () =>
  api.get<Array<MyReview & { target_type: TargetType; target_id: string }>>('/api/reviews/me/reviews');

/** The key `summaries` is returned under, e.g. "album:<uuid>". */
export const summaryKey = (type: TargetType, id: string) => `${type}:${id}`;
