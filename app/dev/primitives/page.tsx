'use client';

import { useTheme } from '@/lib/hooks/useTheme';
import { theme } from '@/lib/theme';
import {
  Button, Card, Chip, Input, FeedRow,
  GlassPanel, GlowIconButton, SectionHeader, LockedOverlay, ReactionCount, WMark,
} from '@/components/ui/primitives';
import { Clock, Award, User } from 'lucide-react';

export default function PrimitivesPreview() {
  const { mode, toggle } = useTheme();
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={toggle} style={{ alignSelf: 'flex-start', padding: '8px 14px', background: theme.accent, color: theme.onAccent, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        mode: {mode} — toggle
      </button>

      <WMark size={40} style={{ color: theme.text }} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Chip>Unselected</Chip>
        <Chip selected>Selected</Chip>
      </div>

      <Input label="Location Name" placeholder="Enter a name" />
      <Input label="Bad field" hint="Something is wrong" invalid defaultValue="oops" />

      <Card><span>Plain card over the ground.</span></Card>
      <Card cta><span>CTA card (accent border).</span></Card>

      <GlassPanel floatingAction={<GlowIconButton icon={<span style={{ fontSize: 20 }}>+</span>} label="Add" />}>
        <SectionHeader>Friends</SectionHeader>
        <FeedRow title="Samira" subtitle={'Blue Note · "so good"'} trailing={<ReactionCount count={17} reacted />} divider />
        <FeedRow title="Barb" subtitle="Club Space" trailing={<ReactionCount count={10} />} divider />
        <FeedRow title="Sofia" subtitle="Hooters" trailing={<ReactionCount count={4} />} />
      </GlassPanel>

      <div style={{ display: 'flex', gap: 11 }}>
        <GlowIconButton icon={<Clock size={20} />} label="History" />
        <GlowIconButton icon={<Award size={20} />} label="Rewards" />
        <GlowIconButton icon={<User size={20} />} label="Profile" />
      </div>

      <LockedOverlay title="Unlock who's near" body="Finish setting up your friends to unlock who's closeby.">
        <FeedRow title="Hidden" subtitle="blurred" />
        <FeedRow title="Hidden" subtitle="blurred" />
        <FeedRow title="Hidden" subtitle="blurred" />
      </LockedOverlay>
    </div>
  );
}
