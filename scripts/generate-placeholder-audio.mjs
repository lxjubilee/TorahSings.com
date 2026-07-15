/**
 * Generates public/audio/placeholder-ambient.wav
 *
 * This is NOT music, and it is not a Torah Sings production. It is a synthesized
 * drone that exists so the player — transport, scrubber, waveform, duration,
 * playback-position persistence — can be exercised against a real <audio>
 * element before the masters land on the Jubilee CDN.
 *
 * Delete this file and the WAV once real audio is wired up.
 *
 *   node scripts/generate-placeholder-audio.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_RATE = 22050;
const SECONDS = 24;
const FADE = 2.5;

// A low drone on D, with the raised fourth of Ahavah Rabbah shimmering above it.
const VOICES = [
  { hz: 73.42, gain: 0.34, lfoHz: 0.07 }, // D2
  { hz: 110.0, gain: 0.2, lfoHz: 0.05 }, // A2
  { hz: 146.83, gain: 0.16, lfoHz: 0.11 }, // D3
  { hz: 185.0, gain: 0.07, lfoHz: 0.09 }, // F#3
  { hz: 293.66, gain: 0.045, lfoHz: 0.13 }, // D4
];

const frames = SAMPLE_RATE * SECONDS;
const pcm = Buffer.alloc(frames * 2);

for (let i = 0; i < frames; i++) {
  const t = i / SAMPLE_RATE;

  let sample = 0;
  for (const v of VOICES) {
    const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * v.lfoHz * t);
    sample += v.gain * lfo * Math.sin(2 * Math.PI * v.hz * t);
  }

  // Gentle fade in and out so it can loop without a click.
  let env = 1;
  if (t < FADE) env = t / FADE;
  else if (t > SECONDS - FADE) env = (SECONDS - t) / FADE;
  env = env * env * (3 - 2 * env); // smoothstep

  sample = Math.tanh(sample * env * 1.1) * 0.62;

  const clamped = Math.max(-1, Math.min(1, sample));
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // format = PCM
header.writeUInt16LE(1, 22); // channels = mono
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = join(__dirname, '..', 'public', 'audio', 'placeholder-ambient.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, pcm]));

console.log(`wrote ${out} (${((header.length + pcm.length) / 1024 / 1024).toFixed(2)} MB, ${SECONDS}s)`);
