-- Rolled-back behaviour checks for 0046. Everything happens inside one DO
-- block that ends by raising the results, so nothing persists.
-- Run: supabase db query --linked --project-ref <QA ref> -f <this file>
do $$
declare
  m uuid := '22222222-2222-2222-2222-222222222222';  -- venue owner (manager)
  a uuid := '11111111-1111-1111-1111-111111111111';  -- attendee
  v uuid;
  b uuid;
  res text := '';
  n int;
  p int;
  j jsonb;
  ok boolean;
begin
  insert into locations (name, lat, lng, geofence_radius_meters, owner_id, is_event)
  values ('0046 test venue', 36.0999, -80.2442, 100, m, false) returning id into v;
  insert into banners (location_id, image_url, display_order, is_active)
  values (v, 'https://example.com/slide.png', 0, true) returning id into b;

  -- ---- as attendee, not checked in
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    perform public.set_event_role(v, 'designer');
    res := res || E'\nFAIL 1 role without check-in allowed';
  exception when others then
    res := res || E'\nok   1 role without check-in rejected (' || sqlstate || ')';
  end;

  execute 'reset role';
  insert into location_checkins (user_id, location_id, mode) values (a, v, 'live');
  execute 'set local role authenticated';

  -- ---- as attendee, checked in
  perform public.set_event_role(v, 'designer');
  perform public.set_event_role(v, 'developer');
  select count(*) into n from event_roles where location_id = v and user_id = a and role = 'developer';
  res := res || E'\n' || case when n = 1 then 'ok  ' else 'FAIL' end || ' 2 role set + changed (rows=' || n || ')';

  begin
    perform public.set_event_role(v, 'ceo');
    res := res || E'\nFAIL 3 unknown role accepted';
  exception when others then
    res := res || E'\nok   3 unknown role rejected (' || sqlstate || ')';
  end;

  perform public.record_event_presence(v, 36.20, -80.40, 10, 'America/New_York');
  select count(*) into n from event_presence_days where location_id = v;
  res := res || E'\n' || case when n = 0 then 'ok  ' else 'FAIL' end || ' 4 far-away fix logs nothing (rows=' || n || ')';

  perform public.record_event_presence(v, 36.0999, -80.2442, 10, 'America/New_York');
  perform public.record_event_presence(v, 36.0999, -80.2442, 10, 'Not/AZone');
  select count(*), max(pings) into n, p from event_presence_days where location_id = v;
  res := res || E'\n' || case when n = 1 and p = 1 then 'ok  ' else 'FAIL' end
         || ' 5 inside fix logs one day, repeat within a minute ignored, bad tz tolerated (rows=' || n || ', pings=' || coalesce(p::text, 'null') || ')';

  perform public.record_slide_event(b, 'view');
  perform public.record_slide_event(b, 'view');
  perform public.record_slide_event(b, 'tap');
  execute 'reset role';
  select count(*) into n from carousel_slide_events where banner_id = b;
  res := res || E'\n' || case when n = 2 then 'ok  ' else 'FAIL' end || ' 6 slide view deduped + tap (rows=' || n || ')';
  execute 'set local role authenticated';

  select count(*) into n from carousel_slide_events where banner_id = b;
  res := res || E'\n' || case when n = 0 then 'ok  ' else 'FAIL' end || ' 7 attendee cannot read slide events (visible=' || n || ')';

  begin
    insert into event_staff (location_id, user_id, kind, added_by) values (v, a, 'judge', a);
    res := res || E'\nFAIL 8 attendee self-marked as staff';
  exception when others then
    res := res || E'\nok   8 attendee cannot write staff (' || sqlstate || ')';
  end;

  begin
    perform public.event_tracking_summary(v);
    res := res || E'\nFAIL 9 attendee read the summary';
  exception when others then
    res := res || E'\nok   9 attendee summary rejected (' || sqlstate || ')';
  end;

  select count(*) into n from event_roles where location_id = v;
  res := res || E'\n' || case when n = 1 then 'ok  ' else 'FAIL' end || ' 10 attendee reads own role (rows=' || n || ')';

  -- ---- as manager
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);

  j := public.event_tracking_summary(v);
  ok := (j->>'attendees')::int = 1 and (j->'roles'->>'developer')::int = 1
        and (j->'presence_days'->0->>'people')::int = 1
        and (j->'slides'->0->>'viewers')::int = 1 and (j->'slides'->0->>'tappers')::int = 1
        and (j->>'dates_set')::boolean = false;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 11 manager summary before staff: ' || j::text;

  insert into event_staff (location_id, user_id, kind, added_by) values (v, a, 'mentor', m);
  j := public.event_tracking_summary(v);
  ok := (j->>'staff')::int = 1 and (j->>'attendees')::int = 0 and j->'roles' = '{}'::jsonb
        and j->'presence_days' = '[]'::jsonb and (j->'slides'->0->>'viewers')::int = 0;
  res := res || E'\n' || case when ok then 'ok  ' else 'FAIL' end || ' 12 staff excluded from every count: ' || j::text;

  select count(*) into n from event_presence_days where location_id = v;
  res := res || E'\n' || case when n = 1 then 'ok  ' else 'FAIL' end || ' 13 manager reads presence rows (rows=' || n || ')';

  execute 'reset role';
  raise exception 'ROLLED BACK. Results:%', res;
end;
$$;
