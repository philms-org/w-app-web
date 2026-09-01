// Sentry init for the browser. Next.js auto-loads this file on the client
// (Next 15.3+ `instrumentation-client` convention). Disabled until
// NEXT_PUBLIC_SENTRY_DSN is set in the environment.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1,
  debug: false,
});

// Lets Sentry tie client-side route changes into performance traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
