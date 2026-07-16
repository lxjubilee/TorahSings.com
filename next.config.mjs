/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
