# Location Request / Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any signed-in user request a venue from the map; a master admin approves or rejects it from a queue; the requester is notified via an automated chat message from a "The W App" system sender — replacing the map's "Add a location" button, which currently only mutates local React state and was never buildable as "any user creates a venue" because venue creation is master-admin-only by RLS.

**Architecture:** A new `location_requests` table (separate from `locations`, so every existing consumer of `locations` — the map, check-in/geofencing, the organizer report, the home nearby-banner — keeps working unmodified) plus three SECURITY DEFINER RPCs: `request_location` (creates the request, notifies the requester via a fixed system-sender chat), `approve_location_request` (copies the request into a real `locations` row, owner = requester, notifies), `reject_location_request` (marks rejected, notifies with an optional reason). A fixed "The W App" profile row is seeded once and used as the sender of every automated message.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js` ^2.110.7, Supabase Postgres (plpgsql, SECURITY DEFINER). Inline `style={{}}` per this repo's convention.

**Spec:** `docs/superpowers/specs/2026-09-04-location-request-workflow-design.md`

## Global Constraints

- **No automated test suite exists in this repo.** `package.json` scripts are `dev`/`build`/`build:vercel`/`start`/`lint` only. Every task ends with `npx tsc --noEmit` (must stay clean) plus either a direct `supabase db query` assertion or a manual browser check.
- Follow the existing inline-style convention — no Tailwind classes, no CSS modules. Colors come from `@/lib/theme` in dark-themed screens (`MapTab.tsx`); the admin panel (`app/admin/**`) uses its own light-theme literals (`theme.bg`/`theme.text`/`theme.muted`/`theme.divider`/`theme.accent`/`theme.accent2` plus ad-hoc hex — check the file you're editing, don't assume).
- `'use client'` at the top of every component/hook file using React state or browser APIs.
- Migration files: `supabase/migrations/00NN_name.sql`, applied with `supabase db query --linked` after `supabase link --project-ref <ref>`. **QA ref `ducadjakxmkfcvrteoqz`, PROD ref `yatixschvikugckkpfum`.** Run from inside `/Users/sr/w-app-web` (or a worktree of it) — running from `~` silently does nothing.
- **Check the migration number before Task 1.** This plan claims `0020` (0019 is the latest on `main` as of 2026-09-04) — peer sessions may commit to `main` concurrently. Run `git -C <your worktree> ls-tree -r --name-only main -- supabase/migrations/ | sort | tail -3` (or `ls supabase/migrations/` if your worktree is already up to date with `main`); if `0020` is taken, use the next free number and update every reference in Task 1 and Task 2 to match.
- Prefer single-line `echo "...;" | supabase db query --linked` for verification queries; multi-line heredoc SQL pasted into a terminal is fragile.
- **Do NOT apply the migration to PROD in this plan.** Task 2 applies to QA only. PROD apply happens after the whole branch is reviewed, as a separate, explicit step outside this plan (matching how the connections-write-path and privacy-copy plans were finished this session).
- Commit after every task.
- Build gates are ON (`next.config.ts`): lint and type errors fail the build.
- The fixed system-profile UUID is `00000000-0000-4000-8000-00000000a99d` — use this exact literal everywhere it appears (the migration's seed insert, all three RPCs' `v_system_id` local constant, and `lib/constants.ts`'s `SYSTEM_PROFILE_ID`). Do not regenerate it per-task.

---

### Task 1: Migration — location_requests table, system profile, three RPCs

**Files:**
- Create: `supabase/migrations/0020_location_requests.sql`

**Interfaces:**
- Produces: table `location_requests`; profile row `00000000-0000-4000-8000-00000000a99d` ("The W App"); functions `request_location(text, text, double precision, double precision) returns uuid`, `approve_location_request(uuid) returns uuid`, `reject_location_request(uuid, text) returns void`. Task 2 applies this file; Task 3 consumes the RPCs.

- [ ] **Step 1: Verify the migration number is free**

Run: `ls supabase/migrations/ | sort | tail -3`
Expected: highest is `0019_connections_write_path.sql`. If a peer has since added `0020_*`, rename this task's file and every reference below to the next free number.

- [ ] **Step 2: Create the migration file**

```sql
-- 0020_location_requests.sql
-- The map's "Add a location" button (components/tabs/MapTab.tsx) has always
-- been visible to every signed-in user with no permission check, but
-- locations' INSERT policy (0002_locations_insert_policy.sql,
-- locations_insert_master_admin) restricts venue creation to master admins
-- only. Submitting the button wrote to local React state only
-- (setNearbyLocations([...])) and never persisted, which is why it looked
-- broken -- it could never have worked as "any user creates a venue".
--
-- This migration adds the missing step: any signed-in user can REQUEST a
-- venue; a master admin approves or rejects it from a queue; the requester
-- is notified via an automated chat message from a fixed "The W App"
-- system sender.
--
-- Design: docs/superpowers/specs/2026-09-04-location-request-workflow-design.md
--
-- Apply order (run from inside /Users/sr/w-app-web):
--   supabase link --project-ref ducadjakxmkfcvrteoqz     # QA only -- see plan
--   supabase db query --linked < supabase/migrations/0020_location_requests.sql

-- ---- Schema ---------------------------------------------------------------

create table if not exists location_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table location_requests enable row level security;

-- Submitter reads their own requests; master admins read all (for the
-- approval queue). No client INSERT/UPDATE policy at all -- every write
-- goes through the three RPCs below, matching the convention set by
-- set_master_admin / record_qr_scan: the interesting writes here (creating
-- a locations row as a side effect, writing a message as a different
-- sender) can't be expressed safely as a plain RLS `with check`.
drop policy if exists location_requests_select_own on location_requests;
create policy location_requests_select_own on location_requests for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists location_requests_select_admin on location_requests;
create policy location_requests_select_admin on location_requests for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_master_admin));

-- ---- System sender ----------------------------------------------------
-- Fixed, well-known id -- never regenerated. Mirrored as SYSTEM_PROFILE_ID
-- in lib/constants.ts. No email/phone, not a master admin.
insert into profiles (id, display_name, is_master_admin)
values ('00000000-0000-4000-8000-00000000a99d', 'The W App', false)
on conflict (id) do nothing;

-- ---- RPCs ---------------------------------------------------------------

create or replace function request_location(
  p_name text,
  p_description text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_conversation_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  insert into location_requests (submitted_by, name, description, lat, lng)
  values (v_uid, p_name, p_description, p_lat, p_lng)
  returning id into v_request_id;

  -- Find-or-create the requester's persistent system-notification thread --
  -- one thread per user across all their requests (there's no cap on
  -- pending requests), not one per request.
  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_uid
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_uid)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_uid, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, 'Your request for "' || p_name || '" is pending approval.');

  return v_request_id;
end;
$$;

grant execute on function request_location(text, text, double precision, double precision) to authenticated;

create or replace function approve_location_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_req record;
  v_location_id uuid;
  v_conversation_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not_authorized';
  end if;

  select * into v_req from location_requests where id = p_request_id;
  if v_req is null then
    raise exception 'request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  insert into locations (name, description, lat, lng, geofence_radius_meters, owner_id, is_event)
  values (v_req.name, v_req.description, v_req.lat, v_req.lng, 50, v_req.submitted_by, false)
  returning id into v_location_id;

  update location_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_req.submitted_by
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_req.submitted_by)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_req.submitted_by, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, '"' || v_req.name || '" was approved — you''re the venue owner now.');

  return v_location_id;
end;
$$;

grant execute on function approve_location_request(uuid) to authenticated;

create or replace function reject_location_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_req record;
  v_conversation_id uuid;
  v_content text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not_authorized';
  end if;

  select * into v_req from location_requests where id = p_request_id;
  if v_req is null then
    raise exception 'request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  update location_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
  where id = p_request_id;

  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_req.submitted_by
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_req.submitted_by)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_req.submitted_by, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  v_content := 'Your request for "' || v_req.name || '" wasn''t approved.';
  if p_reason is not null and length(trim(p_reason)) > 0 then
    v_content := v_content || ' ' || p_reason;
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, v_content);
end;
$$;

grant execute on function reject_location_request(uuid, text) to authenticated;
```

- [ ] **Step 3: Verify the file parses structurally (no apply yet)**

Run: `grep -c 'create or replace function' supabase/migrations/0020_location_requests.sql`
Expected: `3`

Run: `grep -c "00000000-0000-4000-8000-00000000a99d" supabase/migrations/0020_location_requests.sql`
Expected: `4` (the seed insert + one `v_system_id constant` declaration per RPC).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0020_location_requests.sql
git commit -m "Add migration 0020: location_requests table + request/approve/reject RPCs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Apply to QA and prove the write path in SQL

Proves the entire server-side contract before any UI exists. If this task passes, the rest of the plan is only presentation.

**Files:**
- Modify: none (database state only)

**Interfaces:**
- Consumes: `supabase/migrations/0020_location_requests.sql` from Task 1.
- Produces: verified-live `request_location` / `approve_location_request` / `reject_location_request` on QA.

- [ ] **Step 1: Link to QA and apply**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0020_location_requests.sql
```

- [ ] **Step 2: Verify the three functions, the system profile, and the policies exist**

Run:
```bash
echo "select proname, prosecdef from pg_proc where proname in ('request_location','approve_location_request','reject_location_request');" | supabase db query --linked
```
Expected: three rows, all `prosecdef` = `true`.

Run:
```bash
echo "select id, display_name from profiles where id = '00000000-0000-4000-8000-00000000a99d';" | supabase db query --linked
```
Expected: one row, `display_name` = `The W App`.

Run:
```bash
echo "select polname from pg_policy where polrelid = 'location_requests'::regclass;" | supabase db query --linked
```
Expected: two rows — `location_requests_select_own` and `location_requests_select_admin`.

- [ ] **Step 3: Verify the guard rails reject bad input**

`request_location` reads `auth.uid()`, which is NULL in a plain SQL session, so the first guard must fire.

Run:
```bash
echo "select request_location('t','d',0,0);" | supabase db query --linked
```
Expected: an error containing `not_signed_in`. (An error here is a **PASS**.)

Run:
```bash
echo "select approve_location_request('00000000-0000-0000-0000-000000000000'::uuid);" | supabase db query --linked
```
Expected: an error containing `not_authorized` (no `auth.uid()` in a plain SQL session, so the admin check fails before the request lookup — PASS).

- [ ] **Step 4: Prove the full flow end-to-end using two real QA profiles**

Get two real profile ids (a non-admin requester and a master admin):
```bash
echo "select id, display_name, is_master_admin from profiles order by is_master_admin desc limit 5;" | supabase db query --linked
```
Pick a `is_master_admin = true` row (the reviewer) and any other row (the requester). Note both ids.

Run this as one `do $$ ... $$` block (substitute the two real ids for `<REQUESTER_ID>` and `<ADMIN_ID>`; the block only raises on a real problem, so "no error" plus the two follow-up SELECTs below is the actual pass/fail signal — `RAISE NOTICE` output is not returned by `supabase db query`):
```bash
echo "do \$\$
declare
  v_requester uuid := '<REQUESTER_ID>';
  v_admin uuid := '<ADMIN_ID>';
  v_request uuid;
  v_location uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_requester)::text, true);
  v_request := request_location('Test Venue From Plan', 'plan verification row', 40.7128, -74.0060);

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_location := approve_location_request(v_request);
end \$\$;" | supabase db query --linked
```
Expected: no error.

Then verify:
```bash
echo "select status, reviewed_by is not null as reviewed from location_requests where name = 'Test Venue From Plan';" | supabase db query --linked
```
Expected: one row, `status = 'approved'`, `reviewed = t`.

```bash
echo "select name, owner_id, geofence_radius_meters from locations where name = 'Test Venue From Plan';" | supabase db query --linked
```
Expected: one row, `owner_id` = the requester's id, `geofence_radius_meters = 50`.

```bash
echo "select m.content from messages m join conversation_participants cp on cp.conversation_id = m.conversation_id where cp.user_id = '<REQUESTER_ID>' and m.sender_id = '00000000-0000-4000-8000-00000000a99d' order by m.created_at;" | supabase db query --linked
```
Expected: two rows — the pending-approval message, then the approved message.

- [ ] **Step 5: Clean up the verification rows**

```bash
echo "delete from locations where name = 'Test Venue From Plan'; delete from location_requests where name = 'Test Venue From Plan';" | supabase db query --linked
```
(The system conversation + messages are harmless to leave — they're indistinguishable from a real interaction and cost nothing.)

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "Apply migration 0020 to QA (location request/approve/reject verified end-to-end)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Types, constants, and data-layer functions

**Files:**
- Modify: `lib/constants.ts` (append `SYSTEM_PROFILE_ID`)
- Modify: `lib/types.ts` (append one interface)
- Modify: `lib/data.ts` (append near the other RPC wrappers at the end of the file)

**Interfaces:**
- Consumes: the RPCs from Task 2; `getCurrentUserId()` and `supabase`, both already present in `lib/data.ts`.
- Produces:
  ```ts
  // lib/constants.ts
  export const SYSTEM_PROFILE_ID: string

  // lib/types.ts
  export interface LocationRequest {
    id: string;
    submitted_by: string;
    name: string;
    description: string | null;
    lat: number;
    lng: number;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    profiles?: { display_name: string } | null;
  }

  // lib/data.ts
  function requestLocation(name: string, description: string, lat: number, lng: number): Promise<string>
  function fetchLocationRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<LocationRequest[]>
  function approveLocationRequest(requestId: string): Promise<string>
  function rejectLocationRequest(requestId: string, reason?: string): Promise<void>
  ```
  Tasks 4 and 5 consume these.

- [ ] **Step 1: Append `SYSTEM_PROFILE_ID` to `lib/constants.ts`**

Add at the end of the file:

```ts
// The fixed "The W App" system-sender profile used by the location-request
// workflow (migration 0020) to post automated chat notifications. Never
// regenerate this id -- it must match the row the migration seeded.
export const SYSTEM_PROFILE_ID = '00000000-0000-4000-8000-00000000a99d';
```

- [ ] **Step 2: Append the interface to `lib/types.ts`**

Add at the end of the file:

```ts
// ---- Location requests (map "Add a location" -> admin approval queue) ----
// See supabase/migrations/0020_location_requests.sql.
export interface LocationRequest {
  id: string;
  submitted_by: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
}
```

- [ ] **Step 3: Append the data-layer functions to `lib/data.ts`**

Add `LocationRequest` to the existing `import type { ... } from './types'` block at the top of the file. Then add at the end of the file (after the connections-graph / friends-feed functions, which are currently last):

```ts
// ---- Location requests ----

// Creates a request for the current user and (server-side, same transaction)
// posts a "pending approval" message from the system sender. Returns the
// request id.
export async function requestLocation(
  name: string,
  description: string,
  lat: number,
  lng: number
): Promise<string> {
  const { data, error } = await supabase.rpc('request_location', {
    p_name: name,
    p_description: description || null,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return data as string;
}

// Master-admin-only by RLS (location_requests_select_admin) -- a non-admin
// calling this only ever gets back their own requests
// (location_requests_select_own), never an error.
export async function fetchLocationRequests(
  status?: 'pending' | 'approved' | 'rejected'
): Promise<LocationRequest[]> {
  let query = supabase
    .from('location_requests')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LocationRequest[];
}

// Master-admin-only (enforced inside the RPC). Creates the real locations
// row (owner = the original requester) and returns its id.
export async function approveLocationRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('approve_location_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as string;
}

// Master-admin-only (enforced inside the RPC).
export async function rejectLocationRequest(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_location_request', {
    p_request_id: requestId,
    p_reason: reason || null,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/constants.ts lib/types.ts lib/data.ts
git commit -m "Add location-request types, SYSTEM_PROFILE_ID, and data-layer functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Repoint the map's "Add a location" flow to `requestLocation()`

**Files:**
- Modify: `components/tabs/MapTab.tsx`

**Interfaces:**
- Consumes: `requestLocation` from `lib/data.ts` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add state for the request flow**

Near the other `useState` declarations (around the existing `newLocationName`/`newLocationDescription`/`clickedLocation` state), add:

```tsx
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
```

Add `requestLocation` to the existing `import { fetchVenues } from '@/lib/data';` line, making it `import { fetchVenues, requestLocation } from '@/lib/data';`.

- [ ] **Step 2: Replace `handleAddLocation`**

Current:
```tsx
  const handleAddLocation = () => {
    if (!newLocationName.trim() || !clickedLocation) return;
    
    const newLocation = {
      id: Date.now().toString(),
      name: newLocationName.trim(),
      description: newLocationDescription.trim() || 'Custom location',
      latitude: clickedLocation.lat,
      longitude: clickedLocation.lng,
      radius: 50,
      count: 1,
      category: 'custom',
      isHot: false,
    };

    // Add to current locations
    setNearbyLocations([...nearbyLocations, newLocation]);
    
    // Reset form
    setNewLocationName('');
    setNewLocationDescription('');
    setShowAddLocation(false);
    setClickedLocation(null);
  };
```

Replace with:
```tsx
  const handleAddLocation = () => {
    if (!newLocationName.trim() || !clickedLocation) return;

    setSubmittingRequest(true);
    setRequestError(null);
    requestLocation(
      newLocationName.trim(),
      newLocationDescription.trim(),
      clickedLocation.lat,
      clickedLocation.lng
    )
      .then(() => {
        setRequestSent(true);
      })
      .catch((err) => {
        console.error('Failed to submit location request:', err);
        setRequestError("Couldn't send your request. Try again.");
      })
      .finally(() => setSubmittingRequest(false));
  };
```

- [ ] **Step 3: Update `handleCancelAddLocation` to reset the new state**

Current:
```tsx
  const handleCancelAddLocation = () => {
    setNewLocationName('');
    setNewLocationDescription('');
    setShowAddLocation(false);
    setClickedLocation(null);
  };
```

Replace with:
```tsx
  const handleCancelAddLocation = () => {
    setNewLocationName('');
    setNewLocationDescription('');
    setShowAddLocation(false);
    setClickedLocation(null);
    setRequestError(null);
    setRequestSent(false);
  };
```

- [ ] **Step 4: Update the "Add Location Modal" JSX**

Find the modal block (`{showAddLocation && ( ... )}`, currently ending with the Cancel/Add Location button row). Replace the ENTIRE modal body `<div>` (the white card, from `<div style={{ backgroundColor: 'white', ...` through its closing `</div>`) with:

```tsx
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {requestSent ? (
              <>
                <h3 style={{
                  fontWeight: '600',
                  fontSize: '20px',
                  marginBottom: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>Request sent</h3>
                <p style={{
                  color: '#6B7280',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  We&apos;ll message you once it&apos;s reviewed.
                </p>
                <button
                  onClick={handleCancelAddLocation}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: '#17BFD9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 style={{
                  fontWeight: '600',
                  fontSize: '20px',
                  marginBottom: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>Request a Location</h3>

                <p style={{
                  color: '#6B7280',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  Before you request a venue: it should be a real place your group can
                  physically check into, and you should have some connection to it — you
                  work there, run events there, or can otherwise speak for it. This isn&apos;t
                  a general points-of-interest map. Duplicate, joke, or spam requests will
                  be rejected. Review is manual and may take a few days.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#374151',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    Location Name *
                  </label>
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Enter location name"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#374151',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    Description
                  </label>
                  <textarea
                    value={newLocationDescription}
                    onChange={(e) => setNewLocationDescription(e.target.value)}
                    placeholder="Enter location description"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {requestError && (
                  <p style={{
                    color: '#DC2626',
                    fontSize: '13px',
                    marginBottom: '16px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {requestError}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={handleCancelAddLocation}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: '#F3F4F6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddLocation}
                    disabled={!newLocationName.trim() || submittingRequest}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: newLocationName.trim() ? '#17BFD9' : '#D1D5DB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: newLocationName.trim() && !submittingRequest ? 'pointer' : 'not-allowed',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}
                  >
                    {submittingRequest ? 'Sending…' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
```

(This is the same outer modal overlay `<div style={{ position: 'fixed', ... }}>` — only its inner white-card child changes. Leave the outer overlay `<div>` and the `{showAddLocation && ( ... )}` wrapper exactly as they are.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual browser check**

Run `npm run dev`, sign in as a non-admin QA account, open the map, tap "+", tap the map, fill in a name, tap "Send Request".
Expected: the modal switches to "Request sent" / "We'll message you once it's reviewed"; tapping "Done" closes it. Open Messages — a conversation with "The W App" shows the pending-approval message. `select * from location_requests order by created_at desc limit 1;` via `supabase db query --linked` shows the new row with `status = 'pending'`.

- [ ] **Step 7: Commit**

```bash
git add components/tabs/MapTab.tsx
git commit -m "MapTab: repoint 'Add a location' to requestLocation(), add guidelines copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin approval queue

**Files:**
- Create: `app/admin/location-requests/page.tsx`
- Modify: `app/admin/page.tsx` (add one nav link)

**Interfaces:**
- Consumes: `fetchLocationRequests`, `approveLocationRequest`, `rejectLocationRequest` (Task 3); `LocationRequest` type (Task 3); `theme` from `@/lib/theme`.
- Produces: route `/admin/location-requests`. Nothing later consumes it.

- [ ] **Step 1: Create `app/admin/location-requests/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { fetchLocationRequests, approveLocationRequest, rejectLocationRequest } from '@/lib/data';
import type { LocationRequest } from '@/lib/types';
import { theme } from '@/lib/theme';

export default function LocationRequestsPage() {
  const [requests, setRequests] = useState<LocationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    fetchLocationRequests('pending')
      .then(setRequests)
      .catch((err) => {
        console.error('Failed to load location requests:', err);
        setError("Couldn't load requests.");
        setRequests([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveLocationRequest(id);
      load();
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError("Couldn't approve — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await rejectLocationRequest(id, rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError("Couldn't reject — try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Link href="/admin" style={{ color: theme.text, display: 'flex' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </Link>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>Location Requests</h1>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {requests === null ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading…</p>
        ) : requests.length === 0 ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>No pending requests.</p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.divider}`,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {r.name}
              </h3>
              {r.description && (
                <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  {r.description}
                </p>
              )}
              <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Requested by {r.profiles?.display_name ?? 'someone'} · {new Date(r.created_at).toLocaleDateString()} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </p>

              {rejectingId === r.id ? (
                <div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: theme.surface2,
                      border: `1px solid ${theme.divider}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '13px',
                      marginBottom: '10px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => reject(r.id)}
                      disabled={busyId === r.id}
                      style={{ background: theme.accent2, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {busyId === r.id ? '…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      style={{ background: theme.surface2, color: theme.text, border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => approve(r.id)}
                    disabled={busyId === r.id}
                    style={{ background: theme.accent, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busyId === r.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setRejectingId(r.id)}
                    disabled={busyId === r.id}
                    style={{ background: 'none', border: `1px solid ${theme.divider}`, color: theme.muted, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add a nav link from the main admin page**

In `app/admin/page.tsx`, right after the header's closing `</div>` (the one containing the "W Staff Admin" `<h1>` and its description `<p>`) and before `<div style={{ padding: '20px' }}>`, add:

```tsx
      <div style={{ padding: '16px 20px 0' }}>
        <Link
          href="/admin/location-requests"
          style={{
            display: 'inline-block',
            backgroundColor: theme.accent,
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          Location Requests
        </Link>
      </div>
```

(`Link` is already imported at the top of `app/admin/page.tsx`; `theme` is already imported too.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual browser check**

Sign in as a master admin, go to `/admin`, click "Location Requests". Expected: the pending request created in Task 4's browser check appears. Click "Approve" — it disappears from the list (now approved). Verify:
```bash
echo "select status from location_requests order by created_at desc limit 1;" | supabase db query --linked
echo "select name, owner_id from locations order by created_at desc limit 1;" | supabase db query --linked
```
Expected: `status = 'approved'`; the new `locations` row's `owner_id` matches the requester from Task 4.

As the requester, check Messages again: the "The W App" thread now also has the "was approved" message.

Repeat once more with a fresh request + "Reject" (with a reason) to confirm the reject path and its message.

- [ ] **Step 5: Commit**

```bash
git add app/admin/location-requests/page.tsx app/admin/page.tsx
git commit -m "Add admin location-requests approval queue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** schema + 3 RPCs (Task 1-2), system sender (Task 1, seeded), types/constants/data functions (Task 3), map repoint + guidelines copy (Task 4), admin queue (Task 5). Every spec scope item maps to a task. Categories is explicitly a separate, later sub-project per the spec — not here.
- **Type consistency:** `LocationRequest` fields match what `fetchLocationRequests`'s `.select('*, profiles(display_name)')` returns and what the admin page reads (`r.name`, `r.description`, `r.profiles?.display_name`, `r.lat`, `r.lng`, `r.created_at`). `requestLocation`/`approveLocationRequest`/`rejectLocationRequest` signatures match their RPC param names exactly (`p_name`, `p_description`, `p_lat`, `p_lng`, `p_request_id`, `p_reason`).
- **The system-sender id is a single literal, repeated verbatim** across the migration's seed, all three RPCs' `v_system_id constant`, and `lib/constants.ts`'s `SYSTEM_PROFILE_ID` — Task 1's Step 3 grep count (`4`) checks this before Task 1 is considered done.
- **Known gap, deliberate:** no UI shows a requester their own pending requests' location on the map, and there's no request-history view in the admin panel (`reviewed_at`/`status` are in the table for whenever that's wanted) — both explicitly deferred in the spec.
