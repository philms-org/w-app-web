'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Send, Users } from 'lucide-react';
import { fetchVenue, fetchVenueMembers, sendVenueBroadcast, fetchTeams, fetchCheckedInUserIds } from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import type { Venue, VenueMember, TeamWithMembers } from '@/lib/types';

export default function VenueMessagePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading…</p>
        </div>
      }
    >
      <VenueMessagePageInner />
    </Suspense>
  );
}

type FilterKey = 'all' | 'min3' | 'min5' | 'min10' | 'min20';
type AudienceMode = 'visits' | 'teams' | 'noteam';

const FILTERS: { key: FilterKey; label: string; minVisits?: number }[] = [
  { key: 'all', label: 'All members' },
  { key: 'min3', label: '3+ visits', minVisits: 3 },
  { key: 'min5', label: '5+ visits', minVisits: 5 },
  { key: 'min10', label: '10+ visits', minVisits: 10 },
  { key: 'min20', label: '20+ visits', minVisits: 20 },
];

function VenueMessagePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') ?? '';

  const [venue, setVenue] = useState<Venue | null>(null);
  const [members, setMembers] = useState<VenueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [mode, setMode] = useState<AudienceMode>('visits');
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<string[]>([]);
  const [pickedTeams, setPickedTeams] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { canManage } = useIsOrganizer(locationId || null);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    Promise.all([
      fetchVenue(locationId),
      fetchVenueMembers(locationId),
      fetchTeams(locationId).catch(() => [] as TeamWithMembers[]),
      fetchCheckedInUserIds(locationId).catch(() => [] as string[]),
    ])
      .then(([v, m, t, ids]) => {
        setVenue(v);
        setMembers(m);
        setTeams(t);
        setCheckedInIds(ids);
      })
      .catch((err) => {
        console.error('Failed to load venue/members:', err);
        setError("Couldn't load venue data");
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  const selectedFilter = FILTERS.find((f) => f.key === filter)!;
  const visitTargets = selectedFilter.minVisits
    ? members.filter((m) => m.checkinCount >= selectedFilter.minVisits!)
    : members;

  // Who will actually receive this, for each audience mode.
  const teamMemberIds = new Set(teams.flatMap((t) => t.members.map((m) => m.user_id)));
  const teamTargetIds = Array.from(
    new Set(teams.filter((t) => pickedTeams.has(t.id)).flatMap((t) => t.members.map((m) => m.user_id))),
  );
  const noTeamTargetIds = checkedInIds.filter((id) => !teamMemberIds.has(id));
  const targets: { length: number } =
    mode === 'teams' ? teamTargetIds : mode === 'noteam' ? noTeamTargetIds : visitTargets;
  const teamCount = pickedTeams.size;
  const toggleTeam = (id: string) =>
    setPickedTeams((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSend = async () => {
    if (!venue || !message.trim() || targets.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const count = await sendVenueBroadcast(
        locationId,
        venue.name,
        message.trim(),
        mode === 'visits'
          ? { minVisits: selectedFilter.minVisits }
          : { recipientIds: mode === 'teams' ? teamTargetIds : noTeamTargetIds }
      );
      setSent(count);
      setMessage('');
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      setError("Couldn't send the message — try again");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: theme.surface2,
    border: `1px solid ${theme.divider}`,
    borderRadius: '12px',
    padding: '12px 14px',
    color: theme.text,
    fontSize: '15px',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    resize: 'vertical' as const,
    minHeight: '120px',
    boxSizing: 'border-box' as const,
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: '9999px',
    border: `1px solid ${active ? theme.accent : theme.divider}`,
    backgroundColor: active ? theme.accent : theme.surface2,
    color: active ? theme.onAccent : theme.text,
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'Montserrat, system-ui, sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  });

  if (!canManage && !loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '12px' }}>
        <p style={{ color: theme.text, fontSize: '16px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', textAlign: 'center' }}>
          Organizer access required
        </p>
        <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif', textAlign: 'center' }}>
          Only the venue organizer or a master admin can send mass messages.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: theme.text }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: theme.text }}>Mass Message</h1>
          {venue && <p style={{ fontSize: '12px', color: theme.muted, marginTop: '1px' }}>{venue.name}</p>}
        </div>
      </div>

      <div style={{ padding: '20px', paddingBottom: '100px', maxWidth: '520px' }}>
        {loading ? (
          <p style={{ color: theme.muted }}>Loading…</p>
        ) : (
          <>
            {sent !== null ? (
              <div style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.divider}`,
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
              }}>
                <Send style={{ width: '32px', height: '32px', color: theme.accent, margin: '0 auto 12px' }} />
                <p style={{ fontSize: '16px', fontWeight: 700, color: theme.text, marginBottom: '6px' }}>
                  Message sent to {sent} {sent === 1 ? 'person' : 'people'}
                </p>
                <p style={{ fontSize: '13px', color: theme.muted, marginBottom: '20px' }}>
                  They&apos;ll see it as a group message in their Messages tab.
                </p>
                <button
                  onClick={() => setSent(null)}
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.onAccent,
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                  }}
                >
                  Send Another
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Audience
                  </p>
                  <div role="group" aria-label="Audience type" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <button onClick={() => setMode('visits')} aria-pressed={mode === 'visits'} style={chipStyle(mode === 'visits')}>Everyone</button>
                    <button onClick={() => setMode('teams')} aria-pressed={mode === 'teams'} style={chipStyle(mode === 'teams')}>Teams</button>
                    <button onClick={() => setMode('noteam')} aria-pressed={mode === 'noteam'} style={chipStyle(mode === 'noteam')}>No team yet</button>
                  </div>
                  {mode === 'visits' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {FILTERS.map((f) => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={chipStyle(filter === f.key)}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {mode === 'noteam' && (
                    <p style={{ fontSize: '13px', color: theme.muted }}>
                      People checked in right now who haven&apos;t joined a team.
                    </p>
                  )}
                  {mode === 'teams' && (
                    <div>
                      {teams.length === 0 ? (
                        <p style={{ fontSize: '13px', color: theme.muted }}>No teams have been created here yet.</p>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                            <button onClick={() => setPickedTeams(new Set(teams.map((t) => t.id)))} style={chipStyle(false)}>Select all</button>
                            <button onClick={() => setPickedTeams(new Set())} style={chipStyle(false)}>Clear</button>
                          </div>
                          {teams.map((t) => (
                            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '52px', borderTop: `1px solid ${theme.divider}`, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={pickedTeams.has(t.id)}
                                onChange={() => toggleTeam(t.id)}
                                style={{ width: '22px', height: '22px', accentColor: theme.accent }}
                              />
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: theme.text }}>{t.name}</span>
                                <span style={{ display: 'block', fontSize: '12.5px', color: theme.muted }}>
                                  {t.members.length} {t.members.length === 1 ? 'person' : 'people'}
                                </span>
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                    <Users style={{ width: '14px', height: '14px', color: theme.muted }} />
                    <p style={{ fontSize: '13px', color: theme.muted }}>
                      {targets.length} {targets.length === 1 ? 'person' : 'people'} will receive this{mode === 'teams' && teamCount > 0 ? ` on ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}` : ''}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Message
                  </p>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message to members…"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: theme.muted, marginTop: '6px' }}>
                    Recipients will see this as a group message in their Messages tab.
                  </p>
                </div>

                {error && (
                  <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '12px' }}>{error}</p>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim() || targets.length === 0}
                  style={{
                    width: '100%',
                    backgroundColor: theme.accent,
                    color: theme.onAccent,
                    border: 'none',
                    borderRadius: '14px',
                    padding: '14px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: sending || !message.trim() || targets.length === 0 ? 'default' : 'pointer',
                    opacity: sending || !message.trim() || targets.length === 0 ? 0.5 : 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Send style={{ width: '18px', height: '18px' }} />
                  {sending ? 'Sending…' : `Send to ${targets.length} ${targets.length === 1 ? 'person' : 'people'}${mode === 'teams' && teamCount > 0 ? ` on ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}` : ''}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
