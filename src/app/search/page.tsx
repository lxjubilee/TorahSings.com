import type { Metadata } from 'next';

import { CatalogAlbumTile } from '@/components/home/CatalogAlbumTile';
import { PageHero } from '@/components/system/PageHero';
import { angelsCatalog } from '@/content/angels-catalog';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: false },
};

/** Every album, flattened once, for searching by title / book / code. */
const ALL_ALBUMS = angelsCatalog.flatMap((category) => category.albums);

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const needle = query.toLowerCase();

  const results = needle
    ? ALL_ALBUMS.filter((a) => `${a.title} ${a.book} ${a.code}`.toLowerCase().includes(needle))
    : [];

  return (
    <>
      <PageHero eyebrow="Search the library" title={query ? `“${query}”` : 'Search'}>
        {query
          ? `${results.length} album${results.length === 1 ? '' : 's'} match your search.`
          : 'Search the catalog by album title or book name from the header.'}
      </PageHero>

      <div className={`wrap ${styles.page}`}>
        {query && results.length > 0 && (
          <div className={styles.grid}>
            {results.map((album) => (
              <CatalogAlbumTile key={album.code} album={album} />
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <p className={styles.empty}>
            No albums match “{query}”. Try a book name like “Genesis”, or a word from a title.
          </p>
        )}
      </div>
    </>
  );
}
