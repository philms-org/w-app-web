import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

// Pitch voting, judging, post-event survey and ticket match (migration 0048).
// Every write is a SECURITY DEFINER RPC that checks the rules server-side and
// raises a short, readable message on refusal.

function rpcError(err: unknown, fallback: string): Error {
  const msg = (err as { message?: string } | null)?.message;
  if (msg && msg.length < 120 && !/violates|permission denied|JWT|relation|function/i.test(msg)) {
    return new Error(msg.charAt(0).toUpperCase() + msg.slice(1) + '.');
  }
  return new Error(fallback);
}

// ---------------------------------------------------------------- pitches

export type PitchVoting = 'off' | 'open' | 'done';

export interface Pitch {
  id: string;
  title: string;
  summary: string | null;
  pitcher_name: string | null;
  mine: boolean;
  voted: boolean;
  votes: number | null; // null while hidden
  team_id: string | null;
}

export interface PitchBoard {
  state: PitchVoting;
  is_manager: boolean;
  votes_left: number;
  pitches: Pitch[];
}

export async function fetchPitchVoting(locationId: string): Promise<PitchVoting> {
  const { data, error } = await supabase.from('locations').select('pitch_voting').eq('id', locationId).maybeSingle();
  if (error) throw error;
  return ((data as { pitch_voting?: PitchVoting } | null)?.pitch_voting) ?? 'off';
}

export async function fetchPitchBoard(locationId: string): Promise<PitchBoard> {
  const { data, error } = await supabase.rpc('pitch_board', { p_location_id: locationId });
  if (error) throw rpcError(error, "Couldn't load pitches.");
  return data as PitchBoard;
}

export async function createPitch(locationId: string, title: string, summary: string): Promise<void> {
  const { error } = await supabase.rpc('create_pitch', { p_location_id: locationId, p_title: title, p_summary: summary });
  if (error) throw rpcError(error, "Couldn't add your pitch.");
}

export async function deletePitch(pitchId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pitch', { p_pitch_id: pitchId });
  if (error) throw rpcError(error, "Couldn't remove the pitch.");
}

export async function votePitch(pitchId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('vote_pitch', { p_pitch_id: pitchId, p_on: on });
  if (error) throw rpcError(error, "Couldn't save your vote.");
}

export async function setPitchVoting(locationId: string, state: PitchVoting): Promise<void> {
  const { error } = await supabase.rpc('set_pitch_voting', { p_location_id: locationId, p_state: state });
  if (error) throw rpcError(error, "Couldn't change voting.");
}

export async function promotePitchToTeam(pitchId: string): Promise<void> {
  const { error } = await supabase.rpc('promote_pitch_to_team', { p_pitch_id: pitchId });
  if (error) throw rpcError(error, "Couldn't make a team from that pitch.");
}

// ---------------------------------------------------------------- judging

export const JUDGING_CRITERIA = [
  { key: 'validation', label: 'Customer validation' },
  { key: 'execution', label: 'Execution & design' },
  { key: 'business', label: 'Business model' },
] as const;
export type Criterion = (typeof JUDGING_CRITERIA)[number]['key'];
export type Scores = Record<Criterion, number>;

export interface JudgingBoard {
  is_judge: boolean;
  is_manager: boolean;
  judges: number;
  teams: { team_id: string; name: string; idea: string | null; mine: (Scores & { note: string | null }) | null }[];
  leaderboard: ({ team_id: string; name: string; judges: number; total: number; place: number } & Scores)[] | null;
}

export async function fetchJudgingBoard(locationId: string): Promise<JudgingBoard> {
  const { data, error } = await supabase.rpc('judging_board', { p_location_id: locationId });
  if (error) throw rpcError(error, "Couldn't load judging.");
  return data as JudgingBoard;
}

export async function submitJudgeScore(teamId: string, scores: Scores, note: string): Promise<void> {
  const { error } = await supabase.rpc('submit_judge_score', {
    p_team_id: teamId,
    p_validation: scores.validation,
    p_execution: scores.execution,
    p_business: scores.business,
    p_note: note,
  });
  if (error) throw rpcError(error, "Couldn't save the score.");
}

// Whether I'm marked as a judge here (event_staff, own row readable since 0048).
export async function amIJudge(locationId: string): Promise<boolean> {
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data, error } = await supabase
    .from('event_staff')
    .select('kind')
    .eq('location_id', locationId)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data as { kind?: string } | null)?.kind === 'judge';
}

// ----------------------------------------------------------------- survey

export interface DueSurvey {
  location_id: string;
  name: string;
  wave: 0 | 30;
}

export async function fetchDueSurvey(): Promise<DueSurvey | null> {
  const { data, error } = await supabase.rpc('my_due_event_survey');
  if (error) throw error;
  return (data as DueSurvey | null) ?? null;
}

export type TeamStatus = 'yes' | 'no' | 'unsure';

export async function submitSurvey(
  survey: DueSurvey,
  answer: { nps: number | null; best: string; teamStatus: TeamStatus | null } | 'skip',
): Promise<void> {
  const skipped = answer === 'skip';
  const { error } = await supabase.rpc('submit_event_survey', {
    p_location_id: survey.location_id,
    p_wave: survey.wave,
    p_nps: skipped ? null : answer.nps,
    p_best: skipped ? null : answer.best,
    p_team_status: skipped ? null : answer.teamStatus,
    p_skipped: skipped,
  });
  if (error) throw rpcError(error, "Couldn't send your answers.");
}

// ---------------------------------------------------------------- tickets

export interface TicketRow {
  email: string;
  name: string | null;
}

export interface TicketMatch {
  tickets: number;
  imported_at: string | null;
  in_w: number;
  checked_in: number;
  not_joined: TicketRow[];
  no_ticket: (string | null)[];
}

// Minimal CSV reader: quoted fields, commas and newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

// Finds the email column (and a name column, or first + last name) in a
// ticket export such as Eventbrite's attendee CSV.
export function ticketRowsFromCsv(text: string): TicketRow[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  let emailCol = header.findIndex((h) => h === 'email' || h === 'email address' || h.includes('email'));
  let start = 1;
  if (emailCol === -1) {
    // No header: use the first column that looks like an email.
    emailCol = rows[0].findIndex((f) => /\S+@\S+\.\S+/.test(f));
    start = 0;
    if (emailCol === -1) return [];
  }
  const nameCol = start ? header.findIndex((h) => h === 'name' || h === 'full name' || h === 'attendee name') : -1;
  const firstCol = start ? header.findIndex((h) => h === 'first name') : -1;
  const lastCol = start ? header.findIndex((h) => h === 'last name') : -1;

  const out: TicketRow[] = [];
  for (const r of rows.slice(start)) {
    const email = (r[emailCol] ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) continue;
    const name = nameCol >= 0
      ? (r[nameCol] ?? '').trim()
      : [firstCol >= 0 ? r[firstCol] : '', lastCol >= 0 ? r[lastCol] : ''].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
    out.push({ email, name: name || null });
  }
  return out;
}

export async function importTickets(locationId: string, rows: TicketRow[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_event_tickets', { p_location_id: locationId, p_rows: rows });
  if (error) throw rpcError(error, "Couldn't import the ticket list.");
  return data as number;
}

export async function clearTickets(locationId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_event_tickets', { p_location_id: locationId });
  if (error) throw rpcError(error, "Couldn't clear the ticket list.");
}

export async function fetchTicketMatch(locationId: string): Promise<TicketMatch> {
  const { data, error } = await supabase.rpc('ticket_match', { p_location_id: locationId });
  if (error) throw rpcError(error, "Couldn't load the ticket match.");
  return data as TicketMatch;
}

// ---------------------------------------------------------------- summary

export interface EventOutcomes {
  pitch_voting: PitchVoting;
  pitches: number;
  votes: number;
  judges: number;
  teams_scored: number;
  tickets: number;
  survey: {
    answered: number;
    skipped: number;
    nps_responses: number;
    nps: number | null;
    still_going: number;
    still_going_30: number;
    answered_30: number;
  };
}

export async function fetchEventOutcomes(locationId: string): Promise<EventOutcomes> {
  const { data, error } = await supabase.rpc('event_outcomes_summary', { p_location_id: locationId });
  if (error) throw error;
  return data as EventOutcomes;
}
