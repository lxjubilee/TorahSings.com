import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DefaultPlaylistDetail } from '@/components/playlists/DefaultPlaylistDetail';
import { allDefaultPlaylistIds, getDefaultPlaylist } from '@/lib/default-playlists';

export const dynamicParams = false;

export function generateStaticParams() {
  return allDefaultPlaylistIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const playlist = getDefaultPlaylist(id);
  if (!playlist) return { title: 'Playlist' };
  return {
    title: playlist.title,
    description: playlist.description,
    robots: { index: false, follow: false },
  };
}

export default async function DefaultPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playlist = getDefaultPlaylist(id);
  if (!playlist) notFound();

  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 72 }}>
      <DefaultPlaylistDetail playlist={playlist} />
    </div>
  );
}
