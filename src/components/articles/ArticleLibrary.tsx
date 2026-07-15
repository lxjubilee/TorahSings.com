'use client';

import { useMemo, useState } from 'react';
import { canReadArticle } from '@/lib/access';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { ARTICLE_CATEGORIES, type Article, type ArticleCategory } from '@/lib/types';
import { ArticleCard } from './ArticleCard';
import styles from './ArticleLibrary.module.css';

type Filter = ArticleCategory | 'All';

const FILTERS: readonly Filter[] = ['All', ...ARTICLE_CATEGORIES];

/**
 * The article library. H4C's structural clarity — organized categories,
 * progressive layering — expressed through the celestial aesthetic.
 */
export function ArticleLibrary({ articles }: { articles: Article[] }) {
  const { entitlement } = useJubileeAccount();
  const [filter, setFilter] = useState<Filter>('All');

  const visible = useMemo(
    () => (filter === 'All' ? articles : articles.filter((a) => a.category === filter)),
    [articles, filter],
  );

  // The featured piece leads the library, but steps into the grid once the
  // reader narrows to a category — otherwise it would sit there out of context.
  const featured = filter === 'All' ? visible.find((a) => a.featured) : undefined;
  const rest = featured ? visible.filter((a) => a.slug !== featured.slug) : visible;

  const isLocked = (article: Article) => !canReadArticle(article, entitlement).allowed;

  return (
    <>
      <div className={styles.chips} role="group" aria-label="Filter by category">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={[styles.chip, f === filter ? styles.selected : ''].filter(Boolean).join(' ')}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {featured && <ArticleCard article={featured} featured locked={isLocked(featured)} />}

      {rest.length > 0 ? (
        <div className={styles.grid}>
          {rest.map((article) => (
            <ArticleCard key={article.slug} article={article} locked={isLocked(article)} />
          ))}
        </div>
      ) : (
        !featured && <p className={styles.empty}>Nothing has surfaced under this heading yet. It will.</p>
      )}
    </>
  );
}
