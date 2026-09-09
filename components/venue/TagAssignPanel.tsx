'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAttendeeHistory, fetchVerificationTags, fetchVerificationTagTypes,
  assignVerificationTag, assignVerificationTagFreeform, removeVerificationTag,
} from '@/lib/data';
import type { Profile, VerificationTag, VerificationTagType } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Input } from '@/components/ui/primitives';
import TagBadge from '@/components/shared/TagBadge';

export default function TagAssignPanel(
  { locationId, refreshKey }: { locationId: string; refreshKey?: number },
) {
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [tags, setTags] = useState<VerificationTag[]>([]);
  const [types, setTypes] = useState<VerificationTagType[]>([]);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(() => {
    fetchVerificationTags(locationId).then(setTags).catch((e) => console.error('Failed to load tags:', e));
  }, [locationId]);

  useEffect(() => {
    Promise.all([fetchAttendeeHistory(locationId), fetchVerificationTags(locationId)])
      .then(([a, t]) => { setAttendees(a); setTags(t); })
      .catch((e) => { console.error('Failed to load assign panel:', e); setError("Couldn't load attendees."); });
  }, [locationId]);

  // Types are re-fetched whenever the catalog panel signals a change
  // (refreshKey bump), so a title added there shows up here without a remount.
  useEffect(() => {
    fetchVerificationTagTypes(locationId)
      .then(setTypes)
      .catch((e) => console.error('Failed to load title types:', e));
  }, [locationId, refreshKey]);

  const tagsByUser = useMemo(() => {
    const m = new Map<string, VerificationTag[]>();
    for (const t of tags) { const l = m.get(t.user_id) ?? []; l.push(t); m.set(t.user_id, l); }
    return m;
  }, [tags]);

  const grant = async (userId: string, typeId: string) => {
    setBusyUser(userId); setError(null);
    try { await assignVerificationTag(userId, locationId, typeId); loadTags(); }
    catch (e) { console.error('Failed to assign title:', e); setError("Couldn't assign the title."); }
    finally { setBusyUser(null); }
  };

  const grantCustom = async (userId: string) => {
    const label = customText.trim();
    if (!label) return;
    setBusyUser(userId); setError(null);
    try {
      await assignVerificationTagFreeform(userId, locationId, label, null);
      setCustomFor(null); setCustomText('');
      loadTags();
    } catch (e) {
      console.error('Failed to assign custom title:', e);
      setError("Couldn't assign the title.");
    } finally { setBusyUser(null); }
  };

  const revoke = async (userId: string, tagId: string) => {
    setBusyUser(userId); setError(null);
    try { await removeVerificationTag(tagId); loadTags(); }
    catch (e) { console.error('Failed to remove title:', e); setError("Couldn't remove the title."); }
    finally { setBusyUser(null); }
  };

  return (
    <div style={{ fontFamily: typeTokens.family }}>
      <h2 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>
        Assign titles
      </h2>
      {error && <p style={{ color: theme.accent2, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {attendees.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 14 }}>No attendees at this venue yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {attendees.map((a) => {
          const mine = tagsByUser.get(a.id) ?? [];
          const grantedTypeIds = new Set(mine.map((t) => t.type_id).filter(Boolean));
          const busy = busyUser === a.id;
          return (
            <div key={a.id} style={{ padding: 14, borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface }}>
              <p style={{ fontWeight: 600, color: theme.text, fontSize: 15, marginBottom: 8 }}>{a.display_name ?? 'Someone'}</p>

              {mine.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {mine.map((t) => (
                    <button key={t.id} onClick={() => revoke(a.id, t.id)} disabled={busy}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <TagBadge tag={t} size="md" />
                      <span style={{ color: theme.muted, fontSize: 12 }}>✕</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {types.filter((ty) => !grantedTypeIds.has(ty.id)).map((ty) => (
                  <button key={ty.id} onClick={() => grant(a.id, ty.id)} disabled={busy}
                    style={{
                      padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer',
                      border: `1px solid ${theme.divider}`, backgroundColor: theme.surface2,
                      color: theme.text, fontFamily: typeTokens.family, fontSize: 13, fontWeight: 600,
                    }}>
                    + {ty.label}
                  </button>
                ))}
                <button onClick={() => { setCustomFor(a.id); setCustomText(''); }} disabled={busy}
                  style={{ padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer', border: `1px dashed ${theme.divider}`, background: 'none', color: theme.muted, fontFamily: typeTokens.family, fontSize: 13 }}>
                  ＋ custom
                </button>
              </div>

              {customFor === a.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="One-off title" />
                  <button onClick={() => grantCustom(a.id)} disabled={busy || !customText.trim()}
                    style={{ padding: '8px 16px', borderRadius: radius.pill, border: 'none', backgroundColor: theme.accent, color: '#0D0D0F', fontWeight: 700, cursor: 'pointer', fontFamily: typeTokens.family, fontSize: 13 }}>
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
