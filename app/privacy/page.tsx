'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { theme } from '@/lib/theme';

const sectionStyle: React.CSSProperties = {
  marginBottom: '28px',
};

const headingStyle: React.CSSProperties = {
  color: theme.text,
  fontSize: '16px',
  fontWeight: 700,
  marginBottom: '10px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

const bodyStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: '14px',
  lineHeight: 1.6,
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

// DRAFT — placeholder copy for founder review, not final legal language.
// Covers only the location-tracking disclosure gap flagged in
// docs/RESUME-launch-prep.md; not a full privacy policy for the whole app.
export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: '48px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '20px',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <Link href="/main" style={{ color: theme.text, display: 'flex' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </Link>
        <h1 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Privacy &amp; Location Data
        </h1>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ ...bodyStyle, marginBottom: '28px', color: theme.text }}>
          This page explains what location data The W App collects, why, and how long it&apos;s kept.
        </p>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>What we collect</h2>
          <p style={bodyStyle}>
            While you&apos;re checked in to a venue, we periodically record your approximate position
            within that venue. This only happens while you have an active check-in — we don&apos;t
            track your location before you check in, after you check out, or anywhere outside the
            venue you&apos;re checked into.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Why we collect it</h2>
          <p style={bodyStyle}>
            Venue organizers use this data in aggregate to understand things like which areas of
            their venue are busiest and how long attendees typically stay. Individual attendees are
            never identified in these reports — figures below 3 people are hidden so no one can be
            singled out from a small count.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>How long we keep it</h2>
          <p style={bodyStyle}>
            Raw position data is deleted within 48 hours. Only the aggregated, anonymized statistics
            derived from it (e.g. &ldquo;Main Bar was busiest at 9pm&rdquo;) are kept longer, for the
            venue&apos;s ongoing reporting.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Your controls</h2>
          <p style={bodyStyle}>
            You can deny or revoke location access at any time in your browser or device settings.
            Without location access, you can still use The W App, but you won&apos;t be able to check
            in to venues or see nearby locations.
          </p>
        </div>

        <p style={{ ...bodyStyle, fontSize: '12px', marginTop: '8px' }}>
          Questions about this policy? Contact the venue organizer or app support.
        </p>
      </div>
    </div>
  );
}
