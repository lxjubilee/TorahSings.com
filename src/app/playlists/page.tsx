import type { Metadata } from 'next';

import { PlaylistsBody } from '@/components/playlists/PlaylistsBody';
import { PageHero } from '@/components/system/PageHero';
import { defaultPlaylistsByType } from '@/lib/default-playlists';

export const metadata: Metadata = {
  title: 'Playlists',
  description: 'Playlists by theme, for your season, and the mixes you build yourself.',
  robots: { index: false, follow: false },
};

export default function PlaylistsPage() {
  const thematic = defaultPlaylistsByType('Thematic');
  const emotional = defaultPlaylistsByType('Emotional State');

  return (
    <>
      <PageHero eyebrow="Playlists" title="Songs, Gathered">
        Playlists grouped by the truth they carry and the season you are in — plus the mixes you
        build yourself, saved to your account.
      </PageHero>

      <div className="wrap" style={{ paddingBottom: 72 }}>
        <PlaylistsBody thematic={thematic} emotional={emotional} />
      </div>
    </>
  );
}
