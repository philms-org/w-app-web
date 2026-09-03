import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Content-Security-Policy notes:
// - Supabase URL comes from env (local dev vs prod project); we allow any
//   *.supabase.co plus localhost for the local Docker stack.
// - Leaflet needs OpenStreetMap tile hosts for img-src.
// - 'unsafe-inline' style-src is required by the current inline-style-heavy
//   components and Leaflet's injected styles.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com", // Next.js dev + hydration + Vercel Analytics; tighten with nonces post-launch
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' data:",
  // Vercel Analytics beacons to same-origin /_vercel/insights ('self' covers it).
  // Sentry uploads events/traces to its *.ingest.*.sentry.io hosts.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321 https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera=(self) is required by the QR scanner at /main/connect/scan.
  // geolocation=(self) was already set (needed for the scan-time geotag).
  // microphone and payment stay fully disabled.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Build gates are ON: lint and type errors fail the build.
  // (They were previously ignored; see git history.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

// withSentryConfig wraps the build to upload source maps and register Vercel
// cron monitors. Source-map upload is skipped unless SENTRY_AUTH_TOKEN (plus
// SENTRY_ORG / SENTRY_PROJECT) are set — safe to ship before the Sentry
// project is provisioned.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Quiet the "no auth token" notice locally; keep logs in CI.
  silent: !process.env.CI,
  // Upload a wider set of client bundles for readable stack traces.
  widenClientFileUpload: true,
  // Tree-shake Sentry's internal debug logging from the bundle.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

