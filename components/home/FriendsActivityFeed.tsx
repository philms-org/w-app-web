'use client';

import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';

// Round 1 restyle: real copy + a blurred illustrative backdrop instead of a
// flat gradient card. Still locked-state only — the 3-connections gate and
// real fetchFriendsActivity() wiring is Round 2+ (needs the real connections
// schema this repo's paused 2026-08-04 plan flagged as unresolved).
export default function FriendsActivityFeed() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: '16px',
      overflow: 'hidden',
      margin: '0 20px 20px',
      backgroundColor: theme.surface,
      border: `1px solid ${theme.divider}`,
      minHeight: '180px',
    }}>
      <FeedBlurBackdrop />

      <div style={{
        position: 'relative',
        background: `linear-gradient(180deg, transparent 0%, ${theme.bg} 85%)`,
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '9999px',
          backgroundColor: theme.premium1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Lock style={{ width: '22px', height: '22px', color: 'white' }} />
        </div>
        <h3 style={{
          color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '6px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          Add friends to see where they&apos;ve been
        </h3>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          marginTop: '10px', color: theme.muted, fontSize: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          <Users style={{ width: '14px', height: '14px' }} />
          0 / 3 connections
        </div>
      </div>
    </div>
  );
}
