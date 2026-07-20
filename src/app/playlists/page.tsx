import type { Metadata } from 'next';

import { PlaylistsGrid } from '@/components/account/PlaylistsGrid';
import { PageHero } from '@/components/system/PageHero';

export const metadata: Metadata = {
  title: 'Playlists',
  description: 'The playlists you have built.',
  robots: { index: false, follow: false },
};

export default function PlaylistsPage() {
  return (
    <>
      <PageHero eyebrow="Your mixes" title="My Favorites">
        Build your own mixes from any album or straight from the player — name them, play them, and
        keep them saved to your account.
      </PageHero>

      <div className="wrap" style={{ paddingBottom: 72 }}>
        <PlaylistsGrid />
      </div>
    </>
  );
}
