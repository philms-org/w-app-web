'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { fetchDueSurvey, submitSurvey, type DueSurvey, type TeamStatus } from '@/lib/eventOutcomes';

const font = 'Montserrat, system-ui, sans-serif';

const TEAM_ANSWERS: { value: TeamStatus; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

// Post-event survey (0047). Shown once, the first time someone opens the app
// after an event they attended ends (wave 0: rating + best part + "still
// working on it?"), and again 30 days later with just the team question.
// Skippable; the server decides which survey is due.
export default function EventSurveySheet() {
  const [survey, setSurvey] = useState<DueSurvey | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [best, setBest] = useState('');
  const [teamStatus, setTeamStatus] = useState<TeamStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDueSurvey()
      .then((s) => { if (!cancelled) setSurvey(s); })
      .catch((err) => console.error('Failed to check for an event survey:', err));
    return () => { cancelled = true; };
  }, []);

  if (!survey) return null;

  const followUp = survey.wave === 30;
  const canSend = followUp ? teamStatus !== null : nps !== null;

  const send = async (answer: Parameters<typeof submitSurvey>[1]) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitSurvey(survey, answer);
      if (answer === 'skip') setSurvey(null);
      else {
        setThanks(true);
        setTimeout(() => setSurvey(null), 1400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your answers.");
    } finally {
      setSending(false);
    }
  };

  const pill = (on: boolean): React.CSSProperties => ({
    minWidth: 36, height: 36, padding: '0 10px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontWeight: 700, fontSize: 13,
    border: on ? 'none' : `1px solid ${theme.divider}`,
    backgroundColor: on ? theme.accent : theme.surface2,
    color: on ? theme.onAccent : theme.text,
  });
  const label: React.CSSProperties = { color: theme.muted, fontSize: 13, margin: '10px 0 6px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-survey-title"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto',
          backgroundColor: theme.surface, borderTop: `1px solid ${theme.divider}`, borderRadius: '24px 24px 0 0',
          padding: '10px 18px calc(18px + env(safe-area-inset-bottom, 0px))', fontFamily: font,
        }}
      >
        <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.divider, margin: '0 auto 14px' }} />
        {thanks ? (
          <p id="event-survey-title" style={{ color: theme.text, fontSize: 17, fontWeight: 800, margin: '8px 0 16px' }}>Thanks, the organizers will see this.</p>
        ) : (
          <>
            <p id="event-survey-title" style={{ color: theme.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
              {followUp ? `A month after ${survey.name}` : `How was ${survey.name}?`}
            </p>

            {!followUp && (
              <>
                <p style={label}>How likely are you to recommend it to a friend?</p>
                <div role="radiogroup" aria-label="Recommend score, 0 to 10" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <button key={n} type="button" role="radio" aria-checked={nps === n} onClick={() => setNps(n)} style={pill(nps === n)}>{n}</button>
                  ))}
                </div>
                <label htmlFor="survey-best" style={{ ...label, display: 'block' }}>Best part, in a few words (optional)</label>
                <textarea
                  id="survey-best"
                  value={best}
                  maxLength={280}
                  rows={2}
                  onChange={(e) => setBest(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'none', backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`, borderRadius: 10, padding: 8, color: theme.text, fontFamily: font, fontSize: 13 }}
                />
              </>
            )}

            <p style={label}>Is your team still working on it?</p>
            <div role="radiogroup" aria-label="Is your team still working on it?" style={{ display: 'flex', gap: 6 }}>
              {TEAM_ANSWERS.map((a) => (
                <button key={a.value} type="button" role="radio" aria-checked={teamStatus === a.value} onClick={() => setTeamStatus(a.value)} style={pill(teamStatus === a.value)}>
                  {a.label}
                </button>
              ))}
            </div>

            {error && <p role="alert" style={{ color: theme.accent, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => send('skip')}
                disabled={sending}
                style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, fontFamily: font, fontWeight: 700, fontSize: 14, cursor: 'pointer', backgroundColor: 'transparent', color: theme.text, border: `1px solid ${theme.divider}` }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => send({ nps, best, teamStatus })}
                disabled={!canSend || sending}
                style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, fontFamily: font, fontWeight: 700, fontSize: 14, cursor: canSend && !sending ? 'pointer' : 'default', opacity: canSend && !sending ? 1 : 0.5, backgroundColor: theme.accent, color: theme.onAccent, border: 'none' }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
