# QR / Links Contact Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a curated 2×3 grid of contact methods ("My Links"), and turn the post-scan screen into a tappable "User Links" view with real deep links.

**Architecture:** One shared `ContactGrid` component renders six `slot_order` positions (0–5) in two modes: **editable** (My Links — tap a slot to open `EditLinkSheet`) and **readonly** (User Links — tap an enabled slot to open its `tel:` / `mailto:` / `https://…` link). Contact-type metadata (label, icon, input hint, link template) lives in one `lib/contact-methods.ts` constant so web and iOS can share the vocabulary. The `contact_methods` table and its `fetch`/`upsert` helpers already exist — this plan adds UI plus, if needed, one RLS policy so a connected user can read another user's enabled rows.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, React client components, Supabase (`lib/data.ts`), Zustand (`lib/store.ts`). Styling: `lib/theme.ts` tokens + `components/ui/primitives.tsx` (`Button`, `Input`, `Card`). Supabase CLI (token auth) for the migration. No test runner — verification is `npx tsc --noEmit` + `npm run build` + a visual check in the preview browser, plus a `node` assertion script for the link helpers.

**Spec:** `docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md` §2 (open questions resolved per the doc's recommendations: the type list below is O2.1; My Links is its own route linked from ProfileTab + ConnectSheet per O2.3; the RLS policy is O2.2, added only if Task 4's check shows it's missing).

## Global Constraints

- **Light theme only.** Colour/radius/type from `lib/theme.ts` and `components/ui/primitives.tsx`. `#0D0D0F` is the only allowed hardcoded hex (on-accent text).
- **No new npm dependencies.**
- **Reuse, don't fork.** `ContactGrid` is used by both My Links and `ConnectResult`. Do not write two grids.
- **`type` column stays free text.** The vocabulary is a client constant; unknown types (e.g. an iOS-added one) must render with a sensible fallback (generic icon, `value` shown as-is, no deep link).
- **Six slots, fixed.** `slot_order` 0–5. Empty slots show "+ Add" in edit mode and are hidden in readonly mode.
- **Migration number is 0021** (0020 is the unbuilt `location_requests` worktree). Only add it if Task 4 Step 1 shows the read policy is missing.
- After every task: `npx tsc --noEmit` and `npm run build` pass (lint + type gates on). Never run `npm run build` while a dev server is up.
- Commit after every task with the message in its final step.

## Existing pieces (do not rebuild)

- `ContactMethod` type (`lib/types.ts`): `{ id: string; user_id: string; slot_order: number; type: string; value?: string | null; is_enabled: boolean }`.
- `fetchContactMethods(userId: string): Promise<ContactMethod[]>` — ordered by `slot_order`.
- `upsertContactMethod(method: Partial<ContactMethod> & { user_id: string }): Promise<void>` — upserts one row.
- `components/connect/ConnectResult.tsx` — the post-scan screen. Already fetches the other user's `fetchContactMethods(otherId)`, filters `is_enabled`, renders them as buttons, and calls `recordContactMethodChoice(connectionId, type)` on tap. This plan replaces its bespoke list with `ContactGrid` readonly + deep links; the `recordContactMethodChoice` call is preserved.
- `app/main/connect/scan/page.tsx` mounts `<ConnectResult connectionId={...} />` after a scan.
- `app/main/connections/page.tsx` — the connections list (avatar + name + unfriend per row).
- `components/home/ConnectSheet.tsx` — the Home "Connect" panel (rotating QR + "Scan a code").
- `components/tabs/ProfileTab.tsx` — `menuItems` array drives the profile menu.

---

## File Structure

- **Create:** `lib/contact-methods.ts` — `CONTACT_TYPES`, `contactTypeMeta(type)`, `contactLink(type, value)`, `DEFAULT_SLOTS`.
- **Create:** `components/connect/ContactGrid.tsx` — the 2×3 grid, `mode: 'edit' | 'readonly'`.
- **Create:** `components/connect/EditLinkSheet.tsx` — per-slot editor (bottom sheet).
- **Create:** `app/main/connect/links/page.tsx` — My Links route.
- **Create:** `scripts/verify-contact-links.mjs` — link-helper assertions.
- **Modify:** `components/connect/ConnectResult.tsx` — use `ContactGrid` readonly.
- **Modify:** `components/home/ConnectSheet.tsx` — add "My Links" link.
- **Modify:** `components/tabs/ProfileTab.tsx` — add "My Links" menu item.
- **Modify:** `app/main/connections/page.tsx` — per-row "View links" opening a readonly `ContactGrid` sheet.
- **Create (conditional, Task 4):** `supabase/migrations/0021_contact_methods_connected_read.sql`.

---

### Task 1: Contact-type vocabulary + link helpers

**Files:**
- Create: `lib/contact-methods.ts`
- Create: `scripts/verify-contact-links.mjs`

**Interfaces:**
- Produces:
  - `interface ContactTypeMeta { type: string; label: string; icon: LucideIcon; hint: string; buildLink: (value: string) => string | null }`.
  - `const CONTACT_TYPES: ContactTypeMeta[]` — in this order: `phone, email, instagram, whatsapp, linkedin, snapchat, x, telegram, website, custom`.
  - `function contactTypeMeta(type: string): ContactTypeMeta` — returns the match, or a fallback `{ type, label: type, icon: Link2, hint: '', buildLink: () => null }` for unknown types.
  - `function contactLink(type: string, value: string | null | undefined): string | null` — `contactTypeMeta(type).buildLink(value.trim())` when `value` is non-empty, else `null`.
  - `const DEFAULT_SLOTS: string[]` — length 6: `['phone', 'email', 'instagram', 'whatsapp', 'linkedin', 'custom']` (per O2.1 recommendation).
- Consumes: `lucide-react` icons (`Phone, Mail, Instagram, MessageCircle, Linkedin, Ghost, Twitter, Send, Globe, Link2`).

- [ ] **Step 1: Write the assertion script**

Create `scripts/verify-contact-links.mjs`:

```js
// Standalone assertions — this repo has no test runner.
// Run: node scripts/verify-contact-links.mjs
import { CONTACT_TYPES, contactTypeMeta, contactLink, DEFAULT_SLOTS } from '../lib/contact-methods.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

eq(CONTACT_TYPES.length, 10, 'CONTACT_TYPES length');
eq(CONTACT_TYPES[0].type, 'phone', 'first type is phone');
eq(DEFAULT_SLOTS.length, 6, 'DEFAULT_SLOTS length');

// known link templates
eq(contactLink('phone', ' +1 555 111 '), 'tel:+1555111', 'phone -> tel: (spaces stripped)');
eq(contactLink('email', ' a@b.com '), 'mailto:a@b.com', 'email -> mailto:');
eq(contactLink('instagram', '@handle'), 'https://instagram.com/handle', 'instagram strips @');
eq(contactLink('instagram', 'handle'), 'https://instagram.com/handle', 'instagram bare handle');
eq(contactLink('whatsapp', '+1 555 111'), 'https://wa.me/1555111', 'whatsapp digits only, no +');
eq(contactLink('linkedin', 'in/jane'), 'https://linkedin.com/in/jane', 'linkedin path');
eq(contactLink('x', '@jane'), 'https://x.com/jane', 'x strips @');
eq(contactLink('telegram', 'jane'), 'https://t.me/jane', 'telegram');
eq(contactLink('website', 'example.com'), 'https://example.com', 'website adds https://');
eq(contactLink('website', 'https://example.com'), 'https://example.com', 'website keeps existing scheme');

// empty / custom / unknown
eq(contactLink('phone', ''), null, 'empty value -> null');
eq(contactLink('phone', '   '), null, 'whitespace value -> null');
eq(contactLink('custom', 'anything'), null, 'custom -> no link');
eq(contactLink('mastodon', 'x'), null, 'unknown type -> no link');
eq(contactTypeMeta('mastodon').label, 'mastodon', 'unknown type label falls back to type');

if (!process.exitCode) console.log('OK: contact link helpers verified');
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `node scripts/verify-contact-links.mjs`
Expected: FAIL — import throws, `lib/contact-methods.ts` does not exist.

- [ ] **Step 3: Write `lib/contact-methods.ts`**

```ts
import type { LucideIcon } from 'lucide-react';
import {
  Phone, Mail, Instagram, MessageCircle, Linkedin, Ghost, Twitter, Send, Globe, Link2,
} from 'lucide-react';

export interface ContactTypeMeta {
  type: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  buildLink: (value: string) => string | null;
}

const digits = (v: string) => v.replace(/[^\d]/g, '');
const stripAt = (v: string) => v.replace(/^@+/, '').trim();
const stripHost = (v: string, host: string) =>
  v.trim().replace(/^https?:\/\//i, '').replace(new RegExp(`^${host}/?`, 'i'), '').replace(/^@+/, '');

export const CONTACT_TYPES: ContactTypeMeta[] = [
  { type: 'phone', label: 'Phone', icon: Phone, hint: '+1 555 123 4567',
    buildLink: (v) => (digits(v) ? `tel:${v.trim().startsWith('+') ? '+' : ''}${digits(v)}` : null) },
  { type: 'email', label: 'Email', icon: Mail, hint: 'you@example.com',
    buildLink: (v) => (v.trim() ? `mailto:${v.trim()}` : null) },
  { type: 'instagram', label: 'Instagram', icon: Instagram, hint: '@handle',
    buildLink: (v) => (stripAt(v) ? `https://instagram.com/${stripHost(v, 'instagram.com')}` : null) },
  { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: '+1 555 123 4567',
    buildLink: (v) => (digits(v) ? `https://wa.me/${digits(v)}` : null) },
  { type: 'linkedin', label: 'LinkedIn', icon: Linkedin, hint: 'in/your-name',
    buildLink: (v) => (v.trim() ? `https://linkedin.com/${stripHost(v, 'linkedin.com')}` : null) },
  { type: 'snapchat', label: 'Snapchat', icon: Ghost, hint: 'username',
    buildLink: (v) => (stripAt(v) ? `https://snapchat.com/add/${stripAt(v)}` : null) },
  { type: 'x', label: 'X', icon: Twitter, hint: '@handle',
    buildLink: (v) => (stripAt(v) ? `https://x.com/${stripHost(v, 'x.com')}` : null) },
  { type: 'telegram', label: 'Telegram', icon: Send, hint: 'username',
    buildLink: (v) => (stripAt(v) ? `https://t.me/${stripAt(v)}` : null) },
  { type: 'website', label: 'Website', icon: Globe, hint: 'example.com',
    buildLink: (v) => {
      const t = v.trim();
      if (!t) return null;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    } },
  { type: 'custom', label: 'Custom', icon: Link2, hint: 'anything',
    buildLink: () => null },
];

const FALLBACK = (type: string): ContactTypeMeta => ({
  type, label: type, icon: Link2, hint: '', buildLink: () => null,
});

export function contactTypeMeta(type: string): ContactTypeMeta {
  return CONTACT_TYPES.find((c) => c.type === type) ?? FALLBACK(type);
}

export function contactLink(type: string, value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  return contactTypeMeta(type).buildLink(v);
}

export const DEFAULT_SLOTS: string[] = ['phone', 'email', 'instagram', 'whatsapp', 'linkedin', 'custom'];
```

> The assertion `contactLink('instagram', 'handle') === 'https://instagram.com/handle'` requires `stripHost` to no-op on a bare handle — it does (nothing matches the `https?://` or `instagram.com/` prefixes; the `@` strip is a no-op).

- [ ] **Step 4: Run the script — expect PASS**

Run: `node scripts/verify-contact-links.mjs`
Expected: `OK: contact link helpers verified`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/contact-methods.ts scripts/verify-contact-links.mjs
git commit -m "contact grid: type vocabulary + deep-link helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ContactGrid` component

**Files:**
- Create: `components/connect/ContactGrid.tsx`

**Interfaces:**
- Consumes: `ContactMethod` (`@/lib/types`), `contactTypeMeta` / `contactLink` (`@/lib/contact-methods`), `theme`/`type`/`radius` (`@/lib/theme`), `Plus` (`lucide-react`).
- Produces:
  - `interface ContactGridProps { methods: ContactMethod[]; mode: 'edit' | 'readonly'; onSlotClick?: (slotOrder: number) => void; onLinkOpen?: (type: string) => void }`.
  - `ContactGrid({ methods, mode, onSlotClick, onLinkOpen }: ContactGridProps)` — a 2-column grid of 6 tiles keyed by `slot_order` 0–5.
    - **edit mode:** every slot is a button → `onSlotClick(slotOrder)`. A slot with a row shows icon + label + dimmed `value` (or "Not set"); a disabled row is at 50% opacity with an "Off" pill; an empty slot shows `+` and "Add".
    - **readonly mode:** only slots that are `is_enabled` AND have a non-empty `value` render (others render an empty spacer `<div style={{minHeight:84}}>` so the grid keeps shape). Each is an `<a href={contactLink(...)} target="_blank" rel="noopener noreferrer">` when `contactLink` is non-null, else a plain tile. `onClick` calls `onLinkOpen?.(type)`.

- [ ] **Step 1: Write `components/connect/ContactGrid.tsx`**

```tsx
'use client';

import type { ContactMethod } from '@/lib/types';
import { contactTypeMeta, contactLink } from '@/lib/contact-methods';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Plus } from 'lucide-react';

interface ContactGridProps {
  methods: ContactMethod[];
  mode: 'edit' | 'readonly';
  onSlotClick?: (slotOrder: number) => void;
  onLinkOpen?: (type: string) => void;
}

const SLOTS = [0, 1, 2, 3, 4, 5];

const tileBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
  padding: 14,
  minHeight: 84,
  borderRadius: radius.card,
  border: `1px solid ${theme.divider}`,
  backgroundColor: theme.surface,
  fontFamily: typeTokens.family,
  textAlign: 'left',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

export default function ContactGrid({ methods, mode, onSlotClick, onLinkOpen }: ContactGridProps) {
  const bySlot = new Map<number, ContactMethod>();
  for (const m of methods) bySlot.set(m.slot_order, m);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {SLOTS.map((slot) => {
        const m = bySlot.get(slot);
        const meta = m ? contactTypeMeta(m.type) : null;
        const Icon = meta?.icon ?? Plus;

        if (mode === 'readonly') {
          const usable = m && m.is_enabled && (m.value ?? '').trim() !== '';
          if (!usable || !m || !meta) return <div key={slot} aria-hidden style={{ minHeight: 84 }} />;
          const href = contactLink(m.type, m.value);
          const content = (
            <>
              <Icon style={{ width: 18, height: 18, color: theme.accent }} />
              <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text }}>{meta.label}</span>
              <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, wordBreak: 'break-all' }}>{m.value}</span>
            </>
          );
          return href ? (
            <a
              key={slot}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLinkOpen?.(m.type)}
              style={{ ...tileBase, cursor: 'pointer' }}
            >
              {content}
            </a>
          ) : (
            <div key={slot} style={tileBase}>{content}</div>
          );
        }

        const disabled = m ? !m.is_enabled : false;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSlotClick?.(slot)}
            style={{ ...tileBase, cursor: 'pointer', opacity: disabled ? 0.5 : 1, position: 'relative' }}
          >
            {m && meta ? (
              <>
                <Icon style={{ width: 18, height: 18, color: theme.accent }} />
                <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text }}>{meta.label}</span>
                <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, wordBreak: 'break-all' }}>
                  {(m.value ?? '').trim() || 'Not set'}
                </span>
                {disabled && (
                  <span style={{
                    position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700,
                    color: theme.muted, border: `1px solid ${theme.divider}`, borderRadius: radius.pill, padding: '1px 6px',
                  }}>Off</span>
                )}
              </>
            ) : (
              <>
                <Plus style={{ width: 18, height: 18, color: theme.muted }} />
                <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 600, color: theme.muted }}>Add</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes. (No screen renders it yet — that's Task 3.)

- [ ] **Step 3: Commit**

```bash
git add components/connect/ContactGrid.tsx
git commit -m "contact grid: shared 2x3 ContactGrid (edit + readonly modes)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `EditLinkSheet` + My Links route

**Files:**
- Create: `components/connect/EditLinkSheet.tsx`
- Create: `app/main/connect/links/page.tsx`

**Interfaces:**
- Consumes: `ContactMethod`, `CONTACT_TYPES` / `contactTypeMeta`, `fetchContactMethods` / `upsertContactMethod` (`@/lib/data`), `useStore`, `Button` / `Input` (`@/components/ui/primitives`), `ContactGrid`.
- Produces:
  - `interface EditLinkSheetProps { slotOrder: number; existing: ContactMethod | null; onSave: (patch: { slot_order: number; type: string; value: string; is_enabled: boolean }) => Promise<void>; onClose: () => void }`.
  - `EditLinkSheet(props)` — a bottom sheet: a `type` picker (chips of `CONTACT_TYPES`), an `Input` for `value` (placeholder = `contactTypeMeta(type).hint`), an "enabled" checkbox (default true), Save + Cancel. Save calls `onSave` then `onClose`.
  - `MyLinksPage` (default export) — loads `fetchContactMethods(user.id)`, renders `<ContactGrid mode="edit" methods={methods} onSlotClick={setEditSlot} />` + the sheet. On save: `upsertContactMethod({ user_id, ...(existing?.id ? {id} : {}), slot_order, type, value: value || null, is_enabled })`, then re-fetch.

- [ ] **Step 1: Write `components/connect/EditLinkSheet.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { ContactMethod } from '@/lib/types';
import { CONTACT_TYPES, contactTypeMeta } from '@/lib/contact-methods';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

interface EditLinkSheetProps {
  slotOrder: number;
  existing: ContactMethod | null;
  onSave: (patch: { slot_order: number; type: string; value: string; is_enabled: boolean }) => Promise<void>;
  onClose: () => void;
}

export default function EditLinkSheet({ slotOrder, existing, onSave, onClose }: EditLinkSheetProps) {
  const [type, setType] = useState(existing?.type ?? CONTACT_TYPES[0].type);
  const [value, setValue] = useState(existing?.value ?? '');
  const [enabled, setEnabled] = useState(existing?.is_enabled ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ slot_order: slotOrder, type, value: value.trim(), is_enabled: enabled });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', backgroundColor: theme.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: typeTokens.family,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h3 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Edit link</h3>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTACT_TYPES.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => setType(c.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: radius.pill,
                border: `1px solid ${type === c.type ? theme.accent : theme.divider}`,
                backgroundColor: type === c.type ? theme.accent : theme.surface,
                color: type === c.type ? '#0D0D0F' : theme.text,
                fontSize: typeTokens.label.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: typeTokens.family,
              }}
            >
              <c.icon style={{ width: 14, height: 14 }} />
              {c.label}
            </button>
          ))}
        </div>

        <Input
          label="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={contactTypeMeta(type).hint}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, fontSize: typeTokens.label.fontSize, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: theme.accent }} />
          Show this to people I connect with
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/main/connect/links/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fetchContactMethods, upsertContactMethod } from '@/lib/data';
import type { ContactMethod } from '@/lib/types';
import { theme, type as typeTokens } from '@/lib/theme';
import ContactGrid from '@/components/connect/ContactGrid';
import EditLinkSheet from '@/components/connect/EditLinkSheet';

export default function MyLinksPage() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [editSlot, setEditSlot] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!user?.id) return;
    fetchContactMethods(user.id)
      .then(setMethods)
      .catch((err) => console.error('Failed to load contact methods:', err));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const existing = editSlot === null ? null : methods.find((m) => m.slot_order === editSlot) ?? null;

  const handleSave = async (patch: { slot_order: number; type: string; value: string; is_enabled: boolean }) => {
    if (!user?.id) return;
    await upsertContactMethod({
      user_id: user.id,
      ...(existing?.id ? { id: existing.id } : {}),
      slot_order: patch.slot_order,
      type: patch.type,
      value: patch.value || null,
      is_enabled: patch.is_enabled,
    });
    load();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>My links</h1>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, marginBottom: 20 }}>
          The six ways people can reach you after you connect. Turn any of them off to hide it.
        </p>
        <ContactGrid methods={methods} mode="edit" onSlotClick={setEditSlot} />
      </div>

      {editSlot !== null && (
        <EditLinkSheet
          slotOrder={editSlot}
          existing={existing}
          onSave={handleSave}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes; the route table shows `/main/connect/links`.

- [ ] **Step 4: Visual check**

Preview `/main/connect/links`. Six "Add" tiles. Tap one → sheet slides up. Pick "Instagram", type `@me`, Save → tile shows Instagram + `@me`. Re-open, uncheck "Show this…", Save → tile dims with an "Off" pill. Reload the page → state persists (proves the `upsertContactMethod` round-trip). Check `read_console_messages` for errors.

- [ ] **Step 5: Commit**

```bash
git add components/connect/EditLinkSheet.tsx app/main/connect/links/page.tsx
git commit -m "contact grid: My Links route + per-slot EditLinkSheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Connected-user read policy for `contact_methods`

**Files:**
- Verify: current RLS on `contact_methods`
- Create (only if missing): `supabase/migrations/0021_contact_methods_connected_read.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `fetchContactMethods(otherUserId)` for a user who shares a `connections` row with `otherUserId` (needed by `ConnectResult` and Task 6's sheet).

- [ ] **Step 1: Inspect the current policy**

Run (from `/Users/sr/w-app-web`; QA ref `ducadjakxmkfcvrteoqz`, `supabase link --project-ref <ref>` first if needed — token auth, see `docs/RESUME-launch-prep.md` "PIPELINE"):
```bash
echo "select policyname, cmd, qual from pg_policies where tablename = 'contact_methods';" | supabase db query --linked
```
- **If** a `SELECT` policy already permits reading rows where the requester shares a `connections` row with `user_id`, or reads are open → **no migration**. Record "RLS already sufficient" in the plan progress log and skip to Step 4 (nothing to commit).
- **If** the only `SELECT` policy is own-rows (`user_id = auth.uid()`) → do Steps 2–3.

- [ ] **Step 2: Write `supabase/migrations/0021_contact_methods_connected_read.sql`**

First confirm the `connections` column names:
```bash
echo "select column_name from information_schema.columns where table_name='connections';" | supabase db query --linked
```
Then write the file, substituting the real pair for `user_id` / `friend_id` if migration 0019 named them differently:

```sql
-- 0021_contact_methods_connected_read.sql
-- Lets a user read another user's ENABLED contact methods when the two
-- share a connections row (either direction). Needed for the post-scan
-- "User Links" view and the connections-list link sheet.

drop policy if exists "contact_methods connected read" on public.contact_methods;

create policy "contact_methods connected read"
on public.contact_methods
for select
to authenticated
using (
  is_enabled
  and exists (
    select 1 from public.connections c
    where (c.user_id = auth.uid() and c.friend_id = contact_methods.user_id)
       or (c.friend_id = auth.uid() and c.user_id = contact_methods.user_id)
  )
);
```

- [ ] **Step 3: Apply to QA, then prod (founder-gated)**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz   # QA
supabase db query --linked < supabase/migrations/0021_contact_methods_connected_read.sql
echo "select policyname from pg_policies where tablename='contact_methods';" | supabase db query --linked
```
Then **ask the founder to confirm** before the prod apply:
```bash
supabase link --project-ref yatixschvikugckkpfum   # PROD
supabase db query --linked < supabase/migrations/0021_contact_methods_connected_read.sql
```
Re-link back to QA afterwards.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0021_contact_methods_connected_read.sql
git commit -m "contact grid: RLS — connected users can read each other's enabled links

Applied to QA (and prod, pending founder confirmation).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `ConnectResult` uses `ContactGrid` readonly

**Files:**
- Modify: `components/connect/ConnectResult.tsx`

**Interfaces:**
- Consumes: `ContactGrid` (Task 2), the existing `methods` state, `recordContactMethodChoice`.
- Produces: the post-scan screen shows the other user's enabled links as a 2×3 grid of tappable deep links; tapping one still fires `recordContactMethodChoice(connectionId, type)`.

- [ ] **Step 1: Replace the bespoke `methods.map(...)` block**

In `components/connect/ConnectResult.tsx`:
- Add import: `import ContactGrid from '@/components/connect/ContactGrid';`
- Keep `const [chosen, setChosen] = useState<string | null>(null);`. Delete the standalone `choose` function.
- Replace the `{methods.length > 0 && (<p>How do you want…</p>)}` + `{methods.map((m) => (<button …>))}` + `{chosen && …}` region with:

```tsx
{methods.length > 0 && (
  <>
    <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '12px' }}>
      How do you want to stay in touch?
    </p>
    <ContactGrid
      methods={methods}
      mode="readonly"
      onLinkOpen={(type) => {
        setChosen(type);
        recordContactMethodChoice(connectionId, type).catch(() => {});
      }}
    />
  </>
)}
{chosen && (
  <p style={{ color: theme.muted, fontSize: '12px', marginTop: '10px' }}>Saved — opening {chosen}…</p>
)}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 3: Visual check**

A real scan is hard to exercise in preview. Minimum: `/main/connect/scan` still renders the camera view with no console errors, and `npx tsc` proves the `ConnectResult` wiring. Note in the commit that the live post-scan grid needs a real two-account scan to verify end to end.

- [ ] **Step 4: Commit**

```bash
git add components/connect/ConnectResult.tsx
git commit -m "contact grid: post-scan screen uses ContactGrid readonly + deep links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Entry points

**Files:**
- Modify: `components/tabs/ProfileTab.tsx`
- Modify: `components/home/ConnectSheet.tsx`
- Modify: `app/main/connections/page.tsx`

**Interfaces:**
- Consumes: everything above; `fetchContactMethods` for the connections sheet.
- Produces: three ways in — ProfileTab menu → My Links; ConnectSheet → My Links; a connection row → that person's User Links in a sheet.

- [ ] **Step 1: ProfileTab menu item**

In `components/tabs/ProfileTab.tsx`: add `Link2` to the `lucide-react` import, and in `menuItems` (right after the `connections` entry):

```tsx
{ id: 'links', label: 'My Links', icon: Link2, action: () => router.push('/main/connect/links') },
```

- [ ] **Step 2: ConnectSheet link**

In `components/home/ConnectSheet.tsx`, directly after the "Scan a code" `<Link>`:

```tsx
<Link
  href="/main/connect/links"
  style={{
    display: 'block', marginTop: 12, color: theme.accent, fontSize: '13px', fontWeight: 600,
    textDecoration: 'none', fontFamily: 'Montserrat, system-ui, sans-serif',
  }}
>
  Edit my links
</Link>
```

- [ ] **Step 3: Connections-row "Links" sheet**

In `app/main/connections/page.tsx`:
- Imports: `import ContactGrid from '@/components/connect/ContactGrid';`, `import { fetchContactMethods } from '@/lib/data';` (add to the existing import if there is one), `import type { ContactMethod } from '@/lib/types';`, `import { radius, type as typeTokens } from '@/lib/theme';` (extend the existing theme import).
- State: `const [linksFor, setLinksFor] = useState<{ id: string; name: string } | null>(null); const [sheetMethods, setSheetMethods] = useState<ContactMethod[]>([]);`
- Handler:

```tsx
const openLinks = (otherId: string, name: string) => {
  setLinksFor({ id: otherId, name });
  setSheetMethods([]);
  fetchContactMethods(otherId).then(setSheetMethods).catch(() => setSheetMethods([]));
};
```
- On each connection row, next to the unfriend control, add a ghost button:

```tsx
<button
  type="button"
  onClick={() => openLinks(/* other user id */, /* display name */)}
  style={{ background: 'none', border: 'none', color: theme.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
>
  Links
</button>
```
(Use whatever the row already calls the other user's id and name.)
- Render the sheet when `linksFor` is set (same overlay pattern as `EditLinkSheet` — `position:fixed; inset:0; rgba(0,0,0,.5); align-items:flex-end`, inner panel `backgroundColor: theme.bg`, `borderTopLeftRadius/RightRadius: radius.sheet`, padding, `onClick` stopPropagation):

```tsx
{linksFor && (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={() => setLinksFor(null)}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', backgroundColor: theme.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: '20px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: typeTokens.family }}>
      <h3 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
        {linksFor.name}&apos;s links
      </h3>
      {sheetMethods.some((m) => m.is_enabled && (m.value ?? '').trim() !== '') ? (
        <ContactGrid methods={sheetMethods} mode="readonly" />
      ) : (
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>No shared links yet.</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Typecheck + build + lint**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Run: `npm run lint` → no new errors.

- [ ] **Step 5: Visual check**

- ProfileTab → "My Links" opens `/main/connect/links`.
- Home → Connect panel → "Edit my links" opens the same.
- `/main/connections` → a row's "Links" button opens the sheet (grid if the other user has enabled links and Task 4's RLS is in place; "No shared links yet." otherwise).

- [ ] **Step 6: Commit**

```bash
git add components/tabs/ProfileTab.tsx components/home/ConnectSheet.tsx app/main/connections/page.tsx
git commit -m "contact grid: entry points — ProfileTab, ConnectSheet, connections list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (spec §2):
- 2×3 grid → `ContactGrid` (Task 2), six `slot_order` slots. ✓
- My Links (own slots, edit) → Task 3 route + `EditLinkSheet`. ✓
- Edit Links (per-slot type + value + enable) → `EditLinkSheet` (Task 3). ✓
- User Links (scanner sees enabled methods as tappable deep links) → `ContactGrid` readonly in `ConnectResult` (Task 5) and the connections-row sheet (Task 6). ✓
- Feeds `recordContactMethodChoice` → preserved via `onLinkOpen` (Task 5). ✓
- Fixed type vocabulary, `type` stays free text, unknown-type fallback → `lib/contact-methods.ts` (Task 1), `contactTypeMeta` fallback, verified by the assertion script. ✓
- Default 6 slots → `DEFAULT_SLOTS` exported (Task 1). **Note:** nothing pre-seeds `contact_methods` rows — a new user sees six "Add" tiles. `DEFAULT_SLOTS` is available for a future pre-seed but is not wired in this plan. Flag to the founder if pre-seeding is desired.
- O2.2 RLS → Task 4 (conditional). O2.3 My Links as a route linked from ProfileTab + ConnectSheet → Task 3 + Task 6. ✓

**2. Placeholder scan:** No "TBD" / "handle errors" / "similar to Task N". Task 4 is conditional but both branches are spelled out. Task 6 Step 3 gives exact state, handler, imports, and the sheet markup; the two `/* other user id */` / `/* display name */` comments are deliberate — the executor uses whatever the existing row already binds, which the plan cannot name without the row's current code, and Task 6 Step 3's first line says so.

**3. Type consistency:** `ContactMethod` shape identical everywhere. `ContactGridProps` (`methods`, `mode`, `onSlotClick`, `onLinkOpen`) matches Task 2 ↔ Task 3 (`onSlotClick={setEditSlot}`) ↔ Task 5 (`onLinkOpen`) ↔ Task 6. `EditLinkSheetProps.onSave` `{ slot_order, type, value, is_enabled }` matches `handleSave`. `contactLink` / `contactTypeMeta` / `CONTACT_TYPES` / `DEFAULT_SLOTS` names match between `lib/contact-methods.ts`, the verify script, `ContactGrid`, `EditLinkSheet`. `upsertContactMethod` call shape (`Partial<ContactMethod> & { user_id }`) matches `lib/data.ts`. `Button` `variant="secondary"` + `style` and `Input` `label`/`value`/`onChange`/`placeholder` match `components/ui/primitives.tsx`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-08-qr-links-contact-grid.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — execute here with checkpoints.

Which approach?
