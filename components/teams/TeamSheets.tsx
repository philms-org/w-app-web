'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, UserPlus } from 'lucide-react';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';
import {
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
  respondToJoinRequest,
  requestToJoinTeam,
} from '@/lib/data';
import { TEAM_NEEDS, type Profile, type Team, type TeamNeed, type TeamWithMembers } from '@/lib/types';

export const NEED_LABEL: Record<TeamNeed, string> = {
  developer: 'Developer',
  designer: 'Designer',
  business: 'Business',
  data: 'Data',
  marketing: 'Marketing',
  other: 'Other',
};

const MIN_TAP = 44;

// Bottom sheet shared by both team sheets. Esc and the scrim close it.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
          background: theme.surface, border: `1px solid ${theme.divider}`,
          borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          padding: '16px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          fontFamily: typeTokens.family,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: MIN_TAP, height: MIN_TAP, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: theme.text, cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: theme.muted, margin: '14px 0 6px',
};

function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        minHeight: MIN_TAP, padding: '0 16px', borderRadius: radius.pill, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: typeTokens.family,
        fontSize: 14, fontWeight: 600,
        background: on ? theme.accent : theme.glassFill,
        color: on ? 'var(--on-accent)' : theme.text,
        border: on ? 'none' : `1px solid ${theme.glassBorder}`,
      }}
    >
      {on && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------- create / edit

export function CreateTeamSheet({
  locationId,
  defaultName = '',
  editing,
  onClose,
  onDone,
}: {
  locationId: string;
  defaultName?: string;
  editing?: TeamWithMembers;
  onClose: () => void;
  onDone: (team?: Team) => void;
}) {
  const [kind, setKind] = useState<'team' | 'company'>(editing?.kind ?? 'team');
  const [name, setName] = useState(editing?.name ?? defaultName);
  const [idea, setIdea] = useState(editing?.idea ?? '');
  const [needs, setNeeds] = useState<Set<TeamNeed>>(new Set(editing?.needs ?? []));
  const [maxSize, setMaxSize] = useState(editing?.max_size ?? 6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === 'company' ? 'Company' : 'Team';
  const minSize = editing ? Math.max(2, editing.members.length) : 2;
  const sizes = [4, 6, 8, 10].filter((n) => n >= minSize);
  if (!sizes.includes(maxSize)) sizes.push(maxSize);
  sizes.sort((a, b) => a - b);

  const toggle = (n: TeamNeed) =>
    setNeeds((cur) => {
      const next = new Set(cur);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateTeam(editing.id, { name, idea, needs: [...needs], maxSize });
        onDone();
      } else {
        const team = await createTeam({ locationId, name, kind, idea, needs: [...needs], maxSize });
        onDone(team);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet title={editing ? `Edit ${label.toLowerCase()}` : `Create a ${label.toLowerCase()}`} onClose={onClose}>
      {!editing && (
        <div role="group" aria-label="Type" style={{ display: 'flex', gap: 8 }}>
          <ToggleChip on={kind === 'team'} onClick={() => setKind('team')}>Team</ToggleChip>
          <ToggleChip on={kind === 'company'} onClick={() => setKind('company')}>Company</ToggleChip>
        </div>
      )}

      <label style={fieldLabel} htmlFor="team-name">{label} name</label>
      <Input id="team-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={kind === 'company' ? 'Company name' : 'Your team name'} />

      <label style={fieldLabel} htmlFor="team-idea">{kind === 'company' ? 'What does it do?' : 'What are you building?'} (one line)</label>
      <Input id="team-idea" value={idea} maxLength={140} onChange={(e) => setIdea(e.target.value)} placeholder="One sentence is enough" />

      <span style={fieldLabel}>Who do you still need?</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TEAM_NEEDS.map((n) => (
          <ToggleChip key={n} on={needs.has(n)} onClick={() => toggle(n)}>{NEED_LABEL[n]}</ToggleChip>
        ))}
      </div>

      <span style={fieldLabel}>Size limit</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sizes.map((n) => (
          <ToggleChip key={n} on={maxSize === n} onClick={() => setMaxSize(n)}>{n} people</ToggleChip>
        ))}
      </div>

      {error && <p role="alert" style={{ color: theme.accent2, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

      <div style={{ marginTop: 18 }}>
        <Button fullWidth onClick={submit} disabled={busy || name.trim().length < 2} style={{ minHeight: 48 }}>
          {busy ? 'Saving…' : editing ? 'Save changes' : `Create ${label.toLowerCase()}`}
        </Button>
      </div>
      {!editing && (
        <p style={{ color: theme.muted, fontSize: 12.5, margin: '10px 0 0' }}>
          You&apos;ll be the owner. You can add or remove people any time.
        </p>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------ team page

export function TeamDetailSheet({
  team,
  myUserId,
  myTeamId,
  checkedIn,
  roomProfiles,
  takenIds,
  onClose,
  onChanged,
  onEdit,
  canManage = false,
}: {
  team: TeamWithMembers;
  myUserId: string | undefined;
  myTeamId: string | null;
  checkedIn: boolean;
  roomProfiles: Profile[];
  takenIds: Set<string>;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  // Organizer of this venue: can run any team here (0042).
  canManage?: boolean;
}) {
  const isOwner = team.owner_id === myUserId;
  const canRun = isOwner || canManage;
  const isMember = team.members.some((m) => m.user_id === myUserId);
  const iRequested = team.requests.some((m) => m.user_id === myUserId);
  const full = team.members.length >= team.max_size;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/main?teamCode=${team.join_code}`;

  useEffect(() => {
    if (!(isMember || canRun) || !link) return;
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then((url) => alive && setQr(url)).catch(() => {});
    return () => { alive = false; };
  }, [isMember, canRun, link]);

  const run = async (key: string, fn: () => Promise<void>, closeAfter = false) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
      if (closeAfter) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? team.join_code : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError('Copy isn’t available here. Select the code and copy it manually.');
    }
  };

  const candidates = useMemo(
    () => roomProfiles.filter((p) => p.id !== myUserId && !takenIds.has(p.id)),
    [roomProfiles, takenIds, myUserId],
  );

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, borderTop: `1px solid ${theme.divider}` };
  const small: React.CSSProperties = { minHeight: MIN_TAP, padding: '0 14px', fontSize: 13 };

  return (
    <Sheet title={team.name} onClose={onClose}>
      <p style={{ color: theme.muted, fontSize: 13, margin: '-6px 0 8px' }}>
        {team.kind === 'company' ? 'Company' : 'Team'} · {team.members.length} of {team.max_size}
        {isOwner ? ' · you’re the owner' : ''}
      </p>
      {team.idea && <p style={{ color: theme.text, fontSize: typeTokens.body.fontSize, margin: '0 0 8px' }}>{team.idea}</p>}
      {team.needs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {team.needs.map((n) => (
            <span key={n} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: radius.pill, border: `1px solid ${theme.glassBorder}`, color: theme.text }}>
              Needs {NEED_LABEL[n]}
            </span>
          ))}
        </div>
      )}

      {(isMember || canRun) && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: radius.card, background: theme.surface2, border: `1px solid ${theme.divider}`, margin: '8px 0 12px' }}>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code to join ${team.name}`} width={92} height={92} style={{ borderRadius: 8, background: '#fff', flex: 'none' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: theme.muted, fontSize: 12.5 }}>Team code</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.08em', color: theme.text }}>{team.join_code}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <Button variant="secondary" style={small} onClick={() => copy('code')}>
                {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}&nbsp;{copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
              <Button variant="secondary" style={small} onClick={() => copy('link')}>
                {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}&nbsp;{copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canRun && team.requests.length > 0 && (
        <div style={{ border: `1px solid ${theme.accent2}`, borderRadius: radius.card, padding: '8px 12px', margin: '0 0 12px' }}>
          <strong style={{ fontSize: 13, color: theme.text }}>{team.requests.length} {team.requests.length === 1 ? 'request' : 'requests'}</strong>
          {team.requests.map((r) => (
            <div key={r.user_id} style={{ ...row, borderTop: 'none', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: theme.text }}>{r.profile?.display_name ?? 'Someone'}</span>
              <Button style={small} disabled={busy !== null || full} onClick={() => run(`a${r.user_id}`, () => respondToJoinRequest(team.id, r.user_id, true))}>Accept</Button>
              <Button variant="secondary" style={small} disabled={busy !== null} onClick={() => run(`d${r.user_id}`, () => respondToJoinRequest(team.id, r.user_id, false))}>Decline</Button>
            </div>
          ))}
        </div>
      )}

      <div>
        {team.members.map((m) => (
          <div key={m.user_id} style={row}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{m.profile?.display_name ?? 'Someone'}{m.user_id === myUserId ? ' (you)' : ''}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: theme.muted }}>{m.role === 'owner' ? 'Owner' : 'Member'}{m.profile?.role ? ` · ${m.profile.role}` : ''}</span>
            </span>
            {canRun && m.user_id !== myUserId && (
              <Button variant="secondary" style={small} disabled={busy !== null} onClick={() => run(`r${m.user_id}`, () => removeTeamMember(team.id, m.user_id))}>Remove</Button>
            )}
          </div>
        ))}
      </div>

      {canRun && !full && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" fullWidth style={{ minHeight: 48 }} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <UserPlus size={16} />&nbsp;Add someone from the room
          </Button>
          {adding && (
            <div style={{ marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
              {candidates.length === 0 && <p style={{ color: theme.muted, fontSize: 13 }}>Everyone checked in is already on a team.</p>}
              {candidates.map((p) => (
                <div key={p.id} style={row}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: theme.text }}>{p.display_name ?? 'Someone'}</span>
                  <Button style={small} disabled={busy !== null} onClick={() => run(`x${p.id}`, () => addTeamMember(team.id, p.id))}>Add</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" style={{ color: theme.accent2, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {canRun && <Button variant="secondary" style={{ minHeight: 48 }} onClick={onEdit}>Edit team</Button>}
        {canManage && !confirmDelete && (
          <Button variant="secondary" style={{ minHeight: 48 }} onClick={() => setConfirmDelete(true)}>Delete team</Button>
        )}
        {canManage && confirmDelete && (
          <>
            <Button style={{ minHeight: 48 }} disabled={busy !== null} onClick={() => run('delete', () => deleteTeam(team.id), true)}>Yes, delete {team.name}</Button>
            <Button variant="secondary" style={{ minHeight: 48 }} onClick={() => setConfirmDelete(false)}>Keep it</Button>
          </>
        )}
        {isMember && !confirmLeave && (
          <Button variant="secondary" style={{ minHeight: 48 }} onClick={() => setConfirmLeave(true)}>Leave team</Button>
        )}
        {isMember && confirmLeave && (
          <>
            <Button style={{ minHeight: 48 }} disabled={busy !== null} onClick={() => run('leave', () => removeTeamMember(team.id, myUserId!), true)}>Yes, leave {team.name}</Button>
            <Button variant="secondary" style={{ minHeight: 48 }} onClick={() => setConfirmLeave(false)}>Stay</Button>
          </>
        )}
        {!isMember && !canRun && (
          <Button
            fullWidth
            style={{ minHeight: 48 }}
            disabled={busy !== null || full || iRequested || !checkedIn || myTeamId !== null}
            onClick={() => run('req', () => requestToJoinTeam(team.id))}
          >
            {iRequested ? 'Requested. Waiting for the owner' : full ? 'Team is full' : myTeamId ? 'Leave your team to join another' : !checkedIn ? 'Check in to join' : 'Ask to join'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
