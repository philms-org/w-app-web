'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronUp, ChevronDown, X, Search, MapPinPlus } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { fetchVenue, fetchVenues, fetchRewards } from '@/lib/data';
import {
  fetchEventHotspots, addHotspot, createHotspotPlace, updateHotspot, removeHotspot, fetchHotspotVisitCounts,
} from '@/lib/hotspots';
import { theme } from '@/lib/theme';
import type { EventHotspot, Venue } from '@/lib/types';

const WMap = dynamic(() => import('@/components/WMap'), { ssr: false });
const FONT = 'Montserrat, system-ui, sans-serif';
const inputStyle: React.CSSProperties = {
  backgroundColor: theme.pill, border: 'none', borderRadius: 10, padding: '10px 14px', minHeight: 44,
  fontSize: 14, color: theme.text, fontFamily: FONT, width: '100%', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', color: theme.muted, cursor: 'pointer',
};

export default function VenueHotspotsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: theme.bg }} />}>
      <VenueHotspotsInner />
    </Suspense>
  );
}

function VenueHotspotsInner() {
  const router = useRouter();
  const eventId = useSearchParams().get('locationId');
  const { canManage } = useIsOrganizer(eventId);

  const [event, setEvent] = useState<Venue | null>(null);
  const [hotspots, setHotspots] = useState<EventHotspot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [maxRewardTarget, setMaxRewardTarget] = useState<number | null>(null);
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [mode, setMode] = useState<'none' | 'search' | 'new'>('none');
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newRadius, setNewRadius] = useState('75');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);

  const load = useCallback(() => {
    if (!eventId) return;
    Promise.all([fetchVenue(eventId), fetchEventHotspots(eventId)])
      .then(([ev, list]) => { setEvent(ev); setHotspots(list); })
      .catch((e) => { console.error(e); setError("Couldn't load hotspots — try again"); });
    fetchRewards(eventId)
      .then((rewards) => {
        const targets = rewards.map((r) => r.min_hotspots).filter((n): n is number => n != null);
        setMaxRewardTarget(targets.length ? Math.max(...targets) : null);
      })
      .catch((e) => console.error(e));
    fetchHotspotVisitCounts(eventId)
      .then((c) => { setCounts(c); setCountsFailed(false); })
      .catch((e) => { console.error(e); setCountsFailed(true); });
  }, [eventId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mode === 'search' && allVenues.length === 0) fetchVenues().then(setAllVenues).catch((e) => { console.error(e); setError("Couldn't load places. Try again"); });
  }, [mode, allVenues.length]);

  const taken = useMemo(() => new Set([eventId, ...hotspots.map((h) => h.location_id)]), [eventId, hotspots]);
  const results = allVenues
    .filter((v) => !taken.has(v.id) && !v.is_event && v.lat != null)
    .filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 20);

  const run = (p: Promise<unknown>, msg: string): Promise<boolean> => {
    setBusy(true); setError(null);
    return p.then(() => { load(); return true; })
      .catch((e) => { console.error(e); setError(msg); return false; })
      .finally(() => setBusy(false));
  };

  // Swap positions i and i+dir, then normalize every changed row to its
  // new index so arbitrary stored sort_orders end up 0..n-1.
  const move = (i: number, dir: -1 | 1) => {
    if (!hotspots[i] || !hotspots[i + dir]) return;
    const next = [...hotspots];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    const changed = next.map((h, idx) => ({ h, idx })).filter(({ h, idx }) => h.sort_order !== idx);
    run(Promise.all(changed.map(({ h, idx }) => updateHotspot(h.id, { sort_order: idx }))),
      "Couldn't reorder — try again");
  };

  const saveNew = () => {
    if (!eventId || !pin || !newName.trim()) { setError('Drop a pin and add a name'); return; }
    const radius = parseInt(newRadius, 10);
    run(
      createHotspotPlace(eventId, { name: newName, lat: pin.lat, lng: pin.lng, radius: Number.isNaN(radius) ? 75 : radius, note: newNote }),
      "Couldn't add hotspot — try again"
    ).then((ok) => { if (ok) { setMode('none'); setPin(null); setNewName(''); setNewNote(''); setNewRadius('75'); } });
  };

  const evLat = event?.lat ?? null;
  const evLng = event?.lng ?? null;
  const mapCenter = useMemo(
    () => pin ?? (evLat ? { lat: evLat, lng: evLng as number } : undefined),
    [pin, evLat, evLng],
  );

  if (!eventId) return null;
  if (!event && error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <p role="alert" style={{ color: theme.text, fontFamily: FONT, fontSize: 16, textAlign: 'center' }}>{error}</p>
        <button onClick={() => { setError(null); load(); }} style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Try again</button>
      </div>
    );
  }
  if (!event) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: FONT }}>Loading...</p>
      </div>
    );
  }
  if (!canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <p style={{ color: theme.text, fontFamily: FONT, fontSize: 16, textAlign: 'center' }}>Only this event&apos;s organizers can manage hotspots.</p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: FONT, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Back to app</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, fontFamily: FONT, paddingBottom: 40 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px 8px 4px', borderBottom: `1px solid ${theme.divider}` }}>
        <button onClick={() => router.back()} aria-label="Back" style={iconBtn}><ChevronLeft size={22} color={theme.text} /></button>
        <b style={{ fontSize: 17 }}>Hotspots</b>
        <span style={{ marginLeft: 'auto', color: theme.muted, fontSize: 13, paddingRight: 8 }}>{event?.name}</span>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <button onClick={() => setMode(mode === 'search' ? 'none' : 'search')} aria-expanded={mode === 'search'} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
          fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT,
        }}><Search size={16} aria-hidden /> Add place</button>
        <button onClick={() => setMode(mode === 'new' ? 'none' : 'new')} aria-expanded={mode === 'new'} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${theme.glassHighlight}`, background: 'none', color: theme.text,
          fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT,
        }}><MapPinPlus size={16} aria-hidden /> New place</button>
      </div>

      {error && <p role="alert" style={{ color: theme.accent2, margin: '0 16px 12px', fontSize: 13 }}>{error}</p>}

      {mode === 'search' && (
        <div style={{ margin: '0 16px 16px' }}>
          <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Venue name" aria-label="Search venues" style={inputStyle} />
          {results.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>No matching places. Try New place instead.</p>
          ) : results.map((v) => (
            <button key={v.id} disabled={busy}
              onClick={() => run(addHotspot(eventId, v.id), "Couldn't add hotspot — try again").then((ok) => { if (ok) setMode('none'); })}
              style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', marginTop: 6, padding: '10px 14px',
                borderRadius: 10, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface, color: theme.text, cursor: 'pointer', fontFamily: FONT }}>
              {v.name}{v.city ? ` — ${v.city}` : ''}
            </button>
          ))}
        </div>
      )}

      {mode === 'new' && (
        <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
            <WMap
              locations={pin ? [{
                id: 'new', name: newName || 'New hotspot', description: '', latitude: pin.lat, longitude: pin.lng,
                radius: Number(newRadius) || 75, count: 0, isHot: false,
                hotspot: { stamped: false, eventName: event?.name ?? '', note: null },
              }] : []}
              onLocationSelect={() => {}}
              onMapClick={(lat, lng) => setPin({ lat, lng })}
              center={mapCenter}
              zoom={16}
            />
          </div>
          <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>{pin ? 'Pin dropped. Tap the map to move it.' : 'Tap the map to drop a pin.'}</p>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Place name" aria-label="Place name" style={inputStyle} />
          <input value={newNote} maxLength={140} onChange={(e) => setNewNote(e.target.value)} placeholder="Why go? (optional)" aria-label="Why go" style={inputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.muted }}>
            Check-in radius (m)
            <input type="number" min={10} max={1000} value={newRadius} onChange={(e) => setNewRadius(e.target.value)} style={{ ...inputStyle, width: 90 }} />
          </label>
          <button onClick={saveNew} disabled={busy} style={{
            minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
            fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          }}>{busy ? 'Adding…' : 'Add hotspot'}</button>
        </div>
      )}

      {maxRewardTarget != null && maxRewardTarget > hotspots.length && (
        <p role="status" style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 10, backgroundColor: theme.surface2, fontSize: 13 }}>
          A reward needs {maxRewardTarget} hotspots but this event has {hotspots.length}. Add more or lower the reward target.
        </p>
      )}

      <section aria-label="This event's hotspots" style={{ margin: '0 16px', backgroundColor: theme.surface, borderRadius: 14, border: `1px solid ${theme.divider}` }}>
        {hotspots.length === 0 ? (
          <p style={{ padding: 16, color: theme.muted, fontSize: 14 }}>No hotspots yet. Add a place people should visit.</p>
        ) : hotspots.map((h, i) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 4px 6px 0',
            borderBottom: i < hotspots.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button aria-label={`Move ${h.place?.name ?? 'hotspot'} up`} disabled={busy || i === 0} onClick={() => move(i, -1)} style={iconBtn}><ChevronUp size={16} /></button>
              <button aria-label={`Move ${h.place?.name ?? 'hotspot'} down`} disabled={busy || i === hotspots.length - 1} onClick={() => move(i, 1)} style={iconBtn}><ChevronDown size={16} /></button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{h.place?.name ?? 'Hotspot'}</b>
              <input defaultValue={h.note ?? ''} maxLength={140} placeholder="Why go? (optional)" aria-label={`Note for ${h.place?.name ?? 'hotspot'}`}
                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== h.note) run(updateHotspot(h.id, { note: v }), "Couldn't save note — try again"); }}
                style={{ ...inputStyle, minHeight: 36, padding: '6px 10px', fontSize: 12, marginTop: 4 }} />
              {!countsFailed && (
                <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                  {counts[h.location_id] ?? 0} {(counts[h.location_id] ?? 0) === 1 ? 'person' : 'people'} visited
                </div>
              )}
            </div>
            <button aria-label={`Remove ${h.place?.name ?? 'hotspot'}`} disabled={busy}
              onClick={() => run(removeHotspot(h.id), "Couldn't remove — try again")} style={iconBtn}><X size={18} /></button>
          </div>
        ))}
      </section>
      <p style={{ margin: '10px 16px', color: theme.muted, fontSize: 12 }}>Counts only. You never see who visited.</p>
    </div>
  );
}
