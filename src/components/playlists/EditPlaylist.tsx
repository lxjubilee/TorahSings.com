'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type CatalogAlbum } from '@/lib/angels';
import { allCatalogAlbums } from '@/lib/catalog';
import { songUuid } from '@/lib/ids';
import { useJubileeAccount } from '@/lib/jubilee-account';
import type { DefaultPlaylist } from '@/lib/default-playlists';
import { playlistImageUrl } from '@/lib/default-playlists';
import { defaultPlaylistCover } from '@/lib/default-playlist-play';
import { bulkAddToPlaylist, createPlaylist } from '@/lib/playlists';
import styles from './EditPlaylist.module.css';

const BACK = 'M15 18l-6-6 6-6';

interface Slot {
  key: string;
  /** Selected album code, '' before an album is picked. */
  code: string;
  /** Selected track number within the album, null before a track is picked. */
  n: number | null;
  artist: string;
  description: string;
}

/**
 * The Edit Playlist page (Section 5). Opens a default playlist in edit mode:
 * a 16:9 banner, a header (back · "Edit Playlist" · name + count · Save), and
 * the ordered song list. Each slot is two dependent dropdowns (Album → Track)
 * plus the shown title, an italic artist, and a per-song description.
 *
 * Per Section 5.7 / 6.5, a signed-in user's edits are saved to the database as
 * THEIR personalized version — never to the on-disk default. We implement that
 * as "clone to My Playlists": a new personal playlist is created and the chosen
 * tracks are added to it. The shipped default is left untouched for everyone.
 */
export function EditPlaylist({ playlist }: { playlist: DefaultPlaylist }) {
  const router = useRouter();
  const { session, status, signIn } = useJubileeAccount();

  // Albums that actually have tracks — the only ones a slot can resolve to.
  const albums = useMemo<CatalogAlbum[]>(
    () => allCatalogAlbums().filter((a) => a.tracks.length > 0),
    [],
  );
  const albumByCode = useMemo(() => {
    const m = new Map<string, CatalogAlbum>();
    for (const a of albums) m.set(a.code, a);
    return m;
  }, [albums]);

  const keyer = useRef(0);
  const nextKey = () => `slot-${keyer.current++}`;

  const [slots, setSlots] = useState<Slot[]>(() =>
    playlist.songs.map((s) => ({
      key: nextKey(),
      code: s.code,
      n: s.n,
      artist: s.artist,
      description: s.description,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const banner = playlist.linkedImage
    ? playlistImageUrl(playlist.linkedImage)
    : defaultPlaylistCover(playlist.songs);

  const validCount = slots.filter((s) => s.code && s.n != null).length;

  const trackTitle = (s: Slot) =>
    (s.code && s.n != null && albumByCode.get(s.code)?.tracks.find((t) => t.n === s.n)?.title) || '';

  // --- slot mutation ---------------------------------------------------------
  const patch = (key: string, next: Partial<Slot>) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...next } : s)));

  const onAlbum = (key: string, code: string) => {
    // Changing the album repopulates the track list; default to its first track.
    const first = albumByCode.get(code)?.tracks[0]?.n ?? null;
    patch(key, { code, n: first });
  };

  const onTrack = (key: string, nStr: string) =>
    patch(key, { n: nStr === '' ? null : Number(nStr) });

  const removeSlot = (key: string) => setSlots((prev) => prev.filter((s) => s.key !== key));

  const addSlot = () =>
    setSlots((prev) => [...prev, { key: nextKey(), code: '', n: null, artist: '', description: '' }]);

  // --- save (clone to My Playlists) -----------------------------------------
  const onSave = async () => {
    if (busy) return;
    if (!session) {
      signIn();
      return;
    }
    const ids = slots
      .filter((s) => s.code && s.n != null)
      .map((s) => songUuid(s.code, s.n as number));
    if (!ids.length) {
      setErr('Add at least one song before saving.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await createPlaylist({
        name: playlist.title,
        description: playlist.description || undefined,
      });
      await bulkAddToPlaylist(created.id, ids);
      router.push(`/playlist?id=${created.id}`);
    } catch {
      setErr('Could not save your playlist. Please try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <div className={[styles.banner, banner ? '' : styles.bannerEmpty].join(' ')}>
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" />
        )}
        <div className={styles.bannerShade} />
      </div>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={() => router.push(`/playlists/${playlist.id}`)}
            aria-label="Back to playlist"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d={BACK} />
            </svg>
          </button>
          <div className={styles.headText}>
            <h1 className={styles.title}>Edit Playlist</h1>
            <p className={styles.subtitle}>
              {playlist.title} · {validCount} {validCount === 1 ? 'song' : 'songs'}
            </p>
          </div>
          <button type="button" className={styles.save} onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </header>

        {playlist.anchorVerse && (
          <p className={styles.verse}>
            <span className={styles.verseText}>“{playlist.anchorVerse.text}”</span>
            <span className={styles.verseRef}>{playlist.anchorVerse.reference}</span>
          </p>
        )}

        {err && <p className={styles.err}>{err}</p>}
        {status !== 'loading' && !session && (
          <p className={styles.signinNote}>
            Your edits save to your account as your own copy — the shipped playlist stays as it is.{' '}
            <button type="button" className={styles.linkbtn} onClick={signIn}>
              Sign in
            </button>{' '}
            to save.
          </p>
        )}

        <ol className={styles.slots}>
          {slots.map((s, i) => {
            const album = s.code ? albumByCode.get(s.code) : undefined;
            return (
              <li key={s.key} className={styles.slot}>
                <span className={styles.index}>{i + 1}</span>

                <div className={styles.slotBody}>
                  <div className={styles.dropdowns}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Album</span>
                      <select
                        className={styles.select}
                        value={s.code}
                        onChange={(e) => onAlbum(s.key, e.target.value)}
                      >
                        <option value="">Choose an album…</option>
                        {albums.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.title} — {a.book}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Track</span>
                      <select
                        className={styles.select}
                        value={s.n ?? ''}
                        onChange={(e) => onTrack(s.key, e.target.value)}
                        disabled={!album}
                      >
                        <option value="">{album ? 'Choose a track…' : 'Pick an album first'}</option>
                        {album?.tracks.map((t) => (
                          <option key={t.n} value={t.n}>
                            {t.n}. {t.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {(s.code && s.n != null) && (
                    <div className={styles.meta}>
                      <span className={styles.songTitle}>{trackTitle(s)}</span>
                      <input
                        className={styles.artist}
                        value={s.artist}
                        onChange={(e) => patch(s.key, { artist: e.target.value })}
                        placeholder="Artist (optional)"
                        aria-label="Artist"
                        maxLength={80}
                      />
                    </div>
                  )}

                  <input
                    className={styles.desc}
                    value={s.description}
                    onChange={(e) => patch(s.key, { description: e.target.value })}
                    placeholder="A short line about this song (optional)"
                    aria-label="Song description"
                    maxLength={160}
                  />
                </div>

                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeSlot(s.key)}
                  aria-label={`Remove slot ${i + 1}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>

        <button type="button" className={styles.addSong} onClick={addSlot}>
          + Add song
        </button>
      </div>
    </>
  );
}
