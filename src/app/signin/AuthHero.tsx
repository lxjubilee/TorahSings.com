'use client';

import { useEffect, useState } from 'react';
import styles from './SignInForm.module.css';

/**
 * The right-panel slideshow — rotating quotes over the images in
 * public/images/slider, in file order (sld1 is the first slide). The stylesheet
 * owns cover/centre and the Ken-Burns zoom, so a slide only supplies the image;
 * `.hero::before` lays the scrim that keeps the quote readable over it.
 */
const SLIDES = [
  {
    image: '/images/slider/sld1.webp',
    quote: 'When the morning stars sang together, and all the sons of Elohim shouted for joy.',
    cite: 'Iyob 38:7',
  },
  {
    image: '/images/slider/sld2.webp',
    quote: 'Holy, holy, holy is Yahuah of hosts; the whole earth is full of His glory.',
    cite: 'Yeshayahu 6:3',
  },
  {
    image: '/images/slider/sld3.webp',
    quote: 'The heavens declare the glory of El; the skies proclaim the work of His hands.',
    cite: 'Tehillim 19:1',
  },
  {
    image: '/images/slider/sld4.webp',
    quote: 'Sing to Yahuah a new song; sing to Yahuah, all the earth.',
    cite: 'Tehillim 96:1',
  },
  {
    image: '/images/slider/sld5.webp',
    quote: 'He will rejoice over you with gladness, and renew you in His love with singing.',
    cite: 'Tzephanyah 3:17',
  },
  {
    image: '/images/slider/sld6.webp',
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
            style={{ backgroundImage: `url('${s.image}')` }}
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
