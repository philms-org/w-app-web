'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { theme } from '@/lib/theme';
import {
  EVENT_ROLES,
  fetchEventTrackingSummary,
  type EventTrackingSummary,
} from '@/lib/eventTracking';
import { fetchEventOutcomes, type EventOutcomes } from '@/lib/eventOutcomes';

const font = 'Montserrat, system-ui, sans-serif';

// Report card for the 0046 tracking: attendees without staff, who was in the
// room each day, the room's role mix and how far each carousel slide reached.
export default function EventTrackingCard({ locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<EventTrackingSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setFailed(false);
    fetchEventTrackingSummary(locationId)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch((err) => {
        console.error('Failed to load event tracking:', err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [locationId]);

  // Pitches, judging, survey and tickets (0047).
  const [outcomes, setOutcomes] = useState<EventOutcomes | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOutcomes(null);
    fetchEventOutcomes(locationId)
      .then((o) => { if (!cancelled) setOutcomes(o); })
      .catch((err) => console.error('Failed to load event outcomes:', err));
    return () => { cancelled = true; };
  }, [locationId]);

  const editHref = `/main/venue/edit?locationId=${locationId}`;
  const membersHref = `/main/venue/members?locationId=${locationId}`;

  const sub: React.CSSProperties = { fontSize: '11px', color: theme.muted, margin: '14px 0 6px', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
  const note: React.CSSProperties = { fontSize: '13px', color: theme.muted, margin: 0, fontFamily: font };
  const linkStyle: React.CSSProperties = { color: theme.accent, fontWeight: 600, textDecoration: 'none' };

  const rolesAnswered = summary ? Object.values(summary.roles).reduce((a, b) => a + (b ?? 0), 0) : 0;
  const maxDay = summary ? Math.max(1, ...summary.presence_days.map((d) => d.people)) : 1;

  return (
    <div style={{ backgroundColor: theme.surface, borderRadius: '16px', border: `1px solid ${theme.divider}`, padding: '16px', marginBottom: '16px', fontFamily: font }}>
      <h2 style={{ fontSize: '14px', fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
        Event tracking
      </h2>

      {failed && <p style={note}>Couldn&apos;t load event tracking. Reopen the report to try again.</p>}
      {!failed && !summary && <p style={note}>Loading…</p>}

      {summary && (
        <>
          {!summary.dates_set && (
            <p style={{ ...note, color: theme.text, padding: '10px 12px', borderRadius: '12px', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`, marginBottom: '12px' }}>
              No event dates set. <Link href={editHref} style={linkStyle}>Add them in Edit Info</Link> so check-ins last the whole event.
            </p>
          )}

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{summary.attendees}</div>
              <div style={note}>attendees (staff not counted)</div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{summary.staff}</div>
              <div style={note}><Link href={membersHref} style={linkStyle}>staff marked</Link></div>
            </div>
          </div>

          <p style={sub}>In the room each day</p>
          {summary.presence_days.length === 0 ? (
            <p style={note}>Nobody yet. People count once per day while checked in and inside the venue.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {summary.presence_days.map((d) => (
                <div key={d.day} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 32px', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: theme.text }}>
                    {new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ height: '10px', borderRadius: '5px', backgroundColor: theme.surface2 }}>
                    <div style={{ width: `${(d.people / maxDay) * 100}%`, height: '100%', borderRadius: '5px', backgroundColor: theme.accent }} />
                  </div>
                  <span style={{ fontSize: '13px', color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.people}</span>
                </div>
              ))}
            </div>
          )}

          <p style={sub}>Roles {rolesAnswered > 0 && `· ${rolesAnswered} of ${summary.attendees} answered`}</p>
          {!summary.ask_event_role && rolesAnswered === 0 ? (
            <p style={note}>
              Not asking yet. <Link href={editHref} style={linkStyle}>Turn on the role question</Link> to see your developer, designer and business mix.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {EVENT_ROLES.map(({ value, label }) => (
                <span key={value} style={{ fontSize: '13px', color: theme.text, padding: '6px 10px', borderRadius: '999px', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}` }}>
                  {label} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{summary.roles[value] ?? 0}</strong>
                </span>
              ))}
            </div>
          )}

          <p style={sub}>Carousel slides · unique people</p>
          {summary.slides.length === 0 ? (
            <p style={note}>No slides uploaded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {summary.slides.map((s, i) => (
                <div key={s.banner_id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '10px', alignItems: 'center', opacity: s.is_active ? 1 : 0.55 }}>
                  <div
                    role="img"
                    aria-label={`Slide ${i + 1}`}
                    style={{ width: '64px', height: '43px', borderRadius: '8px', backgroundColor: '#000', backgroundImage: `url(${s.image_url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
                  />
                  <span style={{ fontSize: '13px', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
                    Slide {i + 1}{!s.is_active && ' (hidden)'} · <strong>{s.viewers}</strong> saw it · <strong>{s.tappers}</strong> opened the link
                  </span>
                </div>
              ))}
            </div>
          )}

          {outcomes && (
            <>
              <p style={sub}>Pitches and judging</p>
              <p style={note}>
                <Link href={`/main/venue/pitches?locationId=${locationId}`} style={linkStyle}>
                  {outcomes.pitches} {outcomes.pitches === 1 ? 'pitch' : 'pitches'} · {outcomes.votes} votes
                </Link>
                {' · '}
                <Link href={`/main/venue/judging?locationId=${locationId}`} style={linkStyle}>
                  {outcomes.teams_scored} {outcomes.teams_scored === 1 ? 'team' : 'teams'} scored by {outcomes.judges} {outcomes.judges === 1 ? 'judge' : 'judges'}
                </Link>
              </p>

              <p style={sub}>After the event</p>
              {outcomes.survey.answered + outcomes.survey.skipped === 0 ? (
                <p style={note}>
                  {summary.dates_set
                    ? 'The survey goes out the first time attendees open the app after your last day.'
                    : 'The survey needs event dates to know when the event ends.'}
                </p>
              ) : (
                <p style={{ ...note, color: theme.text }}>
                  {outcomes.survey.nps !== null && <>Recommend score <strong>{outcomes.survey.nps > 0 ? '+' : ''}{outcomes.survey.nps}</strong> from {outcomes.survey.nps_responses} · </>}
                  {outcomes.survey.answered} answered, {outcomes.survey.skipped} skipped ·{' '}
                  <strong>{outcomes.survey.still_going}</strong> say their team is still going
                  {outcomes.survey.answered_30 > 0 && <> (<strong>{outcomes.survey.still_going_30}</strong> at 30 days)</>}
                </p>
              )}

              <p style={sub}>Ticket list</p>
              <p style={note}>
                <Link href={`/main/venue/tickets?locationId=${locationId}`} style={linkStyle}>
                  {outcomes.tickets > 0 ? `${outcomes.tickets} tickets imported · see who showed up` : 'Upload your ticket CSV to see who showed up'}
                </Link>
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
