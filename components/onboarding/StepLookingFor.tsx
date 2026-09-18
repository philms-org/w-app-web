'use client';

import { Users, Briefcase, Heart } from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import { theme, type as typeTokens } from '@/lib/theme';
import OptionButton from './OptionButton';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 };
const heading: React.CSSProperties = { fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text };

// id 0 is "None" — represented by the default '0', not a pickable tile.
const pickable = (opts: { id: number; emoji: string; label: string }[]) => opts.filter((o) => o.id !== 0);
const toggle = (current: string, id: number) => (current === id.toString() ? '0' : id.toString());

export default function StepLookingFor({ data, patch }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
        Pick at least one — you can change these later.
      </p>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users style={{ width: 24, height: 24, color: theme.accent }} />
          <h3 style={heading}>Socializing</h3>
        </div>
        <div style={grid2}>
          {pickable(LOOKING_FOR_OPTIONS.socializing.options).map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.accent}
              selected={data.socialisingId === o.id.toString()}
              onClick={() => patch({ socialisingId: toggle(data.socialisingId, o.id) })}
            />
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Briefcase style={{ width: 24, height: 24, color: theme.accent2 }} />
          <h3 style={heading}>Business</h3>
        </div>
        <div style={grid2}>
          {pickable(LOOKING_FOR_OPTIONS.business.options).map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.accent2}
              selected={data.networkingId === o.id.toString()}
              onClick={() => patch({ networkingId: toggle(data.networkingId, o.id) })}
            />
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Heart style={{ width: 24, height: 24, color: theme.warm1 }} />
          <h3 style={heading}>Love is always in the air. Save time by letting people know what&apos;s up.</h3>
        </div>
        <div style={grid2}>
          {pickable(LOOKING_FOR_OPTIONS.love.options).map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.warm1}
              selected={data.datingId === o.id.toString()}
              onClick={() => patch({ datingId: toggle(data.datingId, o.id) })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
