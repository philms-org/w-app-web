'use client';

import { Chip } from '@/components/ui/primitives';

export type FeedFilter = 'all' | 'dating' | 'networking' | 'socialising';

const OPTIONS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dating', label: 'Dating' },
  { key: 'networking', label: 'Networking' },
  { key: 'socialising', label: 'Socialising' },
];

export default function VenueFeedFilters({
  value,
  onChange,
}: {
  value: FeedFilter;
  onChange: (f: FeedFilter) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 12px' }}>
      {OPTIONS.map((o) => (
        <Chip key={o.key} selected={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
