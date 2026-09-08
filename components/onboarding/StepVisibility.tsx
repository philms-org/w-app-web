'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

const TOGGLES: { key: keyof OnboardingData; label: string }[] = [
  { key: 'cityVisible', label: 'Show my city' },
  { key: 'professionVisible', label: 'Show my profession' },
  { key: 'favouriteDrinkVisible', label: 'Show whether I drink' },
  { key: 'fridayNightVisible', label: 'Show my Friday-night answer' },
];

export default function StepVisibility({ data, patch }: Props) {
  const summary: [string, string][] = (
    [
      ['City', data.city],
      ['Nationality', data.nationality],
      ['Profession', data.profession],
      ['Drinks', data.favouriteDrink],
      ['Friday night', data.fridayNight],
      ['Relationship', data.relationship],
    ] as [string, string][]
  ).filter(([, v]) => v.trim() !== '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
        Choose what people you connect with can see. You can change this any time in your profile.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TOGGLES.map((t) => {
          const on = data[t.key] as boolean;
          return (
            <label
              key={t.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 0',
                borderBottom: `1px solid ${theme.divider}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ color: theme.text, fontSize: typeTokens.label.fontSize, fontWeight: 600 }}>{t.label}</span>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => patch({ [t.key]: e.target.checked } as Partial<OnboardingData>)}
                style={{ width: 20, height: 20, accentColor: theme.accent, cursor: 'pointer', flexShrink: 0 }}
              />
            </label>
          );
        })}
      </div>

      {summary.length > 0 && (
        <div
          style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.divider}`,
            borderRadius: radius.card,
            padding: 16,
          }}
        >
          <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            Your profile
          </p>
          {summary.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
              <span style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>{k}</span>
              <span style={{ color: theme.text, fontSize: typeTokens.body.fontSize, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
