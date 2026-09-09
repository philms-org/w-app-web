'use client';

import { useEffect, useState } from 'react';
import { fetchVenueTitleRoster, tagIconPublicUrl } from '@/lib/data';
import type { Profile, VerificationTagType } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { resolveTagIcon } from '@/lib/tagIcons';

export default function TitleRosterCard({ locationId }: { locationId: string }) {
  const [groups, setGroups] = useState<{ type: VerificationTagType; people: Profile[] }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchVenueTitleRoster(locationId)
      .then((g) => { if (!cancelled) setGroups(g); })
      .catch((e) => console.error('Failed to load title roster:', e));
    return () => { cancelled = true; };
  }, [locationId]);

  if (groups.length === 0) return null;

  return (
    <div style={{
      backgroundColor: theme.surface, borderRadius: radius.card, border: `1px solid ${theme.divider}`,
      padding: 16, marginBottom: 20, fontFamily: typeTokens.family,
    }}>
      <h3 style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
        Titles at this venue
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map(({ type, people }) => {
          const Icon = resolveTagIcon(type.icon);
          return (
            <div key={type.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {type.icon_kind === 'lucide' && <Icon style={{ width: 16, height: 16, color: theme.accent }} />}
                {type.icon_kind === 'emoji' && <span style={{ fontSize: 16 }}>{type.icon}</span>}
                {type.icon_kind === 'image' && (
                  <img src={tagIconPublicUrl(type.icon)} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                )}
                <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>{type.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 2 }}>
                {people.map((p) => (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
