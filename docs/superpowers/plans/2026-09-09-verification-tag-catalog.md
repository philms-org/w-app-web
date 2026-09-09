# Verified Titles (Verification Tag Catalog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ad-hoc `verification_tags` feature into a per-venue catalog of reusable titles (label + lucide/emoji/image icon) that organizers grant to attendees, shown inline on the checked-in feed contact card and venue-chat messages and as a grouped "Who's here" roster.

**Architecture:** A new `verification_tag_types` catalog table (per venue), plus a nullable `verification_tags.type_id` FK linking a grant to a catalog entry. Existing `tag`/`icon` columns are kept as a fallback and written as a snapshot on every new grant, so the four current display sites keep working untouched until each is migrated. Display resolution (type when linked, row's own `tag`/`icon` otherwise) is centralized in one `TagBadge` component. All writes are RLS-gated on the existing `is_venue_manager(location_id, auth.uid())` helper, which already covers owner + co-owners + master admin.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, React client components, Supabase (`lib/data.ts` + Storage), `lucide-react` (already a dependency). Supabase CLI (token auth) for the migration. Styling: `lib/theme.ts` tokens + `components/ui/primitives.tsx`. No test runner — verification is `npx tsc --noEmit` + `npm run build` + `npm run lint` + preview browser.

**Spec:** `docs/superpowers/specs/2026-09-09-verification-tag-catalog-design.md`

## Global Constraints

- **Light theme only.** Tokens from `lib/theme.ts` + `components/ui/primitives.tsx`. `#0D0D0F` is the only allowed hardcoded hex.
- **No new npm dependencies.**
- **Migration file is `0023_verification_tag_types.sql`.** (Highest applied is `0022_badges`; `0020_location_requests` is worktree-only, `0021_activity_menu` is QA-only. Confirm `ls supabase/migrations/` at execution.)
- **All catalog + grant writes are RLS-gated** on `is_venue_manager(location_id, auth.uid())` — identical to `verification_tags_write` / `banners_write`. That helper (`0001_organizer_admin_rbac.sql:22`) already returns true for venue owner, `location_managers` rows, and `profiles.is_master_admin`. Do not add a separate master-admin branch anywhere.
- **`verification_tag_types` read policy is `using (true)`** — the roster is attendee-facing.
- **Idempotent migration.** Tables use `create table if not exists`; policies `drop policy if exists` then `create`; seed/backfill use `on conflict do nothing`. Safe to re-run.
- **Backfill is best-effort.** A `verification_tags` row that can't be linked keeps `type_id` null and renders via the fallback path — not an error.
- Apply the migration to **QA** in the task, then **prod** as an explicit step in the same task (matching how `0022_badges` was handled 2026-09-09). Re-link the CLI to QA afterwards.
- After every task: `npx tsc --noEmit` + `npm run build` + `npm run lint` pass. **Never `npm run build` with a dev server running** — if it happens, `rm -rf .next` and restart the dev server.
- Commit after every task with the message in its final step.

## Reference (from the codebase)

- `verification_tags` columns today: `id, user_id, location_id, tag (text), icon (text null), assigned_by, assigned_at` (`0001_organizer_admin_rbac.sql`; `icon` added there too). RLS: `verification_tags_select` = `to authenticated`, `verification_tags_write` = `is_venue_manager(location_id, auth.uid())`.
- `is_venue_manager(check_location_id uuid, check_user_id uuid) returns boolean` — `0001_organizer_admin_rbac.sql:22`. `stable`, `language sql`. Owner OR `location_managers` row OR `profiles.is_master_admin`.
- Storage precedent: `0018_banners_storage_policies.sql` — bucket `banners`, `public = true`, `banners_storage_select` (`to authenticated, anon using (bucket_id='banners')`), `banners_storage_write` (`for all to authenticated`, `is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())`).
- `uploadBannerImage(file, locationId)` — `lib/data.ts:829`. Path `${locationId}/${Date.now()}.jpg`, `.upload(path, file, { contentType: 'image/jpeg', upsert: true })`, returns `getPublicUrl(path).data.publicUrl`. **No client-side resizing.** `uploadTagIcon` mirrors this (no resize), with a size guard.
- Existing tag data functions in `lib/data.ts`: `fetchVerificationTags` (~743), `assignVerificationTag` (~752), `removeVerificationTag` (~766); the `tagsByUser` map builder inside `fetchVenueMembers` (~707); `fetchTagBreakdown` (~1272, selects `tag` only).
- `fetchVerificationTags` / `fetchVenueMembers` currently do `.select('*')` on `verification_tags` — the join is added in Task 4.
- Activity-menu helpers (`lib/data.ts:506–542`) are the reference shape for the catalog CRUD helpers (parity feature 3).
- `app/main/venue/activities/page.tsx` — the reference for a `/main/venue/*` organizer route: `Suspense` wrapper + inner component reading `useSearchParams().get('locationId')`, `useIsOrganizer(locationId || null)` → `canManage`, load/CRUD/reload pattern.
- `app/admin/venue/[id]/tags/page.tsx` — the current tags admin screen (free-text emoji + label per attendee). Full rebuild in Task 6.
- `components/home/CheckedInHero.tsx` — organizer nav pills live in a `{canManage && (<>…</>)}` block of `<Link>`s (~`:344–411`); inline tag assign UI is the `tagText`/`tagIcon`/`tagSaving`/`tagError` state + `handleAssignTag`/`handleRemoveTag` + its JSX (~`:44–260`); `selectedAttendee` + `selectedAttendeeTags` detail (~`:207`).
- `components/shared/AttendeeStrip.tsx` — `AttendeeStripProps` already has `tagsByUserId?: Map<string, VerificationTag[]>`; the `{tags && tags.length > 0 && (…)}` block under each avatar renders them today.
- `components/ChatView.tsx` — renders message rows (~`:270`); sender name at `{msg.profiles?.display_name ?? 'Member'}` (~`:287`), shown only when `conversation.isGroup && !mine && sender changed`. Shared by venue chat and DMs. `fetchMessages` returns `Message` with `profiles` embedded.
- `app/main/venue/chat/page.tsx` — the venue chat screen; imports `ChatView, { type ChatConversation }`, resolves the venue via `VenueSwitcher`, has `venue` in state.
- `components/home/VenuePeekModal.tsx` — `VenuePeekModalProps { venue: Venue; onClose }`; loads banners on mount.
- `lib/theme.ts` exports `theme` (`.bg .surface .surface2 .text .muted .divider .accent .accent2 .pill`), `radius` (`.control .card .sheet .pill`), `type as` type tokens (`.family .heading .label .caption` etc.).
- `components/ui/primitives.tsx` exports `Button`, `Input`, `Chip` (`Chip` `onClick` optional → read-only display is fine).
- `components/profile/BadgeTile.tsx` — the `ICONS: Record<string, LucideIcon>` name→component map pattern for Task 2.

---

## File Structure

**Create**
- `supabase/migrations/0023_verification_tag_types.sql` — catalog table, `type_id` column, RLS, `tag-icons` bucket + policies, backfill.
- `lib/tagIcons.ts` — `TAG_ICON_CHOICES` (curated lucide names) + `TAG_ICONS` (name→component map) + `resolveTagIcon`.
- `components/shared/TagBadge.tsx` — single renderer for a granted tag (type-aware, size `sm`/`md`).
- `components/venue/TagCatalogPanel.tsx` — catalog CRUD + icon picker (Icon/Emoji/Upload).
- `components/venue/TagAssignPanel.tsx` — per-attendee assign-from-catalog + custom escape hatch.
- `components/venue/TitleRosterCard.tsx` — "Who's here" grouped-by-title card.
- `app/main/venue/titles/page.tsx` — organizer entry point route (Suspense + inner, `locationId` from query).

**Modify**
- `lib/types.ts` — `TagIconKind`, `VerificationTagType`, `VerificationTag.type_id`/`type`.
- `lib/data.ts` — catalog CRUD + seed, `assignVerificationTag` signature, `assignVerificationTagFreeform`, `uploadTagIcon`/`tagIconPublicUrl`, `fetchVenueTitleRoster`, `verification_tag_types` join in `fetchVerificationTags` + `fetchVenueMembers`, resolved-label in `fetchTagBreakdown`.
- `app/admin/venue/[id]/tags/page.tsx` — rebuild around the two panel components.
- `components/home/CheckedInHero.tsx` — remove inline assign UI; add "Titles" nav pill; render `TagBadge` in the attendee detail; mount `TitleRosterCard`.
- `components/shared/AttendeeStrip.tsx` — tag block → `TagBadge size="sm"`.
- `components/ChatView.tsx` — optional `tagsByUserId` prop; `TagBadge size="sm"` next to sender name.
- `app/main/venue/chat/page.tsx` — load the venue's tags, pass `tagsByUserId` to `ChatView`.
- `components/home/VenuePeekModal.tsx` — mount `TitleRosterCard`.
- `app/main/venue/report/page.tsx` — display resolved label from `fetchTagBreakdown` (only if it renders tag labels directly; confirm at execution).
- `docs/web-launch-2day-plan.md` + `~/.claude/projects/-Users-sr-w-app-web/memory/launch_prep_prod_migrations_2026-08-24.md` — prod migration state (Task 1).

---

### Task 1: Migration 0023 + TS types

**Files:**
- Create: `supabase/migrations/0023_verification_tag_types.sql`
- Modify: `lib/types.ts`
- Modify: `docs/web-launch-2day-plan.md`, `~/.claude/projects/-Users-sr-w-app-web/memory/launch_prep_prod_migrations_2026-08-24.md`

**Interfaces:**
- Produces (DB):
  - `verification_tag_types(id uuid pk, location_id uuid → locations on delete cascade, label text, icon text, icon_kind text check in ('lucide','image','emoji'), sort_order int default 0, created_by uuid, created_at timestamptz default now())`; unique `(location_id, lower(label))`; index `(location_id, sort_order)`.
  - `verification_tags.type_id uuid null → verification_tag_types(id) on delete set null`.
  - RLS: `verification_tag_types_select` (`using (true)`), `verification_tag_types_write` (`for all`, `is_venue_manager(location_id, auth.uid())`).
  - Storage bucket `tag-icons` (`public = true`) + `tag_icons_storage_select` / `tag_icons_storage_write`.
  - Every pre-existing `verification_tags` row backfilled to a non-null `type_id` where the `(location_id, tag)` pair is resolvable.
- Produces (TS): `TagIconKind = 'lucide' | 'image' | 'emoji'`; `VerificationTagType = { id: string; location_id: string; label: string; icon: string; icon_kind: TagIconKind; sort_order: number; created_by: string | null; created_at: string }`; `VerificationTag` gains `type_id: string | null` and `type?: VerificationTagType`.

- [ ] **Step 1: Confirm migration numbering**

Run: `ls supabase/migrations/ | tail -5`. Expect the highest to be `0022_badges.sql`. If a `0023_*` already exists, STOP and ask.

- [ ] **Step 2: Write `supabase/migrations/0023_verification_tag_types.sql`**

```sql
-- 0023_verification_tag_types.sql
-- Per-venue catalog of "verified titles" (Mentor, Judge, Sponsor, ...): a
-- label + an icon (lucide name | emoji | uploaded image path). Existing
-- verification_tags rows link to a catalog entry via type_id; the legacy
-- tag/icon columns are kept as a fallback and snapshot-written on new grants.
-- See docs/superpowers/specs/2026-09-09-verification-tag-catalog-design.md
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0023_verification_tag_types.sql

create table if not exists verification_tag_types (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  label text not null,
  icon text not null,
  icon_kind text not null check (icon_kind in ('lucide','image','emoji')),
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists verification_tag_types_loc_label_uniq
  on verification_tag_types (location_id, lower(label));
create index if not exists verification_tag_types_loc_sort_idx
  on verification_tag_types (location_id, sort_order);

alter table verification_tag_types enable row level security;

drop policy if exists verification_tag_types_select on verification_tag_types;
create policy verification_tag_types_select on verification_tag_types
  for select to authenticated using (true);

drop policy if exists verification_tag_types_write on verification_tag_types;
create policy verification_tag_types_write on verification_tag_types
  for all to authenticated
  using (is_venue_manager(location_id, auth.uid()))
  with check (is_venue_manager(location_id, auth.uid()));

alter table verification_tags
  add column if not exists type_id uuid references verification_tag_types(id) on delete set null;

-- Storage bucket for uploaded title icons (icon_kind = 'image').
insert into storage.buckets (id, name, public)
values ('tag-icons', 'tag-icons', true)
on conflict (id) do nothing;

drop policy if exists tag_icons_storage_select on storage.objects;
create policy tag_icons_storage_select on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'tag-icons');

drop policy if exists tag_icons_storage_write on storage.objects;
create policy tag_icons_storage_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'tag-icons'
    and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())
  )
  with check (
    bucket_id = 'tag-icons'
    and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Backfill: fold each distinct (location_id, tag, icon) into a catalog entry,
-- then link the grants. Idempotent.
do $$
declare
  r record;
  v_type_id uuid;
  v_sort integer;
  v_last_loc uuid;
begin
  v_last_loc := null;
  v_sort := 0;
  for r in
    select location_id, tag, coalesce(nullif(icon, ''), '') as icon_val
    from verification_tags
    where tag is not null and tag <> ''
    group by location_id, tag, coalesce(nullif(icon, ''), '')
    order by location_id, min(assigned_at)
  loop
    if r.location_id is distinct from v_last_loc then
      v_last_loc := r.location_id;
      v_sort := 0;
    end if;
    v_sort := v_sort + 10;

    insert into verification_tag_types (location_id, label, icon, icon_kind, sort_order)
    values (
      r.location_id,
      r.tag,
      case when r.icon_val <> '' then r.icon_val else 'award' end,
      case when r.icon_val <> '' then 'emoji' else 'lucide' end,
      v_sort
    )
    on conflict (location_id, lower(label)) do nothing;

    select id into v_type_id from verification_tag_types
      where location_id = r.location_id and lower(label) = lower(r.tag);

    update verification_tags
      set type_id = v_type_id
      where location_id = r.location_id and tag = r.tag and type_id is null;
  end loop;
end $$;
```

- [ ] **Step 3: Apply to QA + verify**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0023_verification_tag_types.sql
echo "select count(*) types from verification_tag_types; select count(*) unlinked from verification_tags where type_id is null and tag is not null and tag <> '';" | supabase db query --linked
echo "select id, public from storage.buckets where id = 'tag-icons';" | supabase db query --linked
echo "select policyname from pg_policies where tablename = 'verification_tag_types'; select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'tag_icons%';" | supabase db query --linked
```
Expect: `types` ≥ number of distinct legacy `(location_id, tag)` pairs; `unlinked` = 0 (note & investigate if not); bucket row present; 2 `verification_tag_types_*` policies + 2 `tag_icons_*` storage policies.

- [ ] **Step 4: Apply to prod + verify**

```bash
supabase link --project-ref yatixschvikugckkpfum
echo "select to_regclass('public.verification_tags') vt, (select count(*) from information_schema.columns where table_name='verification_tags' and column_name='icon') has_icon_col;" | supabase db query --linked
supabase db query --linked < supabase/migrations/0023_verification_tag_types.sql
echo "select count(*) types from verification_tag_types; select count(*) unlinked from verification_tags where type_id is null and tag is not null and tag <> '';" | supabase db query --linked
echo "select policyname from pg_policies where tablename = 'verification_tag_types'; select id from storage.buckets where id='tag-icons';" | supabase db query --linked
supabase link --project-ref ducadjakxmkfcvrteoqz
```
Expect: `verification_tags` exists with an `icon` column before applying; after applying, `unlinked` = 0, 2 policies, bucket present. **Re-link to QA is the last command.**

- [ ] **Step 5: Add TS types** — in `lib/types.ts`, replace the existing `VerificationTag` interface and add the new ones. Find:

```ts
export interface VerificationTag {
  id: string;
  user_id: string;
  location_id: string;
  tag: string;
  icon?: string | null;
  assigned_by: string;
  assigned_at: string;
  profiles?: Profile;
}
```

Replace with:

```ts
export type TagIconKind = 'lucide' | 'image' | 'emoji';

export interface VerificationTagType {
  id: string;
  location_id: string;
  label: string;
  icon: string;
  icon_kind: TagIconKind;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface VerificationTag {
  id: string;
  user_id: string;
  location_id: string;
  tag: string;
  icon?: string | null;
  type_id: string | null;
  type?: VerificationTagType;
  assigned_by: string;
  assigned_at: string;
  profiles?: Profile;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (No call site sets `type_id` yet; it is optional-at-construction only where objects are built literally — if `tsc` flags a literal `VerificationTag` construction missing `type_id`, add `type_id: null` there. Known spots: `components/home/CheckedInHero.tsx`, `app/admin/venue/[id]/tags/page.tsx` build maps from fetched rows, not literals, so likely clean.)

- [ ] **Step 7: Update rollout docs**

In `docs/web-launch-2day-plan.md`, in the parity/migration status area, add a line: `0023_verification_tag_types applied + verified on QA and PROD (2026-09-09) — verification_tag_types catalog + verification_tags.type_id + tag-icons bucket + backfill.`

In `~/.claude/projects/-Users-sr-w-app-web/memory/launch_prep_prod_migrations_2026-08-24.md`, update the "prod has 0001-0019 + 0022" line to include `0023`, and its `description:` frontmatter likewise.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0023_verification_tag_types.sql lib/types.ts docs/web-launch-2day-plan.md
git commit -m "titles: migration 0023 (verification_tag_types catalog + type_id + tag-icons bucket + backfill)

Applied + verified on QA and PROD.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(The memory file lives outside the repo — it is saved, not committed.)

---

### Task 2: `lib/tagIcons.ts` — curated icon set

**Files:**
- Create: `lib/tagIcons.ts`

**Interfaces:**
- Consumes: `lucide-react` icon components.
- Produces:
  - `TAG_ICON_CHOICES: readonly string[]` — the pickable lucide names.
  - `TAG_ICONS: Record<string, LucideIcon>` — name → component, for every name in `TAG_ICON_CHOICES` plus `'award'`.
  - `resolveTagIcon(name: string): LucideIcon` — `TAG_ICONS[name] ?? Award`.

- [ ] **Step 1: Write `lib/tagIcons.ts`**

```ts
import {
  Award, Brain, Gavel, Scale, Mic, Star, Crown, Gem, Shield, HeartHandshake,
  Ticket, Sparkles, Megaphone, GraduationCap, Briefcase, HandHeart, Users,
  UserCheck, Flame, Music, Camera, PenTool, Wrench, MapPin, Handshake,
  Rocket, Trophy, BadgeCheck, Headphones, Coffee, Lightbulb, Compass,
  Flag, Heart, Key, Leaf, LifeBuoy, Palette, Puzzle, Radio, Ribbon,
  Speaker, Sprout, Sun, Target, Verified, Wand2, Zap, Bookmark, Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Curated set an organizer picks from for a title's icon (icon_kind = 'lucide').
// Keys are the lucide "kebab" names stored in verification_tag_types.icon.
export const TAG_ICONS: Record<string, LucideIcon> = {
  award: Award,
  brain: Brain,
  gavel: Gavel,
  scale: Scale,
  mic: Mic,
  star: Star,
  crown: Crown,
  gem: Gem,
  shield: Shield,
  'heart-handshake': HeartHandshake,
  ticket: Ticket,
  sparkles: Sparkles,
  megaphone: Megaphone,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  'hand-heart': HandHeart,
  users: Users,
  'user-check': UserCheck,
  flame: Flame,
  music: Music,
  camera: Camera,
  'pen-tool': PenTool,
  wrench: Wrench,
  'map-pin': MapPin,
  handshake: Handshake,
  rocket: Rocket,
  trophy: Trophy,
  'badge-check': BadgeCheck,
  headphones: Headphones,
  coffee: Coffee,
  lightbulb: Lightbulb,
  compass: Compass,
  flag: Flag,
  heart: Heart,
  key: Key,
  leaf: Leaf,
  'life-buoy': LifeBuoy,
  palette: Palette,
  puzzle: Puzzle,
  radio: Radio,
  ribbon: Ribbon,
  speaker: Speaker,
  sprout: Sprout,
  sun: Sun,
  target: Target,
  verified: Verified,
  'wand-2': Wand2,
  zap: Zap,
  bookmark: Bookmark,
  'building-2': Building2,
};

export const TAG_ICON_CHOICES: readonly string[] = Object.keys(TAG_ICONS).filter(
  (n) => n !== 'award',
);

export function resolveTagIcon(name: string): LucideIcon {
  return TAG_ICONS[name] ?? Award;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If any named import above is not exported by the installed `lucide-react`, remove that entry from `TAG_ICONS` (and its key is auto-dropped from `TAG_ICON_CHOICES`). Do not add a dependency or a version bump to get an icon.

- [ ] **Step 3: Commit**

```bash
git add lib/tagIcons.ts
git commit -m "titles: curated lucide icon set for the title catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Data layer — catalog CRUD + seed

**Files:**
- Modify: `lib/data.ts`

**Interfaces:**
- Consumes: `getCurrentUserId` (already imported from `./auth`), `supabase`, `VerificationTagType` from `./types`.
- Produces:
  - `fetchVerificationTagTypes(locationId: string): Promise<VerificationTagType[]>` — ordered by `sort_order`.
  - `createVerificationTagType(locationId: string, fields: { label: string; icon: string; icon_kind: TagIconKind; sort_order: number }): Promise<VerificationTagType>`.
  - `updateVerificationTagType(id: string, fields: Partial<Pick<VerificationTagType, 'label' | 'icon' | 'icon_kind' | 'sort_order'>>): Promise<void>`.
  - `deleteVerificationTagType(id: string): Promise<void>`.
  - `seedDefaultVerificationTagTypes(locationId: string): Promise<void>` — inserts 7 defaults, `on conflict do nothing` semantics via per-row upsert ignore.

- [ ] **Step 1: Add `VerificationTagType` + `TagIconKind` to the `./types` import** in `lib/data.ts` (near `VerificationTag`, which is already imported at ~line 12).

- [ ] **Step 2: Add the catalog helpers** immediately after `removeVerificationTag` (~`lib/data.ts:768`):

```ts
// ---- Verification Tag Catalog (per-venue title types) ----

export async function fetchVerificationTagTypes(locationId: string): Promise<VerificationTagType[]> {
  const { data, error } = await supabase
    .from('verification_tag_types')
    .select('*')
    .eq('location_id', locationId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as VerificationTagType[];
}

export async function createVerificationTagType(
  locationId: string,
  fields: { label: string; icon: string; icon_kind: TagIconKind; sort_order: number },
): Promise<VerificationTagType> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('verification_tag_types')
    .insert({ location_id: locationId, created_by: uid, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as VerificationTagType;
}

export async function updateVerificationTagType(
  id: string,
  fields: Partial<Pick<VerificationTagType, 'label' | 'icon' | 'icon_kind' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('verification_tag_types').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteVerificationTagType(id: string): Promise<void> {
  const { error } = await supabase.from('verification_tag_types').delete().eq('id', id);
  if (error) throw error;
}

const DEFAULT_TAG_TYPES: { label: string; icon: string; sort_order: number }[] = [
  { label: 'Mentor', icon: 'brain', sort_order: 10 },
  { label: 'Judge', icon: 'gavel', sort_order: 20 },
  { label: 'Speaker', icon: 'mic', sort_order: 30 },
  { label: 'Organizer', icon: 'star', sort_order: 40 },
  { label: 'Sponsor', icon: 'gem', sort_order: 50 },
  { label: 'Host', icon: 'crown', sort_order: 60 },
  { label: 'Volunteer', icon: 'heart-handshake', sort_order: 70 },
];

export async function seedDefaultVerificationTagTypes(locationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  const rows = DEFAULT_TAG_TYPES.map((t) => ({
    location_id: locationId,
    created_by: uid,
    icon_kind: 'lucide' as const,
    ...t,
  }));
  // upsert on the (location_id, lower(label)) unique index; ignore existing.
  const { error } = await supabase
    .from('verification_tag_types')
    .upsert(rows, { onConflict: 'location_id,label', ignoreDuplicates: true });
  if (error) throw error;
}
```

> Note on `seedDefaultVerificationTagTypes`: the unique index is on `(location_id, lower(label))`, an expression index. `supabase.upsert`'s `onConflict` needs a real constraint/column list, not an expression. If the `upsert` errors with "no unique or exclusion constraint matching the ON CONFLICT specification", fall back to inserting rows one by one and swallowing the `23505` unique-violation code:
> ```ts
> for (const row of rows) {
>   const { error } = await supabase.from('verification_tag_types').insert(row);
>   if (error && error.code !== '23505') throw error;
> }
> ```
> Prefer this fallback if unsure — it is unconditionally correct.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.

- [ ] **Step 4: Commit**

```bash
git add lib/data.ts
git commit -m "titles: data layer — verification_tag_types CRUD + default seed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Data layer — assignment refactor, icon upload, roster, display joins

**Files:**
- Modify: `lib/data.ts`

**Interfaces:**
- Consumes: `fetchVerificationTagTypes` behaviour is not needed here; the assign path re-reads a single type row.
- Produces:
  - `assignVerificationTag(userId: string, locationId: string, typeId: string): Promise<void>` — **new signature**. Reads the type, inserts a `verification_tags` row with `type_id`, `tag = type.label`, `icon = type.icon`, `assigned_by = uid`.
  - `assignVerificationTagFreeform(userId: string, locationId: string, tag: string, icon?: string | null): Promise<void>` — the *current* `assignVerificationTag` body verbatim (no `type_id`).
  - `uploadTagIcon(file: File, locationId: string): Promise<string>` — validates type + size, uploads to `tag-icons/${locationId}/${crypto.randomUUID()}.<ext>`, returns the **storage path** (not a URL).
  - `tagIconPublicUrl(path: string): string` — `supabase.storage.from('tag-icons').getPublicUrl(path).data.publicUrl`.
  - `fetchVenueTitleRoster(locationId: string): Promise<{ type: VerificationTagType; people: Profile[] }[]>` — groups by type, ordered by `type.sort_order`, `people` by `display_name`.
  - `fetchVerificationTags` and the `tagsByUser` builder in `fetchVenueMembers` now populate `tag.type`.
  - `fetchTagBreakdown` groups by resolved label (`type.label` ?? `tag`).

- [ ] **Step 1: Rename the current `assignVerificationTag` to `assignVerificationTagFreeform`.** Find (~`lib/data.ts:752`):

```ts
export async function assignVerificationTag(
  userId: string,
  locationId: string,
  tag: string,
  icon?: string | null
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('verification_tags')
    .insert({ user_id: userId, location_id: locationId, tag, icon: icon ?? null, assigned_by: uid });
  if (error) throw error;
}
```

Rename the function to `assignVerificationTagFreeform` (body unchanged), then add the new catalog-backed `assignVerificationTag` directly below it:

```ts
export async function assignVerificationTag(
  userId: string,
  locationId: string,
  typeId: string,
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { data: type, error: typeError } = await supabase
    .from('verification_tag_types')
    .select('label, icon')
    .eq('id', typeId)
    .single();
  if (typeError) throw typeError;
  const { error } = await supabase.from('verification_tags').insert({
    user_id: userId,
    location_id: locationId,
    type_id: typeId,
    tag: (type as { label: string }).label,        // snapshot for the fallback path
    icon: (type as { icon: string }).icon,
    assigned_by: uid,
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Add the upload helpers** after `assignVerificationTag`:

```ts
const TAG_ICON_MAX_BYTES = 512 * 1024;
const TAG_ICON_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export async function uploadTagIcon(file: File, locationId: string): Promise<string> {
  const ext = TAG_ICON_TYPES[file.type];
  if (!ext) throw new Error('Icon must be a PNG, JPG, WebP, or SVG.');
  if (file.size > TAG_ICON_MAX_BYTES) throw new Error('Icon must be 512 KB or smaller.');
  const path = `${locationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('tag-icons')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function tagIconPublicUrl(path: string): string {
  return supabase.storage.from('tag-icons').getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 3: Add `fetchVenueTitleRoster`** after the upload helpers:

```ts
export async function fetchVenueTitleRoster(
  locationId: string,
): Promise<{ type: VerificationTagType; people: Profile[] }[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('type_id, verification_tag_types(*), profiles(*)')
    .eq('location_id', locationId)
    .not('type_id', 'is', null);
  if (error) throw error;

  const groups = new Map<string, { type: VerificationTagType; people: Profile[] }>();
  for (const row of (data ?? []) as unknown as {
    type_id: string;
    verification_tag_types: VerificationTagType | null;
    profiles: Profile | null;
  }[]) {
    const type = row.verification_tag_types;
    const person = row.profiles;
    if (!type || !person) continue;
    const g = groups.get(row.type_id) ?? { type, people: [] };
    if (!g.people.some((p) => p.id === person.id)) g.people.push(person);
    groups.set(row.type_id, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.type.sort_order - b.type.sort_order)
    .map((g) => ({
      type: g.type,
      people: g.people.sort((a, b) =>
        (a.display_name ?? '').localeCompare(b.display_name ?? '')),
    }));
}
```

- [ ] **Step 4: Add the `verification_tag_types` join to reads that feed display.**

In `fetchVerificationTags` (~`:743`) change `.select('*')` to `.select('*, verification_tag_types(*)')` and map the embedded row onto `type`:

```ts
export async function fetchVerificationTags(locationId: string): Promise<VerificationTag[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('*, verification_tag_types(*)')
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const { verification_tag_types, ...rest } = r as VerificationTag & {
      verification_tag_types: VerificationTagType | null;
    };
    return { ...rest, type: verification_tag_types ?? undefined } as VerificationTag;
  });
}
```

In `fetchVenueMembers`, the `tagRows` query (~`:706`) — same change: `.select('*, verification_tag_types(*)')`, and when pushing into `tagsByUser`, attach `type: t.verification_tag_types ?? undefined`.

- [ ] **Step 5: Resolved label in `fetchTagBreakdown`** (~`:1272`). Change the select to `.select('tag, verification_tag_types(label)')` and count by `row.verification_tag_types?.label ?? row.tag`:

```ts
export async function fetchTagBreakdown(locationId: string): Promise<TagBreakdownEntry[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('tag, verification_tag_types(label)')
    .eq('location_id', locationId);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tag: string; verification_tag_types: { label: string } | null }[]) {
    const label = row.verification_tag_types?.label ?? row.tag;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
```

> If the embedded `verification_tag_types(label)` select trips the type checker (it may infer an array), cast the row via `as unknown as {...}` exactly as `fetchVenueTitleRoster` does, or fall back to a two-query approach: fetch `tag, type_id`, then fetch labels for the distinct `type_id`s and resolve. Prefer the cast.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Fix any call site broken by the `assignVerificationTag` signature change here *only if* it is not already scheduled for rewrite in Task 6 (the two known callers — `app/admin/venue/[id]/tags/page.tsx` and `components/home/CheckedInHero.tsx` — ARE rewritten in Task 6; if `tsc` fails now because of them, temporarily switch those two calls to `assignVerificationTagFreeform` with the existing args so the tree compiles, and Task 6 replaces them properly).
Run: `npm run build` → completes.

- [ ] **Step 7: Commit**

```bash
git add lib/data.ts
git commit -m "titles: data layer — catalog-backed assign, icon upload, roster, display joins

assignVerificationTag now takes a type_id and snapshots label/icon;
assignVerificationTagFreeform keeps the old free-text path. Adds
uploadTagIcon/tagIconPublicUrl, fetchVenueTitleRoster, and the
verification_tag_types join to fetchVerificationTags / fetchVenueMembers /
fetchTagBreakdown.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `TagBadge` shared renderer

**Files:**
- Create: `components/shared/TagBadge.tsx`

**Interfaces:**
- Consumes: `VerificationTag` (`lib/types`), `resolveTagIcon` (`lib/tagIcons`), `tagIconPublicUrl` (`lib/data`), `theme` + `type` tokens (`lib/theme`).
- Produces: `default TagBadge({ tag, size }: { tag: VerificationTag; size?: 'sm' | 'md' })`.

- [ ] **Step 1: Write `components/shared/TagBadge.tsx`**

```tsx
'use client';

import { resolveTagIcon } from '@/lib/tagIcons';
import { tagIconPublicUrl } from '@/lib/data';
import type { VerificationTag } from '@/lib/types';
import { theme, type as typeTokens } from '@/lib/theme';

// Single renderer for a granted verification tag. type_id set -> use the
// linked catalog type (lucide | emoji | uploaded image). type_id null ->
// legacy free-text path: the row's own emoji/text `icon` + `tag`.
export default function TagBadge({ tag, size = 'md' }: { tag: VerificationTag; size?: 'sm' | 'md' }) {
  const label = tag.type?.label ?? tag.tag;
  const dim = size === 'sm' ? 14 : 16;

  let icon: React.ReactNode = null;
  if (tag.type) {
    if (tag.type.icon_kind === 'lucide') {
      const Icon = resolveTagIcon(tag.type.icon);
      icon = <Icon style={{ width: dim, height: dim, color: theme.accent }} />;
    } else if (tag.type.icon_kind === 'emoji') {
      icon = <span style={{ fontSize: dim }}>{tag.type.icon}</span>;
    } else {
      icon = (
        <img
          src={tagIconPublicUrl(tag.type.icon)}
          alt=""
          style={{ width: dim, height: dim, objectFit: 'contain', borderRadius: 3 }}
        />
      );
    }
  } else if (tag.icon) {
    icon = <span style={{ fontSize: dim }}>{tag.icon}</span>;
  }

  if (size === 'sm') {
    return (
      <span
        title={label}
        aria-label={label}
        style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      >
        {icon}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999,
        backgroundColor: theme.surface2, color: theme.text,
        fontSize: typeTokens.caption.fontSize, fontWeight: 600,
        fontFamily: typeTokens.family, whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → clean. (`React.ReactNode` needs no import in a `.tsx` file with the automatic JSX runtime; if `tsc` complains, add `import type { ReactNode } from 'react'` and use `ReactNode`.)

- [ ] **Step 3: Commit**

```bash
git add components/shared/TagBadge.tsx
git commit -m "titles: TagBadge shared renderer (lucide | emoji | image, sm/md)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Organizer screens — catalog panel, assign panel, routes

**Files:**
- Create: `components/venue/TagCatalogPanel.tsx`
- Create: `components/venue/TagAssignPanel.tsx`
- Create: `app/main/venue/titles/page.tsx`
- Modify: `app/admin/venue/[id]/tags/page.tsx`
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `fetchVerificationTagTypes`, `createVerificationTagType`, `updateVerificationTagType`, `deleteVerificationTagType`, `seedDefaultVerificationTagTypes`, `uploadTagIcon`, `fetchVerificationTags`, `assignVerificationTag`, `assignVerificationTagFreeform`, `removeVerificationTag`, `fetchAttendeeHistory` (existing) — all from `lib/data`; `TAG_ICON_CHOICES`, `resolveTagIcon` from `lib/tagIcons`; `TagBadge`; `useIsOrganizer`.
- Produces:
  - `TagCatalogPanel({ locationId }: { locationId: string })` — renders + mutates the venue's `verification_tag_types`.
  - `TagAssignPanel({ locationId }: { locationId: string })` — attendee list with per-person catalog-chip assignment.
  - Route `/main/venue/titles` — `?locationId=` query, `canManage` guard, renders both panels.

- [ ] **Step 1: Write `components/venue/TagCatalogPanel.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  fetchVerificationTagTypes, createVerificationTagType, updateVerificationTagType,
  deleteVerificationTagType, seedDefaultVerificationTagTypes, uploadTagIcon,
} from '@/lib/data';
import { TAG_ICON_CHOICES, resolveTagIcon } from '@/lib/tagIcons';
import type { VerificationTagType, TagIconKind } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

type Draft = { label: string; iconKind: TagIconKind; icon: string };
const EMPTY: Draft = { label: '', iconKind: 'lucide', icon: 'brain' };

export default function TagCatalogPanel({ locationId }: { locationId: string }) {
  const [types, setTypes] = useState<VerificationTagType[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchVerificationTagTypes(locationId)
      .then(setTypes)
      .catch((e) => { console.error('Failed to load title catalog:', e); setError("Couldn't load titles."); });
  }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const nextSort = useMemo(
    () => (types.length ? Math.max(...types.map((t) => t.sort_order)) + 10 : 10),
    [types],
  );

  const resetDraft = () => { setDraft(EMPTY); setEditingId(null); };

  const save = async () => {
    const label = draft.label.trim();
    if (!label) return;
    setBusy(true); setError(null);
    try {
      if (editingId) {
        await updateVerificationTagType(editingId, { label, icon_kind: draft.iconKind, icon: draft.icon });
      } else {
        await createVerificationTagType(locationId, {
          label, icon_kind: draft.iconKind, icon: draft.icon, sort_order: nextSort,
        });
      }
      resetDraft();
      load();
    } catch (e) {
      console.error('Failed to save title:', e);
      setError((e as Error).message || "Couldn't save the title.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true); setError(null);
    try { await deleteVerificationTagType(id); load(); }
    catch (e) { console.error('Failed to delete title:', e); setError("Couldn't delete the title."); }
    finally { setBusy(false); }
  };

  const seed = async () => {
    setBusy(true); setError(null);
    try { await seedDefaultVerificationTagTypes(locationId); load(); }
    catch (e) { console.error('Failed to seed defaults:', e); setError("Couldn't add the defaults."); }
    finally { setBusy(false); }
  };

  const onUpload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const path = await uploadTagIcon(file, locationId);
      setDraft((d) => ({ ...d, iconKind: 'image', icon: path }));
    } catch (e) {
      console.error('Failed to upload icon:', e);
      setError((e as Error).message || "Couldn't upload the icon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: typeTokens.family }}>
      <h2 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
        Title catalog
      </h2>
      {error && <p style={{ color: theme.accent2, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {types.length === 0 && (
        <button
          onClick={seed}
          disabled={busy}
          style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: radius.pill, border: 'none',
            backgroundColor: theme.accent, color: '#0D0D0F', fontWeight: 700, cursor: 'pointer',
            fontFamily: typeTokens.family, fontSize: 14,
          }}
        >
          Start with common titles
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[...types].sort((a, b) => a.sort_order - b.sort_order).map((t) => {
          const Icon = resolveTagIcon(t.icon);
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 12,
              borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface,
            }}>
              <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}>
                {t.icon_kind === 'lucide' && <Icon style={{ width: 18, height: 18, color: theme.accent }} />}
                {t.icon_kind === 'emoji' && <span style={{ fontSize: 18 }}>{t.icon}</span>}
                {t.icon_kind === 'image' && <span style={{ fontSize: 11, color: theme.muted }}>IMG</span>}
              </span>
              <span style={{ flex: 1, fontWeight: 600, color: theme.text, fontSize: 14 }}>{t.label}</span>
              <button
                onClick={() => { setEditingId(t.id); setDraft({ label: t.label, iconKind: t.icon_kind, icon: t.icon }); }}
                style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Edit
              </button>
              <button onClick={() => remove(t.id)} disabled={busy} aria-label={`Delete ${t.label}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 style={{ width: 16, height: 16, color: theme.muted }} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: 14, borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <p style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>
          {editingId ? 'Edit title' : 'Add title'}
        </p>
        <Input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="Title (e.g. Head Judge)"
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {(['lucide', 'emoji', 'image'] as TagIconKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'image') { fileRef.current?.click(); return; }
                setDraft((d) => ({ ...d, iconKind: k, icon: k === 'lucide' ? 'brain' : '' }));
              }}
              style={{
                padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer',
                border: `1px solid ${draft.iconKind === k ? theme.accent : theme.divider}`,
                backgroundColor: draft.iconKind === k ? theme.accent : 'transparent',
                color: draft.iconKind === k ? '#0D0D0F' : theme.text,
                fontFamily: typeTokens.family, fontSize: 13, fontWeight: 600,
              }}
            >
              {k === 'lucide' ? 'Icon' : k === 'emoji' ? 'Emoji' : 'Upload'}
            </button>
          ))}
          <input
            ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
          />
        </div>

        {draft.iconKind === 'emoji' && (
          <Input
            value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
            placeholder="🎧"
            maxLength={4}
            style={{ width: 80, textAlign: 'center' }}
          />
        )}
        {draft.iconKind === 'image' && (
          <p style={{ fontSize: 12, color: theme.muted }}>
            {draft.icon ? 'Image uploaded.' : 'Tap "Upload" to choose an image (PNG/JPG/WebP/SVG, ≤512 KB).'}
          </p>
        )}
        {draft.iconKind === 'lucide' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {TAG_ICON_CHOICES.map((name) => {
              const Icon = resolveTagIcon(name);
              const on = draft.icon === name;
              return (
                <button
                  key={name}
                  onClick={() => setDraft((d) => ({ ...d, icon: name }))}
                  aria-label={name}
                  style={{
                    width: 40, height: 40, borderRadius: radius.control, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${on ? theme.accent : theme.divider}`,
                    backgroundColor: on ? theme.accent : 'transparent',
                  }}
                >
                  <Icon style={{ width: 18, height: 18, color: on ? '#0D0D0F' : theme.text }} />
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={save} disabled={busy || !draft.label.trim()}>
            {editingId ? 'Save' : 'Add'}
          </Button>
          {editingId && (
            <button onClick={resetDraft} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontFamily: typeTokens.family, fontSize: 13 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/venue/TagAssignPanel.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAttendeeHistory, fetchVerificationTags, fetchVerificationTagTypes,
  assignVerificationTag, assignVerificationTagFreeform, removeVerificationTag,
} from '@/lib/data';
import type { Profile, VerificationTag, VerificationTagType } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Input } from '@/components/ui/primitives';
import TagBadge from '@/components/shared/TagBadge';

export default function TagAssignPanel({ locationId }: { locationId: string }) {
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [tags, setTags] = useState<VerificationTag[]>([]);
  const [types, setTypes] = useState<VerificationTagType[]>([]);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(() => {
    fetchVerificationTags(locationId).then(setTags).catch((e) => console.error('Failed to load tags:', e));
  }, [locationId]);

  useEffect(() => {
    Promise.all([fetchAttendeeHistory(locationId), fetchVerificationTags(locationId), fetchVerificationTagTypes(locationId)])
      .then(([a, t, ty]) => { setAttendees(a); setTags(t); setTypes(ty); })
      .catch((e) => { console.error('Failed to load assign panel:', e); setError("Couldn't load attendees."); });
  }, [locationId]);

  const tagsByUser = useMemo(() => {
    const m = new Map<string, VerificationTag[]>();
    for (const t of tags) { const l = m.get(t.user_id) ?? []; l.push(t); m.set(t.user_id, l); }
    return m;
  }, [tags]);

  const grant = async (userId: string, typeId: string) => {
    setBusyUser(userId); setError(null);
    try { await assignVerificationTag(userId, locationId, typeId); loadTags(); }
    catch (e) { console.error('Failed to assign title:', e); setError("Couldn't assign the title."); }
    finally { setBusyUser(null); }
  };

  const grantCustom = async (userId: string) => {
    const label = customText.trim();
    if (!label) return;
    setBusyUser(userId); setError(null);
    try {
      await assignVerificationTagFreeform(userId, locationId, label, null);
      setCustomFor(null); setCustomText('');
      loadTags();
    } catch (e) {
      console.error('Failed to assign custom title:', e);
      setError("Couldn't assign the title.");
    } finally { setBusyUser(null); }
  };

  const revoke = async (userId: string, tagId: string) => {
    setBusyUser(userId); setError(null);
    try { await removeVerificationTag(tagId); loadTags(); }
    catch (e) { console.error('Failed to remove title:', e); setError("Couldn't remove the title."); }
    finally { setBusyUser(null); }
  };

  return (
    <div style={{ fontFamily: typeTokens.family }}>
      <h2 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>
        Assign titles
      </h2>
      {error && <p style={{ color: theme.accent2, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {attendees.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 14 }}>No attendees at this venue yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {attendees.map((a) => {
          const mine = tagsByUser.get(a.id) ?? [];
          const grantedTypeIds = new Set(mine.map((t) => t.type_id).filter(Boolean));
          const busy = busyUser === a.id;
          return (
            <div key={a.id} style={{ padding: 14, borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface }}>
              <p style={{ fontWeight: 600, color: theme.text, fontSize: 15, marginBottom: 8 }}>{a.display_name ?? 'Someone'}</p>

              {mine.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {mine.map((t) => (
                    <button key={t.id} onClick={() => revoke(a.id, t.id)} disabled={busy}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <TagBadge tag={t} size="md" />
                      <span style={{ color: theme.muted, fontSize: 12 }}>✕</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {types.filter((ty) => !grantedTypeIds.has(ty.id)).map((ty) => (
                  <button key={ty.id} onClick={() => grant(a.id, ty.id)} disabled={busy}
                    style={{
                      padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer',
                      border: `1px solid ${theme.divider}`, backgroundColor: theme.surface2,
                      color: theme.text, fontFamily: typeTokens.family, fontSize: 13, fontWeight: 600,
                    }}>
                    + {ty.label}
                  </button>
                ))}
                <button onClick={() => { setCustomFor(a.id); setCustomText(''); }} disabled={busy}
                  style={{ padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer', border: `1px dashed ${theme.divider}`, background: 'none', color: theme.muted, fontFamily: typeTokens.family, fontSize: 13 }}>
                  ＋ custom
                </button>
              </div>

              {customFor === a.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="One-off title" />
                  <button onClick={() => grantCustom(a.id)} disabled={busy || !customText.trim()}
                    style={{ padding: '8px 16px', borderRadius: radius.pill, border: 'none', backgroundColor: theme.accent, color: '#0D0D0F', fontWeight: 700, cursor: 'pointer', fontFamily: typeTokens.family, fontSize: 13 }}>
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/main/venue/titles/page.tsx`**

```tsx
'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme, type as typeTokens } from '@/lib/theme';
import TagCatalogPanel from '@/components/venue/TagCatalogPanel';
import TagAssignPanel from '@/components/venue/TagAssignPanel';

function Inner() {
  const router = useRouter();
  const locationId = useSearchParams().get('locationId') ?? '';
  const { canManage } = useIsOrganizer(locationId || null);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Manage Titles</h1>
      </div>

      <div style={{ padding: '8px 20px 48px', maxWidth: 520, margin: '0 auto' }}>
        {!locationId ? (
          <p style={{ color: theme.muted }}>No venue selected.</p>
        ) : !canManage ? (
          <p style={{ color: theme.muted }}>You&apos;re not authorized to manage this venue&apos;s titles.</p>
        ) : (
          <>
            <TagCatalogPanel locationId={locationId} />
            <TagAssignPanel locationId={locationId} />
          </>
        )}
      </div>
    </div>
  );
}

export default function VenueTitlesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: theme.bg }} />}>
      <Inner />
    </Suspense>
  );
}
```

- [ ] **Step 4: Rebuild `app/admin/venue/[id]/tags/page.tsx`** to use the two panels. Keep the file's existing `use(params)` locationId resolution, the `useIsOrganizer` / `canManage` guard, and the header. Replace the body (the attendee list + free-text inputs) with:

```tsx
        <TagCatalogPanel locationId={locationId} />
        <TagAssignPanel locationId={locationId} />
```

Add imports for `TagCatalogPanel` and `TagAssignPanel`; remove the now-unused imports (`fetchAttendeeHistory`, `fetchVerificationTags`, `assignVerificationTag`, `removeVerificationTag`) and the `tagTextByUserId` / `tagIconByUserId` / `handleAssignTag` / `handleRemoveTag` / `tagsByUserId` machinery. Keep `fetchVenue` for the header title.

- [ ] **Step 5: Update `components/home/CheckedInHero.tsx` — nav pill + remove inline assign UI**

Add a "Titles" `<Link>` pill inside the `{canManage && (<>…</>)}` block, matching the "Activities" pill exactly (same style object), pointing to:

```tsx
href={`/main/venue/titles?locationId=${selectedLocation.id}`}
```
with visible text `Titles`.

Remove the inline tag-assignment UI: the `tagText`, `tagIcon`, `tagSaving`, `tagError` state; `handleAssignTag`; `handleRemoveTag`; and their JSX block. **Keep** `tags`, `loadTags` (read), `tagsByUserId`, `selectedAttendeeTags`, and the `fetchVerificationTags` import — they still feed display (Step 6 and Task 7/8). If removing `assignVerificationTag`/`removeVerificationTag`/`assignVerificationTagFreeform` imports leaves them unused, drop them from the import.

- [ ] **Step 6: Render `TagBadge` in the attendee detail.** Where `CheckedInHero` shows `selectedAttendee` with `selectedAttendeeTags` (~`:207`), render the name followed by each tag as `<TagBadge tag={t} size="md" />` in a flex row (`display:flex; align-items:center; gap:6px; flex-wrap:wrap`). Add `import TagBadge from '@/components/shared/TagBadge'`.

- [ ] **Step 7: Typecheck + build + lint + preview**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes; route table shows `/main/venue/titles`.
Run: `npm run lint` → no new errors.
Preview: with a dev server (`preview_start` name `w-app-web-dev`), open `/main/venue/titles?locationId=<a managed venue id>` — the catalog panel renders, "Start with common titles" seeds 7 rows, adding a title with a picked lucide icon works, the assign panel lists attendees with `+ <Title>` chips. `read_console_messages` clean. (If no managed venue / no auth session in preview, verify structurally via `read_page` and note it.)

- [ ] **Step 8: Commit**

```bash
git add components/venue/TagCatalogPanel.tsx components/venue/TagAssignPanel.tsx app/main/venue/titles/page.tsx "app/admin/venue/[id]/tags/page.tsx" components/home/CheckedInHero.tsx
git commit -m "titles: organizer catalog + assign panels, /main/venue/titles route, nav pill

Rebuilds /admin/venue/[id]/tags around the shared panels and removes the
inline tag-assign UI from CheckedInHero (assignment now lives in the
dedicated screen). CheckedInHero keeps reading tags for display.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `TitleRosterCard` — "Who's here" grouped roster

**Files:**
- Create: `components/venue/TitleRosterCard.tsx`
- Modify: `components/home/CheckedInHero.tsx`
- Modify: `components/home/VenuePeekModal.tsx`

**Interfaces:**
- Consumes: `fetchVenueTitleRoster` + `tagIconPublicUrl` (`lib/data`), `resolveTagIcon` (`lib/tagIcons`), `theme` tokens, `Profile`/`VerificationTagType` types.
- Produces: `default TitleRosterCard({ locationId }: { locationId: string })` — renders nothing when the roster is empty.

- [ ] **Step 1: Write `components/venue/TitleRosterCard.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchVenueTitleRoster, tagIconPublicUrl } from '@/lib/data';
import type { Profile, VerificationTagType } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { resolveTagIcon } from '@/lib/tagIcons';

export default function TitleRosterCard({ locationId }: { locationId: string }) {
  const [groups, setGroups] = useState<{ type: VerificationTagType; people: Profile[] }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchVenueTitleRoster(locationId)
      .then((g) => { if (!cancelled) setGroups(g); })
      .catch((e) => console.error('Failed to load title roster:', e));
    return () => { cancelled = true; };
  }, [locationId]);

  if (groups.length === 0) return null;

  return (
    <div style={{
      backgroundColor: theme.surface, borderRadius: radius.card, border: `1px solid ${theme.divider}`,
      padding: 16, fontFamily: typeTokens.family,
    }}>
      <h3 style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
        Who&apos;s here
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map(({ type, people }) => {
          const Icon = resolveTagIcon(type.icon);
          return (
            <div key={type.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {type.icon_kind === 'lucide' && <Icon style={{ width: 16, height: 16, color: theme.accent }} />}
                {type.icon_kind === 'emoji' && <span style={{ fontSize: 16 }}>{type.icon}</span>}
                {type.icon_kind === 'image' && (
                  <img src={tagIconPublicUrl(type.icon)} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                )}
                <span style={{ fontWeight: 700, color: theme.text, fontSize: 13 }}>{type.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 2 }}>
                {people.map((p) => (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 56, flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', backgroundColor: theme.pill,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: theme.text, fontWeight: 700, fontSize: 15,
                    }}>
                      {(p.display_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: 10, color: theme.text, textAlign: 'center', width: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.display_name ?? 'Someone'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount in `CheckedInHero`** — near the other cards (e.g. right after the `ActivityMeterCard` line), add `{selectedLocation && <TitleRosterCard locationId={selectedLocation.id} />}` and import it.

- [ ] **Step 3: Mount in `VenuePeekModal`** — inside the modal body, below the carousel / feed teaser, add `<TitleRosterCard locationId={venue.id} />` and import it.

- [ ] **Step 4: Typecheck + build + preview**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Preview: open the checked-in home / a venue peek for a venue that has ≥1 granted catalog title — the "Who's here" card renders grouped by title in `sort_order`. For a venue with no titles, the card is absent (renders `null`). `read_console_messages` clean.

- [ ] **Step 5: Commit**

```bash
git add components/venue/TitleRosterCard.tsx components/home/CheckedInHero.tsx components/home/VenuePeekModal.tsx
git commit -m "titles: 'Who's here' grouped roster card in checked-in home + venue peek

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Display migration — AttendeeStrip, chat, report

**Files:**
- Modify: `components/shared/AttendeeStrip.tsx`
- Modify: `components/ChatView.tsx`
- Modify: `app/main/venue/chat/page.tsx`
- Modify: `app/main/venue/report/page.tsx` (conditional — see Step 4)

**Interfaces:**
- Consumes: `TagBadge`, `fetchVerificationTags` (`lib/data`), `VerificationTag`.
- Produces: `ChatView` accepts an optional `tagsByUserId?: Map<string, VerificationTag[]>` prop.

- [ ] **Step 1: `AttendeeStrip.tsx` — tag block → `TagBadge`.** Replace the existing `{tags && tags.length > 0 && ( … )}` block under each avatar with a row of `TagBadge size="sm"`:

```tsx
{tags && tags.length > 0 && (
  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
    {tags.map((t) => <TagBadge key={t.id} tag={t} size="sm" />)}
  </span>
)}
```
Add `import TagBadge from '@/components/shared/TagBadge'`. The `tagsByUserId` prop's `VerificationTag[]` now carries `type` (populated by the Task 4 joins) — no prop-shape change.

- [ ] **Step 2: `ChatView.tsx` — sender title.** Add an optional prop:

```ts
tagsByUserId?: Map<string, import('@/lib/types').VerificationTag[]>;
```
to `ChatView`'s props type. Where the sender name renders (`{msg.profiles?.display_name ?? 'Member'}`, ~`:287`), append the sender's tags:

```tsx
{showName && (
  <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: FONT, margin: '0 4px 2px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
    {msg.profiles?.display_name ?? 'Member'}
    {(tagsByUserId?.get(msg.sender_id) ?? []).map((t) => <TagBadge key={t.id} tag={t} size="sm" />)}
  </span>
)}
```
Add `import TagBadge from '@/components/shared/TagBadge'`. DMs pass no `tagsByUserId` → nothing renders, unchanged behaviour.

- [ ] **Step 3: `app/main/venue/chat/page.tsx` — load + pass venue tags.** After the venue is resolved, load its verification tags once and build the map:

```tsx
const [tagsByUserId, setTagsByUserId] = useState<Map<string, VerificationTag[]>>(new Map());
useEffect(() => {
  if (!venue?.id) return;
  fetchVerificationTags(venue.id)
    .then((rows) => {
      const m = new Map<string, VerificationTag[]>();
      for (const t of rows) { const l = m.get(t.user_id) ?? []; l.push(t); m.set(t.user_id, l); }
      setTagsByUserId(m);
    })
    .catch((e) => console.error('Failed to load venue tags for chat:', e));
}, [venue?.id]);
```
Import `fetchVerificationTags` and `type VerificationTag`. Pass `tagsByUserId={tagsByUserId}` to the `<ChatView … />` element.

- [ ] **Step 4: `app/main/venue/report/page.tsx` — resolved label (conditional).** `fetchTagBreakdown` already returns the resolved label in its `tag` field after Task 4, so **if** the report page just renders `entry.tag` from `fetchTagBreakdown`, no change is needed — confirm by reading the file. If it does any of its own re-labelling of raw tag strings, point it at the value from `fetchTagBreakdown`. Note the outcome in the commit message.

- [ ] **Step 5: Typecheck + build + lint + preview**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Run: `npm run lint` → no new errors.
Preview: open a venue chat where a participant has a granted title — the icon shows next to their name on their messages. Open the checked-in "Connections"/attendee strip — small title icons show under avatars. `read_console_messages` clean.

- [ ] **Step 6: Commit**

```bash
git add components/shared/AttendeeStrip.tsx components/ChatView.tsx app/main/venue/chat/page.tsx app/main/venue/report/page.tsx
git commit -m "titles: render TagBadge in AttendeeStrip + venue chat; report uses resolved label

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §1 `verification_tag_types` table, `type_id`, RLS, `tag-icons` bucket, backfill | Task 1 |
| §1 `icon_kind ('lucide','image','emoji')` | Task 1 (check constraint), Task 5 (render), Task 6 (picker) |
| §2 Types (`VerificationTagType`, `TagIconKind`, `VerificationTag.type_id`/`type`) | Task 1 Step 5 |
| §2 `lib/tagIcons.ts` curated set | Task 2 |
| §2 catalog CRUD + `seedDefaultVerificationTagTypes` (7 defaults) | Task 3 |
| §2 `assignVerificationTag(typeId)` + snapshot, `assignVerificationTagFreeform` kept | Task 4 Step 1 |
| §2 `uploadTagIcon` / `tagIconPublicUrl` (no client resize — deviation noted) | Task 4 Step 2 |
| §2 `fetchVenueTitleRoster` | Task 4 Step 3 |
| §2 `type` join in `fetchVerificationTags` / `fetchVenueMembers` / `fetchTagBreakdown` | Task 4 Steps 4–5 |
| §3 Rebuild `/admin/venue/[id]/tags` (catalog + assign panels) | Task 6 Steps 1–2, 4 |
| §3 `/main/venue/titles` entry point | Task 6 Step 3 |
| §3 nav pill + remove inline assign from `CheckedInHero` | Task 6 Steps 5–6 |
| §4 "Who's here" roster card in `CheckedInHero` + `VenuePeekModal` | Task 7 |
| §5 `TagBadge` shared renderer (sm/md, 3 icon kinds + legacy) | Task 5 |
| §5 call sites: AttendeeStrip, CheckedInHero detail, admin chips, report, chat | Task 6 Step 6 (detail), Task 6 Step 4 (admin chips via TagAssignPanel), Task 8 (AttendeeStrip, chat, report) |
| §6 migration 0023 QA → prod, docs/memory update | Task 1 Steps 3–4, 7 |
| §6 global constraints (light theme, no deps, tsc/build/lint each task) | every task's verification steps |

Gaps: none. The standalone `/main/venue/[id]/roster` route and title-rename propagation are explicitly out of scope in the spec and correctly absent.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The two conditional steps (Task 4 Step 5 embedded-select cast; Task 8 Step 4 report page) each spell out the exact alternative and how to decide. Task 3 Step 2's `upsert` note gives a complete, unconditionally-correct fallback.

**3. Type consistency:** `VerificationTagType` fields (`id, location_id, label, icon, icon_kind, sort_order, created_by, created_at`) identical in Task 1 (SQL + TS), Task 3 (CRUD), Task 5 (render), Task 6 (panels), Task 7 (roster). `icon_kind` union `'lucide'|'image'|'emoji'` identical across the check constraint (Task 1), the TS type (Task 1), the picker (Task 6), the renderer (Task 5). `assignVerificationTag(userId, locationId, typeId)` — 3-arg form used consistently in Task 4 (def), Task 6 (`TagAssignPanel.grant`). `assignVerificationTagFreeform(userId, locationId, tag, icon?)` — 4-arg, used in Task 6 (`grantCustom`). `fetchVenueTitleRoster` return shape `{ type, people }[]` identical Task 4 ↔ Task 7. `TagBadge({ tag, size })` identical Task 5 ↔ Tasks 6/7/8. `tagIconPublicUrl(path)` returns a URL string, used in Task 5 + Task 7. `resolveTagIcon(name)` returns a `LucideIcon`, used in Tasks 5, 6, 7.

**Deviation from spec (intentional):** spec §2 said `uploadTagIcon` compresses client-side to ~128px. The codebase's `uploadBannerImage` does no resizing, and adding an image pipeline is disproportionate. Plan uploads the file as-is with a 512 KB size guard + type allowlist. Visual weight is controlled at render time (`TagBadge` fixes icon dimensions, `object-fit: contain`). If a founder wants true thumbnailing later it is an isolated change to `uploadTagIcon`.
