'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { fetchVenueInvite, setVenueInvite, venueInviteUrl } from '@/lib/data';
import { theme } from '@/lib/theme';

// <input type="datetime-local"> works in local time without a zone;
// the server stores an absolute timestamp.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

// Organizer switch for pre-arrival access (migration 0035): while on, anyone
// who signs up through the link can read and post in this venue's feed
// before they arrive. Access ends for them when the event starts (if set) or
// when this is switched off; checking in moves them onto normal access.
// Leaving the start time blank keeps the link open until switched off —
// handy for testing a new venue from several devices off-site.
// Saves immediately, separate from the venue info form.
export default function VenueInviteCard({ locationId }: { locationId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edited locally, saved on blur so each keystroke isn't a save.
  const [draftStartsAt, setDraftStartsAt] = useState('');
  useEffect(() => { setDraftStartsAt(toLocalInput(startsAt)); }, [startsAt]);

  useEffect(() => {
    let cancelled = false;
    fetchVenueInvite(locationId)
      .then((invite) => {
        if (cancelled) return;
        setEnabled(invite?.enabled ?? false);
        setToken(invite?.token ?? null);
        setStartsAt(invite?.event_starts_at ?? null);
      })
      .catch((err) => {
        console.error('Failed to load invite link:', err);
        if (!cancelled) setError("Couldn't load the invite link");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [locationId]);

  const update = async (nextEnabled: boolean, nextStartsAt: string | null, rotate = false) => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setToken(await setVenueInvite(locationId, nextEnabled, nextStartsAt, rotate));
      setEnabled(nextEnabled);
      setStartsAt(nextStartsAt);
    } catch (err) {
      console.error('Failed to update invite link:', err);
      setError("Couldn't save — try again");
    } finally {
      setBusy(false);
    }
  };

  const link = token ? venueInviteUrl(token) : '';
  const ended = enabled && !!startsAt && new Date(startsAt).getTime() <= Date.now();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the link and copy it manually');
    }
  };

  const smallButton: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px',
    borderRadius: 10, border: `1px solid ${theme.divider}`, background: 'transparent',
    color: theme.text, fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
    fontFamily: 'Montserrat, system-ui, sans-serif', opacity: busy ? 0.6 : 1,
  };

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${theme.divider}`, backgroundColor: theme.bg, color: theme.text,
    fontSize: 13,
  };

  return (
    <div style={{
      marginTop: 28, padding: 16, borderRadius: 14, backgroundColor: theme.surface2,
      border: `1px solid ${theme.divider}`, fontFamily: 'Montserrat, system-ui, sans-serif',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: busy ? 'default' : 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.text, fontSize: 15, fontWeight: 700 }}>Pre-arrival access</div>
          <div style={{ color: theme.muted, fontSize: 13, lineHeight: 1.4, marginTop: 4 }}>
            People who sign up with your invite link can see and post in the feed before they arrive.
            It ends when the event starts or when they check in.
          </div>
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label="Pre-arrival access"
          checked={enabled}
          disabled={busy}
          onChange={(e) => update(e.target.checked, startsAt)}
          style={{ width: 22, height: 22, accentColor: theme.accent, flexShrink: 0 }}
        />
      </label>

      {enabled && token && (
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', color: theme.text, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Event starts
          </label>
          <input
            type="datetime-local"
            value={draftStartsAt}
            disabled={busy}
            onChange={(e) => setDraftStartsAt(e.target.value)}
            onBlur={() => {
              if (draftStartsAt !== toLocalInput(startsAt)) update(true, fromLocalInput(draftStartsAt));
            }}
            style={{ ...field, fontFamily: 'inherit' }}
          />
          <p style={{ color: ended ? theme.accent2 : theme.muted, fontSize: 12, lineHeight: 1.4, margin: '6px 0 14px' }}>
            {ended
              ? 'The event has started, so early access has ended. Invitees now need to check in.'
              : startsAt
                ? 'Early access ends automatically at this time.'
                : 'No start time: the link stays open until you turn it off (useful for testing).'}
          </p>

          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            style={{ ...field, fontFamily: 'monospace' }}
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
                if (window.confirm('Make a new link? The current link will stop working for anyone who hasn’t used it yet.')) {
                  update(true, startsAt, true);
                }
              }}
              style={smallButton}
            >
              <RefreshCw size={16} />
              New link
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: theme.accent2, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}
