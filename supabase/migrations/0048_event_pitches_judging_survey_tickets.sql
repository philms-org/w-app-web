-- 0048: Startup Weekend readout, P1 batch B (founder approved the mockup
-- defaults 2026-10-20). Builds on 0046 (event_staff gives judges).
--
--   1. Pitch voting: event_pitches + event_pitch_votes. The organizer opens
--      and closes voting (locations.pitch_voting off/open/done); 3 votes per
--      person; totals stay hidden from attendees until voting is done. A pitch
--      can be turned into a team with the pitcher as owner.
--   2. Judging: event_judge_scores. Judges (event_staff kind 'judge') score
--      each team 1-5 on Startup Weekend's three criteria, equally weighted.
--      Only managers see the leaderboard.
--   3. Post-event survey: event_survey_responses. Wave 0 the first time an
--      attendee opens the app after the event's last day (for 14 days), wave
--      30 asks "still working on it?" 30-60 days after. Skippable.
--   4. Ticket list: event_tickets, matched to W accounts by email. Emails are
--      deleted 30 days after the event ends (60 days after import when the
--      event has no end date) by a daily cron job.
--   5. event_outcomes_summary(): manager-only numbers for the report card.

-- ---------------------------------------------------------- small helpers

alter table public.locations
  add column if not exists pitch_voting text not null default 'off'
    check (pitch_voting in ('off', 'open', 'done'));

-- Judges and other staff can read their own staff row (0046 only let
-- managers read the table), so the app knows to show "Score teams".
drop policy if exists event_staff_select_own on public.event_staff;
create policy event_staff_select_own on public.event_staff
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public._attends_event(p_location_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from location_checkins where location_id = p_location_id and user_id = p_user_id)
      or exists (select 1 from venue_early_access where location_id = p_location_id and user_id = p_user_id);
$$;

revoke all on function public._attends_event(uuid, uuid) from public;

-- ---------------------------------------------------------------- pitches

create table if not exists public.event_pitches (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  pitcher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 60),
  summary text check (summary is null or char_length(summary) <= 140),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (location_id, pitcher_id)
);

create table if not exists public.event_pitch_votes (
  pitch_id uuid not null references public.event_pitches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pitch_id, user_id)
);
create index if not exists event_pitch_votes_by_voter on public.event_pitch_votes (location_id, user_id);

alter table public.event_pitches enable row level security;
alter table public.event_pitch_votes enable row level security;

-- Reads go through pitch_board(); direct reads are for managers only.
drop policy if exists event_pitches_select on public.event_pitches;
create policy event_pitches_select on public.event_pitches
  for select to authenticated
  using (public.is_venue_manager(location_id, auth.uid()));
drop policy if exists event_pitch_votes_select on public.event_pitch_votes;
create policy event_pitch_votes_select on public.event_pitch_votes
  for select to authenticated
  using (user_id = auth.uid() or public.is_venue_manager(location_id, auth.uid()));
grant select on public.event_pitches, public.event_pitch_votes to authenticated;

create or replace function public.set_pitch_voting(p_location_id uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'only organizers can change voting' using errcode = '42501';
  end if;
  if p_state not in ('off', 'open', 'done') then
    raise exception 'unknown voting state' using errcode = '22023';
  end if;
  update locations set pitch_voting = p_state where id = p_location_id;
end;
$$;

create or replace function public.create_pitch(p_location_id uuid, p_title text, p_summary text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if (select pitch_voting from locations where id = p_location_id) is distinct from 'open' then
    raise exception 'pitches are closed' using errcode = '42501';
  end if;
  if not (public.is_checked_in_at(p_location_id) or public.has_early_access(p_location_id)
          or public.is_venue_manager(p_location_id, auth.uid())) then
    raise exception 'not at this event' using errcode = '42501';
  end if;
  if char_length(v_title) < 2 or char_length(v_title) > 60 then
    raise exception 'pitch name must be 2 to 60 characters' using errcode = '22023';
  end if;
  if v_summary is not null and char_length(v_summary) > 140 then
    raise exception 'one line, 140 characters or fewer' using errcode = '22023';
  end if;
  begin
    insert into event_pitches (location_id, pitcher_id, title, summary)
    values (p_location_id, auth.uid(), v_title, v_summary)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'you already added a pitch' using errcode = '23505';
  end;
  return v_id;
end;
$$;

create or replace function public.delete_pitch(p_pitch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pitch event_pitches%rowtype;
begin
  select * into v_pitch from event_pitches where id = p_pitch_id;
  if v_pitch.id is null then return; end if;
  if auth.uid() is null or not (v_pitch.pitcher_id = auth.uid()
     or public.is_venue_manager(v_pitch.location_id, auth.uid())) then
    raise exception 'not your pitch' using errcode = '42501';
  end if;
  delete from event_pitches where id = p_pitch_id;
end;
$$;

create or replace function public.vote_pitch(p_pitch_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select location_id into v_location from event_pitches where id = p_pitch_id;
  if v_location is null then
    raise exception 'pitch not found' using errcode = 'P0002';
  end if;
  if (select pitch_voting from locations where id = v_location) is distinct from 'open' then
    raise exception 'voting is closed' using errcode = '42501';
  end if;
  if not (public.is_checked_in_at(v_location) or public.has_early_access(v_location)) then
    raise exception 'not at this event' using errcode = '42501';
  end if;
  if not p_on then
    delete from event_pitch_votes where pitch_id = p_pitch_id and user_id = auth.uid();
    return;
  end if;
  -- Serialize one voter's votes so two quick taps can't both pass the limit.
  perform pg_advisory_xact_lock(hashtext(v_location::text || auth.uid()::text));
  if exists (select 1 from event_pitch_votes where pitch_id = p_pitch_id and user_id = auth.uid()) then
    return;
  end if;
  if (select count(*) from event_pitch_votes where location_id = v_location and user_id = auth.uid()) >= 3 then
    raise exception 'you have used all 3 votes' using errcode = '23514';
  end if;
  insert into event_pitch_votes (pitch_id, user_id, location_id) values (p_pitch_id, auth.uid(), v_location);
end;
$$;

-- Everything the Pitches screen needs. Vote totals are only included for
-- organizers, or for everyone once voting is done.
create or replace function public.pitch_board(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state text;
  v_manager boolean;
  v_show boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  v_manager := coalesce(public.is_venue_manager(p_location_id, auth.uid()), false);
  if not (v_manager or public._attends_event(p_location_id, auth.uid())) then
    raise exception 'not at this event' using errcode = '42501';
  end if;
  select pitch_voting into v_state from locations where id = p_location_id;
  v_show := v_manager or v_state = 'done';

  return jsonb_build_object(
    'state', v_state,
    'is_manager', v_manager,
    'votes_left', 3 - (select count(*) from event_pitch_votes where location_id = p_location_id and user_id = auth.uid()),
    'pitches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'summary', p.summary,
        'pitcher_name', pr.display_name,
        'mine', p.pitcher_id = auth.uid(),
        'voted', exists (select 1 from event_pitch_votes v where v.pitch_id = p.id and v.user_id = auth.uid()),
        'votes', case when v_show then (select count(*) from event_pitch_votes v where v.pitch_id = p.id) end,
        'team_id', p.team_id
      ) order by case when v_show then (select count(*) from event_pitch_votes v where v.pitch_id = p.id) end desc nulls last, p.created_at)
      from event_pitches p
      left join profiles pr on pr.id = p.pitcher_id
      where p.location_id = p_location_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Organizer: turn a pitch into a team owned by its pitcher.
create or replace function public.promote_pitch_to_team(p_pitch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pitch event_pitches%rowtype;
  v_team_id uuid;
begin
  select * into v_pitch from event_pitches where id = p_pitch_id;
  if v_pitch.id is null then
    raise exception 'pitch not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_venue_manager(v_pitch.location_id, auth.uid()) then
    raise exception 'only organizers can make teams from pitches' using errcode = '42501';
  end if;
  if v_pitch.team_id is not null then
    return v_pitch.team_id;
  end if;

  begin
    insert into teams (location_id, name, kind, idea, join_code, owner_id)
    values (v_pitch.location_id, v_pitch.title, 'team', v_pitch.summary, public.gen_team_code(), v_pitch.pitcher_id)
    returning id into v_team_id;
  exception when unique_violation then
    raise exception 'a team with that name already exists here' using errcode = '23505';
  end;

  if not exists (
    select 1 from team_members
    where location_id = v_pitch.location_id and user_id = v_pitch.pitcher_id and status = 'active'
  ) then
    insert into team_members (team_id, user_id, location_id, role, status)
    values (v_team_id, v_pitch.pitcher_id, v_pitch.location_id, 'owner', 'active');
    delete from team_members
    where user_id = v_pitch.pitcher_id and location_id = v_pitch.location_id and status = 'requested';
  end if;

  update event_pitches set team_id = v_team_id where id = p_pitch_id;
  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------- judging

create table if not exists public.event_judge_scores (
  team_id uuid not null references public.teams(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  validation smallint not null check (validation between 1 and 5),
  execution smallint not null check (execution between 1 and 5),
  business smallint not null check (business between 1 and 5),
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (team_id, judge_id)
);

alter table public.event_judge_scores enable row level security;
drop policy if exists event_judge_scores_select on public.event_judge_scores;
create policy event_judge_scores_select on public.event_judge_scores
  for select to authenticated
  using (judge_id = auth.uid() or public.is_venue_manager(location_id, auth.uid()));
grant select on public.event_judge_scores to authenticated;

create or replace function public._is_event_judge(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_staff
    where location_id = p_location_id and user_id = auth.uid() and kind = 'judge'
  );
$$;

revoke all on function public._is_event_judge(uuid) from public;

create or replace function public.submit_judge_score(
  p_team_id uuid,
  p_validation integer,
  p_execution integer,
  p_business integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select location_id into v_location from teams where id = p_team_id;
  if v_location is null then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if not public._is_event_judge(v_location) then
    raise exception 'only judges can score teams' using errcode = '42501';
  end if;
  if p_validation not between 1 and 5 or p_execution not between 1 and 5 or p_business not between 1 and 5 then
    raise exception 'scores are 1 to 5' using errcode = '22023';
  end if;
  insert into event_judge_scores (team_id, judge_id, location_id, validation, execution, business, note)
  values (p_team_id, auth.uid(), v_location, p_validation, p_execution, p_business, v_note)
  on conflict (team_id, judge_id) do update
    set validation = excluded.validation, execution = excluded.execution,
        business = excluded.business, note = excluded.note, updated_at = now();
end;
$$;

-- Judges get the team list with their own scores; managers also get the
-- averaged leaderboard (total = sum of the three criterion averages, max 15).
create or replace function public.judging_board(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_manager boolean;
  v_judge boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  v_manager := coalesce(public.is_venue_manager(p_location_id, auth.uid()), false);
  v_judge := public._is_event_judge(p_location_id);
  if not (v_manager or v_judge) then
    raise exception 'only judges and organizers can see judging' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'is_judge', v_judge,
    'is_manager', v_manager,
    'judges', (select count(*) from event_staff where location_id = p_location_id and kind = 'judge'),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', t.id,
        'name', t.name,
        'idea', t.idea,
        'mine', (select jsonb_build_object('validation', s.validation, 'execution', s.execution,
                                           'business', s.business, 'note', s.note)
                 from event_judge_scores s where s.team_id = t.id and s.judge_id = auth.uid())
      ) order by t.created_at)
      from teams t where t.location_id = p_location_id
    ), '[]'::jsonb),
    'leaderboard', case when v_manager then coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', r.team_id, 'name', r.name, 'judges', r.judges,
        'validation', r.v, 'execution', r.e, 'business', r.b, 'total', r.total,
        'place', r.place
      ) order by r.place)
      from (
        select t.id as team_id, t.name, count(s.judge_id) as judges,
               round(avg(s.validation), 2) as v, round(avg(s.execution), 2) as e, round(avg(s.business), 2) as b,
               round(avg(s.validation) + avg(s.execution) + avg(s.business), 2) as total,
               rank() over (order by avg(s.validation) + avg(s.execution) + avg(s.business) desc) as place
        from teams t
        join event_judge_scores s on s.team_id = t.id
        where t.location_id = p_location_id
        group by t.id, t.name
      ) r
    ), '[]'::jsonb) end
  );
end;
$$;

-- ---------------------------------------------------------- post-event survey

create table if not exists public.event_survey_responses (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  wave smallint not null check (wave in (0, 30)),
  nps smallint check (nps is null or nps between 0 and 10),
  best text check (best is null or char_length(best) <= 280),
  team_status text check (team_status is null or team_status in ('yes', 'no', 'unsure')),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (location_id, user_id, wave)
);

alter table public.event_survey_responses enable row level security;
drop policy if exists event_survey_responses_select on public.event_survey_responses;
create policy event_survey_responses_select on public.event_survey_responses
  for select to authenticated
  using (user_id = auth.uid() or public.is_venue_manager(location_id, auth.uid()));
grant select on public.event_survey_responses to authenticated;

-- The window a wave is open in, counted from the end of the event's last day.
create or replace function public._survey_window_open(p_end timestamptz, p_wave integer)
returns boolean
language sql
stable
as $$
  select p_end is not null and case p_wave
    when 0 then now() >= p_end + interval '1 day' and now() < p_end + interval '15 days'
    when 30 then now() >= p_end + interval '30 days' and now() < p_end + interval '60 days'
    else false
  end;
$$;

-- The one survey this person should see now, if any: the most recent event
-- they attended (not as staff) whose wave is open and unanswered.
create or replace function public.my_due_event_survey()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('location_id', l.id, 'name', l.name, 'wave', w.wave)
  from locations l
  cross join (values (0), (30)) as w(wave)
  where auth.uid() is not null
    and public._attends_event(l.id, auth.uid())
    and not exists (select 1 from event_staff s where s.location_id = l.id and s.user_id = auth.uid())
    and public._survey_window_open(l.event_end_date, w.wave)
    and not exists (
      select 1 from event_survey_responses r
      where r.location_id = l.id and r.user_id = auth.uid() and r.wave = w.wave
    )
  order by l.event_end_date desc, w.wave desc
  limit 1;
$$;

create or replace function public.submit_event_survey(
  p_location_id uuid,
  p_wave integer,
  p_nps integer,
  p_best text,
  p_team_status text,
  p_skipped boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best text := nullif(btrim(coalesce(p_best, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not public._attends_event(p_location_id, auth.uid()) then
    raise exception 'not at this event' using errcode = '42501';
  end if;
  if not public._survey_window_open((select event_end_date from locations where id = p_location_id), p_wave) then
    raise exception 'this survey is closed' using errcode = '42501';
  end if;
  if p_nps is not null and p_nps not between 0 and 10 then
    raise exception 'score is 0 to 10' using errcode = '22023';
  end if;
  if p_team_status is not null and p_team_status not in ('yes', 'no', 'unsure') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  if v_best is not null and char_length(v_best) > 280 then
    raise exception 'keep it under 280 characters' using errcode = '22023';
  end if;
  insert into event_survey_responses (location_id, user_id, wave, nps, best, team_status, skipped)
  values (
    p_location_id, auth.uid(), p_wave,
    case when coalesce(p_skipped, false) then null else p_nps end,
    case when coalesce(p_skipped, false) then null else v_best end,
    case when coalesce(p_skipped, false) then null else p_team_status end,
    coalesce(p_skipped, false)
  )
  on conflict (location_id, user_id, wave) do nothing;
end;
$$;

-- ---------------------------------------------------------------- tickets

create table if not exists public.event_tickets (
  location_id uuid not null references public.locations(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  name text check (name is null or char_length(name) <= 120),
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  primary key (location_id, email)
);

alter table public.event_tickets enable row level security;
drop policy if exists event_tickets_select on public.event_tickets;
create policy event_tickets_select on public.event_tickets
  for select to authenticated
  using (public.is_venue_manager(location_id, auth.uid()));
grant select on public.event_tickets to authenticated;

-- Replaces the venue's ticket list. p_rows: [{"email": "...", "name": "..."}].
create or replace function public.import_event_tickets(p_location_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'only organizers can import tickets' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'send up to 5000 rows' using errcode = '22023';
  end if;

  delete from event_tickets where location_id = p_location_id;
  insert into event_tickets (location_id, email, name, imported_by)
  select distinct on (lower(btrim(r->>'email')))
         p_location_id, lower(btrim(r->>'email')), left(nullif(btrim(r->>'name'), ''), 120), auth.uid()
  from jsonb_array_elements(p_rows) r
  where lower(btrim(coalesce(r->>'email', ''))) like '%_@_%.__%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.clear_event_tickets(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'only organizers can clear tickets' using errcode = '42501';
  end if;
  delete from event_tickets where location_id = p_location_id;
end;
$$;

-- Ticket list vs W accounts, matched on the account's sign-in email.
create or replace function public.ticket_match(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'only organizers can see the ticket match' using errcode = '42501';
  end if;

  return (
    with t as (
      select tk.email, tk.name, u.id as user_id
      from event_tickets tk
      left join auth.users u on lower(u.email) = tk.email
      where tk.location_id = p_location_id
    ),
    attendees as (
      select user_id from location_checkins where location_id = p_location_id
      union
      select user_id from venue_early_access where location_id = p_location_id
    )
    select jsonb_build_object(
      'tickets', (select count(*) from t),
      'imported_at', (select max(imported_at) from event_tickets where location_id = p_location_id),
      'in_w', (select count(*) from t where user_id is not null),
      'checked_in', (select count(*) from t where user_id is not null and exists (
        select 1 from location_checkins c where c.location_id = p_location_id and c.user_id = t.user_id)),
      'not_joined', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'name', name) order by email)
                              from t where user_id is null), '[]'::jsonb),
      'no_ticket', coalesce((
        select jsonb_agg(pr.display_name order by pr.display_name)
        from attendees a
        join auth.users u on u.id = a.user_id
        left join profiles pr on pr.id = a.user_id
        where not exists (select 1 from event_tickets tk where tk.location_id = p_location_id and tk.email = lower(u.email))
          and not exists (select 1 from event_staff s where s.location_id = p_location_id and s.user_id = a.user_id)
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.purge_expired_event_tickets()
returns void
language sql
security definer
set search_path = public
as $$
  delete from event_tickets tk
  using locations l
  where l.id = tk.location_id
    and (
      (l.event_end_date is not null and l.event_end_date + interval '31 days' < now())
      or (l.event_end_date is null and tk.imported_at + interval '60 days' < now())
    );
$$;

revoke all on function public.purge_expired_event_tickets() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-expired-event-tickets')
      where exists (select 1 from cron.job where jobname = 'purge-expired-event-tickets');
    perform cron.schedule('purge-expired-event-tickets', '17 4 * * *',
                          'select public.purge_expired_event_tickets();');
  end if;
end;
$$;

-- --------------------------------------------------------------- summary

create or replace function public.event_outcomes_summary(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not a manager of this venue' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'pitch_voting', (select pitch_voting from locations where id = p_location_id),
    'pitches', (select count(*) from event_pitches where location_id = p_location_id),
    'votes', (select count(*) from event_pitch_votes where location_id = p_location_id),
    'judges', (select count(*) from event_staff where location_id = p_location_id and kind = 'judge'),
    'teams_scored', (select count(distinct team_id) from event_judge_scores where location_id = p_location_id),
    'survey', (
      select jsonb_build_object(
        'answered', count(*) filter (where wave = 0 and not skipped),
        'skipped', count(*) filter (where wave = 0 and skipped),
        'nps_responses', count(nps) filter (where wave = 0),
        'nps', case when count(nps) filter (where wave = 0) = 0 then null else round(
          100.0 * (count(*) filter (where wave = 0 and nps >= 9) - count(*) filter (where wave = 0 and nps <= 6))
          / count(nps) filter (where wave = 0)) end,
        'still_going', count(*) filter (where wave = 0 and team_status = 'yes'),
        'still_going_30', count(*) filter (where wave = 30 and team_status = 'yes'),
        'answered_30', count(*) filter (where wave = 30 and not skipped)
      )
      from event_survey_responses where location_id = p_location_id
    ),
    'tickets', (select count(*) from event_tickets where location_id = p_location_id)
  );
end;
$$;

-- --------------------------------------------------------------- grants

revoke all on function public.set_pitch_voting(uuid, text) from public;
revoke all on function public.create_pitch(uuid, text, text) from public;
revoke all on function public.delete_pitch(uuid) from public;
revoke all on function public.vote_pitch(uuid, boolean) from public;
revoke all on function public.pitch_board(uuid) from public;
revoke all on function public.promote_pitch_to_team(uuid) from public;
revoke all on function public.submit_judge_score(uuid, integer, integer, integer, text) from public;
revoke all on function public.judging_board(uuid) from public;
revoke all on function public.my_due_event_survey() from public;
revoke all on function public.submit_event_survey(uuid, integer, integer, text, text, boolean) from public;
revoke all on function public.import_event_tickets(uuid, jsonb) from public;
revoke all on function public.clear_event_tickets(uuid) from public;
revoke all on function public.ticket_match(uuid) from public;
revoke all on function public.event_outcomes_summary(uuid) from public;

grant execute on function public.set_pitch_voting(uuid, text) to authenticated;
grant execute on function public.create_pitch(uuid, text, text) to authenticated;
grant execute on function public.delete_pitch(uuid) to authenticated;
grant execute on function public.vote_pitch(uuid, boolean) to authenticated;
grant execute on function public.pitch_board(uuid) to authenticated;
grant execute on function public.promote_pitch_to_team(uuid) to authenticated;
grant execute on function public.submit_judge_score(uuid, integer, integer, integer, text) to authenticated;
grant execute on function public.judging_board(uuid) to authenticated;
grant execute on function public.my_due_event_survey() to authenticated;
grant execute on function public.submit_event_survey(uuid, integer, integer, text, text, boolean) to authenticated;
grant execute on function public.import_event_tickets(uuid, jsonb) to authenticated;
grant execute on function public.clear_event_tickets(uuid) to authenticated;
grant execute on function public.ticket_match(uuid) to authenticated;
grant execute on function public.event_outcomes_summary(uuid) to authenticated;
