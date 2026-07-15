import type { Metadata } from 'next';

import { AlephBetTeaser } from '@/components/lessons/AlephBetTeaser';
import { LessonList } from '@/components/lessons/LessonList';
import { Eyebrow } from '@/components/system/Eyebrow';
import { PageHero } from '@/components/system/PageHero';
import { getLessonAlbums } from '@/lib/content';
import styles from './page.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Learn Hebrew',
  description:
    'You do not need fluency. Just enough literacy to begin discovering for yourself. Taught by Zev and Zariah Inspire, from the Paleo layer up.',
};

export default function LearnHebrewPage() {
  const lessonAlbums = getLessonAlbums();

  return (
    <>
      <PageHero eyebrow="Prong III · The empowerment" title="Learn Hebrew">
        You do not need fluency. You need enough to open the text yourself and see what is standing in it — the
        picture inside the letter, the root under the word. Start where everyone starts. It is genuinely fun, and
        it goes further than you expect.
      </PageHero>

      <div className={`wrap ${styles.page}`}>
        <div>
          <AlephBetTeaser />
        </div>

        <div className={styles.right}>
          <Eyebrow className={styles.rightHead}>Three levels</Eyebrow>
          <LessonList lessonAlbums={lessonAlbums} />
        </div>
      </div>
    </>
  );
}
