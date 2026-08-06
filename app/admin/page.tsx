'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchVenues, fetchProfile, fetchAllProfiles, setMasterAdmin, assignVenueOwner } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Profile } from '@/lib/types';

interface VenueRow {
  venue: Venue;
  organizer: Profile | null;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: theme.surface2,
  border: `1px solid ${theme.divider}`,
  borderRadius: '10px',
  padding: '8px 12px',
  color: theme.text,
  fontSize: '13px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

const linkButtonStyle: React.CSSProperties = {
  color: theme.accent,
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'Montserrat, system-ui, sans-serif',
  textDecoration: 'none',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

function PersonPicker({
  people,
  onPick,
  placeholder,
}: {
  people: Profile[];
  onPick: (person: Profile) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => p.display_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, people]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: theme.surface2,
          border: `1px solid ${theme.divider}`,
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 10,
        }}>
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onPick(p);
                setQuery('');
              }}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              {p.display_name} {p.email ? `— ${p.email}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [rows, setRows] = useState<VenueRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [masterAdmins, setMasterAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchVenues(), fetchAllProfiles()])
      .then(async ([venues, profiles]) => {
        const withOrganizers = await Promise.all(
          venues.map(async (venue) => {
            if (!venue.owner_id) return { venue, organizer: null };
            try {
              const organizer = await fetchProfile(venue.owner_id);
              return { venue, organizer };
            } catch (err) {
              console.error(`Failed to load organizer for venue ${venue.id}:`, err);
              return { venue, organizer: null };
            }
          })
        );
        setRows(withOrganizers);
        setAllProfiles(profiles);
        setMasterAdmins(profiles.filter((p) => p.is_master_admin));
      })
      .catch((err) => {
        console.error('Failed to load admin data:', err);
        setError("Couldn't load venues/profiles — try again");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGrantAdmin = (person: Profile) => {
    setBusy(person.id);
    setError(null);
    setMasterAdmin(person.id, true)
      .then(load)
      .catch((err) => {
        console.error('Failed to grant master admin:', err);
        setError("Couldn't grant master admin — try again");
      })
      .finally(() => setBusy(null));
  };

  const handleRevokeAdmin = (person: Profile) => {
    setBusy(person.id);
    setError(null);
    setMasterAdmin(person.id, false)
      .then(load)
      .catch((err) => {
        console.error('Failed to revoke master admin:', err);
        setError("Couldn't revoke master admin — try again");
      })
      .finally(() => setBusy(null));
  };

  const handleAssignOwner = (venue: Venue, person: Profile) => {
    setBusy(venue.id);
    setError(null);
    assignVenueOwner(venue.id, person.id)
      .then(load)
      .catch((err) => {
        console.error('Failed to assign venue owner:', err);
        setError("Couldn't assign organizer — try again");
      })
      .finally(() => setBusy(null));
  };

  const handleRemoveOwner = (venue: Venue) => {
    setBusy(venue.id);
    setError(null);
    assignVenueOwner(venue.id, null)
      .then(load)
      .catch((err) => {
        console.error('Failed to remove venue owner:', err);
        setError("Couldn't remove organizer — try again");
      })
      .finally(() => setBusy(null));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>W Staff Admin</h1>
        <p style={{
          fontSize: '13px',
          color: theme.muted,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          marginTop: '4px',
        }}>Manage any venue&apos;s banners and verification tags, and govern who has organizer/admin access.</p>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        ) : (
          <>
            {/* Governance: master admins */}
            <div style={{
              backgroundColor: theme.surface,
              borderRadius: '16px',
              border: `1px solid ${theme.divider}`,
              padding: '16px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.muted,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                marginBottom: '10px',
              }}>Master Admins</p>

              {masterAdmins.length === 0 ? (
                <p style={{ color: theme.muted, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: '10px' }}>
                  No one else has master admin access yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {masterAdmins.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ flex: 1, color: theme.text, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                        {p.display_name} {p.email ? `— ${p.email}` : ''}
                      </span>
                      <button
                        onClick={() => handleRevokeAdmin(p)}
                        disabled={busy === p.id}
                        style={{ ...linkButtonStyle, color: theme.accent2 }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: '6px' }}>
                Grant master admin to:
              </p>
              <PersonPicker people={allProfiles} onPick={handleGrantAdmin} placeholder="Search by name or email…" />
            </div>

            {/* Venues + organizer assignment */}
            {rows.length === 0 ? (
              <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>No venues found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rows.map(({ venue, organizer }) => (
                  <div
                    key={venue.id}
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: '16px',
                      border: `1px solid ${theme.divider}`,
                      padding: '16px',
                    }}
                  >
                    <p style={{
                      color: theme.text,
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                    }}>{venue.name}</p>

                    {(venue.address || venue.city) && (
                      <p style={{
                        color: theme.muted,
                        fontSize: '13px',
                        marginTop: '2px',
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}>
                        {[venue.address, venue.city].filter(Boolean).join(', ')}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <p style={{
                        color: theme.muted,
                        fontSize: '13px',
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                        margin: 0,
                      }}>
                        Organizer: {organizer ? organizer.display_name : 'No organizer assigned'}
                      </p>
                      {organizer && (
                        <button
                          onClick={() => handleRemoveOwner(venue)}
                          disabled={busy === venue.id}
                          style={{ ...linkButtonStyle, fontSize: '12px', color: theme.accent2 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', maxWidth: '360px' }}>
                      <PersonPicker
                        people={allProfiles}
                        onPick={(person) => handleAssignOwner(venue, person)}
                        placeholder="Assign a different organizer…"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                      <Link href={`/main/venue/carousel?locationId=${venue.id}`} style={linkButtonStyle}>
                        Manage Carousel
                      </Link>
                      <Link href={`/admin/venue/${venue.id}/tags`} style={linkButtonStyle}>
                        Manage Tags
                      </Link>
                      <Link href={`/main/venue/report?locationId=${venue.id}`} style={linkButtonStyle}>
                        View Report
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
