'use client';

import { useCallback, useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import {
  createPitch,
  deletePitch,
  fetchPitchBoard,
  promotePitchToTeam,
  setPitchVoting,
  votePitch,
  type PitchBoard,
  type PitchVoting,
} from '@/lib/eventOutcomes';

const font = 'Montserrat, system-ui, sans-serif';

const STATE_LABEL: Record<PitchVoting, string> = {
  off: 'Pitches off',
  open: 'Voting open',
  done: 'Voting closed',
};

// Friday-night pitch list (0047). Attendees add one pitch and get 3 votes
// while the organizer has voting open; totals appear once it closes.
// Organizers see totals throughout, open/close voting and turn pitches into
// teams.
export default function PitchesView({ locationId }: { locationId: string }) {
  const [board, setBoard] = useState<PitchBoard | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');

  const load = useCallback(() => {
    fetchPitchBoard(locationId)
      .then((b) => { setBoard(b); setLoadError(false); })
      .catch((err) => { console.error('Failed to load pitches:', err); setLoadError(true); });
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return <p style={{ color: theme.muted, fontSize: 14, fontFamily: font }}>Couldn&apos;t load pitches. Reopen this screen to try again.</p>;
  }
  if (!board) {
    return <p style={{ color: theme.muted, fontSize: 14, fontFamily: font }}>Loading pitches…</p>;
  }

  const hasMine = board.pitches.some((p) => p.mine);
  const open = board.state === 'open';
  const chip: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
    backgroundColor: theme.surface2, color: theme.text, border: `1px solid ${theme.divider}`,
  };
  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({
    minHeight: 40, padding: '0 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: font,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
    backgroundColor: primary ? theme.accent : 'transparent',
    color: primary ? theme.onAccent : theme.text,
    border: primary ? 'none' : `1px solid ${theme.divider}`,
  });
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`,
    borderRadius: 12, padding: '10px 12px', color: theme.text, fontSize: 14, fontFamily: font,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip}>{STATE_LABEL[board.state]}</span>
        {open && !board.is_manager && (
          <span style={{ color: theme.muted, fontSize: 13 }}>
            {board.votes_left > 0 ? `You have ${board.votes_left} of 3 votes left` : 'All 3 votes used. Tap Voted to take one back.'}
          </span>
        )}
      </div>

      {board.is_manager && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['off', 'open', 'done'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => run(`state-${s}`, () => setPitchVoting(locationId, s))}
              disabled={board.state === s || !!busy}
              aria-pressed={board.state === s}
              style={btn(board.state === s, !!busy && board.state !== s)}
            >
              {s === 'off' ? 'Hide pitches' : s === 'open' ? 'Open voting' : 'Close voting'}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" style={{ color: theme.accent, fontSize: 13, margin: 0 }}>{error}</p>}

      {board.state === 'off' && !board.is_manager && (
        <p style={{ color: theme.muted, fontSize: 14, margin: 0 }}>Pitches open when the organizers start them.</p>
      )}

      {board.pitches.length === 0 && board.state !== 'off' && (
        <p style={{ color: theme.muted, fontSize: 14, margin: 0 }}>No pitches yet.</p>
      )}

      {board.pitches.map((p) => (
        <div
          key={p.id}
          style={{
            backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: 14,
            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: theme.text, fontSize: 15, fontWeight: 700 }}>{p.title}</div>
            {p.summary && <div style={{ color: theme.muted, fontSize: 13 }}>{p.summary}</div>}
            <div style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {p.mine ? 'Your pitch' : p.pitcher_name ?? 'Someone'}
              {p.votes !== null && ` · ${p.votes} ${p.votes === 1 ? 'vote' : 'votes'}`}
              {p.team_id && ' · Team made'}
            </div>
          </div>
          {open && !board.is_manager && (
            <button
              type="button"
              aria-pressed={p.voted}
              onClick={() => run(p.id, () => votePitch(p.id, !p.voted))}
              disabled={!!busy || (!p.voted && board.votes_left <= 0)}
              style={btn(p.voted, !!busy || (!p.voted && board.votes_left <= 0))}
            >
              {busy === p.id ? '…' : p.voted ? 'Voted' : 'Vote'}
            </button>
          )}
          {board.is_manager && !p.team_id && (
            <button type="button" onClick={() => run(`team-${p.id}`, () => promotePitchToTeam(p.id))} disabled={!!busy} style={btn(false, !!busy)}>
              {busy === `team-${p.id}` ? '…' : 'Make team'}
            </button>
          )}
          {(p.mine || board.is_manager) && board.state !== 'done' && (
            <button
              type="button"
              aria-label={`Remove ${p.title}`}
              onClick={() => run(`del-${p.id}`, () => deletePitch(p.id))}
              disabled={!!busy}
              style={{ ...btn(false, !!busy), padding: '0 10px' }}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {open && !hasMine && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ ...btn(false), minHeight: 52, borderStyle: 'dashed', textAlign: 'left' }}
        >
          Pitching tonight? Add your idea so people can vote
        </button>
      )}

      {open && adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run('create', async () => {
              await createPitch(locationId, title, summary);
              setAdding(false);
              setTitle('');
              setSummary('');
            });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface }}
        >
          <label htmlFor="pitch-title" style={{ color: theme.muted, fontSize: 12, fontWeight: 600 }}>Idea name</label>
          <input id="pitch-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Lease Lens" style={input} />
          <label htmlFor="pitch-summary" style={{ color: theme.muted, fontSize: 12, fontWeight: 600 }}>One line (optional)</label>
          <input id="pitch-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={140} placeholder="AI reads your lease before you sign" style={input} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAdding(false)} style={btn(false)}>Cancel</button>
            <button type="submit" disabled={title.trim().length < 2 || !!busy} style={btn(true, title.trim().length < 2 || !!busy)}>
              {busy === 'create' ? 'Adding…' : 'Add pitch'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
