'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { fetchVenue, updateVenueInfo } from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import VenueInviteCard from '@/components/organizer/VenueInviteCard';
import { fetchEventSettings, updateEventSettings } from '@/lib/eventTracking';

// Stored as timestamptz; edited as local calendar days. The end day counts in
// full (check-ins last until it ends, PR #51).
function isoToDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayToIso(day: string): string | null {
  return day ? new Date(`${day}T00:00:00`).toISOString() : null;
}

export default function VenueEditPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading…</p>
        </div>
      }
    >
      <VenueEditPageInner />
    </Suspense>
  );
}

function VenueEditPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') ?? '';

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    whatsapp: '',
  });

  const [eventForm, setEventForm] = useState({ start: '', end: '', askRole: false });

  const { canManage } = useIsOrganizer(locationId || null);

  useEffect(() => {
    if (!locationId) return;
    fetchEventSettings(locationId)
      .then((s) => setEventForm({ start: isoToDay(s.event_date), end: isoToDay(s.event_end_date), askRole: s.ask_event_role }))
      .catch((err) => console.error('Failed to load event settings:', err));
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    fetchVenue(locationId)
      .then((v) => {
        setVenue(v);
        setForm({
          name: v?.name ?? '',
          description: v?.description ?? '',
          address: v?.address ?? '',
          city: v?.city ?? '',
          whatsapp: v?.whatsapp ?? '',
        });
      })
      .catch((err) => {
        console.error('Failed to load venue:', err);
        setError("Couldn't load venue");
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  const handleSave = async () => {
    if (!venue) return;
    setError(null);
    setSaved(false);
    if (!!eventForm.start !== !!eventForm.end) {
      setError('Set both the first and last day of the event, or clear both.');
      return;
    }
    if (eventForm.start && eventForm.end < eventForm.start) {
      setError("The last day can't be before the first day.");
      return;
    }
    setSaving(true);
    try {
      await updateEventSettings(locationId, {
        event_date: dayToIso(eventForm.start),
        event_end_date: dayToIso(eventForm.end),
        ask_event_role: eventForm.askRole,
      });
      await updateVenueInfo(locationId, {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
      });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save venue:', err);
      setError("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: theme.surface2,
    border: `1px solid ${theme.divider}`,
    borderRadius: '12px',
    padding: '12px 14px',
    color: theme.text,
    fontSize: '15px',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '6px',
    display: 'block',
    fontFamily: 'Montserrat, system-ui, sans-serif',
  };

  if (!canManage && !loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <p style={{ color: theme.text, fontSize: '16px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', textAlign: 'center' }}>
          Organizer access required
        </p>
      </div>
    );
  }

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
        <h1 style={{ flex: 1, fontSize: '18px', fontWeight: 700, color: theme.text }}>Edit Venue Info</h1>
      </div>

      <div style={{ padding: '20px', paddingBottom: '100px', maxWidth: '520px' }}>
        {loading ? (
          <p style={{ color: theme.muted }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Venue Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Venue name" />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' as const, minHeight: '80px' }}
                placeholder="Describe your venue…"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Address</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} placeholder="Street address" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>City</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle} placeholder="City" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>WhatsApp / Contact</label>
              <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} style={inputStyle} placeholder="+1 555 000 0000" />
            </div>

            <div style={{ borderTop: `1px solid ${theme.divider}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ ...labelStyle, marginBottom: 0 }}>Event</p>
              {!eventForm.start && (
                <p style={{ color: theme.text, fontSize: '13px', margin: 0, padding: '10px 12px', borderRadius: '12px', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}` }}>
                  Running an event here? Set its dates so check-ins last the whole event and your report counts the right days.
                </p>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="event-start" style={labelStyle}>First day</label>
                  <input
                    id="event-start"
                    type="date"
                    value={eventForm.start}
                    onChange={(e) => setEventForm((f) => ({ ...f, start: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="event-end" style={labelStyle}>Last day</label>
                  <input
                    id="event-end"
                    type="date"
                    value={eventForm.end}
                    min={eventForm.start || undefined}
                    onChange={(e) => setEventForm((f) => ({ ...f, end: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <label htmlFor="event-ask-role" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  id="event-ask-role"
                  type="checkbox"
                  checked={eventForm.askRole}
                  onChange={(e) => setEventForm((f) => ({ ...f, askRole: e.target.checked }))}
                  style={{ width: '20px', height: '20px', marginTop: '1px', accentColor: theme.accent }}
                />
                <span style={{ color: theme.text, fontSize: '14px' }}>
                  Ask attendees their role at check-in
                  <span style={{ display: 'block', color: theme.muted, fontSize: '12px' }}>
                    Developer, designer, business or something else. Shows up in your report.
                  </span>
                </span>
              </label>
            </div>

            {error && <p style={{ color: theme.accent2, fontSize: '13px' }}>{error}</p>}
            {saved && <p style={{ color: theme.accent, fontSize: '13px', fontWeight: 600 }}>Saved!</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: theme.accent,
                color: theme.onAccent,
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Save style={{ width: '18px', height: '18px' }} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {canManage && <VenueInviteCard locationId={locationId} />}
          </div>
        )}
      </div>
    </div>
  );
}
