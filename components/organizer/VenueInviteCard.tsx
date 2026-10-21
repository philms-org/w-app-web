'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import {
  fetchPresence,
  fetchVenueAttendees,
  fetchVenueInvite,
  setVenueGuestPass,
  setVenueInvite,
  venueInviteUrl,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import GuestBadge from '@/components/home/GuestBadge';

const FONT = 'Montserrat, system-ui, sans-serif';

// Organizer links (migrations 0035 / 0037), saved immediately, separate from
// the venue info form:
//   * Attendee link — people coming to the event join the feed from anywhere
//     and keep access until it's switched off. Checking in while it's on also
//     makes you an attendee, so stepping out doesn't cut you off.
//   * Guest pass — a separate link for investors / sponsors following
//     remotely: same feed access, shown with a guest label, never counted as
//     attending.
export default function VenueInviteCard({ locationId }: { locationId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ attending: number; inRoom: number; guests: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = useCallback(() => {
    Promise.all([fetchVenueAttendees(locationId), fetchPresence(locationId)])
      .then(([attendees, presence]) => setCounts({
        attending: attendees.filter((a) => a.kind === 'attendee').length,
        guests: attendees.filter((a) => a.kind === 'guest').length,
        inRoom: new Set(presence.map((p) => p.user_id)).size,
      }))
      .catch((err) => console.error('Failed to load attendee counts:', err));
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    fetchVenueInvite(locationId)
      .then((invite) => {
        if (cancelled) return;
        setEnabled(invite?.enabled ?? false);
        setToken(invite?.token ?? null);
        setGuestEnabled(invite?.guest_enabled ?? false);
        setGuestToken(invite?.guest_token ?? null);
      })
      .catch((err) => {
        console.error('Failed to load invite links:', err);
        if (!cancelled) setError("Couldn't load the invite links");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    loadCounts();
    return () => { cancelled = true; };
  }, [locationId, loadCounts]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      loadCounts();
    } catch (err) {
      console.error('Failed to update invite link:', err);
      setError("Couldn't save — try again");
    } finally {
      setBusy(false);
    }
  };

  const updateAttendee = (next: boolean, rotate = false) => run(async () => {
    setToken(await setVenueInvite(locationId, next, rotate));
    setEnabled(next);
  });

  const updateGuest = (next: boolean, rotate = false) => run(async () => {
    setGuestToken(await setVenueGuestPass(locationId, next, rotate));
    setGuestEnabled(next);
  });

  return (
    <div style={{
      marginTop: 28, padding: 16, borderRadius: 14, backgroundColor: theme.surface2,
      border: `1px solid ${theme.divider}`, fontFamily: FONT,
    }}>
      <LinkSection
        title="Attendee link"
        body="For people coming to the event. They can join the feed from anywhere and keep access until you turn it off. A green light shows when they're in the room."
        enabled={enabled}
        token={token}
        busy={busy}
        onToggle={(next) => updateAttendee(next)}
        onRotate={() => updateAttendee(true, true)}
        countLine={counts ? `${counts.attending} attending · ${counts.inRoom} in the room` : null}
        onError={setError}
      />

      <div style={{ borderTop: `1px solid ${theme.divider}`, margin: '16px 0' }} />

      <LinkSection
        title="Guest pass"
        badge="Investors and sponsors"
        body="A separate link for people following remotely. They can post and comment with a guest label, and see who's in the room. They never show as attending."
        enabled={guestEnabled}
        token={guestToken}
        busy={busy}
        onToggle={(next) => updateGuest(next)}
        onRotate={() => updateGuest(true, true)}
        countLine={counts ? `${counts.guests} ${counts.guests === 1 ? 'guest' : 'guests'}` : null}
        onError={setError}
      />

      {error && <p style={{ color: theme.accent2, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}

function LinkSection({
  title, badge, body, enabled, token, busy, onToggle, onRotate, countLine, onError,
}: {
  title: string;
  badge?: string;
  body: string;
  enabled: boolean;
  token: string | null;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onRotate: () => void;
  countLine: string | null;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = token ? venueInviteUrl(token) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('Copy failed — select the link and copy it manually');
    }
  };

  const smallButton: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px',
    borderRadius: 10, border: `1px solid ${theme.divider}`, background: 'transparent',
    color: theme.text, fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
    fontFamily: FONT, opacity: busy ? 0.6 : 1,
  };

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: busy ? 'default' : 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: theme.text, fontSize: 15, fontWeight: 700 }}>{title}</span>
            {badge && <GuestBadge label={badge} />}
          </div>
          <div style={{ color: theme.muted, fontSize: 13, lineHeight: 1.4, marginTop: 4 }}>{body}</div>
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label={title}
          checked={enabled}
          disabled={busy}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: 22, height: 22, accentColor: theme.accent, flexShrink: 0 }}
        />
      </label>

      {enabled && token && (
        <div style={{ marginTop: 12 }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${theme.divider}`, backgroundColor: theme.bg, color: theme.text,
              fontSize: 13, fontFamily: 'monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={copy} disabled={busy} style={smallButton}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Make a new link? The current link will stop working for anyone who hasn’t used it yet.')) onRotate();
              }}
              style={smallButton}
            >
              <RefreshCw size={16} />
              New link
            </button>
          </div>
        </div>
      )}

      {countLine && <p style={{ color: theme.muted, fontSize: 12, margin: '10px 0 0' }}>{countLine}</p>}
    </div>
  );
}
