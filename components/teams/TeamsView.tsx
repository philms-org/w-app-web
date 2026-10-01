'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users, KeyRound } from 'lucide-react';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';
import { fetchProfile, fetchTeams, joinTeamByCode, requestToJoinTeam } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import type { Profile, TeamNeed, TeamWithMembers } from '@/lib/types';
import { CreateTeamSheet, TeamDetailSheet, NEED_LABEL } from './TeamSheets';

type Filter = 'all' | TeamNeed;

// The "Teams" side of the People / Teams switch on the checked-in Home.
// Everything written here goes through RPCs that enforce the rules (one team
// per person per event, size limit, owner-only changes, must be checked in).
export default function TeamsView({
  locationId,
  myUserId,
  roomProfiles,
  checkedIn,
  myAffiliation: affiliationProp,
}: {
  locationId: string;
  myUserId: string | undefined;
  roomProfiles: Profile[];
  checkedIn: boolean;
  myAffiliation?: string | null;
}) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamWithMembers | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [ownAffiliation, setOwnAffiliation] = useState<string | null>(null);
  const myAffiliation = affiliationProp ?? ownAffiliation;

  // The sign-up "Team idea or company" answer is stored as affiliation.
  useEffect(() => {
    if (!myUserId) return;
    fetchProfile(myUserId).then((p) => setOwnAffiliation(p.affiliation?.[0] ?? null)).catch(() => {});
  }, [myUserId]);

  const load = useCallback(() => {
    fetchTeams(locationId)
      .then((t) => { setTeams(t); setError(null); })
      .catch((e) => { console.error('Failed to load teams:', e); setError('Couldn’t load teams. Try again in a moment.'); })
      .finally(() => setLoaded(true));
  }, [locationId]);

  // Fires once on subscribe, then on any change, tab focus, and a 30s backstop.
  useTableSubscription({ table: 'teams', filter: `location_id=eq.${locationId}`, onEvent: load });
  useTableSubscription({ table: 'team_members', filter: `location_id=eq.${locationId}`, onEvent: load });

  // Team link / QR lands on /main?teamCode=ABC123. Read it once, then clean the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const c = url.searchParams.get('teamCode');
    if (!c) return;
    setPendingCode(c.toUpperCase().slice(0, 12));
    url.searchParams.delete('teamCode');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, []);

  const myTeam = useMemo(
    () => teams.find((t) => t.members.some((m) => m.user_id === myUserId)) ?? null,
    [teams, myUserId],
  );
  const takenIds = useMemo(() => new Set(teams.flatMap((t) => t.members.map((m) => m.user_id))), [teams]);
  const needCounts = useMemo(() => {
    const c = new Map<TeamNeed, number>();
    for (const t of teams) {
      if (t.members.length >= t.max_size) continue;
      for (const n of t.needs) c.set(n, (c.get(n) ?? 0) + 1);
    }
    return c;
  }, [teams]);

  const visible = teams.filter((t) => filter === 'all' || (t.needs.includes(filter) && t.members.length < t.max_size));
  const openTeam = teams.find((t) => t.id === openId) ?? null;
  const suggestion = !myTeam && myAffiliation
    ? teams.find((t) => t.name.trim().toLowerCase() === myAffiliation.trim().toLowerCase() && t.members.length < t.max_size)
    : undefined;

  const joinWith = async (c: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await joinTeamByCode(c);
      setCode(''); setCodeOpen(false); setPendingCode(null);
      load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pillStyle = (on: boolean): React.CSSProperties => ({
    flex: 'none', minHeight: 44, padding: '0 14px', borderRadius: radius.pill, cursor: 'pointer',
    fontFamily: typeTokens.family, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    background: on ? theme.text : theme.glassFill, color: on ? theme.bg : theme.text,
    border: on ? 'none' : `1px solid ${theme.glassBorder}`,
  });

  const card: React.CSSProperties = {
    background: theme.surface2, border: `1px solid ${theme.divider}`, borderRadius: radius.card, padding: 14,
  };

  return (
    <div style={{ fontFamily: typeTokens.family, color: theme.text }}>
      {pendingCode && (
        <div style={{ ...card, marginBottom: 12, borderColor: theme.accent }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
            {checkedIn ? `Join the team with code ${pendingCode}?` : 'Check in first, then open this link again to join the team.'}
          </p>
          {notice && <p role="alert" style={{ color: theme.accent2, fontSize: 13, margin: '0 0 8px' }}>{notice}</p>}
          {checkedIn && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button style={{ minHeight: 44 }} disabled={busy} onClick={() => joinWith(pendingCode)}>{busy ? 'Joining…' : 'Join team'}</Button>
              <Button variant="secondary" style={{ minHeight: 44 }} onClick={() => { setPendingCode(null); setNotice(null); }}>Not now</Button>
            </div>
          )}
        </div>
      )}

      {myTeam && (
        <button
          type="button"
          onClick={() => setOpenId(myTeam.id)}
          style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, color: theme.text, fontFamily: typeTokens.family }}
        >
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted }}>Your team</span>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{myTeam.name}</span>
            <span style={{ display: 'block', fontSize: 13, color: theme.muted }}>
              {myTeam.members.length} of {myTeam.max_size}
              {myTeam.owner_id === myUserId && myTeam.requests.length > 0 ? ` · ${myTeam.requests.length} waiting to join` : ''}
            </span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Open</span>
        </button>
      )}

      {suggestion && (
        <div style={{ ...card, marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14 }}>
            A team named <strong>{suggestion.name}</strong> is here, like the one on your profile.
          </p>
          <Button variant="secondary" style={{ minHeight: 44 }} onClick={() => setOpenId(suggestion.id)}>View team</Button>
        </div>
      )}

      {!myTeam && checkedIn && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Button style={{ minHeight: 48, flex: 1 }} onClick={() => setCreating(true)}>
            <Plus size={16} />&nbsp;Create a team
          </Button>
          <Button variant="secondary" style={{ minHeight: 48 }} onClick={() => setCodeOpen((v) => !v)} aria-expanded={codeOpen}>
            <KeyRound size={16} />&nbsp;Have a code?
          </Button>
        </div>
      )}
      {!checkedIn && (
        <p style={{ color: theme.muted, fontSize: 13, margin: '0 0 12px' }}>Check in to create or join a team. You can still browse.</p>
      )}

      {codeOpen && !myTeam && (
        <div style={{ ...card, marginBottom: 12 }}>
          <label htmlFor="team-code" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.muted, marginBottom: 6 }}>Team code</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input id="team-code" value={code} maxLength={12} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="For example K7Q2MX" />
            <Button style={{ minHeight: 48 }} disabled={busy || code.trim().length < 4} onClick={() => joinWith(code)}>{busy ? '…' : 'Join'}</Button>
          </div>
          {notice && <p role="alert" style={{ color: theme.accent2, fontSize: 13, margin: '8px 0 0' }}>{notice}</p>}
        </div>
      )}

      <div role="group" aria-label="Filter teams" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
        <button type="button" style={pillStyle(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All teams {teams.length}
        </button>
        {[...needCounts.entries()].map(([n, c]) => (
          <button key={n} type="button" style={pillStyle(filter === n)} aria-pressed={filter === n} onClick={() => setFilter(filter === n ? 'all' : n)}>
            Needs {NEED_LABEL[n].toLowerCase()} {c}
          </button>
        ))}
      </div>

      {!loaded && <p style={{ color: theme.muted, fontSize: 14 }}>Loading teams…</p>}
      {error && <p role="alert" style={{ color: theme.accent2, fontSize: 13 }}>{error}</p>}

      {loaded && visible.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <Users size={32} style={{ color: theme.muted }} aria-hidden="true" />
          <p style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>
            {teams.length === 0 ? 'No teams yet' : `No teams need ${filter === 'all' ? 'anyone' : NEED_LABEL[filter].toLowerCase() + 's'} right now`}
          </p>
          <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>
            {teams.length === 0 ? 'Be the first. Create a team and others can join it.' : 'Try another filter.'}
          </p>
          {filter !== 'all' && <Button variant="secondary" style={{ minHeight: 44, marginTop: 12 }} onClick={() => setFilter('all')}>Show all teams</Button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((t) => {
          const full = t.members.length >= t.max_size;
          const mine = t.id === myTeam?.id;
          const requested = t.requests.some((r) => r.user_id === myUserId);
          return (
            <div key={t.id} style={card}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
                aria-label={`Open ${t.name}`}
              >
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: theme.text }}>{t.name}</span>
                <span style={{ display: 'block', fontSize: 13, color: theme.muted }}>
                  {t.members.length} of {t.max_size} · {t.members[0]?.profile?.display_name ?? 'Owner'}
                </span>
                {t.idea && <span style={{ display: 'block', fontSize: 15, marginTop: 6, color: theme.text }}>{t.idea}</span>}
              </button>
              {t.needs.length > 0 && !full && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {t.needs.map((n) => (
                    <span key={n} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: radius.pill, border: `1px solid ${theme.glassBorder}`, color: theme.text }}>
                      Needs {NEED_LABEL[n]}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {mine ? (
                  <Button variant="secondary" style={{ minHeight: 44 }} onClick={() => setOpenId(t.id)}>Open your team</Button>
                ) : (
                  <Button
                    variant="secondary"
                    style={{ minHeight: 44 }}
                    disabled={full || requested || !checkedIn || !!myTeam}
                    onClick={async () => {
                      try { await requestToJoinTeam(t.id); load(); } catch (e) { setNotice((e as Error).message); setOpenId(t.id); }
                    }}
                  >
                    {full ? 'Team is full' : requested ? 'Requested' : myTeam ? 'You’re on a team' : 'Ask to join'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateTeamSheet
          locationId={locationId}
          defaultName={myAffiliation ?? ''}
          onClose={() => setCreating(false)}
          onDone={(t) => { setCreating(false); load(); if (t) setOpenId(t.id); }}
        />
      )}

      {editing && (
        <CreateTeamSheet
          locationId={locationId}
          editing={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); }}
        />
      )}

      {openTeam && !editing && (
        <TeamDetailSheet
          team={openTeam}
          myUserId={myUserId}
          myTeamId={myTeam?.id ?? null}
          checkedIn={checkedIn}
          roomProfiles={roomProfiles}
          takenIds={takenIds}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onEdit={() => setEditing(openTeam)}
        />
      )}
    </div>
  );
}
