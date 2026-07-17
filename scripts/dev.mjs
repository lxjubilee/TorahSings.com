#!/usr/bin/env node
/**
 * DEV ORCHESTRATOR — brings the whole local stack up with one command.
 *
 *   npm run dev
 *     ├── auth  :4031  scripts/local-auth-server.mjs   (SQLite identity API)
 *     └── web   :3000  next dev                        (proxies /api/* -> auth)
 *
 * WHY: next.config.mjs rewrites the browser's same-origin /api/* to
 * NEXT_PUBLIC_API_BASE. When that points at localhost and the auth server is not
 * running, every /api/auth/* call dies with ECONNREFUSED, which Next surfaces as
 * a bare "500 Internal Server Error" — a confusing way to discover you forgot a
 * terminal. Starting both together removes the trap.
 *
 * Run either half alone with `npm run dev:web` / `npm run dev:auth`.
 *
 * Notes
 *  - Spawns `node node_modules/next/dist/bin/next` rather than the `.bin/next`
 *    shim: on Windows the shim is a .cmd wrapper, and killing it can orphan the
 *    real node process (leaving :3000 held). Spawning node directly keeps the
 *    child PID killable.
 *  - Zero new dependencies — node:child_process only.
 *  - Skips the auth server automatically when NEXT_PUBLIC_API_BASE points at a
 *    remote host (e.g. api.torahsings.com), since nothing local is needed then.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- read NEXT_PUBLIC_API_BASE the same way Next will (.env.local wins) -----
function readEnvBase() {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const m = fs
      .readFileSync(p, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .find((l) => l.startsWith('NEXT_PUBLIC_API_BASE='));
    if (m) return m.slice('NEXT_PUBLIC_API_BASE='.length).trim();
  }
  return 'https://api.torahsings.com'; // next.config.mjs default
}

const API_BASE = readEnvBase();
let authPort = null;
try {
  const u = new URL(API_BASE);
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
    authPort = Number(u.port || 80);
  }
} catch {
  /* unparseable — treat as remote and skip the local server */
}

const isPortFree = (port) =>
  new Promise((resolve) => {
    const s = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });

// ---- child management ------------------------------------------------------
const children = [];
let shuttingDown = false;

const C = { auth: '\x1b[35m', web: '\x1b[36m', dim: '\x1b[2m', off: '\x1b[0m' };

function start(name, args, color, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  children.push(child);

  const tag = `${color}${name.padEnd(4)}${C.off} ${C.dim}│${C.off} `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) out.write(tag + l + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    process.stdout.write(`${tag}exited (code ${code}) — shutting the stack down\n`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode === null) {
      try {
        c.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
  setTimeout(() => process.exit(code), 300);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(0));

// ---- boot ------------------------------------------------------------------
console.log('');
console.log(`  ${C.dim}Torah Sings — dev stack${C.off}`);
console.log(`  ${C.dim}api base:${C.off} ${API_BASE}`);

if (authPort) {
  if (await isPortFree(authPort)) {
    start('auth', [path.join(ROOT, 'scripts', 'local-auth-server.mjs')], C.auth);
    console.log(`  ${C.dim}auth    : starting on :${authPort} — sign-up codes print below${C.off}`);
  } else {
    console.log(
      `  ${C.auth}auth${C.off}    : ${C.dim}already running on :${authPort} — reusing it${C.off}`
    );
  }
} else {
  console.log(
    `  ${C.dim}auth    : skipped — NEXT_PUBLIC_API_BASE is remote.${C.off}\n` +
      `  ${C.dim}          ⚠  sign-ups will hit ${API_BASE} (real rows, real emails).${C.off}`
  );
}

// ---- file watching over SMB ------------------------------------------------
// This repo lives on a MAPPED NETWORK DRIVE (W: -> \\HDC-INSPIRESERVER\Websites,
// DriveType 4). Windows' native change notification (ReadDirectoryChangesW) is
// not reliable over SMB, so the default watcher throws
//   "Watchpack Error (watcher): Error: UNKNOWN: unknown error, watch"
// and — the part that actually hurts — NEW ROUTES ARE NEVER DISCOVERED and edits
// do not hot-reload; you have to restart the dev server for every new file.
//
// Polling sidesteps the OS notification API entirely. Measured on this repo:
//   native  -> many watcher errors; a new /route stayed 404 until restart
//   polling -> 0 errors; new route served immediately; edits hot-reloaded
//
// 1000 ms keeps SMB chatter modest while still feeling instant. Override either
// var in the environment to change or disable it (e.g. WATCHPACK_POLLING=false
// if you ever run this from a local disk, where native watching is faster).
const webEnv = {};
if (!('WATCHPACK_POLLING' in process.env)) webEnv.WATCHPACK_POLLING = '1000';
if (!('CHOKIDAR_USEPOLLING' in process.env)) webEnv.CHOKIDAR_USEPOLLING = 'true';

start(
  'web',
  [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev'],
  C.web,
  webEnv
);
if (webEnv.WATCHPACK_POLLING) {
  console.log(
    `  ${C.dim}watcher : polling @ ${webEnv.WATCHPACK_POLLING}ms (network drive — native watch is unreliable over SMB)${C.off}`
  );
}
console.log(`  ${C.dim}Ctrl-C stops both.${C.off}`);
console.log('');
