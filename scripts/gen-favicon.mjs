import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await sharp('W:/TorahSings.com/public/zev-circle.png').resize(s, s).png().toBuffer());
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + sizes.length * 16;
const entries = [];
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += pngs[i].length; entries.push(e);
});
writeFileSync('W:/TorahSings.com/src/app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]));
console.log('wrote favicon.ico', 6 + sizes.length*16 + pngs.reduce((a,b)=>a+b.length,0), 'bytes,', sizes.length, 'sizes');
