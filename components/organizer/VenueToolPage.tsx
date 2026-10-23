'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';

const font = 'Montserrat, system-ui, sans-serif';

interface VenueToolPageProps {
  title: string;
  // Organizers always get in. `allowed` lets others in too (judges on the
  // judging page): null while still checking. The server re-checks either way.
  allowed?: boolean | null;
  children: (locationId: string) => React.ReactNode;
}

// Shell for the 0047 event tools (?locationId=…): back button, title,
// organizer gate.
export default function VenueToolPage(props: VenueToolPageProps) {
  return (
    <Suspense fallback={<Centered text="Loading…" />}>
      <Inner {...props} />
    </Suspense>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <p style={{ color: theme.muted, fontFamily: font, textAlign: 'center' }}>{text}</p>
    </div>
  );
}

export function useToolLocationId(): string {
  return useSearchParams().get('locationId') ?? '';
}

function Inner({ title, allowed = false, children }: VenueToolPageProps) {
  const router = useRouter();
  const locationId = useToolLocationId();
  const { canManage, resolved } = useIsOrganizer(locationId || null);

  if (!locationId) return <Centered text="Open this from the organizer tools." />;
  if (!resolved || (!canManage && allowed === null)) return <Centered text="Loading…" />;
  if (!canManage && !allowed) return <Centered text="Organizer access required." />;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: font }}>
      <div style={{
        padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, color: theme.text }}
        >
          <ChevronLeft style={{ width: 24, height: 24 }} />
        </button>
        <h1 style={{ flex: 1, fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</h1>
      </div>
      <div style={{ padding: 20, paddingBottom: 100, maxWidth: 560 }}>
        {children(locationId)}
      </div>
    </div>
  );
}
