/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Build output directory. Defaults to `.next`; override with NEXT_DIST_DIR.
   *
   * WHY THIS IS OVERRIDABLE: this repo lives on a mapped SMB drive (see the note
   * in scripts/dev.mjs). Turbopack's cache under `.next/dev/cache/turbopack` can
   * wedge there — the dev server dies with "Unable to remove invalid database",
   * and the cache files cannot be deleted afterwards: SMB renames them to
   * `.<hex>` delete-pending markers, and every later open returns "Access is
   * denied" until the server-side handle finally closes. When that happens no
   * local process holds them, so there is nothing to kill and `rm -rf .next`
   * cannot win. Point the build at a fresh directory to get moving again:
   *
   *   NEXT_DIST_DIR=.next-dev npm run dev
   *
   * Delete the stale directory later, once the share has let go of it.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  /**
   * Proxy the browser's same-origin /api/* calls to torahsings-api, the way
   * JubiLujah's web app does. The browser therefore never talks to
   * api.torahsings.com directly: no CORS preflight, and no API hostname baked
   * into the client bundle.
   *
   * There are no Next route handlers under /api, so this catch-all shadows
   * nothing.
   */
  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE || 'https://api.torahsings.com').replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

export default nextConfig;
