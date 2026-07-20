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
      <PageHero eyebrow="Your mixes" title="Playlists">
        Every playlist you build is saved to your Jubilee Account and travels with you.
      </PageHero>

      <div className="wrap" style={{ paddingBottom: 72 }}>
        <PlaylistsGrid />
      </div>
    </>
  );
}
