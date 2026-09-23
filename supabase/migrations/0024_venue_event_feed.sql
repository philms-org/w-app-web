-- Venue event feed: posts + likes, scoped to people currently checked in at
-- that venue. Same trust boundary the venue group chat (0008) already uses.
-- See docs/superpowers/specs/2026-09-23-venue-event-feed-design.md.

alter table profiles add column if not exists date_of_birth date;

create table if not exists venue_posts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  author_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists venue_posts_location_recent
  on venue_posts (location_id, created_at desc);

alter table venue_posts enable row level security;

create policy venue_posts_select_checked_in on venue_posts for select to authenticated
  using (
    exists (
      select 1 from location_checkins lc
      where lc.user_id = auth.uid()
        and lc.location_id = venue_posts.location_id
        and lc.checked_out_at is null
    )
  );

create policy venue_posts_insert_checked_in on venue_posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from location_checkins lc
      where lc.user_id = auth.uid()
        and lc.location_id = venue_posts.location_id
        and lc.checked_out_at is null
    )
  );

create table if not exists post_likes (
  post_id uuid not null references venue_posts(id) on delete cascade,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

create policy post_likes_select_checked_in on post_likes for select to authenticated
  using (
    exists (
      select 1 from venue_posts vp
      join location_checkins lc on lc.location_id = vp.location_id
      where vp.id = post_likes.post_id
        and lc.user_id = auth.uid()
        and lc.checked_out_at is null
    )
  );

create policy post_likes_insert_checked_in on post_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from venue_posts vp
      join location_checkins lc on lc.location_id = vp.location_id
      where vp.id = post_likes.post_id
        and lc.user_id = auth.uid()
        and lc.checked_out_at is null
    )
  );

create policy post_likes_delete_own on post_likes for delete to authenticated
  using (auth.uid() = user_id);
