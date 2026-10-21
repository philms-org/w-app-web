-- Rolled-back behaviour checks for 0047. One DO block that ends by raising
-- the results, so nothing persists. Needs 3 QA profiles besides the two below.
-- Run: supabase db query --linked --project-ref <QA ref> -f <this file>
do $$
declare
  m uuid := '22222222-2222-2222-2222-222222222222';  -- venue owner (manager)
  a uuid := '11111111-1111-1111-1111-111111111111';  -- attendee, later judge
  v uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  t uuid;
  e text;
  res text := '';
  n int;
  j jsonb;
  ok boolean;
begin
  insert into locations (name, lat, lng, geofence_radius_meters, owner_id, is_event, event_date, event_end_date)
  values ('0047 test venue', 36.0999, -80.2442, 100, m, false, now() - interval '3 days', now() - interval '2 days')
  returning id into v;
  insert into location_checkins (user_id, location_id, mode) values (a, v, 'live');
  insert into event_pitches (location_id, pitcher_id, title) values (v, m, 'Pitch One') returning id into p1;
  select email into e from auth.users where id = a;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- ---- pitches while voting is off
  begin
    perform public.create_pitch(v, 'Lease Lens', 'AI reads your lease');
    res := res || E'\nFAIL 1 pitch accepted while voting is off';
  exception when others then res := res || E'\nok   1 pitch rejected while voting off (' || sqlstate || ')';
  end;
  begin
    perform public.set_pitch_voting(v, 'open');
    res := res || E'\nFAIL 2 attendee opened voting';
  exception when others then res := res || E'\nok   2 attendee cannot open voting (' || sqlstate || ')';
  end;

  -- ---- manager opens voting; three more pitchers
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.set_pitch_voting(v, 'open');
  execute 'reset role';
  insert into event_pitches (location_id, pitcher_id, title)
  select v, id, 'Pitch ' || row_number() over (order by id) from profiles where id not in (m, a) limit 3;
  select id into p2 from event_pitches where location_id = v and title = 'Pitch 1';
  select id into p3 from event_pitches where location_id = v and title = 'Pitch 2';
  select id into p4 from event_pitches where location_id = v and title = 'Pitch 3';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  perform public.create_pitch(v, 'Lease Lens', 'AI reads your lease');
  begin
    perform public.create_pitch(v, 'Second idea', null);
    res := res || E'\nFAIL 3 second pitch accepted';
  exception when others then res := res || E'\nok   3 one pitch per person (' || sqlstate || ')';
  end;

  perform public.vote_pitch(p1, true);
  perform public.vote_pitch(p1, true);
  perform public.vote_pitch(p2, true);
  perform public.vote_pitch(p3, true);
  begin
    perform public.vote_pitch(p4, true);
    res := res || E'\nFAIL 4 fourth vote accepted';
  exception when others then res := res || E'\nok   4 fourth vote rejected (' || sqlstate || ')';
  end;
  perform public.vote_pitch(p3, false);
  perform public.vote_pitch(p4, true);

  j := public.pitch_board(v);
  ok := (j->>'votes_left')::int = 0 and (j->>'state') = 'open'
        and not exists (select 1 from jsonb_array_elements(j->'pitches') x where x->'votes' <> 'null'::jsonb);
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 5 attendee board: 0 votes left, totals hidden while open';

  -- ---- manager sees totals, closes voting, promotes a pitch
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  j := public.pitch_board(v);
  ok := (select (x->>'votes')::int from jsonb_array_elements(j->'pitches') x where x->>'id' = p1::text) = 1;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 6 manager sees totals while open';
  perform public.set_pitch_voting(v, 'done');
  t := public.promote_pitch_to_team((select id from event_pitches where location_id = v and pitcher_id = a));
  execute 'reset role';
  select count(*) into n from team_members where team_id = t and user_id = a and role = 'owner' and status = 'active';
  execute 'set local role authenticated';
  res := res || E'\n' || case when n = 1 then 'ok  ' else 'FAIL' end || ' 7 pitch became a team owned by the pitcher';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  j := public.pitch_board(v);
  ok := (select count(*) from jsonb_array_elements(j->'pitches') x where x->'votes' = 'null'::jsonb) = 0;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 8 attendee sees totals once voting is done';
  begin
    perform public.vote_pitch(p2, false);
    res := res || E'\nFAIL 9 vote changed after close';
  exception when others then res := res || E'\nok   9 votes locked after close (' || sqlstate || ')';
  end;

  -- ---- judging
  begin
    perform public.submit_judge_score(t, 4, 3, 5, 'x');
    res := res || E'\nFAIL 10 non-judge scored';
  exception when others then res := res || E'\nok   10 non-judge cannot score (' || sqlstate || ')';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  insert into event_staff (location_id, user_id, kind, added_by) values (v, a, 'judge', m);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from event_staff where location_id = v and user_id = a;
  res := res || E'\n' || case when n = 1 then 'ok  ' else 'FAIL' end || ' 11 judge reads own staff row';
  perform public.submit_judge_score(t, 4, 3, 5, 'Strong interviews');
  perform public.submit_judge_score(t, 4, 4, 5, 'Strong interviews');
  begin
    perform public.submit_judge_score(t, 6, 3, 5, null);
    res := res || E'\nFAIL 12 score 6 accepted';
  exception when others then res := res || E'\nok   12 out-of-range score rejected (' || sqlstate || ')';
  end;
  j := public.judging_board(v);
  ok := j->'leaderboard' = 'null'::jsonb and (j->'teams'->0->'mine'->>'execution')::int = 4;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 13 judge sees own score, no leaderboard';
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  j := public.judging_board(v);
  ok := (j->'leaderboard'->0->>'total')::numeric = 13 and (j->'leaderboard'->0->>'place')::int = 1;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 14 manager leaderboard total 13, place 1';

  -- ---- survey (event ended 2 days ago). Staff don't get surveyed, so unmark the judge.
  delete from event_staff where location_id = v and user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  j := public.my_due_event_survey();
  ok := j is not null and (j->>'location_id')::uuid = v and (j->>'wave')::int = 0;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 15 wave-0 survey due after the event';
  perform public.submit_event_survey(v, 0, 9, 'Mentors were great', 'yes', false);
  begin
    perform public.submit_event_survey(v, 30, null, null, 'yes', false);
    res := res || E'\nFAIL 16 wave-30 accepted early';
  exception when others then res := res || E'\nok   16 wave 30 closed until day 30 (' || sqlstate || ')';
  end;
  j := public.my_due_event_survey();
  res := res || E'\n' || case when j is null or (j->>'location_id')::uuid <> v then 'ok  ' else 'FAIL' end || ' 17 survey not due after answering';

  -- ---- tickets
  begin
    perform public.import_event_tickets(v, '[{"email":"x@example.com"}]'::jsonb);
    res := res || E'\nFAIL 18 attendee imported tickets';
  exception when others then res := res || E'\nok   18 attendee cannot import tickets (' || sqlstate || ')';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  n := public.import_event_tickets(v, jsonb_build_array(
         jsonb_build_object('email', ' ' || upper(e) || ' ', 'name', 'Attendee'),
         jsonb_build_object('email', 'nobody-0047@example.com', 'name', 'Never joined'),
         jsonb_build_object('email', 'nobody-0047@example.com'),
         jsonb_build_object('email', 'not-an-email')));
  res := res || E'\n' || case when n = 2 then 'ok  ' else 'FAIL' end || ' 19 import trims, lowercases, dedupes, drops bad rows (rows=' || n || ')';
  j := public.ticket_match(v);
  ok := (j->>'tickets')::int = 2 and (j->>'in_w')::int = 1 and (j->>'checked_in')::int = 1
        and jsonb_array_length(j->'not_joined') = 1;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 20 match: 2 tickets, 1 in W, 1 checked in, 1 not joined';

  j := public.event_outcomes_summary(v);
  ok := (j->>'pitches')::int = 5 and (j->'survey'->>'nps')::int = 100 and (j->'survey'->>'still_going')::int = 1
        and (j->>'tickets')::int = 2;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 21 outcomes summary: ' || j::text;

  execute 'reset role';
  update locations set event_end_date = now() - interval '40 days' where id = v;
  perform public.purge_expired_event_tickets();
  select count(*) into n from event_tickets where location_id = v;
  res := res || E'\n' || case when n = 0 then 'ok  ' else 'FAIL' end || ' 22 tickets purged 30 days after the event';

  raise exception 'ROLLED BACK. Results:%', res;
end;
$$;
