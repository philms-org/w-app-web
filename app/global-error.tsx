"use client";

// Top-level error boundary for the App Router. Next.js renders this in place
// of the root layout when an uncaught error escapes a nested route, so it
// must render its own <html>/<body>. Reports the error to Sentry (no-op
// until a DSN is configured).
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      {/* Renders instead of the root layout, so globals.css may not be
          loaded: colours and font are inline, dark-theme literals. */}
      <body style={{ margin: 0, minHeight: "100vh", background: "#0C0C0E", color: "#F5F5F7", fontFamily: "Montserrat, system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
        <div style={{ maxWidth: "28rem", margin: "20vh auto", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: "1.5rem", opacity: 0.7 }}>
            The error has been logged. Try again, or reload the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "9999px",
              fontWeight: 600,
              border: "1px solid currentColor",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
