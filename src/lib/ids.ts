import { v5 as uuidv5 } from 'uuid';

/**
 * Deterministic ids for rateable things.
 *
 * MUST match api/src/ids.js — identical namespace + scheme, or a rating written
 * by the API and a summary read by the browser would key on different uuids and
 * silently never meet.
 *
 * This is the bridge between the two halves of the system: the catalog lives in
 * TypeScript/manifest form and knows only codes like `ANSMX01001EN`, while
 * production.user_reviews.target_id is a uuid column. The uuid is DERIVED from
 * the code and never stored, which is why ratings work while catalog.albums
 * sits empty.
 */
export const JV_NAMESPACE = 'f3a1e2d4-5b6c-4d7e-8f90-1a2b3c4d5e6f';

export const albumUuid = (code: string) => uuidv5(`album:${String(code).toUpperCase()}`, JV_NAMESPACE);

export const songUuid = (code: string, n: number | string) =>
  uuidv5(`song:${String(code).toUpperCase()}:${String(n)}`, JV_NAMESPACE);

export const artistUuid = (slug: string) => uuidv5(`artist:${String(slug).toLowerCase()}`, JV_NAMESPACE);
