import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LessonDetail } from '@/components/lessons/LessonDetail';
import { allLessonSlugs, getLessonAlbum } from '@/lib/content';

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return allLessonSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const album = getLessonAlbum(slug);
  if (!album) return { title: 'Lesson not found' };

  return {
    title: album.title,
    description: album.intro,
    openGraph: { title: `${album.title} · Torah Sings`, description: album.intro },
  };
}

export default async function LessonAlbumPage({ params }: { params: Params }) {
  const { slug } = await params;
  const album = getLessonAlbum(slug);
  if (!album) notFound();

  return <LessonDetail album={album} />;
}
