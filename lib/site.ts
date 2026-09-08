/**
 * Canonical site origin, resolved once at module load.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL          — explicit override; set this once a real
 *                                     custom domain is live.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production hostname
 *                                     on Vercel (host only, no protocol).
 *                                     Present in every Vercel build/runtime.
 *  3. http://localhost:3000         — local dev fallback.
 *
 * Server-only value: VERCEL_PROJECT_PRODUCTION_URL is not exposed to the
 * client bundle. Reference SITE_URL from metadata, route handlers, sitemap
 * and robots — not from "use client" components.
 */
export const SITE_URL: string = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
})();
