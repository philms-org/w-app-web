'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import VenueToolPage, { useToolLocationId } from '@/components/organizer/VenueToolPage';
import { theme } from '@/lib/theme';
import {
  JUDGING_CRITERIA,
  amIJudge,
  fetchJudgingBoard,
  submitJudgeScore,
  type JudgingBoard,
  type Scores,
} from '@/lib/eventOutcomes';

const font = 'Montserrat, system-ui, sans-serif';

// Sunday finals (0047): judges score each team 1-5 on Startup Weekend's three
// criteria; organizers see the averaged leaderboard. Judges are people the
// organizer marked "Judge" on the Members page.
export default function JudgingPage() {
  return (
    <Suspense fallback={null}>
      <JudgingGate />
    </Suspense>
  );
}

function JudgingGate() {
  const locationId = useToolLocationId();
  const [isJudge, setIsJudge] = useState<boolean | null>(null);
  useEffect(() => {
    if (!locationId) return;
    amIJudge(locationId).then(setIsJudge).catch(() => setIsJudge(false));
  }, [locationId]);

  return (
    <VenueToolPage title="Judging" allowed={isJudge}>
      {(id) => <JudgingBoardView locationId={id} />}
    </VenueToolPage>
  );
}

function JudgingBoardView({ locationId }: { locationId: string }) {
  const [board, setBoard] = useState<JudgingBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchJudgingBoard(locationId)
      .then((b) => { setBoard(b); setLoadError(null); })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load judging."));
  }, [locationId]);
  useEffect(() => { load(); }, [load]);

  if (loadError) return <p style={{ color: theme.muted, fontSize: 14 }}>{loadError}</p>;
  if (!board) return <p style={{ color: theme.muted, fontSize: 14 }}>Loading…</p>;

  const done = board.teams.filter((t) => t.mine).length;
  const sub: React.CSSProperties = { color: theme.muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 8px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: font }}>
      {board.is_manager && (
        <>
          <p style={{ ...sub, marginTop: 0 }}>Leaderboard · {board.judges} {board.judges === 1 ? 'judge' : 'judges'}</p>
          {board.judges === 0 && (
            <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>
              Mark your judges as &quot;Judge&quot; on the Members page. They&apos;ll get a Score teams button on the venue screen.
            </p>
          )}
          {(board.leaderboard ?? []).length === 0 ? (
            <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>No scores yet.</p>
          ) : (
            (board.leaderboard ?? []).map((r) => (
              <div key={r.team_id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, backgroundColor: theme.surface, border: `1px solid ${theme.divider}` }}>
                <span style={{ fontWeight: 800, fontSize: 18, color: r.place === 1 ? theme.accent : theme.text, fontVariantNumeric: 'tabular-nums' }}>{r.place}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                  <div style={{ color: theme.muted, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    Validation {r.validation} · Execution {r.execution} · Business {r.business} · {r.judges} {r.judges === 1 ? 'judge' : 'judges'}
                  </div>
                </div>
                <span style={{ color: theme.text, fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{r.total}<span style={{ color: theme.muted, fontSize: 11, fontWeight: 600 }}> / 15</span></span>
              </div>
            ))
          )}
        </>
      )}

      {board.is_judge && (
        <>
          <p style={{ ...sub, marginTop: board.is_manager ? 18 : 0 }}>Score teams · {done} of {board.teams.length} done</p>
          {board.teams.length === 0 && <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>No teams yet.</p>}
          {board.teams.map((t) => (
            <ScoreCard key={t.team_id} team={t} onSaved={load} />
          ))}
        </>
      )}
    </div>
  );
}

function ScoreCard({ team, onSaved }: { team: JudgingBoard['teams'][number]; onSaved: () => void }) {
  const [scores, setScores] = useState<Partial<Scores>>(team.mine ?? {});
  const [note, setNote] = useState(team.mine?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!team.mine);
  const complete = JUDGING_CRITERIA.every((c) => scores[c.key]);

  const save = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      await submitJudgeScore(team.team_id, scores as Scores, note);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the score.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 12, borderRadius: 14, backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>{team.name}</div>
        {team.idea && <div style={{ color: theme.muted, fontSize: 13 }}>{team.idea}</div>}
      </div>
      {JUDGING_CRITERIA.map((c) => (
        <div key={c.key} role="radiogroup" aria-label={c.label}>
          <div style={{ color: theme.muted, fontSize: 12, marginBottom: 4 }}>{c.label}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = scores[c.key] === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setScores((s) => ({ ...s, [c.key]: n })); setSaved(false); }}
                  style={{
                    width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontFamily: font, fontWeight: 700, fontSize: 14,
                    border: on ? 'none' : `1px solid ${theme.divider}`,
                    backgroundColor: on ? theme.accent : theme.surface2,
                    color: on ? theme.onAccent : theme.text,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <label htmlFor={`note-${team.team_id}`} style={{ color: theme.muted, fontSize: 12 }}>Private note (only you and organizers see it)</label>
      <textarea
        id={`note-${team.team_id}`}
        value={note}
        maxLength={500}
        rows={2}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`, borderRadius: 10, padding: 8, color: theme.text, fontFamily: font, fontSize: 13 }}
      />
      {error && <p role="alert" style={{ color: theme.accent, fontSize: 13, margin: 0 }}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!complete || saving || saved}
        style={{
          minHeight: 44, borderRadius: 12, border: 'none', fontFamily: font, fontWeight: 700, fontSize: 14,
          cursor: !complete || saving || saved ? 'default' : 'pointer', opacity: !complete || saving ? 0.5 : 1,
          backgroundColor: saved ? theme.surface2 : theme.accent, color: saved ? theme.text : theme.onAccent,
        }}
      >
        {saving ? 'Saving…' : saved ? 'Saved' : complete ? 'Save score' : 'Score all three to save'}
      </button>
    </div>
  );
}
