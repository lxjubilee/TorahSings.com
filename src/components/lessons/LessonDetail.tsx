'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { MembershipGate } from '@/components/gating/MembershipGate';
import { Eyebrow } from '@/components/system/Eyebrow';
import { canOpenLesson, canOpenLessonAlbum } from '@/lib/access';
import { useJubileeAccount } from '@/lib/jubilee-account';
import type { LessonAlbum } from '@/lib/types';
import { ExerciseCard } from './ExerciseCard';
import styles from './LessonDetail.module.css';

export function LessonDetail({ album }: { album: LessonAlbum }) {
  const { entitlement } = useJubileeAccount();
  const albumAccess = canOpenLessonAlbum(album, entitlement);

  return (
    <div className="wrap">
      <Link href="/learn-hebrew" className={styles.back}>
        &#8592; All levels
      </Link>

      <header className={styles.hero}>
        <span className={`glyph ${styles.tile}`} style={{ '--hue': album.hue } as CSSProperties} aria-hidden="true">
          {album.glyph}
        </span>

        <div>
          <Eyebrow>
            Level {album.level} · {album.subtitle}
          </Eyebrow>
          <h1 className={styles.title}>{album.title}</h1>
          <span className={styles.presenters}>Taught by {album.presenters.join(' & ')}</span>
        </div>
      </header>

      <p className={styles.intro}>{album.intro}</p>

      <div className={styles.lessons}>
        {album.lessons.map((lesson) => {
          const access = canOpenLesson(album, lesson.n, entitlement);
          const locked = !access.allowed;

          return (
            <article key={lesson.n} className={[styles.lesson, locked ? styles.locked : ''].filter(Boolean).join(' ')}>
              <div className={styles.head}>
                <span className={styles.n}>{String(lesson.n).padStart(2, '0')}</span>
                <h2 className={styles.lessonTitle}>{lesson.title}</h2>
                <span className={styles.duration}>{lesson.durationMinutes} min</span>
              </div>

              <p className={styles.summary}>{lesson.summary}</p>

              {locked ? (
                <p className={styles.lockedNote}>Unlocks with membership</p>
              ) : (
                <>
                  {!lesson.mediaUrl && (
                    <p className={styles.mediaPending}>
                      Lesson film pending · exercises below are live
                    </p>
                  )}

                  {lesson.exercises.length > 0 && (
                    <details className={styles.details}>
                      <summary className={styles.detailsSummary}>
                        <span className={styles.caret} aria-hidden="true">
                          &#9656;
                        </span>
                        Practice · {lesson.exercises.length}{' '}
                        {lesson.exercises.length === 1 ? 'question' : 'questions'}
                      </summary>
                      <div className={styles.exercises}>
                        {lesson.exercises.map((exercise, i) => (
                          <ExerciseCard key={i} exercise={exercise} />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {!albumAccess.allowed && (
        <div className={styles.gateWrap}>
          <MembershipGate reason={albumAccess.reason} />
        </div>
      )}
    </div>
  );
}
