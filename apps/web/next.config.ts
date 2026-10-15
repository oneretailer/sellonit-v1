import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Where the Next.js server reaches the API (server-side fetches and the
 * `/api/v1/*` proxy below). This is the API base WITHOUT the `/v1` suffix —
 * the API mounts its routes under `/api/v1`, so the local default is
 * `http://localhost:4000/api`. Rewrites are resolved at BUILD time, so this
 * must be set when running `next build` (the Dockerfile takes it as a build
 * arg).
 */
const apiInternalUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api').replace(
  /\/+$/,
  '',
);

/**
 * Dev-server only: extra hostnames (comma-separated, wildcards allowed) that may
 * load dev assets/HMR, e.g. when the dev server is opened through a tunnel or
 * remote preview. Next.js blocks cross-origin dev requests by default.
 * Has no effect on `next build` / `next start`.
 */
const allowedDevOrigins = (process.env.WEB_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy.
 *
 * - The browser only talks to same-origin `/api/v1/*` (proxied by `rewrites`
 *   below), so `connect-src 'self'` covers the API. The internal API URL is
 *   deliberately NOT listed: it is server-side only and would leak an internal
 *   hostname into every response.
 * - `'unsafe-inline'` in `script-src` is required by the App Router, which
 *   emits inline bootstrap scripts for hydration. Removing it needs per-request
 *   nonces via middleware; that is a follow-up, not part of this config.
 * - `'unsafe-eval'` and websockets are added in development only, for React's
 *   debug build and the HMR socket.
 * - Fonts are self-hosted by `next/font`, so no Google Fonts origins are needed.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  output: 'standalone',
  // Monorepo: trace/bundle workspace packages from the repository root.
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  headers() {
    // Applied to every route, including static assets.
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
  rewrites() {
    // Browser code calls same-origin `/api/v1/...`; Next proxies to the API.
    // This avoids CORS in local/dev setups and never exposes internal hostnames.
    return Promise.resolve([
      { source: '/api/v1/:path*', destination: `${apiInternalUrl}/v1/:path*` },
    ]);
  },
};

export default nextConfig;
