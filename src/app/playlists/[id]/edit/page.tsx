import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EditPlaylist } from '@/components/playlists/EditPlaylist';
import { allDefaultPlaylistIds, getDefaultPlaylist } from '@/lib/default-playlists';

export const dynamicParams = false;

export function generateStaticParams() {
  return allDefaultPlaylistIds().map((id) => ({ id }));
}

export const metadata: Metadata = {
  title: 'Edit Playlist',
  robots: { index: false, follow: false },
};

export default async function EditPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playlist = getDefaultPlaylist(id);
  if (!playlist) notFound();

  return <EditPlaylist playlist={playlist} />;
}
