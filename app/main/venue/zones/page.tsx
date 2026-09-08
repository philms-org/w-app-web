'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2, Plus, Navigation } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchVenueZones,
  createVenueZone,
  updateVenueZone,
  deleteVenueZone,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, VenueZone } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';

export default function VenueZonesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueZonesPageInner />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: theme.pill,
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: theme.text,
  fontFamily: 'Montserrat, system-ui, sans-serif',
  width: '100%',
  boxSizing: 'border-box',
};

function VenueZonesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [zones, setZones] = useState<VenueZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editedFields, setEditedFields] = useState<Record<string, { name: string }>>({});

  const { canManage } = useIsOrganizer(venue?.id);

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId)
        .then(setVenue)
        .catch((err) => {
          console.error('Failed to load venue:', err);
          setVenue(null);
        })
        .finally(() => setVenueLoading(false));
      return;
    }

    setVenueLoading(true);
    fetchMyVenues()
      .then((venues) => {
        setMyVenues(venues);
        setSelectedVenueId((current) => current ?? venues[0]?.id ?? null);
        if (venues.length === 0) setVenue(null);
      })
      .catch((err) => {
        console.error('Failed to load venues:', err);
        fetchMyVenue().then(setVenue).catch(() => setVenue(null));
      })
      .finally(() => setVenueLoading(false));
  }, [paramLocationId]);

  useEffect(() => {
    if (paramLocationId || !selectedVenueId) return;
    fetchVenue(selectedVenueId)
      .then(setVenue)
      .catch((err) => {
        console.error('Failed to load selected venue:', err);
        setVenue(null);
      });
  }, [selectedVenueId, paramLocationId]);

  const loadZones = (locationId: string) => {
    setZonesLoading(true);
    fetchVenueZones(locationId)
      .then((rows) => {
        setZones(rows);
        setEditedFields(Object.fromEntries(rows.map((z) => [z.id, { name: z.name }])));
      })
      .catch((err) => {
        console.error('Failed to load zones:', err);
        setError("Couldn't load zones — try again");
      })
      .finally(() => setZonesLoading(false));
  };

  useEffect(() => {
    if (venue) loadZones(venue.id);
  }, [venue]);

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!venue || !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to manage this venue&apos;s zones.
        </p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
          Back to app
        </Link>
      </div>
    );
  }

  const captureLocation = (onSuccess: (lat: number, lng: number) => void) => {
    if (!navigator.geolocation) {
      setError('Location services are not available on this device');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      (err) => {
        console.warn('Location error:', err.code, err.message);
        setError("Couldn't get your location — try again");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  const handleCreate = () => {
    if (!newName.trim() || newLat == null || newLng == null || !venue) return;
    setCreating(true);
    setError(null);
    createVenueZone(venue.id, {
      name: newName.trim(),
      center_lat: newLat,
      center_lng: newLng,
    })
      .then(() => {
        setNewName('');
        setNewLat(null);
        setNewLng(null);
        setShowNew(false);
        loadZones(venue.id);
      })
      .catch((err) => {
        console.error('Failed to create zone:', err);
        setError("Couldn't create zone — try again");
      })
      .finally(() => setCreating(false));
  };

  const handleNameBlur = (zone: VenueZone) => {
    const edited = editedFields[zone.id];
    if (!edited) return;
    const nextName = edited.name.trim() || zone.name;
    if (nextName === zone.name) return;

    setBusyId(zone.id);
    setError(null);
    updateVenueZone(zone.id, { name: nextName })
      .then(() => {
        setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, name: nextName } : z)));
      })
      .catch((err) => {
        console.error('Failed to update zone:', err);
        setError("Couldn't save zone — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleRecenter = (zone: VenueZone) => {
    captureLocation((lat, lng) => {
      setBusyId(zone.id);
      setError(null);
      updateVenueZone(zone.id, { center_lat: lat, center_lng: lng })
        .then(() => {
          setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, center_lat: lat, center_lng: lng } : z)));
        })
        .catch((err) => {
          console.error('Failed to re-center zone:', err);
          setError("Couldn't re-center zone — try again");
        })
        .finally(() => setBusyId(null));
    });
  };

  const handleDelete = (zone: VenueZone) => {
    setBusyId(zone.id);
    setError(null);
    deleteVenueZone(zone.id)
      .then(() => setZones((prev) => prev.filter((z) => z.id !== zone.id)))
      .catch((err) => {
        console.error('Failed to delete zone:', err);
        setError("Couldn't delete zone — try again");
      })
      .finally(() => setBusyId(null));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{ backgroundColor: theme.bg, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.divider}` }}>
        <button onClick={() => router.push('/main')} style={{ padding: '8px', marginLeft: '-8px', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 600, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Manage Zones
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <div style={{ padding: '20px 20px 40px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Define named areas within your venue (e.g. &quot;Bar&quot;, &quot;Dance Floor&quot;) by standing in each area and tapping &quot;Set to my current location.&quot;
        </p>

        {zonesLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading zones...</p>
        ) : zones.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: '20px' }}>
            No zones yet — add one below.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {zones.map((zone) => {
              const isBusy = busyId === zone.id;
              const edited = editedFields[zone.id] ?? { name: zone.name };
              return (
                <div key={zone.id} style={{ backgroundColor: theme.surface, borderRadius: '16px', border: `1px solid ${theme.divider}`, padding: '14px', opacity: isBusy ? 0.6 : 1 }}>
                  <input
                    type="text"
                    value={edited.name}
                    onChange={(e) => setEditedFields((prev) => ({ ...prev, [zone.id]: { name: e.target.value } }))}
                    onBlur={() => handleNameBlur(zone)}
                    disabled={isBusy}
                    placeholder="Zone name"
                    style={{ ...inputStyle, fontWeight: 700, marginBottom: '8px' }}
                  />
                  <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    {zone.center_lat.toFixed(6)}, {zone.center_lng.toFixed(6)}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleRecenter(zone)}
                      disabled={isBusy || locating}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: theme.surface2,
                        color: theme.text,
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isBusy || locating ? 'default' : 'pointer',
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      <Navigation style={{ width: '13px', height: '13px' }} />
                      Re-center here
                    </button>
                    <button onClick={() => handleDelete(zone)} disabled={isBusy} aria-label="Delete zone" style={{ backgroundColor: 'transparent', border: 'none', borderRadius: '9999px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy ? 'default' : 'pointer', marginLeft: 'auto' }}>
                      <Trash2 style={{ width: '16px', height: '16px', color: theme.accent2 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showNew ? (
          <div style={{ backgroundColor: theme.surface, borderRadius: '16px', border: `1px solid ${theme.divider}`, padding: '14px' }}>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Zone name (e.g. Bar)" style={{ ...inputStyle, marginBottom: '8px' }} />

            <button
              onClick={() => captureLocation((lat, lng) => {
                setNewLat(lat);
                setNewLng(lng);
              })}
              disabled={locating}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                backgroundColor: theme.surface2,
                color: theme.text,
                border: 'none',
                borderRadius: '9999px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: locating ? 'default' : 'pointer',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                marginBottom: '10px',
              }}
            >
              <Navigation style={{ width: '14px', height: '14px' }} />
              {locating ? 'Getting location...' : newLat != null ? 'Location captured — tap to update' : 'Set to my current location'}
            </button>

            {newLat != null && newLng != null && (
              <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {newLat.toFixed(6)}, {newLng.toFixed(6)}
              </p>
            )}

            {error && <p style={{ color: theme.accent2, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowNew(false);
                  setNewName('');
                  setNewLat(null);
                  setNewLng(null);
                }}
                style={{ flex: 1, backgroundColor: theme.surface2, color: theme.text, border: 'none', borderRadius: '9999px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || newLat == null || newLng == null}
                style={{ flex: 1, backgroundColor: theme.accent, color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: creating || !newName.trim() || newLat == null || newLng == null ? 'default' : 'pointer', opacity: creating || !newName.trim() || newLat == null || newLng == null ? 0.6 : 1, fontFamily: 'Montserrat, system-ui, sans-serif' }}
              >
                {creating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: theme.accent, color: 'white', borderRadius: '9999px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif' }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Add zone
          </button>
        )}
      </div>
    </div>
  );
}
