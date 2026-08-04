'use client';

import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';

// Phase 1 renders only the locked state — the friends'-activity feed itself
// (and the 3-connections gate) needs tables/APIs that don't exist yet.
// Phase 3: gate on real getConnectionCount() and render fetchFriendsActivity()
// once a user has 3+ connections.
export default function FriendsActivityFeed() {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${theme.premium1} 0%, ${theme.premium2} 100%)`,
      borderRadius: '16px',
      padding: '24px 20px',
      margin: '0 20px 20px',
      textAlign: 'center'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 14px'
      }}>
        <Lock style={{ width: '22px', height: '22px', color: 'white' }} />
      </div>
      <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '6px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Unlock friends&apos; activity
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: 1.4, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Connect with 3 people to see where they&apos;ve been
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        marginTop: '14px',
        color: 'rgba(255,255,255,0.9)',
        fontSize: '12px',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>
        <Users style={{ width: '14px', height: '14px' }} />
        0 / 3 connections
      </div>
    </div>
  );
}
