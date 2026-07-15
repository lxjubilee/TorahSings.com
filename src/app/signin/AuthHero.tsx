'use client';

import { useEffect, useState } from 'react';
import styles from './SignInForm.module.css';

/**
 * The right-panel slideshow — rotating quotes over placeholder backgrounds.
 * Each slide's `bg` is a plain CSS background (color/gradient) for now; swap it
 * for `url('/your-image.jpg') center/cover` once you drop images in.
 */
const SLIDES = [
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #4a3418, transparent 62%), linear-gradient(160deg, #26190d, #120b05)',
    quote: 'When the morning stars sang together, and all the sons of Elohim shouted for joy.',
    cite: 'Iyob 38:7',
  },
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #4a2130, transparent 62%), linear-gradient(160deg, #261017, #120709)',
    quote: 'Holy, holy, holy is Yahuah of hosts; the whole earth is full of His glory.',
    cite: 'Yeshayahu 6:3',
  },
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #2e2150, transparent 62%), linear-gradient(160deg, #171226, #0b0812)',
    quote: 'The heavens declare the glory of El; the skies proclaim the work of His hands.',
    cite: 'Tehillim 19:1',
  },
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #143a3a, transparent 62%), linear-gradient(160deg, #0d2124, #060f11)',
    quote: 'Sing to Yahuah a new song; sing to Yahuah, all the earth.',
    cite: 'Tehillim 96:1',
  },
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #1b2d55, transparent 62%), linear-gradient(160deg, #101a2e, #070c16)',
    quote: 'He will rejoice over you with gladness, and renew you in His love with singing.',
    cite: 'Tzephanyah 3:17',
  },
  {
    bg: 'radial-gradient(120% 95% at 50% 18%, #3d2a16, transparent 62%), linear-gradient(160deg, #1f150b, #0f0a05)',
    quote: 'Let everything that has breath praise Yah. Halelu-Yah.',
    cite: 'Tehillim 150:6',
  },
];

export function AuthHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[active];

  return (
    <div className={styles.hero}>
      <div className={styles.heroSlides} aria-hidden="true">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={[styles.heroSlide, i === active ? styles.heroSlideActive : ''].filter(Boolean).join(' ')}
            style={{ background: s.bg }}
          />
        ))}
      </div>

      <div className={styles.quote}>
        <p key={active}>{slide.quote}</p>
        <cite>{slide.cite}</cite>
      </div>

      <div className={styles.heroDots}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={[styles.heroDot, i === active ? styles.heroDotActive : ''].filter(Boolean).join(' ')}
            aria-label={`Show slide ${i + 1}`}
            aria-current={i === active}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
