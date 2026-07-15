import Link from 'next/link';
import { BookCover } from '@/components/book/BookCover';
import { Eyebrow } from '@/components/system/Eyebrow';
import styles from './BookBand.module.css';

/** The funnel. The songs are the doorway; the book is the whole account of it. */
export function BookBand() {
  return (
    <section className="wrap">
      <div className={styles.band}>
        <div>
          <Eyebrow>The full transmission</Eyebrow>

          <h2 className={styles.title}>The whole account of how the songs were found.</h2>

          <p className={styles.copy}>
            The albums let you hear it. The book explains it — where the first sequence turned up, what the
            symbols were doing, why the fold is sevenfold, and what else came loose from the text once we
            started reading it the old way. It is the argument in full, laid out for anyone willing to check
            the work. Included with membership.
          </p>

          <div className={styles.actions}>
            <Link href="/book" className="pill">
              Get the book
            </Link>
            <Link href="/membership" className="pill pill--ghost">
              See membership
            </Link>
          </div>
        </div>

        <div className={styles.coverWrap}>
          <BookCover />
        </div>
      </div>
    </section>
  );
}
