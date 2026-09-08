'use client';

import { theme, type as typeTokens } from '@/lib/theme';
import { Input } from '@/components/ui/primitives';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

export default function StepLocation({ data, patch }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
        Your city is shown to people you connect with; nationality is optional.
      </p>
      <Input
        label="City"
        value={data.city}
        onChange={(e) => patch({ city: e.target.value })}
        placeholder="Where are you based?"
        autoComplete="address-level2"
      />
      <Input
        label="Nationality (optional)"
        value={data.nationality}
        onChange={(e) => patch({ nationality: e.target.value })}
        placeholder="Your nationality"
      />
    </div>
  );
}
