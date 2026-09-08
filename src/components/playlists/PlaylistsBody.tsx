'use client';

import { useJubileeAccount } from '@/lib/jubilee-account';
import type { DefaultPlaylist } from '@/lib/default-playlists';
import { PlaylistsGrid } from '@/components/account/PlaylistsGrid';
import { DefaultSection } from './DefaultSection';

/**
 * Composes the three PLAYLISTS-page sections in the spec order (Section 2):
 *
 *  - Signed in: My Playlists first (their own content is most relevant), then
 *    the defaults — Thematic ("Songs by Theme"), then Emotional State
 *    ("For Your Season").
 *  - Signed out: open with the defaults; the sign-in prompt to build your own
 *    follows underneath.
 *
 * The default playlists are baked at build time and passed in from the server
 * page; My Playlists come from the database inside <PlaylistsGrid/>.
 */
export function PlaylistsBody({
  thematic,
  emotional,
}: {
  thematic: DefaultPlaylist[];
  emotional: DefaultPlaylist[];
}) {
  const { session, status } = useJubileeAccount();
  const signedIn = Boolean(session) && status !== 'loading';

  const defaults = (
    <>
      <DefaultSection
        heading="Songs by Theme"
        blurb="Built around the truth the songs share — each one teaches something."
        playlists={thematic}
      />
      <DefaultSection
        heading="For Your Season"
        blurb="Built around where you are right now — songs that meet you there."
        playlists={emotional}
      />
    </>
  );

  const mine = <PlaylistsGrid />;

  return signedIn ? (
    <>
      {mine}
      <div style={{ height: 24 }} />
      {defaults}
    </>
  ) : (
    <>
      {defaults}
      {mine}
    </>
  );
}
