'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchVenue } from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import TagCatalogPanel from '@/components/venue/TagCatalogPanel';
import TagAssignPanel from '@/components/venue/TagAssignPanel';

export default function AdminVenueTagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = use(params);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { canManage } = useIsOrganizer(locationId);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchVenue(locationId)
      .then(setVenue)
      .catch((err) => {
        console.error('Failed to load venue:', err);
        setError("Couldn't load this venue — try again");
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to manage this venue&apos;s tags.
        </p>
        <Link
          href="/admin"
          style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to admin
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <Link
          href="/admin"
          style={{ color: theme.accent, fontSize: '13px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', textDecoration: 'none' }}
        >
          Back to admin
        </Link>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          marginTop: '8px',
        }}>
          Manage Tags{venue ? ` — ${venue.name}` : ''}
        </h1>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <TagCatalogPanel
          locationId={locationId}
          onCatalogChange={() => setCatalogRefresh((n) => n + 1)}
        />
        <TagAssignPanel locationId={locationId} refreshKey={catalogRefresh} />
      </div>
    </div>
  );
}
