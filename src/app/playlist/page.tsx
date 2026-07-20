import type { Metadata } from 'next';
import Link from 'next/link';

import { PlaylistDetail } from '@/components/account/PlaylistDetail';

export const metadata: Metadata = {
  title: 'Playlist',
  robots: { index: false, follow: false },
};

/**
 * A single playlist, at JubiLujah's URL: /playlist?id=<uuid> (singular, query
 * param — not /playlists/[id]), so links are interchangeable between the sites.
 */
export default async function PlaylistPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 72 }}>
      {id ? (
        <PlaylistDetail id={id} />
      ) : (
        <p style={{ padding: '60px 24px', textAlign: 'center' }}>
          No playlist selected. <Link href="/playlists">Browse your playlists</Link>.
        </p>
      )}
    </div>
  );
}
