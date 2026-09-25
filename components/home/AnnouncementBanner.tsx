'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, X } from 'lucide-react';
import { fetchCurrentAnnouncement } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme, radius, type as typeTokens, elevation, glassBlur } from '@/lib/theme';
import type { VenueAnnouncement } from '@/lib/types';

const DISMISSED_KEY = 'w_app_dismissed_announcements';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// The venue's current announcement, pinned to the top of checked-in Home.
// Written by venue managers on /main/venue/announcements (RLS, migration
// 0029). Live: a new or edited announcement appears without a reload.
// Dismissing hides that one announcement on this device; the next one the
// organizer posts shows again.
export default function AnnouncementBanner({ locationId, venueName }: { locationId: string; venueName: string }) {
  const [announcement, setAnnouncement] = useState<VenueAnnouncement | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { canManage } = useIsOrganizer(locationId);

  useEffect(() => { setDismissed(readDismissed()); }, []);

  const load = useCallback(() => {
    fetchCurrentAnnouncement(locationId)
      .then(setAnnouncement)
      .catch((err) => console.error('Failed to load announcement:', err));
  }, [locationId]);

  useEffect(() => {
    setAnnouncement(null);
    load();
  }, [load]);

  useTableSubscription({
    table: 'venue_announcements',
    filter: `location_id=eq.${locationId}`,
    onEvent: load,
  });

  // An expiry can pass while the page is open; drop it at that moment.
  useEffect(() => {
    if (!announcement?.expires_at) return;
    const ms = new Date(announcement.expires_at).getTime() - Date.now();
    if (ms <= 0) { setAnnouncement(null); return; }
    const t = setTimeout(load, Math.min(ms + 500, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [announcement, load]);

  const dismiss = () => {
    if (!announcement) return;
    const next = [...dismissed.filter((id) => id !== announcement.id), announcement.id].slice(-50);
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  if (!announcement || dismissed.includes(announcement.id)) return null;

  return (
    <section
      aria-label={`Announcement from ${venueName}`}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        margin: '12px 16px 0',
        padding: '14px 8px 14px 14px',
        borderRadius: radius.card,
        background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        fontFamily: typeTokens.family,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.glassFill, border: `1px solid ${theme.glassBorder}`, color: theme.text,
        }}
      >
        <Megaphone size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted,
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          <span>{venueName}</span>
          <span aria-hidden>·</span>
          <span style={{ letterSpacing: '0.04em', textTransform: 'none', fontWeight: 600 }}>{timeAgo(announcement.created_at)}</span>
        </div>
        <p style={{
          margin: '4px 0 0', color: theme.text, fontSize: typeTokens.body.fontSize, fontWeight: 600,
          lineHeight: 1.4, wordBreak: 'break-word',
        }}>
          {announcement.body}
        </p>
        {canManage && (
          <Link
            href={`/main/venue/announcements?locationId=${locationId}`}
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 44, marginBottom: -12,
              color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, textDecoration: 'underline',
            }}
          >
            Edit announcements
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this announcement"
        style={{
          width: 44, height: 44, flexShrink: 0, margin: '-8px 0 0', border: 'none', background: 'none',
          color: theme.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: radius.pill,
        }}
      >
        <X size={18} />
      </button>
    </section>
  );
}
