import styles from './PostureStrip.module.css';

/** The posture, stated once, plainly, before the library opens. */
export function PostureStrip() {
  return (
    <section className="wrap">
      <div className={styles.strip}>
        <p className={styles.line}>
          Brushing away tradition and human thinking — going back to the ancient Hebrew, and letting the
          Scriptures speak for themselves.
        </p>

        <div className={styles.stats}>
          <div>
            <span className={styles.value}>7</span>
            <span className={styles.key}>
              Degrees in the fold.
              <br />
              The narrative sets the count.
            </span>
          </div>
          <div>
            <span className={`glyph ${styles.value}`}>Job 38:7</span>
            <span className={styles.key}>
              &ldquo;The morning stars
              <br />
              sang together.&rdquo;
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
