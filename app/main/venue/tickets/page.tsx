'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import VenueToolPage from '@/components/organizer/VenueToolPage';
import { theme } from '@/lib/theme';
import {
  clearTickets,
  fetchTicketMatch,
  importTickets,
  ticketRowsFromCsv,
  type TicketMatch,
} from '@/lib/eventOutcomes';

const font = 'Montserrat, system-ui, sans-serif';

export default function TicketsPage() {
  return (
    <VenueToolPage title="Ticket list">
      {(locationId) => <TicketsView locationId={locationId} />}
    </VenueToolPage>
  );
}

// Ticket list vs W accounts (0047). The CSV is read in the browser; only
// email + name go to the server, matched to sign-in emails, and deleted 30
// days after the event.
function TicketsView({ locationId }: { locationId: string }) {
  const [match, setMatch] = useState<TicketMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNotJoined, setShowNotJoined] = useState(false);
  const [showNoTicket, setShowNoTicket] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    fetchTicketMatch(locationId)
      .then((m) => { setMatch(m); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the ticket match."));
  }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const rows = ticketRowsFromCsv(await file.text());
      if (rows.length === 0) {
        setError("Couldn't find an email column in that file. Export the attendee list as CSV and try again.");
        return;
      }
      const n = await importTickets(locationId, rows);
      setStatus(`Imported ${n} tickets.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import the ticket list.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyEmails = async () => {
    const text = (match?.not_joined ?? []).map((r) => r.email).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${match?.not_joined.length ?? 0} emails.`);
    } catch {
      setShowNotJoined(true);
      setTimeout(() => listRef.current?.select(), 0);
      setStatus('Select the emails below and copy them.');
    }
  };

  const card: React.CSSProperties = { padding: 12, borderRadius: 14, backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, display: 'flex', alignItems: 'center', gap: 10 };
  const btn: React.CSSProperties = { minHeight: 40, padding: '0 14px', borderRadius: 12, fontFamily: font, fontWeight: 700, fontSize: 13, cursor: 'pointer', backgroundColor: 'transparent', color: theme.text, border: `1px solid ${theme.divider}`, whiteSpace: 'nowrap' };
  const hasList = !!match && match.tickets > 0;
  const showUp = match && match.tickets > 0 ? Math.round((100 * match.checked_in) / match.tickets) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: font }}>
      <label
        htmlFor="ticket-csv"
        style={{ position: 'relative', border: `1.5px dashed ${theme.divider}`, borderRadius: 14, padding: 16, textAlign: 'center', color: theme.muted, cursor: busy ? 'default' : 'pointer' }}
      >
        <span style={{ display: 'block', color: theme.text, fontWeight: 700, fontSize: 14 }}>
          {busy ? 'Importing…' : hasList ? 'Replace ticket list (CSV)' : 'Upload your Eventbrite or ticket CSV'}
        </span>
        <span style={{ fontSize: 12 }}>Needs an email column. Nothing is sent to anyone. Emails are deleted 30 days after the event.</span>
        <input
          ref={fileRef}
          id="ticket-csv"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />
      </label>

      {error && <p role="alert" style={{ color: theme.accent, fontSize: 13, margin: 0 }}>{error}</p>}
      {status && <p role="status" style={{ color: theme.text, fontSize: 13, margin: 0 }}>{status}</p>}

      {match && !hasList && <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>No ticket list yet.</p>}

      {match && hasList && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {([[match.tickets, 'tickets'], [match.in_w, 'in W'], [match.tickets - match.in_w, 'not yet']] as const).map(([n, label]) => (
              <div key={label} style={{ ...card, flexDirection: 'column', gap: 0, alignItems: 'center' }}>
                <span style={{ color: theme.text, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ color: theme.muted, fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme.text, fontWeight: 700, fontSize: 14 }}>{match.not_joined.length} haven&apos;t joined W</div>
              <div style={{ color: theme.muted, fontSize: 12 }}>Copy their emails to send your invite link</div>
            </div>
            {match.not_joined.length > 0 && <button type="button" onClick={copyEmails} style={btn}>Copy</button>}
            {match.not_joined.length > 0 && (
              <button type="button" onClick={() => setShowNotJoined((v) => !v)} aria-expanded={showNotJoined} style={btn}>
                {showNotJoined ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
          {showNotJoined && (
            <textarea
              ref={listRef}
              readOnly
              aria-label="Emails of ticket holders who haven't joined W"
              rows={Math.min(8, match.not_joined.length + 1)}
              value={match.not_joined.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join('\n')}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`, borderRadius: 10, padding: 8, color: theme.text, fontFamily: font, fontSize: 12 }}
            />
          )}

          <div style={card}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme.text, fontWeight: 700, fontSize: 14 }}>{match.checked_in} checked in on site</div>
              <div style={{ color: theme.muted, fontSize: 12 }}>{match.tickets - match.checked_in} ticket holders haven&apos;t arrived</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, backgroundColor: theme.surface2, color: theme.text }}>{showUp}%</span>
          </div>

          <div style={card}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme.text, fontWeight: 700, fontSize: 14 }}>{match.no_ticket.length} in W without a ticket</div>
              <div style={{ color: theme.muted, fontSize: 12 }}>Walk-ins or guests. People marked as staff aren&apos;t counted.</div>
            </div>
            {match.no_ticket.length > 0 && (
              <button type="button" onClick={() => setShowNoTicket((v) => !v)} aria-expanded={showNoTicket} style={btn}>
                {showNoTicket ? 'Hide' : 'Review'}
              </button>
            )}
          </div>
          {showNoTicket && (
            <ul style={{ margin: 0, paddingLeft: 18, color: theme.text, fontSize: 13 }}>
              {match.no_ticket.map((n, i) => <li key={i}>{n ?? 'Someone'}</li>)}
            </ul>
          )}

          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              try { await clearTickets(locationId); setStatus('Ticket list deleted.'); load(); }
              catch (err) { setError(err instanceof Error ? err.message : "Couldn't clear the ticket list."); }
              finally { setBusy(false); }
            }}
            disabled={busy}
            style={{ ...btn, alignSelf: 'flex-start', marginTop: 6 }}
          >
            Delete ticket list now
          </button>
        </>
      )}
    </div>
  );
}
