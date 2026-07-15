'use client';

import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import styles from './Exercise.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** One question. Answer it and the note teaches you why. */
export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;

  return (
    <div className={styles.exercise}>
      <p className={styles.prompt}>{exercise.prompt}</p>

      <div className={styles.choices} role="group">
        {exercise.choices.map((choice, i) => {
          const isAnswer = i === exercise.answerIndex;
          const isChosen = i === chosen;

          let tone = '';
          if (answered) {
            if (isAnswer) tone = styles.correct;
            else if (isChosen) tone = styles.wrong;
            else tone = styles.dim;
          }

          return (
            <button
              key={i}
              type="button"
              className={[styles.choice, tone].filter(Boolean).join(' ')}
              disabled={answered}
              onClick={() => setChosen(i)}
            >
              <span className={styles.marker} aria-hidden="true">
                {answered && isAnswer ? '✓' : LETTERS[i]}
              </span>
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <p className={styles.note} role="status">
            {exercise.note}
          </p>
          <button type="button" className={styles.again} onClick={() => setChosen(null)}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
