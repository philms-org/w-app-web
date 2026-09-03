'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { getCurrentUserId } from '@/lib/auth';
import { fetchConnection, fetchProfile, fetchContactMethods, recordContactMethodChoice } from '@/lib/data';
import type { ContactMethod } from '@/lib/types';
import { Check } from 'lucide-react';

export default function ConnectResult({ connectionId }: { connectionId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [conn, uid] = await Promise.all([fetchConnection(connectionId), getCurrentUserId()]);
        if (cancelled || !conn || !uid) return;
        setPlace(conn.place_label);
        setScannedAt(conn.scanned_at);
        // This screen only ever renders for the scanner today (it's mounted
        // from the scan page). The scannee branch is defensive — note that
        // record_contact_method_choice (migration 0015) is scanner-only, so
        // the chooser below would be a silent no-op if a scannee ever saw it.
        const otherId = conn.scanner_id === uid ? conn.scannee_id : conn.scanner_id;
        const [profile, contactMethods] = await Promise.all([
          fetchProfile(otherId),
          fetchContactMethods(otherId),
        ]);
        if (cancelled) return;
        setName(profile?.display_name ?? null);
        setMethods(contactMethods.filter((m) => m.is_enabled));
      } catch {
        // The connection already exists — a load failure here is not a
        // "connection failed" and must not read like one.
        if (!cancelled) setMethods([]);
      }
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  const choose = (type: string) => {
    setChosen(type);
    // Best-effort analytics write.
    recordContactMethodChoice(connectionId, type).catch(() => {});
  };

  const dateLine = scannedAt
    ? new Date(scannedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{ padding: '8px 20px 32px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '9999px', backgroundColor: theme.green,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 14px',
      }}>
        <Check style={{ width: '28px', height: '28px', color: 'white' }} />
      </div>

      <h2 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
        Connected with {name ?? 'them'}
      </h2>
      <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '22px' }}>
        {place ? `Connected near ${place}` : dateLine ? `Connected · ${dateLine}` : 'Connected'}
      </p>

      {methods.length > 0 && (
        <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '12px' }}>
          How do you want to stay in touch?
        </p>
      )}

      {methods.map((m) => (
        <button
          key={m.id}
          onClick={() => choose(m.type)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px', marginBottom: '10px',
            backgroundColor: chosen === m.type ? theme.accent : theme.surface,
            color: chosen === m.type ? 'white' : theme.text,
            border: `1px solid ${theme.divider}`, borderRadius: '12px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          <span style={{ textTransform: 'capitalize' }}>{m.type}</span>
          <span style={{ opacity: 0.7, fontWeight: 400 }}>{m.value ?? ''}</span>
        </button>
      ))}

      {chosen && (
        <p style={{ color: theme.muted, fontSize: '12px', marginTop: '10px' }}>Saved.</p>
      )}
    </div>
  );
}
