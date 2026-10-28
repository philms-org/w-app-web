-- Rollback for 0048. Drops pitches, votes, judge scores, survey answers and
-- ticket lists collected since it was applied.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-expired-event-tickets')
      where exists (select 1 from cron.job where jobname = 'purge-expired-event-tickets');
  end if;
end;
$$;
drop function if exists public.event_outcomes_summary(uuid);
drop function if exists public.purge_expired_event_tickets();
drop function if exists public.ticket_match(uuid);
drop function if exists public.clear_event_tickets(uuid);
drop function if exists public.import_event_tickets(uuid, jsonb);
drop function if exists public.submit_event_survey(uuid, integer, integer, text, text, boolean);
drop function if exists public.my_due_event_survey();
drop function if exists public._survey_window_open(timestamptz, integer);
drop function if exists public.judging_board(uuid);
drop function if exists public.submit_judge_score(uuid, integer, integer, integer, text);
drop function if exists public._is_event_judge(uuid);
drop function if exists public.promote_pitch_to_team(uuid);
drop function if exists public.pitch_board(uuid);
drop function if exists public.vote_pitch(uuid, boolean);
drop function if exists public.delete_pitch(uuid);
drop function if exists public.create_pitch(uuid, text, text);
drop function if exists public.set_pitch_voting(uuid, text);
drop function if exists public._attends_event(uuid, uuid);
drop table if exists public.event_tickets;
drop table if exists public.event_survey_responses;
drop table if exists public.event_judge_scores;
drop table if exists public.event_pitch_votes;
drop table if exists public.event_pitches;
drop policy if exists event_staff_select_own on public.event_staff;
alter table public.locations drop column if exists pitch_voting;
