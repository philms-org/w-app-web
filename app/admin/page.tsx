'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchVenues, fetchProfile } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Profile } from '@/lib/types';

interface VenueRow {
  venue: Venue;
  organizer: Profile | null;
}

export default function AdminPage() {
  const [rows, setRows] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchVenues()
      .then(async (venues) => {
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
        if (!cancelled) setRows(withOrganizers);
      })
      .catch((err) => {
        console.error('Failed to load venues:', err);
        if (!cancelled) setError("Couldn't load venues — try again");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        }}>Manage any venue&apos;s banners and verification tags.</p>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading venues...</p>
        ) : rows.length === 0 ? (
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

                <p style={{
                  color: theme.muted,
                  fontSize: '13px',
                  marginTop: '6px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}>
                  Organizer: {organizer ? organizer.display_name : 'No organizer assigned'}
                </p>

                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <Link
                    href={`/main/venue/carousel?locationId=${venue.id}`}
                    style={{
                      color: theme.accent,
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      textDecoration: 'none',
                    }}
                  >
                    Manage Carousel
                  </Link>
                  <Link
                    href={`/admin/venue/${venue.id}/tags`}
                    style={{
                      color: theme.accent,
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      textDecoration: 'none',
                    }}
                  >
                    Manage Tags
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
