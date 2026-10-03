import { createClient } from '@supabase/supabase-js';

// GET  /api/account/delete                        -> { blockers }
// POST /api/account/delete  { confirm: 'DELETE' } -> { status: 'deleted' } | 409 { blockers }
// Authorization: Bearer <the caller's access token>
//
// Permanently deletes the caller's own account and everything they posted.
// The work happens in delete_account() (migration 0039), one transaction
// that ends by deleting the auth.users row. Only the service role can run
// it, so the user id always comes from the verified token, never the body.
// Owners (venues, teams with other members) and W staff are refused with
// the list of what to hand off first.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function caller(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('account/delete: SUPABASE_SERVICE_ROLE_KEY (or public Supabase env) is not set');
    return { error: json({ error: 'unavailable' }, 503) };
  }
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: json({ error: 'not_signed_in' }, 401) };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error: json({ error: 'not_signed_in' }, 401) };
  return { admin, userId: data.user.id };
}

export async function GET(req: Request) {
  const c = await caller(req);
  if ('error' in c) return c.error;

  const { data, error } = await c.admin.rpc('account_deletion_blockers', { p_user: c.userId });
  if (error) {
    console.error('account/delete: blockers check failed', error);
    return json({ error: 'unavailable' }, 503);
  }
  return json({ blockers: data });
}

export async function POST(req: Request) {
  const c = await caller(req);
  if ('error' in c) return c.error;

  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== 'DELETE') return json({ error: 'bad_request' }, 400);

  const { data, error } = await c.admin.rpc('delete_account', { p_user: c.userId });
  const result = data as { status: string; blockers?: unknown } | null;
  if (error || !result) {
    console.error('account/delete: delete_account failed', error);
    return json({ error: 'delete_failed' }, 500);
  }
  if (result.status === 'blocked') return json({ error: 'blocked', blockers: result.blockers }, 409);
  if (result.status !== 'deleted') return json({ error: 'not_found' }, 404);

  // The account is gone; now its avatar files (avatars/<uid>/...). Best
  // effort: a leftover file is orphaned but no longer tied to anyone.
  const { data: files } = await c.admin.storage.from('avatars').list(c.userId);
  if (files?.length) {
    const { error: rmError } = await c.admin.storage
      .from('avatars')
      .remove(files.map((f) => `${c.userId}/${f.name}`));
    if (rmError) console.error('account/delete: avatar cleanup failed', rmError);
  }

  return json({ status: 'deleted' });
}
