'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { fetchVenue, updateVenueInfo } from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';

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

  const { canManage } = useIsOrganizer(locationId || null);

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
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
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
          </div>
        )}
      </div>
    </div>
  );
}
