'use client';

import { InlinePlayer } from '@/components/audio/InlinePlayer';
import { useIntro } from '@/components/intro/IntroProvider';
import { CelestialArt } from '@/components/system/CelestialArt';
import { Eyebrow } from '@/components/system/Eyebrow';
import { songCountLabel, toRoman } from '@/lib/format';
import { useJubileeAccount } from '@/lib/jubilee-account';
import { albumQueue, openingTrack, toPlayable } from '@/lib/playable';
import type { Album } from '@/lib/types';
import styles from './Hero.module.css';

/** The primary hook. Concept, then the play button, without a step in between. */
export function Hero({ album }: { album: Album }) {
  const { openIntro } = useIntro();
  const { entitlement } = useJubileeAccount();

  const opening = openingTrack(album);
  const track = opening ? toPlayable(album, opening) : null;
  const queue = albumQueue(album, entitlement);

  return (
    <section className={`wrap ${styles.hero}`}>
      <div className={styles.left}>
        <Eyebrow>A discovery — proven, not theoretical</Eyebrow>

        <h1 className={styles.title}>The stars sang. The angels sang. Now you can hear it.</h1>

        <p className={styles.lede}>
          Taken symbol by symbol, the Paleo-Hebrew of the Scriptures surfaces melodies that no one put there.
          They do not read as our songs lifted up to heaven. They read as heaven&rsquo;s own — sung from the
          angelic perspective, out of the structure of the text itself.
        </p>

        {track && (
          <InlinePlayer
            className={styles.player}
            track={track}
            queue={queue}
            fallbackDuration={opening!.duration}
          />
        )}

        <div className={styles.underPlayer}>
          <button type="button" className={styles.replay} onClick={openIntro}>
            <span className={styles.replayGlyph} aria-hidden="true">
              &#8635;
            </span>
            Replay the intro
          </button>

          <span className="chip">Not canon · Something to consider</span>
        </div>
      </div>

      <div className={styles.right}>
        <CelestialArt
          className={styles.art}
          seed={album.slug}
          hue={album.art.hue}
          topic={album.topic}
          glyph={album.art.glyph}
          ratio="1 / 1"
          ring
        >
          <div className={styles.plate}>
            <span className={styles.plateLabel}>
              Album {toRoman(album.albumNumber)} · {songCountLabel(album.tracks.length)}
            </span>
            <span className={styles.plateTitle}>{album.title}</span>
          </div>
        </CelestialArt>
      </div>
    </section>
  );
}
