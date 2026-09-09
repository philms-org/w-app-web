# Verification Tag Catalog ("Verified Titles") — Design

**Date:** 2026-09-09
**Status:** Approved design, pending implementation plan
**Supersedes behaviour of:** the ad-hoc `verification_tags` free-text flow

## Goal

An organizer (or venue co-owner, or master admin) can maintain a **per-venue
catalog of titles** — a label plus an icon, e.g. "Mentor" with a brain icon —
and grant those titles to attendees. A granted title shows:

1. **Inline on a person's contact card in the feed** — next to their name when
   they are a checked-in attendee you inspect, and next to their name on their
   venue-chat messages.
2. **As a browsable roster** grouped by title in the checked-in / venue-peek
   views — "show me everyone who is a Mentor / Judge / Sponsor here."

This evolves the existing `verification_tags` feature (today: an organizer types
a free-text label + an emoji per attendee, no reuse) into a catalog-backed
system, **in place**, keeping the current free-text columns as a fallback.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| Scope | Titles are **venue-scoped** (`location_id`). Available for **any** location, not only `is_event = true`. |
| Catalog | A **per-venue catalog** (`verification_tag_types`). Auto-seeded with a common default set the organizer can delete. Organizer can add / edit / remove entries freely. |
| Icon source | A **curated `lucide` icon set**, **or** a short **emoji**, **or** an **uploaded image** (e.g. a sponsor's logo). `icon_kind ∈ ('lucide','image','emoji')`. |
| Permissions | Anyone with `canManage` for the venue — `is_venue_manager(location_id, auth.uid())` (owner + co-owners) plus master admin. Identical bar to `verification_tags_write` / `banners_write`. |
| Existing system | **Evolve `verification_tags` in place.** Add a catalog table + a nullable `type_id` FK. **Keep** `verification_tags.tag` / `icon` as a fallback for legacy / orphaned rows. |
| Normalization | Nullable `type_id`; new grants also **snapshot** the type's `label`/`icon` into the row's own `tag`/`icon` so the legacy display path keeps working during migration. |
| Freeform escape hatch | **Kept** — `assignVerificationTagFreeform(userId, locationId, tag, icon)` for one-offs / master-admin. |
| Roster surface | A **card inside existing views** (`CheckedInHero`, `VenuePeekModal`). A standalone `/main/venue/[id]/roster` page is a **fast-follow**, not this build. |
| Chat | Sender titles **are** shown in `/main/venue/chat` message rows (5th display call site). |

## Non-goals / fast-follow

- Standalone full-screen "All titles at {venue}" roster route.
- Propagating a title **rename** to people already granted it (snapshot columns
  do not auto-update; organizers re-grant, or a propagation pass is added
  later).
- Dropping `verification_tags.tag` / `icon` — deferred cleanup once prod
  backfill is confirmed stable. The design keeps writing the snapshot copy so
  this stays a safe no-notice change later.

---

## Section 1 — Data model

### New table `verification_tag_types` (the per-venue catalog)

| column | type | notes |
|---|---|---|
| `id` | `uuid` primary key default `gen_random_uuid()` | |
| `location_id` | `uuid not null` → `locations(id)` on delete cascade | |
| `label` | `text not null` | "Mentor", "Head Judge", "Gold Sponsor" |
| `icon` | `text not null` | lucide name (`'brain'`) · emoji (`'🎧'`) · storage path (`'<location_id>/<uuid>.png'`) |
| `icon_kind` | `text not null` | check `in ('lucide','image','emoji')` |
| `sort_order` | `integer not null default 0` | catalog ordering **and** roster group order |
| `created_by` | `uuid` (nullable, no FK requirement beyond convention) | |
| `created_at` | `timestamptz not null default now()` | |

- Unique: `(location_id, lower(label))` — no duplicate titles per venue.
- Index: `(location_id, sort_order)` for catalog + roster reads.

### `verification_tags` (existing grant table) changes

- Add `type_id uuid null references verification_tag_types(id) on delete set null`.
- Existing columns `tag`, `icon`, `assigned_by`, `assigned_at` unchanged and **retained**.
- **Display resolution rule (everywhere):**
  - `type_id` set → use the linked type's `label` / `icon` / `icon_kind`.
  - `type_id` null → use the row's own `icon` + `tag`, rendered exactly as
    `AttendeeStrip` does today (emoji/text).

### RLS

`verification_tag_types`:

```sql
alter table verification_tag_types enable row level security;

create policy verification_tag_types_select on verification_tag_types
  for select to authenticated using (true);   -- roster is attendee-facing

create policy verification_tag_types_write on verification_tag_types
  for all to authenticated
  using (is_venue_manager(location_id, auth.uid()))
  with check (is_venue_manager(location_id, auth.uid()));
```

`verification_tags` write policy is **unchanged** (already
`is_venue_manager(...)` from `0001_organizer_admin_rbac.sql`). Nothing added.

> Verify during implementation that `is_venue_manager` already treats master
> admin as authorized (the `useIsOrganizer` hook's `canManage` includes master
> admin separately). Match whatever `verification_tags_write` resolves to — do
> not diverge from it.

### Storage — bucket `tag-icons`

New **public** bucket `tag-icons`. Object path: `${locationId}/${uuid}.png`.
`storage.objects` policies copied verbatim from
`0018_banners_storage_policies.sql`, bucket id swapped to `tag-icons`:

```sql
insert into storage.buckets (id, name, public)
values ('tag-icons', 'tag-icons', true)
on conflict (id) do nothing;

create policy tag_icons_storage_select on storage.objects for select
  to authenticated, anon using (bucket_id = 'tag-icons');

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
```

### Backfill (in the migration, after schema + RLS)

Run inside a `do $$ … $$` block, idempotent:

1. For each distinct `(location_id, tag, coalesce(icon,''))` in
   `verification_tags`:
   - Insert a `verification_tag_types` row:
     `label = tag`,
     `icon = coalesce(nullif(icon,''), 'award')`,
     `icon_kind = 'emoji'` when `icon` is non-empty, else `'lucide'`
       (with `icon = 'award'` as the safe default name),
     `sort_order` = incrementing per `location_id` by first-seen order.
   - `on conflict (location_id, lower(label)) do nothing`.
2. `update verification_tags vt set type_id = t.id from verification_tag_types t
   where t.location_id = vt.location_id and lower(t.label) = lower(vt.tag)
   and vt.type_id is null`.
3. Best-effort: any row that still has `type_id is null` after this keeps
   working via the fallback path — acceptable, not an error.

### Verification queries (migration task)

- `select count(*) from verification_tag_types;` — ≥ number of distinct legacy `(location_id, tag)` pairs.
- `select count(*) from verification_tags where type_id is null;` — expect `0` on QA (note the number if non-zero, investigate).
- Bucket present: `select id, public from storage.buckets where id = 'tag-icons';`
- Policies present: `select policyname from pg_policies where tablename = 'verification_tag_types'; select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'tag_icons%';`

---

## Section 2 — Data layer (`lib/data.ts`, `lib/types.ts`, `lib/tagIcons.ts`)

### Types

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
```

`VerificationTag` gains:

```ts
  type_id: string | null;
  type?: VerificationTagType;   // populated by joined reads
```

### `lib/tagIcons.ts` (new)

- `TAG_ICON_CHOICES: string[]` — ~50 curated `lucide` names
  (`brain`, `gavel`, `scale`, `mic`, `star`, `crown`, `gem`, `shield`,
  `heart-handshake`, `award`, `ticket`, `sparkles`, `megaphone`,
  `graduation-cap`, `briefcase`, `hand-heart`, `users`, `user-check`,
  `flame`, `music`, `camera`, `pen-tool`, `wrench`, `map-pin`, …).
- `TAG_ICONS: Record<string, LucideIcon>` — the same names mapped to
  components (the `BadgeTile.ICONS` pattern, expanded). `award` is the
  fallback for an unknown name.

### Catalog CRUD (mirror the activity-menu helpers, parity feature 3)

```ts
fetchVerificationTagTypes(locationId): Promise<VerificationTagType[]>   // order by sort_order
createVerificationTagType(locationId, { label, icon, icon_kind, sort_order }): Promise<VerificationTagType>
updateVerificationTagType(id, fields: Partial<Pick<VerificationTagType,'label'|'icon'|'icon_kind'|'sort_order'>>): Promise<void>
deleteVerificationTagType(id): Promise<void>   // grants' type_id -> null via on delete set null
seedDefaultVerificationTagTypes(locationId): Promise<void>
```

`seedDefaultVerificationTagTypes` inserts, `on conflict (location_id, lower(label)) do nothing`:

| label | icon (lucide) | sort_order |
|---|---|---|
| Mentor | `brain` | 10 |
| Judge | `gavel` | 20 |
| Speaker | `mic` | 30 |
| Organizer | `star` | 40 |
| Sponsor | `gem` | 50 |
| Host | `crown` | 60 |
| Volunteer | `heart-handshake` | 70 |

Called client-side the first time the catalog screen loads and finds an empty
catalog (behind a "Start with common titles" button, not automatic).

### Assignment

- `assignVerificationTag(userId, locationId, typeId)` — **signature changes** to
  take a `type_id`. Reads the type, inserts a `verification_tags` row with
  `type_id` **and** a snapshot `tag = type.label`, `icon = type.icon`
  (fallback columns stay meaningful; the 4 legacy display sites keep working
  until migrated).
- `assignVerificationTagFreeform(userId, locationId, tag, icon)` — **kept** —
  the pre-existing behaviour (no `type_id`), for one-offs and master admin.
- `removeVerificationTag(tagId)` — unchanged.
- Multiple titles per person per venue are allowed (no unique constraint on
  `(user_id, location_id)`).

### Roster query

```ts
fetchVenueTitleRoster(locationId): Promise<{ type: VerificationTagType; people: Profile[] }[]>
```

One embedded select on `verification_tags` filtered
`location_id = <id> and type_id is not null`, joining `verification_tag_types`
and `profiles`. Grouped client-side by `type_id`; groups ordered by
`type.sort_order`; `people` within a group ordered by `display_name`. Legacy
(`type_id is null`) grants are **excluded** from the roster (no catalog group)
but still render inline on cards.

### Icon upload

- `uploadTagIcon(file: File, locationId: string): Promise<string>` — compress
  client-side to ~128px PNG (reuse the approach in `uploadBannerImage` /
  `uploadAvatar`), upload to `tag-icons/${locationId}/${crypto.randomUUID()}.png`,
  return the **path**.
- `tagIconPublicUrl(path: string): string` —
  `supabase.storage.from('tag-icons').getPublicUrl(path).data.publicUrl`.

### Updated display helpers

- The `tagsByUser` map builder in `fetchVenueMembers` (~`lib/data.ts:707`) and
  `fetchVerificationTags` — add the `verification_tag_types` join so
  `tag.type` is populated.
- `fetchTagBreakdown` (~`lib/data.ts:1272`) — group by **resolved label**
  (`type.label` when present, else `tag`).
- Wherever `AttendeeStrip` gets its `tagsByUserId` (`fetchAttendeeHistory`
  path / `CheckedInHero`) — same join added.

---

## Section 3 — Organizer screens

### Rebuild `/admin/venue/[id]/tags` → "Manage Titles — {venue}"

Two panels, both gated on `canManage` (existing guard in the page).

**Panel A — Title catalog.** List of `verification_tag_types` for the venue:
each row shows the icon preview + label + edit + delete. "Add title" opens an
editor (inline row or sheet):

- **Label** text field.
- **Icon picker** — segmented control **Icon / Emoji / Upload**:
  - *Icon* → grid of `TAG_ICON_CHOICES` (rendered via `TAG_ICONS`). Selecting
    stores the name, `icon_kind = 'lucide'`.
  - *Emoji* → single text input, `maxLength 4` (today's behaviour).
    `icon_kind = 'emoji'`.
  - *Upload* → file input → `uploadTagIcon` → stores the returned path,
    `icon_kind = 'image'`; shows the uploaded thumbnail.
- Empty-catalog state → "Start with common titles" button →
  `seedDefaultVerificationTagTypes` → reload.

**Panel B — Assign to people.** The existing attendee list. Each attendee
row's control changes from "emoji + free text + Assign" to:

- A set of the venue's catalog titles as tappable chips — tap to grant
  (`assignVerificationTag(userId, locationId, typeId)`), tap a granted chip to
  remove (`removeVerificationTag`).
- A "＋ custom" affordance → the freeform path
  (`assignVerificationTagFreeform`) for one-offs.
- Granted titles rendered with `TagBadge` (Section 5).

### New organizer entry point `/main/venue/titles`

A thin route in the `/main/venue/*` cluster (peers: `activities`, `rewards`,
`zones`, `members`, `carousel`, `chat`, `report`). Resolves the current venue
via `VenueSwitcher` exactly like the other `/main/venue/*` pages, then renders
the **same two panel components** as `/admin/venue/[id]/tags`. Add it to
whatever organizer nav lists the other `/main/venue/*` entries.

`/admin/venue/[id]/tags` stays as a valid route pointing at the same
components (reachable from `/admin`).

### Remove inline assignment from `CheckedInHero`

Delete the `tagText` / `tagIcon` / `tagSaving` / `tagError` state, `loadTags`
writes for assignment, `handleAssignTag`, `handleRemoveTag`, and the inline
assign UI (~`components/home/CheckedInHero.tsx:44`–`260`). `CheckedInHero`
keeps **reading** tags for display (Section 4, Section 5).

---

## Section 4 — Attendee-facing titled-people roster

A **"Who's here" card**, not a route, backed by `fetchVenueTitleRoster`.
Rendered in:

- `CheckedInHero` (the checked-in home view), and
- `VenuePeekModal` (venue preview).

Behaviour:

- Renders only if `fetchVenueTitleRoster` returns ≥ 1 group.
- One block per title, ordered by `sort_order`: `TagBadge md` (icon + label) as
  the header, then a horizontal avatar strip of that title's people. Reuse
  `AttendeeStrip` in a **non-selecting** mode (tapping a person opens their
  existing profile peek / detail; no select highlight state).
- Legacy `type_id is null` grants do not appear here.

Standalone `/main/venue/[id]/roster` full page + a "See all" link are
**fast-follow**, explicitly out of scope.

---

## Section 5 — Display: shared renderer + call-site migration

### `components/shared/TagBadge.tsx` (new)

```ts
TagBadge({ tag, size }: { tag: VerificationTag; size?: 'sm' | 'md' })
```

Resolution:

- `tag.type_id` set → `tag.type.icon_kind`:
  - `'lucide'` → `TAG_ICONS[tag.type.icon] ?? Award` component.
  - `'emoji'` → `tag.type.icon` as text.
  - `'image'` → `<img src={tagIconPublicUrl(tag.type.icon)}>`, fixed square,
    `object-fit: contain`.
  - label = `tag.type.label`.
- `tag.type_id` null → legacy: `tag.icon` (emoji/text) + `tag.tag`, exactly as
  `AttendeeStrip` renders today.
- `size = 'md'` → icon + label pill (feed contact card, roster header).
- `size = 'sm'` → icon only; label in `title` + `aria-label` (dense avatar
  strips, chat rows).

Uses `lib/theme.ts` tokens + `components/ui/primitives.tsx`. Light theme only;
`#0D0D0F` the only permitted hardcoded hex (project constraint).

### The 5 display call sites → all use `TagBadge`

1. **`components/shared/AttendeeStrip.tsx`** — the
   `{tags && tags.length > 0 && …}` block under each avatar → a row of
   `TagBadge sm`. Already receives `tagsByUserId`; the map now carries
   resolved `type`.
2. **`components/home/CheckedInHero.tsx`** — assignment UI removed (Section 3);
   the `selectedAttendee` detail (~`:207`) shows the name followed by inline
   `TagBadge md`s ("Jordan  🧠 Mentor  ⚖️ Judge") — **this is the feed contact
   card**. Plus the "Who's here" roster card (Section 4).
3. **`/admin/venue/[id]/tags`** — granted-title chips ("Remove …") →
   `TagBadge` + a remove control.
4. **Venue report** — `fetchTagBreakdown` / `/main/venue/report` group by
   resolved label. No component swap; label source changes only.
5. **`/main/venue/chat`** — message rows show `TagBadge sm` next to the sender
   name. Needs a `type`-join on the message → sender → their tags for this
   `location_id` (load the venue's `verification_tags` once for the chat
   screen, index by `user_id`, same shape as `tagsByUserId` elsewhere).

### Data threading

Every read that feeds a display call site must include the
`verification_tag_types` join so `tag.type` is present:
`fetchAttendeeHistory` path, `fetchVenueMembers`, `fetchVerificationTags`,
and the new chat-screen tag load.

---

## Section 6 — Migration & rollout

### `supabase/migrations/0023_verification_tag_types.sql`

1. `create table verification_tag_types …` (Section 1) + `icon_kind` check +
   unique `(location_id, lower(label))` + `(location_id, sort_order)` index.
2. `alter table verification_tags add column type_id uuid null
   references verification_tag_types(id) on delete set null`.
3. RLS: `verification_tag_types_select` (`using (true)`),
   `verification_tag_types_write` (`is_venue_manager(location_id, auth.uid())`).
4. Storage: `tag-icons` bucket insert (`on conflict do nothing`,
   `public = true`) + the two `storage.objects` policies from `0018`, bucket id
   `tag-icons`.
5. Backfill `do $$ … $$` block (Section 1) — idempotent.
6. Verification queries (Section 1).

Header comment mirrors `0022_badges.sql`: what it does, the spec path, and the
manual apply commands for QA.

### Apply order

- **QA** (`ducadjakxmkfcvrteoqz`) — apply, run verification queries.
- **Prod** (`yatixschvikugckkpfum`) — apply as a confirmed step **in the same
  task**, matching how `0022_badges.sql` was handled 2026-09-09. Re-link CLI to
  QA afterwards.
- Update `docs/web-launch-2day-plan.md` + the launch-prep memory with the new
  prod migration state.

### Global constraints (inherited from the parity work)

- Light theme only; tokens from `lib/theme.ts` + `components/ui/primitives.tsx`;
  `#0D0D0F` the only allowed hardcoded hex.
- No new npm dependencies (`lucide-react` already present).
- After every task: `npx tsc --noEmit` + `npm run build` pass. Never
  `npm run build` with a dev server running (clear `.next` if it happens).
- `npm run lint` — no new errors.
- Commit after every task.

---

## Component / file inventory

**Create**
- `supabase/migrations/0023_verification_tag_types.sql`
- `lib/tagIcons.ts`
- `components/shared/TagBadge.tsx`
- `components/venue/TagCatalogPanel.tsx` (Panel A — catalog CRUD + icon picker)
- `components/venue/TagAssignPanel.tsx` (Panel B — assign from catalog)
- `components/venue/TitleRosterCard.tsx` (Section 4 "Who's here" card)
- `app/main/venue/titles/page.tsx` (organizer entry point)

**Modify**
- `lib/types.ts` — `VerificationTagType`, `TagIconKind`, `VerificationTag.type_id` / `type`.
- `lib/data.ts` — catalog CRUD, `seedDefaultVerificationTagTypes`,
  `assignVerificationTag` (signature), `assignVerificationTagFreeform` (rename
  of today's `assignVerificationTag` body), `fetchVenueTitleRoster`,
  `uploadTagIcon` / `tagIconPublicUrl`, `type` joins in
  `fetchVerificationTags` / `fetchVenueMembers` / `fetchAttendeeHistory` path /
  `fetchTagBreakdown`.
- `app/admin/venue/[id]/tags/page.tsx` — rebuild around the two panel
  components.
- `components/home/CheckedInHero.tsx` — remove inline assignment; add
  `TagBadge` display + `TitleRosterCard`.
- `components/shared/AttendeeStrip.tsx` — tag block → `TagBadge sm`.
- `components/home/VenuePeekModal.tsx` — add `TitleRosterCard`.
- `app/main/venue/chat/*` — sender `TagBadge sm` + venue tag load.
- `app/main/venue/report/page.tsx` — resolved-label grouping (if it renders
  tag labels directly).
- Organizer nav list — add "Manage Titles" → `/main/venue/titles`.
- `docs/web-launch-2day-plan.md` + launch-prep memory — prod migration state.

---

## Self-review

- **Placeholders:** none. The one implementation-time check (does
  `is_venue_manager` cover master admin) is written as "match
  `verification_tags_write`, do not diverge" — a concrete instruction, not a
  TBD.
- **Consistency:** `verification_tag_types` columns identical across Section 1
  (SQL), Section 2 (TS), Section 3 (UI), Section 6 (inventory). `icon_kind`
  enum `('lucide','image','emoji')` identical in the check constraint, the TS
  union, and the picker. `assignVerificationTag(userId, locationId, typeId)`
  signature consistent Section 2 ↔ Section 3. `TagBadge({ tag, size })`
  consistent Section 4 ↔ Section 5.
- **Scope:** one migration, one new lib module, one shared component, four
  new venue components, one new route, edits to ~8 existing files. Sized like
  the parity features (activity-menu was comparable). Single implementation
  plan is appropriate.
- **Ambiguity:** "feed contact card" is pinned to the `CheckedInHero`
  `selectedAttendee` detail + chat rows (no web comment feed exists).
  "roster" is pinned to a card in `CheckedInHero` + `VenuePeekModal`, not a
  route. "organizer" is pinned to `canManage` = `is_venue_manager` + master
  admin.
