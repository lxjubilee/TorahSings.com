#!/usr/bin/env node
/**
 * build-catalog-manifest — scan the warehouse drive and (re)write catalog-manifest.json.
 *
 * The filesystem is the only source of truth: album folders name the codes and
 * titles, each album's lyrics file supplies the canonical song list and credits,
 * ID3 frames and MPEG headers supply the audio facts, and articles.json /
 * playlist JSON are reconciled against the markdown and audio actually present.
 * Nothing is inferred that is not read off disk; anything that does not line up
 * is reported under `integrity` rather than silently normalized.
 *
 *   node scripts/build-catalog-manifest.mjs
 *   node scripts/build-catalog-manifest.mjs "J:\torahsings.com"
 *   env: CATALOG_ROOT (default J:\torahsings.com)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.argv[2] || process.env.CATALOG_ROOT || 'J:\\torahsings.com';
const OUT = path.join(ROOT, 'catalog-manifest.json');
if (!fs.existsSync(ROOT)) {
  console.error(`catalog root not found: ${ROOT}`);
  process.exit(1);
}

const issues = [];
const note = (severity, area, message, extra = {}) =>
  issues.push({ severity, area, message, ...extra });

// ---------- helpers ----------
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const readText = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const stripBom = (s) => (s || '').replace(/\uFEFF/g, '');
const isJunk = (n) => /^(Thumbs\.db|desktop\.ini|\.DS_Store)$/i.test(n);

const dirs = (p) =>
  fs.existsSync(p)
    ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [];
const files = (p) =>
  fs.existsSync(p)
    ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name).sort()
    : [];

const stat = (p) => {
  const s = fs.statSync(p);
  return { bytes: s.size, modified: s.mtime.toISOString() };
};

// Normalize a title for cross-referencing (playlists -> songs).
const norm = (s) =>
  stripBom(s || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/^\s*\d{1,3}[\s._-]+/, '') // leading track number
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// A looser key that folds the Hebraic/anglicised transliteration pairs used
// interchangeably between lyric files and rendered filenames (Dawid/David, ...).
const TRANSLIT = [
  [/\bdawid\b/g, 'david'], [/\bmashiach\b/g, 'messiah'], [/\byahusha\b/g, 'yeshua'],
  [/\byerushalayim\b/g, 'jerusalem'], [/\bmosheh\b/g, 'moses'], [/\bshelomoh\b/g, 'solomon'],
  [/\beliyahu\b/g, 'elijah'], [/\byeshayahu\b/g, 'isaiah'], [/\byirmeyahu\b/g, 'jeremiah'],
  [/\byahudah\b/g, 'judah'], [/\byisrael\b/g, 'israel'], [/\bben\b/g, 'son of'],
];
const loose = (s) => { let x = norm(s); for (const [re, to] of TRANSLIT) x = x.replace(re, to); return x.replace(/\s+/g, ' ').trim(); };

// S\u00f8rensen\u2013Dice coefficient over character bigrams \u2014 tolerant of small edits
// and word-order/length drift between a lyric title and its rendered filename.
function similarity(a, b) {
  a = loose(a); b = loose(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const ga = grams(a), gb = grams(b);
  let hits = 0, na = 0, nb = 0;
  for (const v of ga.values()) na += v;
  for (const [g, v] of gb) { nb += v; hits += Math.min(v, ga.get(g) || 0); }
  return na + nb === 0 ? 0 : (2 * hits) / (na + nb);
}

// "05 Smite the Shepherd (1).mp3" -> an alternate render of "Smite the Shepherd"
const takeSuffix = (base) => {
  const m = base.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { base: m[1], take: Number(m[2]) } : null;
};

// ARTIST lines carry the billed credit plus an optional parenthetical production
// note and/or a "feat." credit. Split them so the lead voice is a clean facet.
function parseArtist(raw) {
  if (!raw) return { artist: null };
  const billed = stripBom(raw).trim();
  const out = { artist: billed };
  const paren = billed.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  const head = paren ? paren[1].trim() : billed;
  const inner = paren ? paren[2].trim() : null;

  const names = head.split(/\s*&\s*|\s*\+\s*/).map((n) => n.trim()).filter(Boolean);
  const expand = (n) => (/inspire$/i.test(n) ? n : `${n} Inspire`);
  out.leadVoices = names.map(expand);
  out.artist = out.leadVoices.length === 1 ? out.leadVoices[0] : out.leadVoices.join(' & ');
  out.billedAs = billed;

  if (inner) {
    const feat = inner.match(/^feat\.?\s*(.+)$/i);
    if (feat) {
      const f = feat[1].split(/\s*(?:&|,|and)\s+/).map((s) => s.trim()).filter(Boolean);
      out.featuring = f;
      const rest = f.filter((x) => /inspire/i.test(x));
      if (rest.length) out.featuringVoices = rest.map((x) => x.replace(/\s*[—-].*$/, '').trim());
    } else {
      out.performanceNote = inner;
    }
  }
  if (out.billedAs === out.artist) delete out.billedAs;
  return out;
}

// ---------- MP3: ID3v2 tags + duration ----------
function readMp3(p) {
  const fd = fs.openSync(p, 'r');
  const size = fs.fstatSync(fd).size;
  const out = { bytes: size };
  try {
    const head = Buffer.alloc(10);
    fs.readSync(fd, head, 0, 10, 0);
    let audioStart = 0;

    if (head.toString('latin1', 0, 3) === 'ID3') {
      const tagSize =
        ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
      audioStart = 10 + tagSize;
      out.id3 = { version: `2.${head[3]}.${head[4]}` };
      const buf = Buffer.alloc(tagSize);
      fs.readSync(fd, buf, 0, tagSize, 10);

      const decode = (body) => {
        const enc = body[0];
        let b = body.subarray(1);
        let t;
        if (enc === 1 || enc === 2) t = b.toString('utf16le');
        else if (enc === 3) t = b.toString('utf8');
        else t = b.toString('latin1');
        return stripBom(t).replace(/\0+$/, '').replace(/\0/g, ' ').trim();
      };

      let o = 0;
      while (o + 10 <= tagSize) {
        const id = buf.toString('latin1', o, o + 4);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const fsz = buf.readUInt32BE(o + 4);
        if (fsz <= 0 || o + 10 + fsz > tagSize) break;
        const body = buf.subarray(o + 10, o + 10 + fsz);
        switch (id) {
          case 'TIT2': out.id3.title = decode(body); break;
          case 'TPE1': out.id3.artistTag = decode(body); break;
          case 'TALB': out.id3.album = decode(body); break;
          case 'TDRC': case 'TYER': out.id3.year = decode(body); break;
          case 'WOAS': out.id3.sourceUrl = body.toString('latin1').replace(/\0/g, '').trim(); break;
          case 'APIC': {
            out.id3.embeddedArtwork = true;
            out.id3.embeddedArtworkBytes = fsz;
            const nul = body.indexOf(0, 1);
            if (nul > 0) out.id3.embeddedArtworkMime = body.toString('latin1', 1, nul);
            break;
          }
          case 'USLT': out.id3.hasEmbeddedLyrics = true; break;
          case 'COMM': {
            // 1 enc byte + 3 lang bytes + short-desc NUL + text
            const enc = body[0];
            const restBuf = body.subarray(4);
            let text;
            if (enc === 1 || enc === 2) {
              // find UTF-16 NUL terminator of the description
              let i = 0;
              while (i + 1 < restBuf.length && !(restBuf[i] === 0 && restBuf[i + 1] === 0)) i += 2;
              text = stripBom(restBuf.subarray(i + 2).toString('utf16le'));
            } else {
              const i = restBuf.indexOf(0);
              text = restBuf.subarray(i + 1).toString(enc === 3 ? 'utf8' : 'latin1');
            }
            out.id3.comment = stripBom(text).replace(/\0/g, '').trim();
            break;
          }
        }
        o += 10 + fsz;
      }

      if (out.id3.sourceUrl) {
        const m = out.id3.sourceUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m) out.id3.sunoId = m[1];
      }
      if (out.id3.comment) {
        const m = out.id3.comment.match(/created=([0-9T:.\-]+Z)/);
        if (m) out.id3.created = m[1];
      }
    }

    // --- duration: find first MPEG frame, honour Xing/Info/VBRI ---
    const scan = Buffer.alloc(Math.min(64 * 1024, Math.max(0, size - audioStart)));
    fs.readSync(fd, scan, 0, scan.length, audioStart);
    const V1L3_BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const V2L3_BR = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
    const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

    for (let i = 0; i + 4 < scan.length; i++) {
      if (scan[i] !== 0xff || (scan[i + 1] & 0xe0) !== 0xe0) continue;
      const verBits = (scan[i + 1] >> 3) & 0x03;
      const layer = (scan[i + 1] >> 1) & 0x03;
      if (verBits === 1 || layer !== 1) continue; // reserved version / not Layer III
      const brIdx = (scan[i + 2] >> 4) & 0x0f;
      const srIdx = (scan[i + 2] >> 2) & 0x03;
      if (brIdx === 0 || brIdx === 15 || srIdx === 3) continue;
      const mpeg1 = verBits === 3;
      const bitrate = (mpeg1 ? V1L3_BR : V2L3_BR)[brIdx] * 1000;
      const sampleRate = RATES[verBits][srIdx];
      if (!bitrate || !sampleRate) continue;
      const padding = (scan[i + 2] >> 1) & 1;
      const channelMode = (scan[i + 3] >> 6) & 0x03;
      const samplesPerFrame = mpeg1 ? 1152 : 576;

      out.audio = {
        codec: 'MPEG Audio Layer III',
        mpegVersion: mpeg1 ? 1 : verBits === 2 ? 2 : 2.5,
        sampleRateHz: sampleRate,
        channels: channelMode === 3 ? 1 : 2,
        channelMode: ['stereo', 'joint stereo', 'dual channel', 'mono'][channelMode],
      };

      // Xing/Info header offset
      const sideInfo = mpeg1 ? (channelMode === 3 ? 17 : 32) : channelMode === 3 ? 9 : 17;
      const xo = i + 4 + sideInfo;
      let duration = null;
      if (xo + 12 < scan.length) {
        const tag = scan.toString('latin1', xo, xo + 4);
        if (tag === 'Xing' || tag === 'Info') {
          const flags = scan.readUInt32BE(xo + 4);
          let q = xo + 8;
          let frames = null, streamBytes = null;
          if (flags & 1) { frames = scan.readUInt32BE(q); q += 4; }
          if (flags & 2) { streamBytes = scan.readUInt32BE(q); q += 4; }
          if (frames) {
            duration = (frames * samplesPerFrame) / sampleRate;
            out.audio.mode = tag === 'Xing' ? 'VBR' : 'CBR';
            out.audio.frames = frames;
            if (streamBytes) out.audio.bitrateKbps = Math.round((streamBytes * 8) / duration / 1000);
          }
        }
      }
      if (duration == null) {
        duration = ((size - audioStart) * 8) / bitrate; // CBR fallback
        out.audio.mode = 'CBR (estimated)';
        out.audio.bitrateKbps = bitrate / 1000;
      }
      out.audio.durationSeconds = Math.round(duration * 10) / 10;
      const total = Math.round(duration);
      out.audio.duration = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
      break;
    }
    if (!out.audio) note('warning', 'music', 'No decodable MPEG frame header', { file: rel(p) });
  } finally {
    fs.closeSync(fd);
  }
  return out;
}

// ---------- lyrics file: parse per-song blocks ----------
function parseLyrics(p) {
  const text = readText(p);
  const result = { headerFields: {}, songs: [], chars: text.length };

  const head = text.split(/^SONG TITLE:/m)[0];
  const grab = (re) => { const m = head.match(re); return m ? m[1].trim() : undefined; };
  result.headerFields.albumTitleLine = (head.match(/^#\s+(.+)$/m) || [])[1]?.trim();
  result.headerFields.albumCode = grab(/\*\*Album Code:\*\*\s*([A-Za-z0-9]+)/);
  result.headerFields.lyricsLastUpdated = grab(/\*\*Lyrics Last Updated:\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
  result.headerFields.fusion = grab(/\*\*Fusion:\*\*\s*([^\n]+?)(?:\s*\*Why the title|\n)/);
  result.headerFields.version = (result.headerFields.albumTitleLine?.match(/\((V\d+)\)\s*$/) || [])[1];

  // split on SONG TITLE: markers
  const idx = [];
  const reBlock = /^SONG TITLE:[ \t]*(.*)$/gm;
  let m;
  while ((m = reBlock.exec(text))) idx.push({ start: m.index, titleLine: m[1].trim() });

  idx.forEach((b, i) => {
    const seg = text.slice(b.start, i + 1 < idx.length ? idx[i + 1].start : text.length);
    const field = (re) => { const x = seg.match(re); return x ? x[1].trim() : null; };
    const pct = (re) => { const x = seg.match(re); return x ? Number(x[1]) : null; };

    const rawTitle = stripBom(b.titleLine);
    const numMatch = rawTitle.match(/^(\d{1,3})[\s._-]+(.*)$/);
    const lyricsBody = seg.match(/^LYRICS:\s*\n([\s\S]*?)(?=^Styles:)/m);

    const casting = field(/^CASTING[^\n:]*:\s*\n([\s\S]*?)(?=\n\s*\n(?:LYRICS:|ARCHETYPE:))/m);
    const leadMatch = seg.match(/\*\*Lead:\s*([^*(]+?)(?:\s*\((M|F)\))?\*\*|\*\*Lead:\s*([^*]+?)\*\*\s*\((M|F)\)/);

    const song = {
      trackNumber: numMatch ? Number(numMatch[1]) : null,
      title: numMatch ? numMatch[2].trim() : rawTitle,
      displayTitle: rawTitle,
      artist: field(/^ARTIST:[ \t]*(.+)$/m),
      archetype: field(/^ARCHETYPE:[ \t]*(.+)$/m),
      vocalGender: field(/^VOCAL GENDER:[ \t]*(.+)$/m),
      estimatedLength: field(/^Estimated Length:[ \t]*(.+)$/m),
      styles: field(/^Styles:[ \t]*(.+)$/m),
      saveTo: field(/^Save To:[ \t]*(.+)$/m),
      ratings: {
        weirdness: pct(/^Weirdness:\s*(\d+)%/m),
        styleInfluence: pct(/^Style Influence:\s*(\d+)%/m),
        faithFocus: pct(/^Faith-Focus Rating:\s*(\d+)%/m),
        praiseVsWorship: pct(/^Praise vs\.? Worship Rating:\s*(\d+)%/m),
        earworm: pct(/^Earworm Rating:\s*(\d+)%/m),
        bestseller: pct(/^Bestseller Rating:\s*(\d+)%/m),
      },
      lead: leadMatch ? (leadMatch[1] || leadMatch[3] || '').trim().replace(/\s*\(.*$/, '') || null : null,
      leadGender: leadMatch ? leadMatch[2] || leadMatch[4] || null : null,
      castingNotes: casting ? casting.trim() : null,
      hasImagePrompt: /^IMAGE PROMPT/m.test(seg),
      lyricsChars: lyricsBody ? lyricsBody[1].trim().length : 0,
    };
    if (song.vocalGender && !song.leadGender) {
      if (/female lead/i.test(song.vocalGender)) song.leadGender = 'F';
      else if (/male lead/i.test(song.vocalGender)) song.leadGender = 'M';
    }
    for (const k of Object.keys(song.ratings)) if (song.ratings[k] == null) delete song.ratings[k];
    result.songs.push(song);
  });
  return result;
}

// ---------- book index (~index.md) ----------
function parseBookIndex(p) {
  const text = readText(p);
  const out = { file: rel(p), ...stat(p) };
  out.heading = (text.match(/^#\s+(.+)$/m) || [])[1]?.trim() || null;
  out.subtitle = (text.match(/^###\s+(.+)$/m) || [])[1]?.trim() || null;
  out.statusRefreshed = (text.match(/Status last refreshed against disk:\s*([0-9-]+)/) || [])[1] || null;
  const rows = [];
  for (const m of text.matchAll(/^\|\s*(ANSMX[0-9A-Z]+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm)) {
    rows.push({
      code: m[1].trim(),
      album: m[2].trim(),
      arc: m[3].trim(),
      plannedSongs: Number(m[4].trim()) || null,
      status: m[5].trim().replace(/\s+/g, ' '),
    });
  }
  if (rows.length) out.plannedAlbums = rows;
  return out;
}

// ---------- markdown frontmatter ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, bodyOffset: 0 };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
      else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
      if (/^-?\d+$/.test(v)) v = Number(v);
      data[key] = v;
    } else if (key && line.trim()) {
      data[key] = String(data[key] ?? '') + ' ' + line.trim();
    }
  }
  return { data, bodyOffset: m[0].length };
}

// =====================================================================
// 1. MUSIC
// =====================================================================
console.error('scanning music...');
const musicRoot = path.join(ROOT, 'music');
const books = [];
const albumsById = new Map();
let songTotal = 0, trackTotal = 0, audioBytes = 0, durationTotal = 0;
const artistTally = new Map();
const globalOrphans = [];

for (const bookDir of dirs(musicRoot)) {
  const bookPath = path.join(musicRoot, bookDir);
  const bm = bookDir.match(/^(\d{2})_(.+)$/);
  const book = {
    id: bookDir,
    number: bm ? Number(bm[1]) : null,
    name: bm ? bm[2].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^(\d)\s?/, '$1 ') : bookDir,
    directory: rel(bookPath),
    albums: [],
  };

  for (const f of files(bookPath)) {
    if (f === '~index.md') book.index = parseBookIndex(path.join(bookPath, f));
    else if (!isJunk(f)) note('info', 'music', 'Unexpected file at book level', { file: rel(path.join(bookPath, f)) });
  }

  for (const albumDir of dirs(bookPath)) {
    const albumPath = path.join(bookPath, albumDir);
    const am = albumDir.match(/^(ANSMX)(\d+)([A-Z][A-Z-]*)\s+(.+)$/);
    if (!am) { note('error', 'music', 'Album folder name does not match ANSMX pattern', { directory: rel(albumPath) }); continue; }

    const digits = am[2];
    let bookNo = null, albumNo = null;
    if (digits.length === 5) { bookNo = Number(digits.slice(0, 2)); albumNo = Number(digits.slice(2)); }
    else if (digits.length === 4) {
      bookNo = Number(digits.slice(0, 1)); albumNo = Number(digits.slice(1));
      note('warning', 'music', `Album code "${am[1]}${digits}${am[3]}" uses 4 digits; catalog standard is 5 (BBNNN)`, { directory: rel(albumPath), expectedCode: `ANSMX${String(book.number).padStart(2, '0')}${digits.slice(1)}${am[3]}` });
    }
    const code = am[1] + digits + am[3];

    const album = {
      id: code,
      code,
      codeDigits: digits,
      bookNumber: bookNo,
      albumNumber: albumNo,
      language: am[3],
      title: am[4].trim(),
      book: book.id,
      bookName: book.name,
      directory: rel(albumPath),
      artwork: null,
      lyricsFile: null,
      songs: [],
    };
    if (bookNo !== null && book.number !== null && bookNo !== book.number)
      note('error', 'music', `Album code book number (${bookNo}) does not match containing book (${book.number})`, { directory: rel(albumPath) });

    // artwork — the cover image, plus any sidecar prompt document
    const artPath = path.join(albumPath, 'artwork');
    const artFiles = files(artPath).filter((f) => !isJunk(f));
    const covers = artFiles.filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f));
    const sidecars = artFiles.filter((f) => !covers.includes(f));
    if (covers.length) {
      const ap = path.join(artPath, covers[0]);
      album.artwork = { file: rel(ap), filename: covers[0], format: path.extname(covers[0]).slice(1).toLowerCase(), ...stat(ap) };
      if (path.parse(covers[0]).name !== code)
        note('info', 'music', `Artwork filename "${covers[0]}" does not match album code "${code}"`, { directory: rel(albumPath) });
      if (covers.length > 1) {
        album.additionalArtwork = covers.slice(1).map((f) => ({ file: rel(path.join(artPath, f)), filename: f, ...stat(path.join(artPath, f)) }));
        note('info', 'music', `Album has ${covers.length} cover images; first is primary`, { directory: rel(albumPath) });
      }
    } else note('warning', 'music', 'Album has no cover image', { directory: rel(albumPath) });
    if (sidecars.length)
      album.artworkDocs = sidecars.map((f) => ({ file: rel(path.join(artPath, f)), filename: f, ...stat(path.join(artPath, f)) }));

    // lyrics
    const lyrPath = path.join(albumPath, 'lyrics');
    const lyrFiles = files(lyrPath).filter((f) => !isJunk(f));
    let parsed = { songs: [], headerFields: {} };
    if (lyrFiles.length) {
      const lp = path.join(lyrPath, lyrFiles[0]);
      parsed = parseLyrics(lp);
      album.lyricsFile = { file: rel(lp), filename: lyrFiles[0], ...stat(lp), ...parsed.headerFields, songBlocks: parsed.songs.length };
      if (lyrFiles.length > 1) note('info', 'music', `Album has ${lyrFiles.length} lyrics files; using "${lyrFiles[0]}"`, { directory: rel(albumPath) });
    } else note('warning', 'music', 'Album has no lyrics file', { directory: rel(albumPath) });

    // supporting docs
    for (const kind of ['blueprints', 'proof']) {
      const kp = path.join(albumPath, kind);
      const kf = files(kp).filter((f) => !isJunk(f));
      if (kf.length) album[kind] = kf.map((f) => ({ file: rel(path.join(kp, f)), filename: f, ...stat(path.join(kp, f)) }));
    }
    for (const f of files(albumPath)) {
      if (isJunk(f)) continue;
      (album.looseFiles ??= []).push({ file: rel(path.join(albumPath, f)), filename: f, ...stat(path.join(albumPath, f)) });
      note('info', 'music', 'Loose file in album root (outside artwork/lyrics/tracks/blueprints/proof)', { file: rel(path.join(albumPath, f)) });
    }
    const known = new Set(['artwork', 'lyrics', 'tracks', 'blueprints', 'proof']);
    for (const d of dirs(albumPath)) if (!known.has(d)) note('info', 'music', `Unexpected subfolder "${d}"`, { directory: rel(albumPath) });

    // tracks on disk
    const trkPath = path.join(albumPath, 'tracks');
    const mp3 = files(trkPath).filter((f) => /\.mp3$/i.test(f));
    for (const f of files(trkPath)) if (!/\.mp3$/i.test(f) && !isJunk(f)) note('info', 'music', 'Non-MP3 file in tracks folder', { file: rel(path.join(trkPath, f)) });
    const audioList = [];
    for (const f of mp3) {
      const fp = path.join(trkPath, f);
      const base = path.parse(f).name;
      const nm = base.match(/^(\d{1,3})[\s._-]+(.*)$/);
      const bare = nm ? nm[2].trim() : base.trim();
      const info = readMp3(fp);
      if (/\s{2,}/.test(base))
        note('info', 'music', 'Filename contains repeated whitespace', { file: rel(fp) });
      audioList.push({
        file: rel(fp), filename: f,
        fileTrackNumber: nm ? Number(nm[1]) : null,
        bytes: info.bytes, modified: stat(fp).modified,
        ...(info.audio || {}),
        ...(info.id3 ? { source: { tagVersion: info.id3.version, titleTag: info.id3.title, accountTag: info.id3.artistTag, url: info.id3.sourceUrl, sunoId: info.id3.sunoId, renderedAt: info.id3.created, embeddedArtwork: !!info.id3.embeddedArtwork, embeddedArtworkBytes: info.id3.embeddedArtworkBytes, embeddedLyrics: !!info.id3.hasEmbeddedLyrics } } : {}),
        _bare: bare, _take: takeSuffix(bare), _used: false,
      });
    }

    // Build the song records first, then bind audio to them in confidence order.
    const songRecords = parsed.songs.map((s, i) => {
      const a = parseArtist(s.artist);
      const song = {
        id: `${code}-${String(s.trackNumber ?? i + 1).padStart(2, '0')}`,
        trackNumber: s.trackNumber,
        sortOrder: i + 1,
        title: s.title,
        albumId: code,
        albumTitle: album.title,
        book: book.id,
        bookNumber: book.number,
        artist: a.artist,
        billedAs: a.billedAs,
        leadVoices: a.leadVoices,
        featuring: a.featuring,
        performanceNote: a.performanceNote,
        lead: s.lead,
        leadGender: s.leadGender,
        vocalGender: s.vocalGender,
        archetype: s.archetype,
        styles: s.styles,
        estimatedLength: s.estimatedLength,
        ratings: Object.keys(s.ratings).length ? s.ratings : undefined,
        castingNotes: s.castingNotes || undefined,
        hasImagePrompt: s.hasImagePrompt || undefined,
        lyricsChars: s.lyricsChars,
        hasAudio: false,
      };
      if (s.saveTo && norm(s.saveTo) !== norm(album.title)) song.saveTo = s.saveTo;
      if (a.artist) artistTally.set(a.artist, (artistTally.get(a.artist) || 0) + 1);
      return { song, src: s };
    });

    const bind = (rec, audio, matchedBy, confidence) => {
      audio._used = true;
      const { _used, _bare, _take, ...a } = audio;
      a.matchedBy = matchedBy;
      if (confidence != null && confidence < 1) a.matchConfidence = Math.round(confidence * 100) / 100;
      rec.song.audio = a;
      rec.song.hasAudio = true;
      trackTotal++; audioBytes += a.bytes || 0; durationTotal += a.durationSeconds || 0;
    };

    const primaries = audioList.filter((a) => !a._take);
    const alternates = audioList.filter((a) => a._take);

    // pass 1 — exact title match
    for (const rec of songRecords) {
      const hit = primaries.find((a) => !a._used && norm(a._bare) === norm(rec.src.title));
      if (hit) bind(rec, hit, 'exact title', 1);
    }
    // pass 2 — transliteration-tolerant match (Dawid/David, Mashiach/Messiah, ...)
    for (const rec of songRecords) {
      if (rec.song.hasAudio) continue;
      const hit = primaries.find((a) => !a._used && loose(a._bare) === loose(rec.src.title));
      if (hit) { bind(rec, hit, 'transliteration variant', 1); note('info', 'music', `Audio filename uses a different transliteration than the lyrics title ("${hit._bare}" vs "${rec.src.title}")`, { song: rec.song.id, file: hit.file }); }
    }
    // pass 3 — greedy best-similarity pairing of what is left inside this album
    {
      const openSongs = songRecords.filter((r) => !r.song.hasAudio);
      const openAudio = primaries.filter((a) => !a._used);
      const pairs = [];
      for (const r of openSongs) for (const a of openAudio) {
        const sc = similarity(a._bare, r.src.title);
        if (sc >= 0.55) pairs.push({ r, a, sc });
      }
      pairs.sort((x, y) => y.sc - x.sc);
      for (const p of pairs) {
        if (p.r.song.hasAudio || p.a._used) continue;
        bind(p.r, p.a, 'approximate title', p.sc);
        note('info', 'music', `Audio filename differs from the lyrics title; paired by similarity ${(p.sc * 100).toFixed(0)}% ("${p.a._bare}" vs "${p.r.src.title}")`, { song: p.r.song.id, file: p.a.file });
      }
    }
    // alternate takes — "<title> (N).mp3" attaches to the song it re-renders
    for (const alt of alternates) {
      let rec = songRecords.find((r) => norm(r.src.title) === norm(alt._take.base) || loose(r.src.title) === loose(alt._take.base));
      if (!rec) { const best = songRecords.map((r) => ({ r, sc: similarity(alt._take.base, r.src.title) })).sort((x, y) => y.sc - x.sc)[0]; if (best && best.sc >= 0.7) rec = best.r; }
      if (rec) {
        alt._used = true;
        const { _used, _bare, _take, ...a } = alt;
        a.take = _take.take;
        (rec.song.alternateTakes ??= []).push(a);
        trackTotal++; audioBytes += a.bytes || 0; durationTotal += a.durationSeconds || 0;
        note('info', 'music', `Alternate render kept alongside the primary track (take ${_take.take})`, { song: rec.song.id, file: a.file });
      }
    }

    for (const rec of songRecords) {
      const a = rec.song.audio;
      if (a?.fileTrackNumber && rec.song.trackNumber && a.fileTrackNumber !== rec.song.trackNumber)
        album.trackNumberingDiffers = true;
      for (const k of Object.keys(rec.song)) if (rec.song[k] === undefined) delete rec.song[k];
      album.songs.push(rec.song);
      songTotal++;
    }
    if (album.trackNumberingDiffers)
      note('info', 'music', 'Lyrics track numbers continue across the book while filenames restart at 01; both numbers are recorded', { album: code });

    // orphan audio (a rendered file with no song block in this album's lyrics file)
    for (const v of audioList) {
      if (v._used) continue;
      const { _used, _bare, _take, ...a } = v;
      (album.unmatchedAudio ??= []).push(a);
      trackTotal++; audioBytes += a.bytes || 0; durationTotal += a.durationSeconds || 0;
      globalOrphans.push({ album, entry: a, bare: _bare });
    }

    album.songCount = album.songs.length;
    album.songsWithAudio = album.songs.filter((s) => s.hasAudio).length;
    album.alternateTakeCount = album.songs.reduce((n, s) => n + (s.alternateTakes?.length || 0), 0);
    album.unmatchedAudioCount = album.unmatchedAudio?.length || 0;
    album.audioFileCount = album.songsWithAudio + album.alternateTakeCount + album.unmatchedAudioCount;
    album.audioComplete = album.songCount > 0 && album.songsWithAudio === album.songCount;
    album.productionStatus =
      album.songsWithAudio === 0 ? 'lyrics-only' : album.audioComplete ? 'complete' : 'partial';
    album.durationSeconds = Math.round(album.songs.reduce((n, s) => n + (s.audio?.durationSeconds || 0), 0));
    album.hasBlueprints = !!album.blueprints;
    album.hasProof = !!album.proof;

    // reconcile against the book index table
    const row = book.index?.plannedAlbums?.find(
      (r) => norm(r.album) === norm(album.title) || r.code.replace(/^ANSMX0?/, '') === code.replace(/^ANSMX0?/, '')
    );
    if (row) {
      album.indexEntry = { code: row.code, arc: row.arc, plannedSongs: row.plannedSongs, status: row.status };
      if (row.plannedSongs && row.plannedSongs !== album.songCount)
        note('info', 'music', `Book index lists ${row.plannedSongs} songs; lyrics file contains ${album.songCount}`, { album: code });
      if (norm(row.album) !== norm(album.title))
        note('info', 'music', `Book index album title "${row.album}" differs from folder title "${album.title}"`, { album: code });
    } else if (book.index?.plannedAlbums) {
      note('info', 'music', 'Album not found in the book index table', { album: code, directory: rel(albumPath) });
    }

    albumsById.set(code, album);
    book.albums.push(album);
  }

  book.albumCount = book.albums.length;
  book.songCount = book.albums.reduce((n, a) => n + a.songCount, 0);
  book.songsWithAudio = book.albums.reduce((n, a) => n + a.songsWithAudio, 0);
  book.audioFileCount = book.albums.reduce((n, a) => n + a.audioFileCount, 0);
  book.durationSeconds = book.albums.reduce((n, a) => n + a.durationSeconds, 0);
  books.push(book);
}

// ---- cross-album resolution: where does each orphaned render actually belong? ----
// Every album's tracks folder is matched against its own lyrics file first. Whatever
// is left over is checked against the whole catalog: it is either audio that was
// rendered into the wrong album folder, or a stray copy of a track already filed
// correctly somewhere else.
{
  const everySong = [...albumsById.values()].flatMap((a) => a.songs);
  const sha = (p) => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex'); } catch { return null; } };

  for (const o of globalOrphans) {
    const scored = everySong
      .filter((s) => s.albumId !== o.album.id)
      .map((s) => ({ s, sc: similarity(o.bare, s.title) }))
      .filter((x) => x.sc >= 0.72)
      .sort((x, y) => y.sc - x.sc || (x.s.hasAudio ? 1 : -1));

    // prefer an unrendered song (a genuine home) over an already-rendered one (a copy)
    const best = scored.find((x) => !x.s.hasAudio) || scored[0];
    if (!best) {
      o.entry.classification = 'unidentified';
      note('warning', 'music', 'Rendered audio has no matching song block in any album lyrics file', { file: o.entry.file, album: o.album.id });
      continue;
    }
    const ref = {
      songId: best.s.id, albumId: best.s.albumId, albumTitle: best.s.albumTitle,
      book: best.s.book, songTitle: best.s.title,
      confidence: Math.round(best.sc * 100) / 100,
    };
    if (!best.s.hasAudio) {
      o.entry.classification = 'misfiled';
      o.entry.likelyBelongsTo = ref;
      note('warning', 'music', `Rendered audio sits in "${o.album.title}" but matches an unrendered song in "${best.s.albumTitle}"`, { file: o.entry.file, likelySongId: best.s.id });
    } else {
      o.entry.classification = 'duplicate-copy';
      ref.canonicalFile = best.s.audio.file;
      if (best.s.audio.bytes === o.entry.bytes) {
        const a = sha(o.entry.file), b = sha(best.s.audio.file);
        ref.byteIdentical = !!a && a === b;
        if (ref.byteIdentical) o.entry.sha256 = a;
      } else ref.byteIdentical = false;
      o.entry.duplicateOf = ref;
      note('warning', 'music', `Stray copy: this file duplicates "${best.s.title}" already filed under "${best.s.albumTitle}"${ref.byteIdentical ? ' (byte-identical)' : ''}`, { file: o.entry.file, canonicalFile: ref.canonicalFile, canonicalSongId: best.s.id });
    }
  }
}

// stray top-level music files (e.g. the archive zip)
const musicLooseFiles = files(musicRoot).filter((f) => !isJunk(f)).map((f) => {
  const p = path.join(musicRoot, f);
  return { file: rel(p), filename: f, ...stat(p) };
});

// =====================================================================
// 2. ARTICLES
// =====================================================================
console.error('scanning articles...');
const articlesRoot = path.join(ROOT, 'articles');
const collections = [];

for (const colDir of dirs(articlesRoot)) {
  const colPath = path.join(articlesRoot, colDir);
  const col = { id: colDir, slug: colDir, directory: rel(colPath), articles: [] };

  const idxPath = path.join(colPath, 'articles.json');
  let index = null;
  if (fs.existsSync(idxPath)) {
    try {
      index = JSON.parse(readText(idxPath));
      col.indexFile = { file: rel(idxPath), ...stat(idxPath) };
      col.category = index.category;
      col.categorySlug = index.category_slug;
      col.office = index.office;
      col.indexUpdated = index.updated;
      col.indexCounts = index.counts;
    } catch (e) { note('error', 'articles', `articles.json is not valid JSON: ${e.message}`, { file: rel(idxPath) }); }
  } else note('warning', 'articles', 'Collection has no articles.json', { directory: rel(colPath) });

  const indexBySlug = new Map((index?.articles || []).map((a) => [a.slug, a]));
  const imgDir = path.join(colPath, 'images');
  const imageFiles = new Set(files(imgDir).filter((f) => !isJunk(f)));
  const usedImages = new Set();

  const mdFiles = files(colPath).filter((f) => /\.md$/i.test(f));
  for (const f of mdFiles) {
    const fp = path.join(colPath, f);
    const text = readText(fp);
    const { data, bodyOffset } = parseFrontmatter(text);
    const body = text.slice(bodyOffset);
    const slug = data.slug || path.parse(f).name;
    const entry = indexBySlug.get(slug);

    // images referenced inside the body
    const inline = [];
    for (const m of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g)) {
      const fileName = decodeURIComponent(m[2].split('/').pop());
      inline.push({ file: rel(path.join(imgDir, fileName)), filename: fileName, alt: m[1] || null, prompt: m[3] || null, exists: imageFiles.has(fileName) });
      usedImages.add(fileName);
      if (!imageFiles.has(fileName)) note('error', 'articles', `Article references a missing image: ${fileName}`, { article: `${colDir}/${slug}` });
    }

    const heroName = entry?.image_file || (imageFiles.has(`${slug}.webp`) ? `${slug}.webp` : null);
    let hero = null;
    if (heroName) {
      const hp = path.join(imgDir, heroName);
      const ok = imageFiles.has(heroName);
      hero = { file: rel(hp), filename: heroName, exists: ok, ...(ok ? stat(hp) : {}) };
      usedImages.add(heroName);
      if (!ok) note('error', 'articles', `Indexed hero image missing on disk: ${heroName}`, { article: `${colDir}/${slug}` });
    }

    const st = stat(fp);
    const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    const words = body.replace(/[#*_>`\[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;

    col.articles.push({
      slug,
      title: data.title || entry?.title || null,
      file: rel(fp),
      filename: f,
      order: data.order ?? null,
      author: data.author || entry?.author || null,
      office: data.office || entry?.office || null,
      personaSlug: data.personaSlug || null,
      excerpt: data.excerpt || null,
      imagePrompt: data.imagePrompt || entry?.image_prompt || null,
      heroImage: hero,
      inlineImages: inline.length ? inline : undefined,
      headings: headings.length ? headings : undefined,
      wordCount: words,
      readingTimeMinutes: Math.max(1, Math.round(words / 225)),
      bytes: st.bytes,
      modified: st.modified,
      inIndex: !!entry,
      indexImageStatus: entry?.image_status || null,
    });

    if (!entry) note('warning', 'articles', 'Article file on disk is not listed in articles.json', { article: `${colDir}/${slug}` });
    if (data.slug && data.slug !== path.parse(f).name)
      note('warning', 'articles', `Frontmatter slug "${data.slug}" does not match filename "${f}"`, { article: `${colDir}/${slug}` });
    if (entry && data.title && entry.title !== data.title)
      note('info', 'articles', `Index title differs from frontmatter title`, { article: `${colDir}/${slug}`, indexTitle: entry.title, frontmatterTitle: data.title });
  }

  const onDisk = new Set(col.articles.map((a) => a.slug));
  for (const s of indexBySlug.keys()) if (!onDisk.has(s)) note('error', 'articles', 'articles.json lists an article with no .md file on disk', { article: `${colDir}/${s}` });

  const orphanImages = [...imageFiles].filter((f) => !usedImages.has(f)).sort();
  if (orphanImages.length) {
    col.orphanImages = orphanImages.map((f) => ({ file: rel(path.join(imgDir, f)), filename: f, ...stat(path.join(imgDir, f)) }));
    note('info', 'articles', `${orphanImages.length} image(s) in images/ are not referenced by any article`, { collection: colDir });
  }

  col.articles.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.slug.localeCompare(b.slug));
  col.articleCount = col.articles.length;
  col.imageDirectory = fs.existsSync(imgDir) ? rel(imgDir) : null;
  col.imageCount = imageFiles.size;
  if (index?.counts?.total != null && index.counts.total !== col.articleCount)
    note('warning', 'articles', `articles.json counts.total (${index.counts.total}) differs from ${col.articleCount} .md files on disk`, { collection: colDir });
  collections.push(col);
}

// =====================================================================
// 3. PLAYLISTS
// =====================================================================
console.error('scanning playlists...');
const plRoot = path.join(ROOT, 'playlists');

// lookup tables for resolving playlist entries to songs
const byAlbumTitle = new Map();
for (const a of albumsById.values()) {
  const k = norm(a.title);
  if (!byAlbumTitle.has(k)) byAlbumTitle.set(k, []);
  byAlbumTitle.get(k).push(a);
}
const allSongs = [...albumsById.values()].flatMap((a) => a.songs);
const songsByTitle = new Map();
for (const s of allSongs) {
  const k = norm(s.title);
  if (!songsByTitle.has(k)) songsByTitle.set(k, []);
  songsByTitle.get(k).push(s);
}

const playlists = [];
for (const f of files(plRoot).filter((f) => /\.json$/i.test(f))) {
  const fp = path.join(plRoot, f);
  let data;
  try { data = JSON.parse(readText(fp)); }
  catch (e) { note('error', 'playlists', `Playlist is not valid JSON: ${e.message}`, { file: rel(fp) }); continue; }

  const st = stat(fp);
  const pl = {
    id: data.id || path.parse(f).name,
    title: data.title || null,
    type: data.type || null,
    description: data.description || null,
    file: rel(fp),
    filename: f,
    anchorVerse: data.anchorVerse || null,
    imagePrompt: data.imagePrompt || null,
    imageAspectRatio: data.imageAspectRatio || null,
    linkedImage: data.linkedImage || null,
    journey: data.journey || null,
    surfacing: data.surfacing || null,
    bytes: st.bytes,
    modified: st.modified,
    songs: [],
  };
  if (data.id && data.id !== path.parse(f).name)
    note('warning', 'playlists', `Playlist id "${data.id}" does not match filename "${f}"`, { file: rel(fp) });

  let resolved = 0;
  for (const item of data.songs || []) {
    const albumKey = norm(item.album || '');
    const trackKey = norm(item.track || '');
    let match = null, how = null;

    let confidence = 1;
    const cands = byAlbumTitle.get(albumKey) || [];
    for (const a of cands) {
      const hit = a.songs.find((s) => norm(s.title) === trackKey);
      if (hit) { match = hit; how = 'album + exact track title'; break; }
    }
    if (!match) {
      // the track title may carry a disambiguator, e.g. "Come, Let Us Go Down (1)"
      const stripped = trackKey.replace(/\s+\d+$/, '');
      for (const a of cands) {
        const hit = a.songs.find((s) => norm(s.title) === stripped || norm(s.title).startsWith(stripped));
        if (hit) { match = hit; how = 'album + track title (disambiguator stripped)'; break; }
      }
    }
    if (!match) {
      for (const a of cands) {
        const hit = a.songs.find((s) => loose(s.title) === loose(item.track || ''));
        if (hit) { match = hit; how = 'album + track title (transliteration variant)'; break; }
      }
    }
    if (!match && cands.length) {
      const best = cands.flatMap((a) => a.songs).map((s) => ({ s, sc: similarity(item.track || '', s.title) })).sort((x, y) => y.sc - x.sc)[0];
      if (best && best.sc >= 0.6) { match = best.s; how = 'album + approximate track title'; confidence = best.sc; }
    }
    if (!match) {
      const g = songsByTitle.get(trackKey) || songsByTitle.get(trackKey.replace(/\s+\d+$/, ''));
      if (g?.length === 1) { match = g[0]; how = 'track title (catalog-wide, unique)'; }
      else if (g?.length > 1) { match = g[0]; how = 'track title (catalog-wide, ambiguous)'; note('warning', 'playlists', `Track "${item.track}" matches ${g.length} songs; linked to the first`, { playlist: pl.id, slot: item.slot }); }
    }
    if (!match && !cands.length)
      note('warning', 'playlists', `Playlist references album "${item.album}", which is not an album folder on disk`, { playlist: pl.id, slot: item.slot });

    const entry = {
      slot: item.slot ?? null,
      album: item.album || null,
      track: item.track || null,
      artist: item.artist || null,
      description: item.description || null,
      resolved: !!match,
    };
    if (match) {
      resolved++;
      entry.songId = match.id;
      entry.albumId = match.albumId;
      entry.book = match.book;
      entry.resolvedTitle = match.title;
      entry.resolvedArtist = match.artist;
      entry.hasAudio = match.hasAudio;
      entry.audioFile = match.audio?.file || null;
      entry.durationSeconds = match.audio?.durationSeconds ?? null;
      entry.artworkFile = albumsById.get(match.albumId)?.artwork?.file || null;
      entry.matchedBy = how;
      if (confidence < 1) entry.matchConfidence = Math.round(confidence * 100) / 100;
      if (!match.hasAudio) note('info', 'playlists', `Playlist references a song with no rendered audio: "${item.track}"`, { playlist: pl.id, slot: item.slot });
    } else {
      note('error', 'playlists', `Unresolved playlist entry: "${item.track}" from album "${item.album}"`, { playlist: pl.id, slot: item.slot });
    }
    pl.songs.push(entry);
  }

  pl.songCount = pl.songs.length;
  pl.declaredSongCount = data.songCount ?? null;
  pl.resolvedSongCount = resolved;
  pl.playableSongCount = pl.songs.filter((s) => s.hasAudio).length;
  pl.durationSeconds = Math.round(pl.songs.reduce((n, s) => n + (s.durationSeconds || 0), 0));
  pl.albumsReferenced = [...new Set(pl.songs.filter((s) => s.albumId).map((s) => s.albumId))];
  pl.booksReferenced = [...new Set(pl.songs.filter((s) => s.book).map((s) => s.book))].sort();
  if (pl.declaredSongCount != null && pl.declaredSongCount !== pl.songCount)
    note('warning', 'playlists', `Declared songCount (${pl.declaredSongCount}) differs from ${pl.songCount} entries`, { playlist: pl.id });

  const known = new Set(['id','title','type','description','anchorVerse','imagePrompt','imageAspectRatio','linkedImage','journey','surfacing','songCount','songs']);
  const extra = Object.keys(data).filter((k) => !known.has(k));
  if (extra.length) { pl.additionalFields = Object.fromEntries(extra.map((k) => [k, data[k]])); note('info', 'playlists', `Playlist carries extra fields: ${extra.join(', ')}`, { playlist: pl.id }); }

  playlists.push(pl);
}

const plImagesDir = path.join(plRoot, 'images');
const playlistImages = files(plImagesDir).filter((f) => !isJunk(f)).map((f) => ({ file: rel(path.join(plImagesDir, f)), filename: f, ...stat(path.join(plImagesDir, f)) }));
if (fs.existsSync(plImagesDir) && !playlistImages.length)
  note('info', 'playlists', 'playlists/images exists but is empty; every playlist linkedImage is unset', { directory: rel(plImagesDir) });

// =====================================================================
// 4. ASSEMBLE
// =====================================================================
const junkFiles = [];
(function walkJunk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkJunk(p);
    else if (isJunk(e.name)) junkFiles.push(rel(p));
  }
})(ROOT);
if (junkFiles.length) note('info', 'filesystem', `${junkFiles.length} OS thumbnail/metadata files found and excluded from the catalog`);

const totalArticles = collections.reduce((n, c) => n + c.articleCount, 0);
const totalArticleImages = collections.reduce((n, c) => n + c.imageCount, 0);
const fmt = (sec) => `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;

const allAlbums = [...albumsById.values()];
const allSongsFinal = allAlbums.flatMap((a) => a.songs);
const renamedSaveTo = allSongsFinal.filter((s) => s.saveTo).length;
if (renamedSaveTo)
  note('info', 'music', `${renamedSaveTo} song(s) carry a "Save To" album title that differs from the album folder title (albums retitled after the lyrics were written); the value is preserved on each song as "saveTo"`);

// group the issue list so consumers can triage without reading every entry
const issueSummary = {};
for (const i of issues) {
  const key = `${i.severity}:${i.area}:${i.message.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N')}`;
  (issueSummary[key] ??= { severity: i.severity, area: i.area, pattern: i.message.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N'), count: 0 }).count++;
}

const manifest = {
  manifestVersion: '1.0.0',
  generator: 'torahsings-catalog-scan',
  generatedAt: new Date().toISOString(),
  root: ROOT,
  pathConvention: 'All file paths are POSIX-style and relative to "root".',
  project: {
    name: 'Torah Sings',
    site: 'TorahSings.com',
    production: 'A Jubilee Inspire Production',
    copyright: '© Jubilee Ministries, Inc.',
  },
  summary: {
    books: books.length,
    booksWithAlbums: books.filter((b) => b.albumCount > 0).length,
    albums: allAlbums.length,
    songs: songTotal,
    songsWithAudio: allAlbums.reduce((n, a) => n + a.songsWithAudio, 0),
    songsAwaitingAudio: songTotal - allAlbums.reduce((n, a) => n + a.songsWithAudio, 0),
    audioFiles: trackTotal,
    alternateTakes: allAlbums.reduce((n, a) => n + a.alternateTakeCount, 0),
    unmatchedAudioFiles: allAlbums.reduce((n, a) => n + a.unmatchedAudioCount, 0),
    unmatchedAudioBreakdown: (() => {
      const u = allAlbums.flatMap((a) => a.unmatchedAudio || []);
      return {
        misfiled: u.filter((x) => x.classification === 'misfiled').length,
        duplicateCopy: u.filter((x) => x.classification === 'duplicate-copy').length,
        byteIdenticalCopies: u.filter((x) => x.duplicateOf?.byteIdentical).length,
        unidentified: u.filter((x) => x.classification === 'unidentified').length,
      };
    })(),
    albumsComplete: allAlbums.filter((a) => a.productionStatus === 'complete').length,
    albumsPartial: allAlbums.filter((a) => a.productionStatus === 'partial').length,
    albumsLyricsOnly: allAlbums.filter((a) => a.productionStatus === 'lyrics-only').length,
    albumsWithCoverArt: allAlbums.filter((a) => a.artwork).length,
    albumsWithBlueprints: allAlbums.filter((a) => a.hasBlueprints).length,
    albumsWithProof: allAlbums.filter((a) => a.hasProof).length,
    articleCollections: collections.length,
    articles: totalArticles,
    articleImages: totalArticleImages,
    articleWords: collections.reduce((n, c) => n + c.articles.reduce((m, a) => m + a.wordCount, 0), 0),
    playlists: playlists.length,
    playlistEntries: playlists.reduce((n, p) => n + p.songCount, 0),
    playlistEntriesResolved: playlists.reduce((n, p) => n + p.resolvedSongCount, 0),
    playlistEntriesPlayable: playlists.reduce((n, p) => n + p.playableSongCount, 0),
    totalAudioBytes: audioBytes,
    totalAudioReadable: `${(audioBytes / 1024 ** 3).toFixed(2)} GB`,
    totalDurationSeconds: Math.round(durationTotal),
    totalDurationReadable: fmt(durationTotal),
    distinctArtists: artistTally.size,
  },
  artists: [...artistTally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, songCount]) => ({ name, songCount })),
  music: { directory: 'music', books, looseFiles: musicLooseFiles },
  articles: { directory: 'articles', collections },
  playlists: { directory: 'playlists', imageDirectory: fs.existsSync(plImagesDir) ? rel(plImagesDir) : null, images: playlistImages, items: playlists },
  excludedFiles: { description: 'OS-generated files present on disk but not part of the catalog.', count: junkFiles.length, files: junkFiles },
  integrity: {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
    summary: Object.values(issueSummary).sort((a, b) => b.count - a.count),
    issues,
  },
};

const json = JSON.stringify(manifest, null, 2);
JSON.parse(json); // syntactic validation
fs.writeFileSync(OUT, json, 'utf8');
manifest.contentHash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);

console.error('\n=== SUMMARY ===');
console.error(JSON.stringify(manifest.summary, null, 2));
console.error(`\nissues: ${manifest.integrity.errors} errors, ${manifest.integrity.warnings} warnings, ${manifest.integrity.info} info`);
console.error(`written: ${OUT} (${(json.length / 1024 / 1024).toFixed(2)} MB)`);
