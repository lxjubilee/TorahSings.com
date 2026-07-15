import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticleReader } from '@/components/articles/ArticleReader';
import { allArticleSlugs, getArticle } from '@/lib/content';

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return allArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Article not found' };

  return {
    title: article.title,
    description: article.dek,
    openGraph: { title: `${article.title} · Torah Sings`, description: article.dek },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return <ArticleReader article={article} />;
}
