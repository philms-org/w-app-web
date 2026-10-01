'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, Megaphone, Image, Gift, FileText, MessageCircle, Map, Send, Settings, UserCheck, Flame } from 'lucide-react';
import { fetchMyVenues, fetchVenueMembers } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';

interface VenueWithCount {
  venue: Venue;
  memberCount: number;
}

const card: React.CSSProperties = {
  backgroundColor: theme.surface,
  border: `1px solid ${theme.divider}`,
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: theme.muted,
  fontFamily: 'Montserrat, system-ui, sans-serif',
  marginBottom: '10px',
};

const toolBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  backgroundColor: theme.surface2,
  border: `1px solid ${theme.divider}`,
  borderRadius: '10px',
  cursor: 'pointer',
  textDecoration: 'none',
  color: theme.text,
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'Montserrat, system-ui, sans-serif',
  flex: '1 1 140px',
};

interface Tool {
  label: string;
  icon: React.ElementType;
  href: (id: string) => string;
}

const TOOLS: Tool[] = [
  { label: 'Members', icon: Users, href: (id) => `/main/venue/members?locationId=${id}` },
  { label: 'Announcements', icon: Megaphone, href: (id) => `/main/venue/announcements?locationId=${id}` },
  { label: 'Mass Message', icon: Send, href: (id) => `/main/venue/message?locationId=${id}` },
  { label: 'Carousel', icon: Image, href: (id) => `/main/venue/carousel?locationId=${id}` },
  { label: 'Rewards', icon: Gift, href: (id) => `/main/venue/rewards?locationId=${id}` },
  { label: 'Reports', icon: FileText, href: (id) => `/main/venue/reports?locationId=${id}` },
  { label: 'Chat', icon: MessageCircle, href: (id) => `/main/venue/chat?locationId=${id}` },
  { label: 'Zones', icon: Map, href: (id) => `/main/venue/zones?locationId=${id}` },
  { label: 'Hotspots', icon: Flame, href: (id) => `/main/venue/hotspots?locationId=${id}` },
  { label: 'Titles', icon: UserCheck, href: (id) => `/admin/venue/${id}/tags` },
  { label: 'Edit Info', icon: Settings, href: (id) => `/main/venue/edit?locationId=${id}` },
];

export default function OrganizerPage() {
  const router = useRouter();
  const [rows, setRows] = useState<VenueWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyVenues()
      .then(async (venues) => {
        const withCounts = await Promise.all(
          venues.map(async (venue) => {
            try {
              const members = await fetchVenueMembers(venue.id);
              return { venue, memberCount: members.length };
            } catch {
              return { venue, memberCount: 0 };
            }
          })
        );
        setRows(withCounts);
      })
      .catch((err) => {
        console.error('Failed to load organizer venues:', err);
        setError("Couldn't load your venues — try again");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: theme.text }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <h1 style={{ flex: 1, fontSize: '18px', fontWeight: 700, color: theme.text }}>Organizer Dashboard</h1>
      </div>

      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        {loading ? (
          <p style={{ color: theme.muted, fontSize: '14px' }}>Loading your venues…</p>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ color: theme.text, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              No venues yet
            </p>
            <p style={{ color: theme.muted, fontSize: '14px' }}>
              Ask your W staff admin to assign you as an organizer for a venue.
            </p>
          </div>
        ) : (
          rows.map(({ venue, memberCount }) => (
            <div key={venue.id} style={card}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '17px', fontWeight: 700, color: theme.text, marginBottom: '2px' }}>
                  {venue.name}
                </p>
                {(venue.address || venue.city) && (
                  <p style={{ fontSize: '13px', color: theme.muted }}>
                    {[venue.address, venue.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <p style={{ fontSize: '12px', color: theme.accent, fontWeight: 600, marginTop: '4px' }}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'} on record
                </p>
              </div>

              <p style={sectionLabel}>Manage</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TOOLS.map(({ label, icon: Icon, href }) => (
                  <Link key={label} href={href(venue.id)} style={toolBtn}>
                    <Icon style={{ width: '16px', height: '16px', color: theme.accent, flexShrink: 0 }} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
