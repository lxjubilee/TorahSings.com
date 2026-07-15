import Link from 'next/link';
import { CelestialArt } from '@/components/system/CelestialArt';
import { Eyebrow } from '@/components/system/Eyebrow';
import type { Article } from '@/lib/types';
import styles from './ArticleCard.module.css';

interface ArticleCardProps {
  article: Article;
  /** The large horizontal card at the head of the library. */
  featured?: boolean;
  /** Marks the piece as members-only. */
  locked?: boolean;
}

export function ArticleCard({ article, featured = false, locked = false }: ArticleCardProps) {
  return (
    <Link
      href={`/hebraic-christianity/${article.slug}`}
      className={[styles.card, featured ? styles.featured : ''].filter(Boolean).join(' ')}
    >
      <CelestialArt
        className={styles.art}
        seed={article.slug}
        hue={article.art.hue}
        topic={article.category}
        glyph={article.art.glyph}
        ratio={featured ? '4 / 3' : '16 / 10'}
      />

      <div className={styles.body}>
        {featured && <Eyebrow className={styles.featuredFlag}>The deepening begins here</Eyebrow>}

        <span className={styles.category}>{article.category}</span>
        <h3 className={styles.title}>{article.title}</h3>
        <p className={styles.dek}>{article.dek}</p>

        <span className={styles.meta}>
          {locked ? (
            <span className={styles.locked}>Members · {article.readingTime} min</span>
          ) : (
            <>
              Read aloud · {article.presenter} · {article.readingTime} min
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
