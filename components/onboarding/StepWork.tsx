'use client';

import { theme, type as typeTokens } from '@/lib/theme';
import { Input } from '@/components/ui/primitives';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

export default function StepWork({ data, patch }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
        All optional — share as much or as little as you like.
      </p>
      <Input label="Profession" value={data.profession} onChange={(e) => patch({ profession: e.target.value })} placeholder="What do you do?" />
      <Input label="Company or affiliation" value={data.affiliation} onChange={(e) => patch({ affiliation: e.target.value })} placeholder="Where?" />
      <Input label="Industry" value={data.industry} onChange={(e) => patch({ industry: e.target.value })} placeholder="Which field?" />
      <Input label="Role" value={data.role} onChange={(e) => patch({ role: e.target.value })} placeholder="Your title" />
    </div>
  );
}
