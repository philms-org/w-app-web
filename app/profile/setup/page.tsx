'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { fetchProfile, upsertProfile } from '@/lib/data';
import { ChevronLeft } from 'lucide-react';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';
import WizardProgress from '@/components/onboarding/WizardProgress';
import StepLookingFor from '@/components/onboarding/StepLookingFor';
import StepLocation from '@/components/onboarding/StepLocation';
import StepWork from '@/components/onboarding/StepWork';
import StepFun from '@/components/onboarding/StepFun';
import StepVisibility from '@/components/onboarding/StepVisibility';
import {
  EMPTY_DATA,
  STEP_TITLES,
  profileToData,
  dataToProfilePatch,
  type OnboardingData,
} from '@/components/onboarding/types';

const TOTAL_STEPS = STEP_TITLES.length;

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, setUser } = useStore();

  const [step, setStep] = useState(1); // 1-indexed
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill from the existing profile row (non-destructive re-entry).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => { if (!cancelled) setData(profileToData(p)); })
      .catch(() => { /* new user with no row yet — keep EMPTY_DATA */ });
    return () => { cancelled = true; };
  }, [user?.id]);

  const patch = (partial: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...partial }));

  const canAdvance = step !== 1
    ? true
    : data.socialisingId !== '0' || data.networkingId !== '0' || data.datingId !== '0';

  const handleBack = () => {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const handleFinish = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setIsSaving(true);
    try {
      await upsertProfile(dataToProfilePatch(user.id, data));
      setUser({
        ...user,
        socialisingId: data.socialisingId,
        networkingId: data.networkingId,
        datingId: data.datingId,
        city: data.city.trim(),
        nationality: data.nationality.trim(),
        profession: data.profession.trim(),
        drink: data.favouriteDrink.trim(),
        activity: data.fridayNight.trim(),
        relationship: data.relationship.trim() || undefined,
        setupComplete: true,
      });
      router.push('/main');
    } catch (err) {
      console.error('Onboarding save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          backgroundColor: theme.surface,
          padding: '16px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          borderBottom: `1px solid ${theme.divider}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button
            onClick={handleBack}
            aria-label="Back"
            style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
          >
            <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
          </button>
          <h1 style={{ flex: 1, textAlign: 'center', fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>
            {STEP_TITLES[step - 1]}
          </h1>
          <div style={{ width: 40 }} />
        </div>
        <WizardProgress step={step} total={TOTAL_STEPS} />
      </div>

      <div style={{ flex: 1, padding: '24px', paddingBottom: 96, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {step === 1 && <StepLookingFor data={data} patch={patch} />}
        {step === 2 && <StepLocation data={data} patch={patch} />}
        {step === 3 && <StepWork data={data} patch={patch} />}
        {step === 4 && <StepFun data={data} patch={patch} />}
        {step === 5 && <StepVisibility data={data} patch={patch} />}
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
        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} fullWidth disabled={!canAdvance}>
            Next
          </Button>
        ) : (
          <Button onClick={handleFinish} fullWidth disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Complete setup'}
          </Button>
        )}
      </div>
    </div>
  );
}
