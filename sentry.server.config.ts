// Sentry init for the Node.js server runtime. Loaded from instrumentation.ts.
// Until NEXT_PUBLIC_SENTRY_DSN is set (Vercel env, once the project is
// provisioned) the SDK stays disabled and captureException() is a safe no-op.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Full sampling at launch for visibility; dial down in the Sentry project
  // once baseline traffic is known.
  tracesSampleRate: 1,
  debug: false,
});
