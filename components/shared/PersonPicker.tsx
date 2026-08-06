'use client';

import { useMemo, useState } from 'react';
import { theme } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export const pickerInputStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: theme.surface2,
  border: `1px solid ${theme.divider}`,
  borderRadius: '10px',
  padding: '8px 12px',
  color: theme.text,
  fontSize: '13px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

export default function PersonPicker({
  people,
  onPick,
  placeholder,
}: {
  people: Profile[];
  onPick: (person: Profile) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => p.display_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, people]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{ ...pickerInputStyle, width: '100%', boxSizing: 'border-box' }}
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: theme.surface2,
          border: `1px solid ${theme.divider}`,
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 10,
        }}>
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onPick(p);
                setQuery('');
              }}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              {p.display_name} {p.email ? `— ${p.email}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
