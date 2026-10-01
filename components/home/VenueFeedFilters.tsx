'use client';

import { Check } from 'lucide-react';
import { theme, radius, type as typeTokens } from '@/lib/theme';

export type FeedFilter = 'all' | 'posted' | 'noteam' | 'networking' | 'socialising' | 'dating';

const LABELS: Record<FeedFilter, string> = {
  all: 'Everyone',
  posted: 'Posted',
  noteam: 'Needs a team',
  networking: 'Networking',
  socialising: 'Socialising',
  dating: 'Dating',
};

// "Everyone" is always shown and selected by default, so nobody is hidden
// until someone picks a pill. Other pills only appear when at least one
// person matches. Pinned (sticky) so you can filter from anywhere in the list.
export default function VenueFeedFilters({
  value,
  onChange,
  counts,
}: {
  value: FeedFilter;
  onChange: (f: FeedFilter) => void;
  counts: Record<FeedFilter, number>;
}) {
  const keys = (Object.keys(LABELS) as FeedFilter[]).filter((k) => k === 'all' || k === value || counts[k] > 0);
  return (
    <div
      role="group"
      aria-label="Filter people"
      style={{
        position: 'sticky', top: 0, zIndex: 5, background: theme.bg,
        display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0 10px', margin: '0 -2px',
        scrollbarWidth: 'none',
      }}
    >
      {keys.map((k) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && k !== 'all' ? 'all' : k)}
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
            {LABELS[k]}
            <span style={{ fontWeight: 500, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
