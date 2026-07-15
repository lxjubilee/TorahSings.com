/**
 * One-off: build the sign-in hero slideshow images from six album covers.
 *   node scripts/gen-signin-slides.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ANGELS_ROOT || 'J:/music/angels';
const OUT = join(process.cwd(), 'public', 'signin-slides');
mkdirSync(OUT, { recursive: true });

function findArt(code) {
  for (const book of readdirSync(ROOT)) {
    const bp = join(ROOT, book);
    try {
      if (!statSync(bp).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const album of readdirSync(bp)) {
      if (album.startsWith(code)) {
        const art = join(bp, album, 'artwork', code + '.png');
        if (existsSync(art)) return art;
      }
    }
  }
  return null;
}

const codes = ['ANSMX01001EN', 'ANSMX01009EN', 'ANSMX02002EN', 'ANSMX02005EN', 'ANSMX01005EN', 'ANSMX01003EN'];
let i = 1;
for (const code of codes) {
  const src = findArt(code);
  if (!src) {
    console.log('MISSING', code);
    i++;
    continue;
  }
  await sharp(src).resize(900, 1300, { fit: 'cover', position: 'centre' }).webp({ quality: 80 }).toFile(join(OUT, `slide${i}.webp`));
  console.log(`slide${i}.webp <- ${code}`);
  i++;
}
