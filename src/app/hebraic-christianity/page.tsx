import type { Metadata } from 'next';

import { ArticleLibrary } from '@/components/articles/ArticleLibrary';
import { PageHero } from '@/components/system/PageHero';
import { getArticles } from '@/lib/content';
import styles from './page.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Hebraic Christianity',
  description:
    'The songs are only the entry point. Ancient Hebraic concepts, principles, and the gems hidden in the Hebrew Scriptures — read aloud, from the Paleo-Hebrew perspective.',
};

export default function HebraicChristianityPage() {
  const articles = getArticles();

  return (
    <>
      <PageHero eyebrow="Prong II · The deepening" title="Hebraic Christianity">
        The songs are only the entry point. Underneath them lies a whole grammar of meaning — pictographs that
        predate the letters, appointed times kept on a calendar older than the nations, covenants that were cut
        rather than signed. What follows is not a course. It is a series of doors, and every one of them is in the
        text already.
      </PageHero>

      <div className={`wrap ${styles.page}`}>
        <ArticleLibrary articles={articles} />
      </div>
    </>
  );
}
