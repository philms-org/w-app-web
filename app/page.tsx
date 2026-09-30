import Link from 'next/link';
import type { Metadata } from 'next';
import EnsureSession from '@/components/EnsureSession';
import { theme } from '@/lib/theme';

export const metadata: Metadata = {
  description:
    "Check in at a venue to see who's there, make connections, and join the room's live chat. The W App is a location-first way to meet the people around you.",
  alternates: { canonical: '/' },
};

const VALUE_PROPS = [
  {
    title: 'See who’s here',
    body: 'Check in at a venue and get a live view of the people in the room with you.',
  },
  {
    title: 'Make the connection',
    body: 'Swap contacts with a tap or a QR scan. Your connections stay with you after you leave.',
  },
  {
    title: 'Join the room',
    body: 'Every checked-in venue has its own live chat and feed while you’re there.',
  },
];

// Server-rendered so crawlers and link unfurls get real content. Every real
// (JS-running) visitor is bounced straight into the app by <EnsureSession>,
// which bootstraps a fresh anonymous session for anyone not already
// authenticated — no signup wall on the way in.
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: theme.bg,
        color: theme.text,
        padding: '64px 24px 48px',
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      <EnsureSession />

      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: theme.accent,
            color: theme.onAccent,
            fontSize: 52,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 28px',
          }}
        >
          W
        </div>

        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: '0 0 12px' }}>
          Connect with people at your location
        </h1>
        <p style={{ fontSize: 18, color: theme.muted, margin: '0 0 36px' }}>
          The W App turns the room you’re standing in into a way to meet people. Check in,
          see who’s there, and connect.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/auth/register"
            style={{
              background: theme.accent,
              color: theme.onAccent,
              fontWeight: 700,
              fontSize: 16,
              padding: '14px 28px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            style={{
              border: `1.5px solid ${theme.accent}`,
              color: theme.text,
              fontWeight: 700,
              fontSize: 16,
              padding: '14px 28px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        </div>
      </div>

      <section
        style={{
          width: '100%',
          maxWidth: 900,
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          margin: '64px auto 0',
        }}
      >
        {VALUE_PROPS.map((p) => (
          <div
            key={p.title}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.divider}`,
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'left',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{p.title}</h2>
            <p style={{ fontSize: 15, color: theme.muted, margin: 0, lineHeight: 1.5 }}>
              {p.body}
            </p>
          </div>
        ))}
      </section>

      <footer style={{ marginTop: 56, fontSize: 13, color: theme.muted }}>
        <Link href="/privacy" style={{ color: 'inherit' }}>
          Privacy
        </Link>
      </footer>
    </main>
  );
}
