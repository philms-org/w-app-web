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

// Location-tracking disclosure. Wording is the accuracy-checked "path (b)"
// rewrite from docs/privacy-copy-rewrite-2026-09-02.md (founder-approved
// 2026-09-03). NOT lawyer-reviewed yet, and NOT a full privacy policy for the
// whole app — it covers venue zone/area analytics only. The connections-geotag
// disclosure is added separately when that feature ships.
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
            Some venues divide their space into named areas (for example &ldquo;Main Bar&rdquo; or
            &ldquo;Patio&rdquo;). While you&apos;re checked in to a venue like that, about once every
            10 seconds your device sends its location to us, we match it to the nearest named area,
            and we store <strong>only that area name and the time</strong> — not your actual
            coordinates.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            This happens only while you have an active check-in. We don&apos;t record anything before
            you check in, after you check out, at venues that haven&apos;t defined areas, or anywhere
            outside the venue you&apos;re checked into.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Why we collect it</h2>
          <p style={bodyStyle}>
            Venue organizers see summary reports for their own venue: how many people are in each
            area, the average time people spend in each area, how people move between areas, and what
            share of their attendees also visited other venues nearby.{' '}
            <strong>Reports show area names and totals only — never your name, your account, or your
            coordinates.</strong>
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Head-count figures — how many people are in an area, and how many of a venue&apos;s
            attendees also went to another venue — are hidden when fewer than 3 people are involved,
            so no one can be picked out of a small number. Average-time and area-to-area movement
            figures can be shown for smaller groups; they still carry no identifying information, but
            a venue could in principle relate them to who was present at the time.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>How long we keep it</h2>
          <p style={bodyStyle}>
            Area-and-time records are deleted within 48 hours — an automated job runs every hour.{' '}
            <strong>Nothing derived from them is stored separately.</strong> Each time an organizer
            opens their report it&apos;s recalculated from scratch using only the last 48 hours of
            data, so anything older has already disappeared from every report.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Your controls</h2>
          <p style={bodyStyle}>
            You can deny or revoke location access at any time in your browser or device settings.
            Without location access, you can still use The W App, but you won&apos;t be able to check
            in to venues or see nearby locations. Denying location doesn&apos;t delete area-and-time
            records already collected during a past check-in; those age out on the normal 48-hour
            schedule.
          </p>
        </div>

        <p style={{ ...bodyStyle, fontSize: '12px', marginTop: '8px' }}>
          Questions about this policy? Contact the venue organizer or app support.
        </p>
      </div>
    </div>
  );
}
