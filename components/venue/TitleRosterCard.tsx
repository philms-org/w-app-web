'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { fetchVenueTitleRoster, tagIconPublicUrl } from '@/lib/data';
import type { Profile, VerificationTagType } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { resolveTagIcon } from '@/lib/tagIcons';

// Compact roster: one sliding row of title pills (same style as the venue
// feed filters) and a single sliding row of the people holding the selected
// title. Tapping the selected pill again collapses the people row.
export default function TitleRosterCard({ locationId }: { locationId: string }) {
  const [groups, setGroups] = useState<{ type: VerificationTagType; people: Profile[] }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVenueTitleRoster(locationId)
      .then((g) => {
        if (cancelled) return;
        setGroups(g);
        setSelectedId(g[0]?.type.id ?? null);
      })
      .catch((e) => console.error('Failed to load title roster:', e));
    return () => { cancelled = true; };
  }, [locationId]);

  if (groups.length === 0) return null;

  const selected = groups.find((g) => g.type.id === selectedId) ?? null;

  return (
    <div style={{ marginBottom: 20, fontFamily: typeTokens.family }}>
      <h3 style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
        Titles at this venue
      </h3>
      <div
        role="group"
        aria-label="Filter by title"
        style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 0 8px', margin: '0 -2px', scrollbarWidth: 'none' }}
      >
        {groups.map(({ type, people }) => {
          const on = type.id === selectedId;
          const Icon = resolveTagIcon(type.icon);
          return (
            <button
              key={type.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSelectedId(on ? null : type.id)}
              style={{
                flex: 'none', minHeight: 44, padding: '0 14px', borderRadius: radius.pill, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                fontFamily: typeTokens.family, fontSize: 13.5, fontWeight: 600,
                background: on ? theme.text : theme.glassFill,
                color: on ? theme.bg : theme.text,
                border: on ? 'none' : `1px solid ${theme.glassBorder}`,
              }}
            >
              {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
              {!on && type.icon_kind === 'lucide' && <Icon style={{ width: 14, height: 14, color: theme.accent }} aria-hidden="true" />}
              {!on && type.icon_kind === 'emoji' && <span style={{ fontSize: 14 }} aria-hidden="true">{type.icon}</span>}
              {!on && type.icon_kind === 'image' && (
                <img src={tagIconPublicUrl(type.icon)} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
              )}
              {type.label}
              <span style={{ fontWeight: 500, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{people.length}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingTop: 4, scrollbarWidth: 'none' }}>
          {selected.people.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 56, flexShrink: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', backgroundColor: theme.pill,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.text, fontWeight: 700, fontSize: 15,
              }}>
                {(p.display_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span style={{
                fontSize: 10, color: theme.text, textAlign: 'center', width: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.display_name ?? 'Someone'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
