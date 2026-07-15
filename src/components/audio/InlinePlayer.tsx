'use client';

import { PlayButton } from '@/components/system/PlayButton';
import { Waveform } from '@/components/system/Waveform';
import { clock } from '@/lib/format';
import { useAudio, type PlayableTrack } from './AudioProvider';
import styles from './InlinePlayer.module.css';

interface InlinePlayerProps {
  track: PlayableTrack;
  /** Seeds auto-advance through the rest of the album. */
  queue?: PlayableTrack[];
  /** The content-declared duration, shown until real metadata arrives. */
  fallbackDuration: string;
  className?: string;
}

/**
 * The hero transport. Play, the now-playing label, a seekable waveform, a clock.
 *
 * The label reads "Begin here" until this track is actually the one sounding,
 * at which point it becomes "Now playing." Saying "now playing" over silence
 * would be the one dishonest thing on the page.
 */
export function InlinePlayer({ track, queue, fallbackDuration, className }: InlinePlayerProps) {
  const { current, playing, time, duration, progress, toggle, seekTo } = useAudio();

  const isCurrent = current?.id === track.id;
  const shownTime = isCurrent ? clock(time) : '0:00';
  const shownDuration = isCurrent && duration > 0 ? clock(duration) : fallbackDuration;

  return (
    <div className={[styles.player, className].filter(Boolean).join(' ')}>
      <PlayButton
        size={52}
        playing={isCurrent && playing}
        label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={() => toggle(track, queue)}
      />

      <div className={styles.mid}>
        <span className={styles.label}>
          <span className={isCurrent && playing ? styles.now : undefined}>
            {isCurrent && playing ? 'Now playing' : 'Begin here'}
          </span>{' '}
          · {track.subtitle} — {track.title}
        </span>

        <Waveform
          seed={track.seed}
          progress={isCurrent ? progress : 0}
          active={isCurrent && playing}
          onSeek={isCurrent ? seekTo : undefined}
          bars={36}
        />
      </div>

      <span className={styles.time}>
        {shownTime} / {shownDuration}
      </span>
    </div>
  );
}
