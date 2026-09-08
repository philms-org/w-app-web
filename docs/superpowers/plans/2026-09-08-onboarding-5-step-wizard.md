# Five-Step Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page `/profile/setup` with a 5-step onboarding wizard that collects the full profile, matching the iOS 5-step flow.

**Architecture:** `app/profile/setup/page.tsx` becomes a thin wizard shell — it owns one `OnboardingData` object and a `step` index (1–5), renders one step child component at a time, and shows a progress bar plus a fixed Back/Next/Finish footer. Each step child is a controlled component in `components/onboarding/` that reads a slice of `OnboardingData` and reports changes up. Nothing writes to the database until **Finish**, which calls the existing `upsertProfile` once with every field, flips `setupComplete`, and routes to `/main`. On mount the shell loads the user's existing `profiles` row and pre-fills, so re-entry (from ProfileTab "Complete profile") is non-destructive.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, React client components, Zustand store (`lib/store.ts`), Supabase via `lib/data.ts`. Styling: `lib/theme.ts` tokens + `components/ui/primitives.tsx` (`Button`, `Input`, `Chip`). No test runner in this repo — verification is `npx tsc --noEmit` + `npm run build` + a visual check in the preview browser.

**Spec:** `docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md` §1 (open questions resolved per the doc's recommendations: no bio field, photo stays in `profile/edit`, `relationship` kept in step 4, `height` dropped).

## Global Constraints

- **Light theme only.** All colour/spacing/radius/type from `lib/theme.ts` (`theme`, `type`, `radius`) and `components/ui/primitives.tsx`. No hardcoded hex except `#0D0D0F` for on-accent text. No `prefers-color-scheme` / dark wiring.
- **No new npm dependencies.**
- **No database migration.** Every column already exists on `profiles`: `city, nationality, profession, affiliation, industry, role, fave_drink, friday_night, relationship, dating_id, socialising_id, networking_id`, and the visibility flags `city_visible, profession_visible, fave_drink_visible, friday_night_visible`.
- **One write only.** `upsertProfile` is called exactly once, on Finish — never per-step.
- **Montserrat** stays the only font family (via `type.family`).
- **Route contract unchanged:** signed-in users with no `profiles.city` are sent here by `app/main/page.tsx` and `app/auth/login/page.tsx`; Finish must set `setupComplete` in the store and `router.push('/main')`.
- After every task: `npx tsc --noEmit` passes and `npm run build` passes (lint + type gates are on).
- Commit after every task with the message shown in its final step.

## Field reference (used by every task)

`profiles` columns written by Finish, grouped by step:

| Step | `profiles` columns | Store `User` fields to mirror |
|---|---|---|
| 1 Looking for | `dating_id`, `socialising_id`, `networking_id` (int or null) | `datingId`, `socialisingId`, `networkingId` (string) |
| 2 Location | `city`, `nationality` (text or null) | `city`, `nationality` |
| 3 Work | `profession`, `affiliation`, `industry`, `role` (text or null) | `profession` only |
| 4 Fun | `fave_drink`, `friday_night`, `relationship` (text or null) | `drink` (`fave_drink`), `activity` (`friday_night`), `relationship` |
| 5 Visibility | `city_visible`, `profession_visible`, `fave_drink_visible`, `friday_night_visible` (bool) | — (DB only) |

`affiliation`, `industry`, `role`, and the four `*_visible` flags have no field on the store `User` type — they persist to the DB via `upsertProfile` only and are not added to the store.

`LOOKING_FOR_OPTIONS` (from `lib/constants.ts`) has three groups — `socializing`, `business`, `love` — each an array of `{ id: number, emoji: string, label: string }`. `id: 0` is always "None".

---

## File Structure

- **Modify:** `app/profile/setup/page.tsx` — wizard shell only (state, nav, progress, footer, Finish). Loses all step markup.
- **Create:** `components/onboarding/types.ts` — `OnboardingData` type, `EMPTY_DATA`, `STEP_TITLES`, `profileToData()`, `dataToProfilePatch()`.
- **Create:** `components/onboarding/OptionButton.tsx` — the emoji + label selectable button (extracted from the current setup page; used by steps 1 and 4).
- **Create:** `components/onboarding/WizardProgress.tsx` — a 5-segment progress bar.
- **Create:** `components/onboarding/StepLookingFor.tsx` — step 1.
- **Create:** `components/onboarding/StepLocation.tsx` — step 2.
- **Create:** `components/onboarding/StepWork.tsx` — step 3.
- **Create:** `components/onboarding/StepFun.tsx` — step 4.
- **Create:** `components/onboarding/StepVisibility.tsx` — step 5 (toggles + review summary).

---

### Task 1: Data model + wizard shell

**Files:**
- Create: `components/onboarding/types.ts`
- Create: `components/onboarding/WizardProgress.tsx`
- Create: `scripts/verify-onboarding-data.mjs`
- Modify: `app/profile/setup/page.tsx` (full rewrite)

**Interfaces:**
- Produces:
  - `type OnboardingData` — a flat object with keys: `socialisingId, networkingId, datingId` (string, default `'0'`); `city, nationality, profession, affiliation, industry, role, favouriteDrink, fridayNight, relationship` (string, default `''`); `cityVisible, professionVisible, favouriteDrinkVisible, fridayNightVisible` (boolean, default `true`).
  - `const EMPTY_DATA: OnboardingData`.
  - `const STEP_TITLES: string[]` — length 5: `['Looking for', 'Where you are', 'What you do', 'The fun stuff', 'Who sees it']`.
  - `function profileToData(p: Partial<Profile> | null): OnboardingData` — maps a `profiles` row onto `OnboardingData`, falling back to `EMPTY_DATA` values for nulls. `*_id` numbers become strings; `*_visible` nulls become `true`.
  - `function dataToProfilePatch(id: string, d: OnboardingData): Partial<Profile> & { id: string }` — inverse: trims strings, empty string → `null`, parses `*Id` to int (or null when `'0'`), passes `*Visible` through.
  - `WizardProgress({ step, total }: { step: number; total: number })` — a `<div>` bar with `total` segments, the first `step` filled with `theme.accent`, the rest `theme.surface2`.
- Consumes: `Profile` from `@/lib/types`, `theme`/`type`/`radius` from `@/lib/theme`, `Button` from `@/components/ui/primitives`.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-onboarding-data.mjs`:

```js
// Standalone assertions — this repo has no test runner.
// Run: node scripts/verify-onboarding-data.mjs
import { EMPTY_DATA, STEP_TITLES, profileToData, dataToProfilePatch } from '../components/onboarding/types.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

eq(STEP_TITLES.length, 5, 'STEP_TITLES length');
eq(EMPTY_DATA.socialisingId, '0', 'EMPTY_DATA.socialisingId');
eq(EMPTY_DATA.city, '', 'EMPTY_DATA.city');
eq(EMPTY_DATA.cityVisible, true, 'EMPTY_DATA.cityVisible');

// profileToData: null row -> all empties
eq(profileToData(null), EMPTY_DATA, 'profileToData(null)');

// profileToData: numeric ids -> strings, visible nulls -> true
const d = profileToData({
  socialising_id: 2, networking_id: null, dating_id: 0,
  city: 'Lisbon', nationality: null, profession: 'DJ',
  fave_drink: 'Sometimes', friday_night: null, relationship: 'Open',
  city_visible: false, profession_visible: null,
});
eq(d.socialisingId, '2', 'profileToData socialising_id -> "2"');
eq(d.networkingId, '0', 'profileToData null id -> "0"');
eq(d.city, 'Lisbon', 'profileToData city');
eq(d.nationality, '', 'profileToData null text -> ""');
eq(d.cityVisible, false, 'profileToData city_visible false');
eq(d.professionVisible, true, 'profileToData null visible -> true');

// dataToProfilePatch: trims, "" -> null, "0" id -> null
const patch = dataToProfilePatch('u1', {
  ...EMPTY_DATA, socialisingId: '3', city: '  Berlin  ', profession: '',
  favouriteDrink: 'No', cityVisible: false,
});
eq(patch.id, 'u1', 'patch.id');
eq(patch.socialising_id, 3, 'patch socialising_id 3');
eq(patch.networking_id, null, 'patch "0" id -> null');
eq(patch.city, 'Berlin', 'patch trims city');
eq(patch.profession, null, 'patch "" -> null');
eq(patch.fave_drink, 'No', 'patch fave_drink');
eq(patch.city_visible, false, 'patch city_visible');

if (!process.exitCode) console.log('OK: onboarding data helpers verified');
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `node scripts/verify-onboarding-data.mjs`
Expected: FAIL — the import throws because `components/onboarding/types.ts` does not exist yet.

- [ ] **Step 3: Write `components/onboarding/types.ts`**

```ts
import type { Profile } from '@/lib/types';

export interface OnboardingData {
  socialisingId: string;
  networkingId: string;
  datingId: string;
  city: string;
  nationality: string;
  profession: string;
  affiliation: string;
  industry: string;
  role: string;
  favouriteDrink: string;
  fridayNight: string;
  relationship: string;
  cityVisible: boolean;
  professionVisible: boolean;
  favouriteDrinkVisible: boolean;
  fridayNightVisible: boolean;
}

export const EMPTY_DATA: OnboardingData = {
  socialisingId: '0',
  networkingId: '0',
  datingId: '0',
  city: '',
  nationality: '',
  profession: '',
  affiliation: '',
  industry: '',
  role: '',
  favouriteDrink: '',
  fridayNight: '',
  relationship: '',
  cityVisible: true,
  professionVisible: true,
  favouriteDrinkVisible: true,
  fridayNightVisible: true,
};

export const STEP_TITLES = [
  'Looking for',
  'Where you are',
  'What you do',
  'The fun stuff',
  'Who sees it',
];

const idToStr = (n: number | null | undefined): string =>
  n === null || n === undefined ? '0' : String(n);

const strOr = (s: string | null | undefined): string => s ?? '';

const boolOr = (b: boolean | null | undefined): boolean => b ?? true;

export function profileToData(p: Partial<Profile> | null): OnboardingData {
  if (!p) return { ...EMPTY_DATA };
  return {
    socialisingId: idToStr(p.socialising_id),
    networkingId: idToStr(p.networking_id),
    datingId: idToStr(p.dating_id),
    city: strOr(p.city),
    nationality: strOr(p.nationality),
    profession: strOr(p.profession),
    affiliation: strOr(p.affiliation),
    industry: strOr(p.industry),
    role: strOr(p.role),
    favouriteDrink: strOr(p.fave_drink),
    fridayNight: strOr(p.friday_night),
    relationship: strOr(p.relationship),
    cityVisible: boolOr(p.city_visible),
    professionVisible: boolOr(p.profession_visible),
    favouriteDrinkVisible: boolOr(p.fave_drink_visible),
    fridayNightVisible: boolOr(p.friday_night_visible),
  };
}

const trimOrNull = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

const idOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n === 0 ? null : n;
};

export function dataToProfilePatch(
  id: string,
  d: OnboardingData,
): Partial<Profile> & { id: string } {
  return {
    id,
    socialising_id: idOrNull(d.socialisingId),
    networking_id: idOrNull(d.networkingId),
    dating_id: idOrNull(d.datingId),
    city: trimOrNull(d.city),
    nationality: trimOrNull(d.nationality),
    profession: trimOrNull(d.profession),
    affiliation: trimOrNull(d.affiliation),
    industry: trimOrNull(d.industry),
    role: trimOrNull(d.role),
    fave_drink: trimOrNull(d.favouriteDrink),
    friday_night: trimOrNull(d.fridayNight),
    relationship: trimOrNull(d.relationship),
    city_visible: d.cityVisible,
    profession_visible: d.professionVisible,
    fave_drink_visible: d.favouriteDrinkVisible,
    friday_night_visible: d.fridayNightVisible,
  };
}
```

> Note on `idOrNull`: the verification asserts `socialisingId: '3' -> 3` and `'0' -> null`. The old page stored `0` for "None"; storing `null` instead is intentional and equivalent for every read site (Task 7 aligns the `login`/`register` mappers so `null` and `0` behave the same).

- [ ] **Step 4: Run the verification script — expect PASS**

Run: `node scripts/verify-onboarding-data.mjs`
Expected: `OK: onboarding data helpers verified`

- [ ] **Step 5: Write `components/onboarding/WizardProgress.tsx`**

```tsx
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
```

- [ ] **Step 6: Rewrite `app/profile/setup/page.tsx` as the shell**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { fetchProfile, upsertProfile } from '@/lib/data';
import { ChevronLeft } from 'lucide-react';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';
import WizardProgress from '@/components/onboarding/WizardProgress';
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
        {/* Task 2–6 replace this block with the step components. */}
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          Step {step} of {TOTAL_STEPS}
        </p>
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
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → completes (do **not** run this while a dev server is up — concurrent builds corrupt `.next`).

- [ ] **Step 8: Visual check**

Start the preview (`preview_start` with the dev script), navigate to `/profile/setup`.
Expected: light screen, header shows "Looking for" + a 5-segment progress bar with segment 1 filled. "Next" is **disabled** (step 1 gate, nothing picked). There is no way past step 1 yet — that's Task 2. Check `read_console_messages` for errors.

- [ ] **Step 9: Commit**

```bash
git add components/onboarding/types.ts components/onboarding/WizardProgress.tsx scripts/verify-onboarding-data.mjs app/profile/setup/page.tsx
git commit -m "onboarding: data model + 5-step wizard shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Step 1 — Looking For

**Files:**
- Create: `components/onboarding/OptionButton.tsx`
- Create: `components/onboarding/StepLookingFor.tsx`
- Modify: `app/profile/setup/page.tsx` (swap the placeholder block for the step switch)

**Interfaces:**
- Consumes: `OnboardingData` and the `patch` updater from Task 1; `LOOKING_FOR_OPTIONS` from `@/lib/constants`.
- Produces:
  - `OptionButton({ emoji, label, selected, accent, onClick }: { emoji: string; label: string; selected: boolean; accent: string; onClick: () => void })` — a full-width rounded-rect button; selected = filled `accent` + `#0D0D0F` text + weight 700, unselected = `theme.surface` + `theme.divider` border + `theme.text`.
  - `StepLookingFor({ data, patch }: { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void })` — three labelled groups (Socializing → `socialisingId` + `theme.accent`; Business → `networkingId` + `theme.accent2`; Love → `datingId` + `theme.warm1`), each a 2-col grid of `OptionButton`s bound to `LOOKING_FOR_OPTIONS`.

- [ ] **Step 1: Write `components/onboarding/OptionButton.tsx`**

```tsx
'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';

interface OptionButtonProps {
  emoji: string;
  label: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
}

export default function OptionButton({ emoji, label, selected, accent, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: radius.control,
        border: `2px solid ${selected ? accent : theme.divider}`,
        backgroundColor: selected ? accent : theme.surface,
        color: selected ? '#0D0D0F' : theme.text,
        fontSize: 14,
        fontWeight: selected ? 700 : 400,
        fontFamily: typeTokens.family,
        cursor: 'pointer',
        transition: 'all .15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Write `components/onboarding/StepLookingFor.tsx`**

```tsx
'use client';

import { Users, Briefcase, Heart } from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import { theme, type as typeTokens } from '@/lib/theme';
import OptionButton from './OptionButton';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 };
const heading: React.CSSProperties = { fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text };

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
          {LOOKING_FOR_OPTIONS.socializing.options.map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.accent}
              selected={data.socialisingId === o.id.toString()}
              onClick={() => patch({ socialisingId: o.id.toString() })}
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
          {LOOKING_FOR_OPTIONS.business.options.map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.accent2}
              selected={data.networkingId === o.id.toString()}
              onClick={() => patch({ networkingId: o.id.toString() })}
            />
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Heart style={{ width: 24, height: 24, color: theme.warm1 }} />
          <h3 style={heading}>Where you stand on dating</h3>
        </div>
        <div style={grid2}>
          {LOOKING_FOR_OPTIONS.love.options.map((o) => (
            <OptionButton
              key={o.id}
              emoji={o.emoji}
              label={o.label}
              accent={theme.warm1}
              selected={data.datingId === o.id.toString()}
              onClick={() => patch({ datingId: o.id.toString() })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Wire the step switch in `app/profile/setup/page.tsx`**

Add the import:

```tsx
import StepLookingFor from '@/components/onboarding/StepLookingFor';
```

Replace the placeholder block (the inner `<p>Step {step} of…</p>`) with:

```tsx
<div style={{ flex: 1, padding: '24px', paddingBottom: 96, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
  {step === 1 && <StepLookingFor data={data} patch={patch} />}
  {/* steps 2–5 added in Tasks 3–6 */}
</div>
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.

- [ ] **Step 5: Visual check**

Preview `/profile/setup`. Pick a "Socializing" option → it fills teal, "Next" **enables**. Tap Next → header switches to "Where you are", progress shows 2 segments filled, body is empty (Task 3). Back returns to step 1 with the pick still selected.

- [ ] **Step 6: Commit**

```bash
git add components/onboarding/OptionButton.tsx components/onboarding/StepLookingFor.tsx app/profile/setup/page.tsx
git commit -m "onboarding: step 1 — looking for

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Step 2 — Location

**Files:**
- Create: `components/onboarding/StepLocation.tsx`
- Modify: `app/profile/setup/page.tsx`

**Interfaces:**
- Consumes: `OnboardingData`, `patch`, `Input` from `@/components/ui/primitives`.
- Produces: `StepLocation({ data, patch }: Props)` — `city` (label "City") and `nationality` (label "Nationality (optional)") text inputs.

- [ ] **Step 1: Write `components/onboarding/StepLocation.tsx`**

```tsx
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
```

- [ ] **Step 2: Wire into the shell**

Import `StepLocation`; add inside the step block:

```tsx
{step === 2 && <StepLocation data={data} patch={patch} />}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 4: Visual check**

Preview: advance to step 2, type a city, Back/Next keeps the value.

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/StepLocation.tsx app/profile/setup/page.tsx
git commit -m "onboarding: step 2 — location

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Step 3 — Work

**Files:**
- Create: `components/onboarding/StepWork.tsx`
- Modify: `app/profile/setup/page.tsx`

**Interfaces:**
- Consumes: `OnboardingData`, `patch`, `Input`.
- Produces: `StepWork({ data, patch }: Props)` — `profession`, `affiliation`, `industry`, `role` text inputs, all optional.

- [ ] **Step 1: Write `components/onboarding/StepWork.tsx`**

```tsx
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
```

- [ ] **Step 2: Wire into the shell**

Import `StepWork`; add:

```tsx
{step === 3 && <StepWork data={data} patch={patch} />}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 4: Visual check**

Preview: step 3 renders four inputs, values persist across Back/Next.

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/StepWork.tsx app/profile/setup/page.tsx
git commit -m "onboarding: step 3 — work

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Step 4 — The fun stuff

**Files:**
- Create: `components/onboarding/StepFun.tsx`
- Modify: `app/profile/setup/page.tsx`

**Interfaces:**
- Consumes: `OnboardingData`, `patch`, `Input` and `Chip` from `@/components/ui/primitives`.
- Produces: `StepFun({ data, patch }: Props)` — `favouriteDrink` as three `Chip`s ("Yes" / "No" / "Sometimes", store the label verbatim), `fridayNight` text input, `relationship` as three `Chip`s ("Single" / "Taken" / "It's complicated").

- [ ] **Step 1: Write `components/onboarding/StepFun.tsx`**

```tsx
'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Input, Chip } from '@/components/ui/primitives';
import type { OnboardingData } from './types';

type Props = { data: OnboardingData; patch: (p: Partial<OnboardingData>) => void };

const DRINKS = ['Yes', 'No', 'Sometimes'];
const RELATIONSHIPS = ['Single', 'Taken', "It's complicated"];

const label: React.CSSProperties = { fontSize: typeTokens.label.fontSize, fontWeight: 600, color: theme.text, marginBottom: 6, display: 'block' };

export default function StepFun({ data, patch }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>The lighter stuff — all optional.</p>

      <div>
        <span style={label}>Do you drink?</span>
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
        <span style={label}>Relationship status</span>
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
```

- [ ] **Step 2: Wire into the shell**

Import `StepFun`; add:

```tsx
{step === 4 && <StepFun data={data} patch={patch} />}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 4: Visual check**

Preview: step 4 — tapping a drink chip selects it; tapping again clears it. Text input + relationship chips work. Values persist across Back/Next.

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/StepFun.tsx app/profile/setup/page.tsx
git commit -m "onboarding: step 4 — the fun stuff

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Step 5 — Visibility + review

**Files:**
- Create: `components/onboarding/StepVisibility.tsx`
- Modify: `app/profile/setup/page.tsx`

**Interfaces:**
- Consumes: `OnboardingData`, `patch`.
- Produces: `StepVisibility({ data, patch }: Props)` — four labelled toggle rows bound to `cityVisible` / `professionVisible` / `favouriteDrinkVisible` / `fridayNightVisible`, plus a read-only summary listing the non-empty values the user entered.

- [ ] **Step 1: Write `components/onboarding/StepVisibility.tsx`**

```tsx
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
```

- [ ] **Step 2: Wire into the shell**

Import `StepVisibility`; add:

```tsx
{step === 5 && <StepVisibility data={data} patch={patch} />}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 4: Visual check**

Preview: reach step 5, footer button reads "Complete setup". Toggles flip. Summary lists whatever you entered in steps 2–4. Tap Complete setup with a test account → lands on `/main`; re-open `/profile/setup` and confirm every value pre-fills (proves the round-trip through `dataToProfilePatch` + `profileToData`).

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/StepVisibility.tsx app/profile/setup/page.tsx
git commit -m "onboarding: step 5 — visibility + review, wire Finish

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Re-entry + read-site check

**Files:**
- Modify: `app/auth/login/page.tsx`, `app/auth/register/page.tsx`
- Verify (edit only if broken): `components/tabs/ProfileTab.tsx`, `app/main/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: confirmation the wizard is reachable and non-destructive from every entry point.

- [ ] **Step 1: Check the looking-for read sites**

Run:
```bash
grep -rn "socialisingId\|networkingId\|datingId\|socialising_id\|networking_id\|dating_id" app components lib
```
Expected read pattern: `user?.socialisingId !== '0'` (ProfileTab `lookingForItems`) and the `login`/`register` mappers doing `profile?.socialising_id != null ? String(...) : undefined`.
- `dataToProfilePatch` now writes `null` for "None" instead of `0`. `String(null)` never happens (the mapper guards `!= null`), so the store gets `undefined`, and `undefined !== '0'` is `true` — which would wrongly light up the ProfileTab pill for a user who picked "None".
- **Fix:** in the `login`/`register` profile mappers, treat `0` and `null` alike.

- [ ] **Step 2: Apply the mapper fix**

In `app/auth/login/page.tsx` and `app/auth/register/page.tsx`, for each of `dating_id` / `socialising_id` / `networking_id`:

```tsx
// before
datingId: profile?.dating_id != null ? String(profile.dating_id) : undefined,
// after
datingId: profile?.dating_id ? String(profile.dating_id) : '0',
```

(`register` may not set these three at all — if so, add them with the `'0'` fallback so the store shape is consistent.)

- [ ] **Step 3: Check the routing gate**

Run:
```bash
grep -rn "profile?.city\|setupComplete\|/profile/setup" app/main/page.tsx app/auth/login/page.tsx app/auth/register/page.tsx components/tabs/ProfileTab.tsx
```
Expected: `app/main/page.tsx` routes to `/profile/setup` when the store `user` has no `city`; `login` routes there when `!profile?.city`; `register` always routes there; `ProfileTab` "Complete profile" / "I'm Looking For" buttons `router.push('/profile/setup')`. No change needed — the wizard honours all of these (Finish sets `city` + `setupComplete`, and re-entry pre-fills).

- [ ] **Step 4: Typecheck + build + lint**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Run: `npm run lint` → no new errors.

- [ ] **Step 5: Full walk-through in the preview**

With a test account that has **no** profile row: register → lands on step 1 → complete all 5 steps → `/main`. Then from ProfileTab tap "Complete profile" → wizard re-opens with every value pre-filled → change one → Complete → ProfileTab reflects the change. Confirm a user who picks "None" for all three categories in step 1 cannot pass step 1 (Next stays disabled).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "onboarding: align looking-for read sites with null-for-None write

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (spec §1):
- 5-step wizard replacing the single page → Tasks 1–6. ✓
- Progress bar + Back/Next/Skip footer → Task 1 shell (`WizardProgress`, footer). "Skip" = Next is never blocked except the step-1 gate; optional steps advance freely. ✓
- Step contents (looking-for / city+nationality / profession+affiliation+industry+role / drink+friday+relationship / visibility+review) → Tasks 2–6, matching the spec table. ✓
- One `upsertProfile` on Finish → Task 1 `handleFinish`. ✓
- `setupComplete` + route `/main` → Task 1 `handleFinish`. ✓
- Non-destructive re-entry with pre-fill → Task 1 `useEffect` + `profileToData`; verified Task 6 Step 4 and Task 7 Step 5. ✓
- Resolved open questions: no bio (not in any task), photo left to `profile/edit` (not in any task), `relationship` in step 4 (Task 5), `height` dropped (absent from `OnboardingData`). ✓
- No migration → Global Constraints; every column confirmed present in the Field reference. ✓

**2. Placeholder scan:** No "TBD" / "add error handling" / "similar to Task N". Every code step is literal. Task 7 Step 2 is conditional but the exact before/after is given.

**3. Type consistency:** `OnboardingData` keys are used identically across Tasks 1–7. `patch: (p: Partial<OnboardingData>) => void` signature is the same in every step's `Props`. `profileToData` / `dataToProfilePatch` / `EMPTY_DATA` / `STEP_TITLES` names match between `types.ts`, the verification script, and the shell. `Chip` / `Input` / `Button` props match `components/ui/primitives.tsx` (`selected`, `onClick`, `style`, `label`, `value`, `onChange`, `fullWidth`, `disabled`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-08-onboarding-5-step-wizard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
