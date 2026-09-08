'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Input, Chip } from '@/components/ui/primitives';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

const DRINKS = ['Yes', 'No', 'Sometimes'];
const RELATIONSHIPS = ['Single', 'Taken', "It's complicated"];

const labelStyle: React.CSSProperties = { fontSize: typeTokens.label.fontSize, fontWeight: 600, color: theme.text, marginBottom: 6, display: 'block' };

export default function StepFun({ data, patch }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>The lighter stuff — all optional.</p>

      <div>
        <span style={labelStyle}>Do you drink?</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {DRINKS.map((d) => (
            <Chip
              key={d}
              selected={data.favouriteDrink === d}
              onClick={() => patch({ favouriteDrink: data.favouriteDrink === d ? '' : d })}
              style={{ flex: 1, padding: '12px', borderRadius: radius.control }}
            >
              {d}
            </Chip>
          ))}
        </div>
      </div>

      <Input
        label="Friday night, you're most likely…"
        value={data.fridayNight}
        onChange={(e) => patch({ fridayNight: e.target.value })}
        placeholder="Out dancing? Home with a book?"
      />

      <div>
        <span style={labelStyle}>Relationship status</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {RELATIONSHIPS.map((r) => (
            <Chip
              key={r}
              selected={data.relationship === r}
              onClick={() => patch({ relationship: data.relationship === r ? '' : r })}
              style={{ flex: 1, padding: '12px', borderRadius: radius.control }}
            >
              {r}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
