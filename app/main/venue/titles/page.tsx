'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme, type as typeTokens } from '@/lib/theme';
import TagCatalogPanel from '@/components/venue/TagCatalogPanel';
import TagAssignPanel from '@/components/venue/TagAssignPanel';

function Inner() {
  const router = useRouter();
  const locationId = useSearchParams().get('locationId') ?? '';
  const { canManage } = useIsOrganizer(locationId || null);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Manage Titles</h1>
      </div>

      <div style={{ padding: '8px 20px 48px', maxWidth: 520, margin: '0 auto' }}>
        {!locationId ? (
          <p style={{ color: theme.muted }}>No venue selected.</p>
        ) : !canManage ? (
          <p style={{ color: theme.muted }}>You&apos;re not authorized to manage this venue&apos;s titles.</p>
        ) : (
          <>
            <TagCatalogPanel
              locationId={locationId}
              onCatalogChange={() => setCatalogRefresh((n) => n + 1)}
            />
            <TagAssignPanel locationId={locationId} refreshKey={catalogRefresh} />
          </>
        )}
      </div>
    </div>
  );
}

export default function VenueTitlesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: theme.bg }} />}>
      <Inner />
    </Suspense>
  );
}
