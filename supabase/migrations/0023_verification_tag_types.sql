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
