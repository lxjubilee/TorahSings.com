'use client';

import Link from 'next/link';
import { MembershipGate } from '@/components/gating/MembershipGate';
import { ArticleBody } from '@/components/reading/ArticleBody';
import { ReadAloudButton } from '@/components/reading/ReadAloudButton';
import { CelestialArt } from '@/components/system/CelestialArt';
import { Eyebrow } from '@/components/system/Eyebrow';
import { canReadArticle } from '@/lib/access';
import { useJubileeAccount } from '@/lib/jubilee-account';
import type { Article } from '@/lib/types';
import styles from './ArticleReader.module.css';

/** How much of a gated article a guest may read before the threshold. */
const TEASER_BLOCKS = 2;

export function ArticleReader({ article }: { article: Article }) {
  const { entitlement } = useJubileeAccount();
  const access = canReadArticle(article, entitlement);

  const blocks = access.allowed ? article.blocks : article.blocks.slice(0, TEASER_BLOCKS);

  return (
    <article>
      <div className="wrap">
        <Link href="/hebraic-christianity" className={styles.back}>
          &#8592; All articles
        </Link>

        <header className={styles.header}>
          <Eyebrow className={styles.category}>{article.category}</Eyebrow>
          <h1 className={styles.title}>{article.title}</h1>
          <p className={styles.dek}>{article.dek}</p>
        </header>

        <CelestialArt
          className={styles.art}
          seed={article.slug}
          hue={article.art.hue}
          topic={article.category}
          glyph={article.art.glyph}
          ratio="21 / 9"
        />

        <div className={styles.body}>
          {access.allowed && (
            <ReadAloudButton
              id={`article:${article.slug}`}
              blocks={article.blocks}
              presenter={article.presenter}
              audioUrl={article.audioUrl}
              minutes={article.readingTime}
            />
          )}

          <div className={access.allowed ? undefined : styles.teaser}>
            <ArticleBody blocks={blocks} />
          </div>
        </div>

        {!access.allowed && <MembershipGate reason={access.reason} afterTeaser />}

        {access.allowed && (
          <div className={styles.footRule}>
            <span className={styles.footMeta}>
              Presented by {article.presenter} · {article.readingTime} min
            </span>
            <span className={styles.footMeta}>Not canon · Something to consider</span>
          </div>
        )}
      </div>
    </article>
  );
}
