# Guest-First Onboarding / Passwordless Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor reach the live feed and browse with zero signup, then collect only a name + email — no password — at the exact moment they check in, open venue messaging, or open their Profile, upgrading the same anonymous session in place rather than starting a new account.

**Architecture:** `/` bootstraps a Supabase **anonymous** session (instead of gating on a real account) and routes straight into `/main`. Three existing surfaces — the auto-checkin effect in `CheckedInHero`, `MessagesTab`, and `ProfileTab` — each check a new `isAnonymous` flag and, if true, show a locked state (reusing the existing `LockedOverlay` primitive) whose CTA opens one shared `VitalsGate` bottom sheet. Submitting it calls `supabase.auth.updateUser({ email, data: { display_name } })` on the *existing* session (no new account, same `auth.uid()`), then completes whatever action triggered the gate. Returning users get a magic-link mode instead of a password. `/auth/login` (password) is untouched and stays reachable for the app's existing real users.

**Tech Stack:** Next.js 15 App Router, TypeScript, React client components, Zustand (`lib/store.ts`), Supabase JS `2.110.7` (`@supabase/supabase-js`, confirmed installed version) for `signInAnonymously` / `updateUser` / `signInWithOtp`. Styling: `lib/theme.ts` tokens + `components/ui/primitives.tsx` (`Button`, `Input`, `LockedOverlay`). No new npm dependencies. No test runner in this repo — verification is `npx tsc --noEmit` + `npm run build` + `npm run lint` + manual QA in the preview browser (and, where noted, a live check against Supabase QA).

**Spec:** `docs/superpowers/specs/2026-09-15-guest-first-onboarding-design.md`

## Global Constraints

- **No new npm dependencies.**
- **No database migration, no RLS change.** Verified directly against prod schema — every table/policy this touches (`profiles`, `location_checkins`, `conversations`, `conversation_participants`) is already scoped to role `authenticated` + `auth.uid()`, which an anonymous Supabase session already satisfies. If any task discovers this isn't true for a table not checked in the spec, STOP and flag it — don't add RLS changes ad hoc.
- **Anonymous sign-ins must be enabled** on whatever Supabase project you're testing against before Task 2 can be verified end-to-end. Local dev: flip `enable_anonymous_sign_ins = true` in `supabase/config.toml` yourself (that file is local-only, safe to change without asking). **QA/prod dashboard toggles are explicitly NOT part of this plan** — the founder said not to push/deploy yet; don't enable anonymous sign-ins on QA or prod Supabase as a side effect of "getting the feature working." If you need to verify against QA, ask first.
- **Theme tokens only** — `theme`, `radius`, `type as typeTokens`, `glassBlur`, `elevation` from `lib/theme.ts`; no new hardcoded colors. Every new component follows the inline-`style` convention already used throughout `components/tabs/*.tsx` and `components/home/*.tsx` (this repo does not use a CSS framework beyond Tailwind utility classes in a few older files — new code here matches the majority inline-style pattern, not Tailwind classes).
- After every task: `npx tsc --noEmit`, `npm run build`, `npm run lint` all pass. **Never run `npm run build` with a dev server running** — if it happens, `rm -rf .next` and restart the dev server.
- Commit after every task with the message given in its final step.
- `/auth/register` and `/auth/login` are **not deleted or modified** by this plan (per spec §6 and Explicitly out of scope) — existing password accounts must keep working exactly as they do today.

## Reference (from the codebase, confirmed this session)

- `profiles` NOT NULL columns: `id`, `display_name`, `is_master_admin` (defaulted). Everything else nullable, including `email`. RLS: `profiles_insert_own` / `profiles_update_own`, both `to authenticated`, `with check (auth.uid() = id)`.
- `upsertProfile(profile: Partial<Profile> & { id: string })` — `lib/data.ts:47` — thin `.from('profiles').upsert(profile)` wrapper, already used exactly this way by `app/auth/register/page.tsx`.
- `lib/auth.ts` today exports `signUp`, `signIn`, `signInWithPhone`, `verifyOTP`, `signOut`, `requestPasswordReset`, `updatePassword`, `getCurrentUserId`, `getCurrentUser` — all thin wrappers around `supabase.auth.*`. This plan adds three more in the same style.
- `lib/store.ts` has **no** `onAuthStateChange` listener anywhere in the app (confirmed by repo-wide grep — the only hit is unrelated, inside `app/auth/reset/page.tsx`'s recovery-session handling). `isAuthenticated`/`user` are set **manually** by callers via `setUser`/`setToken` after every sign-in path (`register`, `login`). New code must follow this same manual pattern — do not introduce a global auth listener as part of this plan, that's a separate, larger change.
- `components/AuthedRedirect.tsx` (mounted in `app/page.tsx`) — today: `if (isAuthenticated) router.replace('/main')`, renders `null` otherwise. This is the file that becomes `EnsureSession` (Task 2).
- `app/main/page.tsx` — the route guard is `if (!isAuthenticated) router.push('/auth/login')` inside a `useEffect` gated on `hasHydrated`. The location-priming modal (`showLocationPrompt` / `handleAllowLocation` / `handleDenyLocation`, backed by `requestLocation()` from `lib/geolocation.ts`) already lives in this same file and already fires on every fresh mount with no `currentLocation` — **no change needed to that modal**, only to the guard above it (Task 3).
- **Check-in has no button.** It's automatic: `components/home/CheckedInHero.tsx`'s `useEffect` (lines ~163–189) calls `checkIn(selectedLocation.id)` the moment `withinGeofence` becomes true, guarded by a `checkInAttemptedFor` ref so it only fires once per venue. `selectedLocation` itself is set by tapping a venue in `components/tabs/MapTab.tsx:129` or `components/home/NearbyBanner.tsx:79` — **that tap stays completely free/ungated** (browsing a venue's card is not check-in). The gate belongs *inside* this effect, immediately before the `checkIn(...)` call (Task 5).
- `components/tabs/MessagesTab.tsx` — unconditionally calls `fetchConversations()` on mount and renders the list; gate wraps the whole component body (Task 6).
- `components/tabs/ProfileTab.tsx` — reads `user`/`logout` from the store, loads profile/badges on mount; gate wraps the identity-requiring parts, progressive fields render once identified (Task 7).
- `components/onboarding/` already models every remaining profile field independently: `types.ts` (`OnboardingData`, `EMPTY_DATA`, `profileToData`, `dataToProfilePatch`), `StepLocation.tsx` (props `{ data: OnboardingData; patch: (p: Partial<OnboardingData>) => void }` — same shape for every other `Step*` component). Task 7 reuses these directly; it does not rebuild field UI.
- `components/ui/primitives.tsx` already exports exactly the pieces this plan needs: `Button` (`variant: 'primary' | 'secondary' | 'ghost'`, `fullWidth`), `Input` (`label`, `hint`, `invalid`), `LockedOverlay({ title, body, children })` (blurred preview + centered lock icon/title/body — this is the existing "locked panel" pattern, reused as-is in Tasks 6–7, not rebuilt).
- Supabase JS installed version is `2.110.7`. `updateUser({ email, data })` on an anonymous session's error, when that email already belongs to a real account, has **not** been triggered live in this session — Task 4's last step is to actually trigger it against QA and confirm the exact `error.code` (best available evidence: GoTrue's documented server code for this case is `email_exists`; the code in Task 4 checks for that plus a message-substring fallback, and gets corrected in that same step if the live value differs).

---

## File Structure

**Create**
- `components/EnsureSession.tsx` — replaces `components/AuthedRedirect.tsx` (bootstraps an anonymous session for every visitor, not just already-authenticated ones).
- `components/onboarding/VitalsGate.tsx` — the shared name+email / magic-link bottom sheet.
- `components/onboarding/ProfileFieldsList.tsx` — progressive field rows for the Profile tab, reusing the existing `Step*` components.

**Modify**
- `lib/store.ts` — `User` gains `isAnonymous?: boolean`.
- `lib/auth.ts` — add `signInAnonymously`, `upgradeAnonymousUser`, `signInWithMagicLink`.
- `app/page.tsx` — `<AuthedRedirect />` → `<EnsureSession />`.
- `app/main/page.tsx` — guard redirects to `/` (not `/auth/login`) when there's no session at all.
- `components/home/CheckedInHero.tsx` — gate the auto-checkin effect.
- `components/tabs/MessagesTab.tsx` — gate with `LockedOverlay` + `VitalsGate`.
- `components/tabs/ProfileTab.tsx` — gate with `LockedOverlay` + `VitalsGate`; mount `ProfileFieldsList` once identified.

**Delete:** none. `components/AuthedRedirect.tsx` is replaced (git tracks the rename); `/auth/register`'s heavy form is deliberately left in place per spec (Deferred).

---

### Task 1: Store field + auth helpers

**Files:**
- Modify: `lib/store.ts`
- Modify: `lib/auth.ts`

**Interfaces:**
- Produces: `User.isAnonymous?: boolean` (store field). `signInAnonymously(): Promise<{ user: SupabaseUser; session: Session }>`. `upgradeAnonymousUser(email: string, displayName: string): Promise<{ user: SupabaseUser }>` — throws on failure, including the email-taken case (caller inspects `err`). `signInWithMagicLink(email: string): Promise<void>`.

- [ ] **Step 1: Add `isAnonymous` to the `User` interface**

In `lib/store.ts`, add one field to the existing `User` interface (near `setupComplete`):

```ts
interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  birth: string;
  image?: string;
  height?: string;
  relationship?: string;
  datingId?: string;
  socialisingId?: string;
  networkingId?: string;
  nationality?: string;
  city?: string;
  drink?: string;
  activity?: string;
  profession?: string;
  setupComplete?: boolean;
  isMasterAdmin?: boolean;
  isAnonymous?: boolean; // true until the vitals gate upgrades this session
}
```

No other change to `lib/store.ts` — `setUser`/`isAuthenticated` logic is unchanged; a `User` object with `isAnonymous: true` still makes `isAuthenticated` true, which is what lets an anonymous visitor reach `/main`.

- [ ] **Step 2: Add the three auth helpers to `lib/auth.ts`**

Append after the existing `signInWithPhone`/`verifyOTP` pair, before `signOut`:

```ts
// Anonymous session — created on every fresh visit (see components/EnsureSession.tsx).
// Supabase issues a real auth.uid() with role `authenticated` and an
// `is_anonymous: true` JWT claim; every RLS policy in this repo that checks
// `to authenticated` + `auth.uid()` already works for this session as-is.
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

// Upgrades the CURRENT (anonymous) session in place — same auth.uid(), no new
// account. Throws if the email already belongs to a different, real account;
// callers must catch that and fall back to signInWithMagicLink instead.
export async function upgradeAnonymousUser(email: string, displayName: string) {
  const { data, error } = await supabase.auth.updateUser({
    email,
    data: { display_name: displayName },
  });
  if (error) throw error;
  return data;
}

// Passwordless return path — replaces password login for the new flow.
// Existing password users can still use signIn() via /auth/login, untouched.
export async function signInWithMagicLink(email: string) {
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/main` : undefined;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/store.ts lib/auth.ts
git commit -m "$(cat <<'EOF'
Add anonymous-session auth helpers and User.isAnonymous flag

Lays the groundwork for guest-first onboarding: signInAnonymously,
upgradeAnonymousUser (upgrades the same session in place), and
signInWithMagicLink for passwordless return sign-in.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `EnsureSession` — anonymous bootstrap on `/`

**Files:**
- Create: `components/EnsureSession.tsx`
- Delete: `components/AuthedRedirect.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `signInAnonymously` (Task 1), `useStore` (`isAuthenticated`, `hasHydrated`, `setUser`, `setToken`).
- Produces: nothing new consumed elsewhere — this is a leaf, mount-only component.

- [ ] **Step 1: Write `components/EnsureSession.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { signInAnonymously } from '@/lib/auth';

// Mounted on the public landing page ("/"). Every visitor — not just
// returning authenticated ones — gets bounced straight into the app: an
// already-authenticated session goes in as-is, everyone else gets a fresh
// anonymous Supabase session first. Crawlers (no JS) never run this, so they
// still see the server-rendered marketing content in app/page.tsx untouched.
export default function EnsureSession() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, setUser, setToken } = useStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated) {
      router.replace('/main');
      return;
    }

    let cancelled = false;
    signInAnonymously()
      .then(({ user, session }) => {
        if (cancelled) return;
        setToken(session.access_token);
        setUser({
          id: user.id,
          name: '',
          email: '',
          phone: '',
          gender: '',
          birth: '',
          isAnonymous: true,
          setupComplete: false,
        });
        router.replace('/main');
      })
      .catch((err) => {
        // Anonymous sign-ins not enabled on this environment yet, or a
        // network failure — stay on the marketing page instead of a dead end.
        console.error('Anonymous session bootstrap failed:', err);
      });
    return () => { cancelled = true; };
  }, [hasHydrated, isAuthenticated, router, setUser, setToken]);

  return null;
}
```

- [ ] **Step 2: Delete `components/AuthedRedirect.tsx` and repoint `app/page.tsx`**

```bash
git rm components/AuthedRedirect.tsx
```

In `app/page.tsx`, change:

```tsx
import AuthedRedirect from '@/components/AuthedRedirect';
```
to
```tsx
import EnsureSession from '@/components/EnsureSession';
```

and change the single usage `<AuthedRedirect />` to `<EnsureSession />`. Nothing else in `app/page.tsx` changes — the marketing JSX, metadata, and `Get started`/`Sign in` links stay exactly as they are today (they remain reachable for no-JS/crawler visitors; a real browser visitor never lingers on them because `EnsureSession` redirects within one render).

- [ ] **Step 3: Enable anonymous sign-ins locally and verify manually**

In `supabase/config.toml`, set `enable_anonymous_sign_ins = true` (local dev only — do not touch QA/prod, per Global Constraints). Restart `supabase start` if it was already running (`supabase stop && supabase start`).

Run: `npm run dev`, open `/` in a private/incognito window (no existing session).
Expected: briefly flashes the marketing page, then lands on `/main` with the location-priming modal (unchanged behavior) — confirm via `supabase db query --linked` against local (`echo "select id, is_anonymous from auth.users order by created_at desc limit 1;" | supabase db query --local` if available, or check the Network tab for a `signInAnonymously` call succeeding) that a fresh `auth.users` row with `is_anonymous = true` was created.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/EnsureSession.tsx app/page.tsx
git rm components/AuthedRedirect.tsx
git commit -m "$(cat <<'EOF'
Bootstrap an anonymous session for every visitor to /

Replaces AuthedRedirect (which only handled already-authenticated
visitors) with EnsureSession: any visitor without a session gets a
fresh anonymous one and lands straight in /main, no signup wall.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Route guard — `/main` accepts anonymous sessions

**Files:**
- Modify: `app/main/page.tsx`

**Interfaces:**
- Consumes: `useStore` (`isAuthenticated`, `hasHydrated`) — unchanged shape.

- [ ] **Step 1: Change the redirect target**

In `app/main/page.tsx`, inside the existing `useEffect`:

```tsx
// Redirect to login if not authenticated
if (!isAuthenticated) {
  router.push('/auth/login');
  return;
}
```

becomes:

```tsx
// No session at all (e.g. a direct deep link before EnsureSession has run)
// — bootstrap one on the landing page rather than sending a first-time
// visitor to a login form they don't need.
if (!isAuthenticated) {
  router.push('/');
  return;
}
```

Nothing else in this file changes — the location-priming modal block below this guard already runs unmodified for any authenticated session, anonymous or not.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. In a private window, navigate directly to `/main` (skipping `/`).
Expected: bounces to `/` momentarily, then `EnsureSession` (Task 2) takes over and lands back on `/main` with a session — no flash of a login form.

Separately, confirm an existing real (password) account still works end-to-end: sign in via `/auth/login` with a QA test account, land on `/main` normally, no regression.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/main/page.tsx
git commit -m "$(cat <<'EOF'
Route /main's no-session guard to / instead of /auth/login

An anonymous session is now the normal case for a first-time visitor
— send anyone with no session at all to bootstrap one, not to a login
form. Existing password sign-in is untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `VitalsGate` component

**Files:**
- Create: `components/onboarding/VitalsGate.tsx`

**Interfaces:**
- Consumes: `upgradeAnonymousUser`, `signInWithMagicLink` (Task 1), `upsertProfile` (`lib/data.ts`), `useStore` (`user`, `setUser`), `Button`/`Input` (`components/ui/primitives.tsx`).
- Produces (for Tasks 5–7): `<VitalsGate open={boolean} intent={'checkin' | 'messages' | 'profile'} onClose={() => void} onIdentified={() => void} />`. `onIdentified` fires only after a successful **upgrade** (not after a magic link is sent — that's a separate return visit, nothing to resume in the current tab).

- [ ] **Step 1: Write `components/onboarding/VitalsGate.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { upgradeAnonymousUser, signInWithMagicLink } from '@/lib/auth';
import { upsertProfile } from '@/lib/data';
import { theme, radius, type as typeTokens, elevation } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

type Intent = 'checkin' | 'messages' | 'profile';

const INTENT_COPY: Record<Intent, string> = {
  checkin: "Add your name and email to check in — that's it.",
  messages: "Add your name and email to start chatting — that's it.",
  profile: 'Add your name and email to save a profile.',
};

// Server-side error code for "this email already belongs to another,
// real account" when upgrading an anonymous session (GoTrue's documented
// code is `email_exists`). Falls back to a message substring in case the
// exact code differs — confirmed/corrected against a live call in Step 4.
function isEmailTakenError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'email_exists') return true;
  return !!e.message && /already (registered|exists|in use)/i.test(e.message);
}

export default function VitalsGate({
  open,
  intent,
  onClose,
  onIdentified,
}: {
  open: boolean;
  intent: Intent;
  onClose: () => void;
  onIdentified: () => void;
}) {
  const { user, setUser } = useStore();
  const [mode, setMode] = useState<'new' | 'returning'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  if (!open) return null;

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isValidEmail(email)) return;
    setBusy(true);
    setError('');
    try {
      await upgradeAnonymousUser(email.trim(), name.trim());
      if (user) {
        await upsertProfile({ id: user.id, display_name: name.trim(), email: email.trim() });
        setUser({ ...user, name: name.trim(), email: email.trim(), isAnonymous: false });
      }
      onIdentified();
    } catch (err) {
      if (isEmailTakenError(err)) {
        setMode('returning');
        setError('');
      } else {
        setError("Couldn't save that — try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;
    setBusy(true);
    setError('');
    try {
      await signInWithMagicLink(email.trim());
      setLinkSent(true);
    } catch {
      setError("Couldn't send the link — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: theme.surface,
          borderTop: `1px solid ${theme.glassBorder}`,
          borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
          padding: '22px 22px calc(22px + env(safe-area-inset-bottom, 10px))',
          boxShadow: elevation.sheet,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.divider, margin: '0 auto 16px' }} />

        {mode === 'new' ? (
          <>
            <p style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
              Almost there
            </p>
            <h3 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 4px' }}>
              {INTENT_COPY[intent]}
            </h3>
            <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '2px 0 16px', lineHeight: 1.5 }}>
              No password to create. We&apos;ll email a confirmation, but you&apos;re in right away.
            </p>
            <form onSubmit={handleSubmitVitals} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input label="Name" name="name" autoComplete="name" placeholder="Jordan Ruiz"
                value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p style={{ color: theme.accent2, fontSize: typeTokens.caption.fontSize, margin: 0 }}>{error}</p>}
              <Button type="submit" fullWidth disabled={busy || !name.trim() || !isValidEmail(email)}>
                {busy ? 'Saving…' : 'Continue'}
              </Button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button type="button" onClick={() => setMode('returning')}
                style={{ background: 'none', border: 'none', color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer' }}>
                Already checked in before? Sign in
              </button>
            </div>
          </>
        ) : linkSent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <h3 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 6px' }}>Check your inbox</h3>
            <p style={{ fontSize: typeTokens.body.fontSize, color: theme.muted, margin: 0 }}>
              We sent a sign-in link to {email}.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
              Welcome back
            </p>
            <h3 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 4px' }}>
              Sign in with a magic link
            </h3>
            <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '2px 0 16px', lineHeight: 1.5 }}>
              No password — we&apos;ll email you a one-tap link.
            </p>
            <form onSubmit={handleSendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p style={{ color: theme.accent2, fontSize: typeTokens.caption.fontSize, margin: 0 }}>{error}</p>}
              <Button type="submit" fullWidth disabled={busy || !isValidEmail(email)}>
                {busy ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button type="button" onClick={() => setMode('new')}
                style={{ background: 'none', border: 'none', color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer' }}>
                New here? Get instant access
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (This component isn't mounted anywhere yet — Tasks 5–7 wire it in — so there's nothing to click-test until then; confirm it at least compiles now.)

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/VitalsGate.tsx
git commit -m "$(cat <<'EOF'
Add VitalsGate: the shared name+email / magic-link bottom sheet

Not wired into any screen yet (Tasks 5-7 do that) — this task is the
component + the anonymous-session upgrade logic on its own.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Confirm the email-collision error shape against QA (do this once, before Task 6/7's manual QA passes)**

With a QA test account's real email (one that's already registered, non-anonymous), go through Task 5 or 6's flow once anonymous sign-ins are enabled on QA (ask the founder first — see Global Constraints), submit that email in the "new" mode, and confirm `isEmailTakenError` actually catches it and flips to the magic-link mode. If the thrown error's `code`/`message` doesn't match, update `isEmailTakenError` in this file and amend this task's commit (`git commit --amend`, since nothing downstream depends on the exact error shape being right on the first try — only on catching *some* real error consistently).

---

### Task 5: Gate check-in in `CheckedInHero`

**Files:**
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `VitalsGate` (Task 4), `useStore().user?.isAnonymous`.

- [ ] **Step 1: Import `VitalsGate` and add gate state**

Near the top of `CheckedInHero`, alongside the existing `useState` calls:

```tsx
import VitalsGate from '@/components/onboarding/VitalsGate';
// ...
const { selectedLocation, setSelectedLocation, currentLocation, user } = useStore();
// ...
const [showVitalsGate, setShowVitalsGate] = useState(false);
```

(`user` joins the existing destructure from `useStore()` at the top of the component — it's already importing `useStore` from `@/lib/store`.)

- [ ] **Step 2: Gate the auto-checkin effect**

The existing effect (today, lines ~163–189):

```tsx
if (withinGeofence && checkInAttemptedFor.current !== selectedLocation.id) {
  checkInAttemptedFor.current = selectedLocation.id;
  checkIn(selectedLocation.id)
    .then(() => setCheckedIn(true))
    .catch((err) => {
      checkInAttemptedFor.current = null;
      console.error('Check-in failed:', err);
    });
}
```

becomes:

```tsx
if (withinGeofence && checkInAttemptedFor.current !== selectedLocation.id) {
  if (user?.isAnonymous) {
    setShowVitalsGate(true);
  } else {
    checkInAttemptedFor.current = selectedLocation.id;
    checkIn(selectedLocation.id)
      .then(() => setCheckedIn(true))
      .catch((err) => {
        checkInAttemptedFor.current = null;
        console.error('Check-in failed:', err);
      });
  }
}
```

Note this intentionally does **not** set `checkInAttemptedFor.current` in the anonymous branch — so once the gate succeeds, the effect's own dependency on `withinGeofence`/`selectedLocation` re-running (triggered by the `isAnonymous` flip in Step 3 below) naturally retries the same `if` block and this time takes the real check-in path.

- [ ] **Step 3: Render the gate and complete check-in on success**

Near the end of the component's JSX (inside the existing top-level `return`, alongside the other conditionally-rendered modals like `CreateGroupModal`):

```tsx
{showVitalsGate && (
  <VitalsGate
    open={showVitalsGate}
    intent="checkin"
    onClose={() => setShowVitalsGate(false)}
    onIdentified={() => setShowVitalsGate(false)}
  />
)}
```

Because `onIdentified` just closes the sheet, and `VitalsGate` already updated `user.isAnonymous` to `false` in the store (Task 4, Step 1), the effect from Step 2 re-runs on that store change (it already depends on nothing that would block this — `withinGeofence`/`selectedLocation`/`loadPresence` are unchanged, and the component re-renders on any `useStore()` value changing) and this time takes the `else` branch, actually calling `checkIn`. No manual "resume" plumbing needed.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. As a fresh anonymous session (private window), select a venue you're within the geofence of (or temporarily lower `radius` on a test venue in QA to make this easy — revert after). Confirm the vitals sheet appears instead of an immediate check-in; submit a fresh test email; confirm the sheet closes and `checkedIn` becomes true (the "Venue Chat" pill and Connections card appear). Then `supabase db query --linked` against QA: `select * from location_checkins where user_id = '<that anon uid>';` — confirm exactly one row, `checked_out_at is null`.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 6: Commit**

```bash
git add components/home/CheckedInHero.tsx
git commit -m "$(cat <<'EOF'
Gate auto-checkin behind the vitals sheet for anonymous sessions

Check-in is automatic (geofence-triggered) — an anonymous session now
sees the name+email sheet at that exact moment instead of silently
checking in with no identity. Existing identified users: unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Gate `MessagesTab`

**Files:**
- Modify: `components/tabs/MessagesTab.tsx`

**Interfaces:**
- Consumes: `VitalsGate` (Task 4), `LockedOverlay` (`components/ui/primitives.tsx`), `useStore().user?.isAnonymous`.

- [ ] **Step 1: Add the gate around the existing content**

At the top of `MessagesTab`, add:

```tsx
import VitalsGate from '@/components/onboarding/VitalsGate';
import { LockedOverlay } from '@/components/ui/primitives';
// ...
const { setActiveChat, setActiveTab, user } = useStore();
const [showVitalsGate, setShowVitalsGate] = useState(false);
```

Wrap the component's existing return value: the simplest correct change is to branch at the top of the function body, before the `loadConversations`/`useEffect` calls run — but those hooks must still run unconditionally (Rules of Hooks), so the branch happens in the **returned JSX**, not by early-returning before the hooks. Keep every existing `useState`/`useEffect`/`useCallback` exactly where they are; only change the final `return`:

```tsx
if (user?.isAnonymous) {
  return (
    <div style={{ padding: 20 }}>
      <LockedOverlay
        title="Say hi when you're ready"
        body="Messaging unlocks the moment you check in somewhere or want to reach out — just your name and email, no password."
      >
        {/* A plausible-looking blurred backdrop: reuse the same empty-state
           shape the real list uses, just static. */}
        <div style={{ height: 220 }} />
      </LockedOverlay>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button onClick={() => setShowVitalsGate(true)}>Unlock messaging</Button>
      </div>
      <VitalsGate
        open={showVitalsGate}
        intent="messages"
        onClose={() => setShowVitalsGate(false)}
        onIdentified={() => setShowVitalsGate(false)}
      />
    </div>
  );
}

// ...existing return (the real conversation list / ChatView) unchanged below
```

Add `Button` to the existing `components/ui/primitives` import if it isn't already imported in this file (check first — `MessagesTab.tsx` may not currently import it).

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. As a fresh anonymous session, open the Messages tab (via `AppHeader`/wherever `setActiveTab('messages')` is triggered) — confirm the locked panel shows instead of `fetchConversations()`'s result, tapping "Unlock messaging" opens the sheet, submitting vitals closes it and re-renders the real conversation list (now that `user.isAnonymous` is `false`, the component's top-level branch takes the other path on next render).

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/tabs/MessagesTab.tsx
git commit -m "$(cat <<'EOF'
Gate Messages tab behind the vitals sheet for anonymous sessions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Gate `ProfileTab` + progressive fields

**Files:**
- Create: `components/onboarding/ProfileFieldsList.tsx`
- Modify: `components/tabs/ProfileTab.tsx`

**Interfaces:**
- Consumes: `VitalsGate` (Task 4), `LockedOverlay`/`Button` (primitives), `OnboardingData`/`EMPTY_DATA`/`profileToData`/`dataToProfilePatch` + every `Step*` component (`components/onboarding/`), `fetchProfile`/`upsertProfile`/`uploadAvatar` (`lib/data.ts`).
- Produces: `<ProfileFieldsList userId={string} />` — self-contained, loads and saves its own state, nothing else depends on it.

- [ ] **Step 1: Write `components/onboarding/ProfileFieldsList.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchProfile, upsertProfile, uploadAvatar } from '@/lib/data';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Camera, ChevronDown, ChevronRight } from 'lucide-react';
import StepLocation from './StepLocation';
import StepWork from './StepWork';
import StepFun from './StepFun';
import StepLookingFor from './StepLookingFor';
import { EMPTY_DATA, profileToData, dataToProfilePatch, type OnboardingData } from './types';

type FieldKey = 'photo' | 'city' | 'looking' | 'work' | 'fun';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'city', label: 'Where you are' },
  { key: 'looking', label: 'Looking for' },
  { key: 'work', label: 'What you do' },
  { key: 'fun', label: 'Fun stuff' },
];

export default function ProfileFieldsList({ userId, avatarUrl }: { userId: string; avatarUrl?: string | null }) {
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [avatar, setAvatar] = useState<string | null | undefined>(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => { if (!cancelled) setData(profileToData(p)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const savePatch = (patch: Partial<OnboardingData>) => {
    const next = { ...data, ...patch };
    setData(next);
    upsertProfile(dataToProfilePatch(userId, next)).catch((err) =>
      console.error('Profile field save failed:', err)
    );
  };

  const handlePickPhoto = async (file: File) => {
    try {
      const url = await uploadAvatar(file, userId);
      setAvatar(url);
      await upsertProfile({ id: userId, avatar_url: url });
    } catch (err) {
      console.error('Avatar upload failed:', err);
    }
  };

  const isDone = (key: FieldKey): boolean => {
    switch (key) {
      case 'photo': return !!avatar;
      case 'city': return !!data.city.trim();
      case 'looking': return data.socialisingId !== '0' || data.networkingId !== '0' || data.datingId !== '0';
      case 'work': return !!data.profession.trim();
      case 'fun': return !!data.favouriteDrink.trim() || !!data.fridayNight.trim();
    }
  };

  const doneCount = FIELDS.filter((f) => isDone(f.key)).length;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: radius.card }}>
      <div style={{ padding: '14px 16px 0' }}>
        <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: 0 }}>
          {doneCount} of {FIELDS.length} details added
        </p>
        <div style={{ height: 6, borderRadius: 999, background: theme.pill, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(doneCount / FIELDS.length) * 100}%`, background: theme.accent2, borderRadius: 999 }} />
        </div>
      </div>

      {FIELDS.map(({ key, label }) => (
        <div key={key} style={{ borderTop: `1px solid ${theme.divider}` }}>
          <button
            onClick={() => key === 'photo' ? fileInputRef.current?.click() : setOpen(open === key ? null : key)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {key === 'photo' ? <Camera size={17} color={theme.text} /> : <span style={{ fontSize: 15 }}>{isDone(key) ? '✓' : ''}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: typeTokens.body.fontSize, fontWeight: 700, color: theme.text, margin: 0 }}>{label}</p>
              <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '1px 0 0' }}>
                {isDone(key) ? 'Added' : 'Not added yet'}
              </p>
            </div>
            {key !== 'photo' && (open === key ? <ChevronDown size={16} color={theme.muted} /> : <ChevronRight size={16} color={theme.muted} />)}
          </button>
          {open === key && key === 'city' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepLocation data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'looking' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepLookingFor data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'work' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepWork data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'fun' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepFun data={data} patch={savePatch} />
            </div>
          )}
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickPhoto(f); }}
      />
    </div>
  );
}
```

`StepLookingFor`/`StepWork`/`StepFun` are siblings of `StepLocation` in `components/onboarding/`, all sharing the `{ data: OnboardingData; patch: (p: Partial<OnboardingData>) => void }` prop shape (confirmed via `app/profile/setup/page.tsx`'s usage of all five `Step*` components with identical props). `savePatch` here saves immediately on every field change — same as the existing `patch` pattern in `app/profile/setup/page.tsx`, just persisted per-call instead of batched until "Finish".

- [ ] **Step 2: Gate `ProfileTab` and mount the list**

In `components/tabs/ProfileTab.tsx`, add near the top:

```tsx
import VitalsGate from '@/components/onboarding/VitalsGate';
import ProfileFieldsList from '@/components/onboarding/ProfileFieldsList';
import { LockedOverlay, Button } from '@/components/ui/primitives';
// ...
const [showVitalsGate, setShowVitalsGate] = useState(false);
```

At the top of the function body (after existing hooks — same Rules-of-Hooks constraint as Task 6, branch in the returned JSX):

```tsx
if (user?.isAnonymous) {
  return (
    <div style={{ padding: 20 }}>
      <LockedOverlay
        title="Set up your guest profile"
        body="Save a name so people you meet can find you again. Everything else can wait."
      >
        <div style={{ height: 220 }} />
      </LockedOverlay>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button onClick={() => setShowVitalsGate(true)}>Set up guest profile</Button>
      </div>
      <VitalsGate
        open={showVitalsGate}
        intent="profile"
        onClose={() => setShowVitalsGate(false)}
        onIdentified={() => setShowVitalsGate(false)}
      />
    </div>
  );
}
```

Then, in the existing identified-user JSX, mount `<ProfileFieldsList userId={user.id} avatarUrl={user.image} />` — place it directly below the existing profile header (avatar/name row) and above the existing `menuItems` list, so it reads as "your details" before "connections / logout / etc." Exact insertion point: wherever the current return's top section (avatar, name, `ThemeToggle`) ends and the `menuItems.map(...)` list begins — read the surrounding ~40 lines at execution time to match existing spacing/structure rather than guessing indentation blind.

- [ ] **Step 3: Manual verification**

As a fresh anonymous session: open Profile tab, confirm locked panel + "Set up guest profile" CTA; submit vitals; confirm the real profile header + `ProfileFieldsList` renders. Tap each field row, save a value, confirm the "N of 5" counter increments and a `supabase db query --linked` against QA on `profiles` shows the field persisted. Upload a photo via the Photo row; confirm `avatar_url` updates.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/ProfileFieldsList.tsx components/tabs/ProfileTab.tsx
git commit -m "$(cat <<'EOF'
Gate Profile tab; add incremental field completion

Anonymous sessions see the vitals gate before Profile; identified
users get each remaining field (photo, city, looking-for, work, fun)
as an independently-saveable row instead of a forced linear wizard.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** every numbered item in the spec's Scope (§1–7) maps to a task: anonymous session on landing → Task 2; location priming unchanged → confirmed no-op in Task 3's Reference note; vitals gate on check-in/messaging/profile → Tasks 5/6/7; passwordless upgrade-in-place → Task 4; magic-link return path → Task 4; progressive profile → Task 7; anonymous-sign-ins infra → Global Constraints (local only) + Task 4 Step 4 / Deferred (QA/prod explicitly not this plan's job).
- **Existing-user compatibility (spec §6):** covered by Task 4's `isEmailTakenError` branch and Task 3/Task 1's explicit "don't touch `/auth/login`" constraint, verified in Task 3 Step 2.
- **No RLS/migration task exists** — intentional, matches the spec's verified conclusion; Global Constraints tells any executor to stop and flag rather than improvise one if reality disagrees.
- **Unused-import fix (self-review pass):** Task 4's original draft imported `glassBlur` from `lib/theme` without using it (the sheet uses a solid `theme.surface` background, matching the register/login forms' existing solid-surface convention, not the glass treatment) — removed from the import.
- **Type consistency fix (self-review pass):** Task 7's original draft imported `Button` in `ProfileFieldsList.tsx` without using it — removed from that file's imports (`ProfileFieldsList` has no buttons of its own, only field rows). `Button` is still correctly imported in `ProfileTab.tsx` itself (Task 7 Step 2) for the "Set up guest profile" CTA, and in `MessagesTab.tsx` (Task 6 Step 1) for "Unlock messaging".
