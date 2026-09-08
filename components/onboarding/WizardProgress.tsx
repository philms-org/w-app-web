'use client';

import { theme, radius } from '@/lib/theme';

export default function WizardProgress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: i < step ? theme.accent : theme.surface2,
            transition: 'background-color .2s ease',
          }}
        />
      ))}
    </div>
  );
}
