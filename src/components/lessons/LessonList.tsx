'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PlayDisc } from '@/components/system/PlayButton';
import { canOpenLessonAlbum } from '@/lib/access';
import { useJubileeAccount } from '@/lib/jubilee-account';
import type { LessonAlbum } from '@/lib/types';
import styles from './LessonList.module.css';

export function LessonList({ lessonAlbums }: { lessonAlbums: LessonAlbum[] }) {
  const { entitlement } = useJubileeAccount();

  return (
    <div className={styles.list}>
      {lessonAlbums.map((album) => {
        const locked = !canOpenLessonAlbum(album, entitlement).allowed;

        return (
          <Link
            key={album.slug}
            href={`/learn-hebrew/${album.slug}`}
            className={[styles.row, locked ? styles.locked : ''].filter(Boolean).join(' ')}
          >
            <span className={`glyph ${styles.tile}`} style={{ '--hue': album.hue } as CSSProperties}>
              {album.glyph}
            </span>

            <span className={styles.body}>
              <span className={styles.level}>
                Level {album.level} · {album.subtitle}
              </span>
              <span className={styles.title}>{album.title}</span>
              <span className={styles.meta}>
                {album.presenters.join(' & ')} · {album.lessons.length} lessons
                {locked ? ' · Members' : ''}
              </span>
            </span>

            <PlayDisc size={40} locked={locked} />
          </Link>
        );
      })}
    </div>
  );
}
