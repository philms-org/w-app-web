'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { upsertProfile } from '@/lib/data';
import { ChevronLeft, Users, Briefcase, Heart } from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

type OptionButtonProps = {
  emoji: string;
  label: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
};

function OptionButton({ emoji, label, selected, accent, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px',
        borderRadius: radius.control,
        border: `2px solid ${selected ? accent : theme.divider}`,
        backgroundColor: selected ? accent : theme.surface,
        color: selected ? '#0D0D0F' : theme.text,
        fontSize: '14px',
        fontWeight: selected ? 700 : 400,
        fontFamily: typeTokens.family,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '18px' }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, setUser } = useStore();

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    datingId: '0',
    socialisingId: '0',
    networkingId: '0',
    nationality: '',
    city: '',
    drink: '',
    activity: '',
    profession: '',
  });

  const handleSave = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setIsLoading(true);

    try {
      await upsertProfile({
        id: user.id,
        display_name: user.name,
        dating_id: formData.datingId ? parseInt(formData.datingId, 10) : null,
        socialising_id: formData.socialisingId ? parseInt(formData.socialisingId, 10) : null,
        networking_id: formData.networkingId ? parseInt(formData.networkingId, 10) : null,
        nationality: formData.nationality || null,
        city: formData.city || null,
        fave_drink: formData.drink || null,
        friday_night: formData.activity || null,
        profession: formData.profession || null,
      });

      setUser({ ...user, ...formData, setupComplete: true });
      router.push('/main');
    } catch (err) {
      console.error('Profile save failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sectionStyle: React.CSSProperties = { marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' };
  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: typeTokens.heading.fontSize,
    fontWeight: 700,
    color: theme.text,
    fontFamily: typeTokens.family,
  };
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div
        style={{
          backgroundColor: theme.surface,
          padding: '16px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.divider}`,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ padding: '8px', marginLeft: '-8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.text }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>
          Set up your profile
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{ padding: '24px', paddingBottom: '96px' }}>
        <h2 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 700, marginBottom: '8px', color: theme.text, textAlign: 'center' }}>
          What are you looking for?
        </h2>
        <p style={{ color: theme.muted, marginBottom: '32px', fontSize: typeTokens.body.fontSize, textAlign: 'center' }}>
          Choose what type of connections you want
        </p>

        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users style={{ width: '24px', height: '24px', color: theme.accent }} />
            <h3 style={sectionHeadingStyle}>Socializing</h3>
          </div>
          <div style={grid2}>
            {LOOKING_FOR_OPTIONS.socializing.options.map((option) => (
              <OptionButton
                key={option.id}
                emoji={option.emoji}
                label={option.label}
                accent={theme.accent}
                selected={formData.socialisingId === option.id.toString()}
                onClick={() => setFormData((prev) => ({ ...prev, socialisingId: option.id.toString() }))}
              />
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Briefcase style={{ width: '24px', height: '24px', color: theme.accent2 }} />
            <h3 style={sectionHeadingStyle}>Business</h3>
          </div>
          <div style={grid2}>
            {LOOKING_FOR_OPTIONS.business.options.map((option) => (
              <OptionButton
                key={option.id}
                emoji={option.emoji}
                label={option.label}
                accent={theme.accent2}
                selected={formData.networkingId === option.id.toString()}
                onClick={() => setFormData((prev) => ({ ...prev, networkingId: option.id.toString() }))}
              />
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Heart style={{ width: '24px', height: '24px', color: theme.warm1 }} />
            <h3 style={sectionHeadingStyle}>Where you stand on dating</h3>
          </div>
          <div style={grid2}>
            {LOOKING_FOR_OPTIONS.love.options.map((option) => (
              <OptionButton
                key={option.id}
                emoji={option.emoji}
                label={option.label}
                accent={theme.warm1}
                selected={formData.datingId === option.id.toString()}
                onClick={() => setFormData((prev) => ({ ...prev, datingId: option.id.toString() }))}
              />
            ))}
          </div>
        </div>

        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            label="City"
            type="text"
            value={formData.city}
            onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="Your city"
          />
          <Input
            label="Profession"
            type="text"
            value={formData.profession}
            onChange={(e) => setFormData((prev) => ({ ...prev, profession: e.target.value }))}
            placeholder="What do you do for work?"
          />
          <Input
            label="Nationality"
            type="text"
            value={formData.nationality}
            onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
            placeholder="Your nationality"
          />
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.surface,
          borderTop: `1px solid ${theme.divider}`,
          padding: '16px 24px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <Button onClick={handleSave} fullWidth disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Complete setup'}
        </Button>
      </div>
    </div>
  );
}
