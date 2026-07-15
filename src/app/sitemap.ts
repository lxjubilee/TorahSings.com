import type { MetadataRoute } from 'next';
import { getAlbums, getArticles, getLessonAlbums } from '@/lib/content';

const BASE = 'https://torahsings.com';

/** Only published content is listed. A future-dated album stays hidden until its hour. */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/hebraic-christianity', '/learn-hebrew', '/membership', '/book'].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const albums = getAlbums().map((a) => ({
    url: `${BASE}/album/${a.slug}`,
    lastModified: new Date(a.releasedAt),
    priority: 0.9,
  }));

  const articles = getArticles().map((a) => ({
    url: `${BASE}/hebraic-christianity/${a.slug}`,
    lastModified: new Date(a.releasedAt),
    priority: 0.7,
  }));

  const lessons = getLessonAlbums().map((l) => ({
    url: `${BASE}/learn-hebrew/${l.slug}`,
    lastModified: new Date(l.releasedAt),
    priority: 0.7,
  }));

  return [...staticRoutes, ...albums, ...articles, ...lessons];
}
