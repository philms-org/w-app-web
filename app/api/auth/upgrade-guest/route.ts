import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/upgrade-guest  { email, displayName }
// Authorization: Bearer <the anonymous session's access token>
//
// Turns the caller's anonymous (guest) session into a real account by setting
// its email, same auth.uid(). GoTrue answers "email_exists" when the address
// already belongs to someone, which on its own lets anyone test whether an
// email has an account. This route puts a per-IP (and per-guest) limit in
// front of that answer. The limit lives in Postgres (auth_rate_limits,
// migration 0027) and is only reachable with the service role, so the
// client can't see, reset or skip it.
//
// Fails closed: if the service role key isn't configured or the limiter
// can't be reached, the upgrade is refused rather than run unthrottled.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per client IP: 5 attempts per 15 minutes. Per guest account: 10 per hour
// (stops one session rotating through IPs).
const LIMITS = [
  { bucket: 'guest_upgrade_ip', max: 5, windowSeconds: 15 * 60 },
  { bucket: 'guest_upgrade_user', max: 10, windowSeconds: 60 * 60 },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

// On Vercel, x-real-ip / x-forwarded-for are set by the platform edge and
// can't be forged by the client. Locally they may be absent, which lands
// everyone in one shared "unknown" bucket (still limited).
function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || 'unknown';
}

// Keys are stored as HMACs so the table never holds raw IPs or user ids.
function keyHash(secret: string, bucket: string, value: string): string {
  return createHmac('sha256', secret).update(`${bucket}:${value}`).digest('hex');
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('upgrade-guest: SUPABASE_SERVICE_ROLE_KEY (or public Supabase env) is not set; refusing unthrottled upgrade');
    return json({ error: 'unavailable' }, 503);
  }

  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: 'not_signed_in' }, 401);

  let email: string;
  let displayName: string;
  try {
    const body = (await req.json()) as { email?: unknown; displayName?: unknown };
    email = typeof body.email === 'string' ? body.email.trim() : '';
    displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254 || !displayName || displayName.length > 80) {
    return json({ error: 'bad_request' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'not_signed_in' }, 401);
  if (!user.is_anonymous) return json({ error: 'not_a_guest' }, 400);

  // Rate limit BEFORE asking GoTrue anything about the email.
  const keys = { guest_upgrade_ip: clientIp(req), guest_upgrade_user: user.id };
  let retryAfter = 0;
  for (const limit of LIMITS) {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: limit.bucket,
      p_key_hash: keyHash(SERVICE_KEY, limit.bucket, keys[limit.bucket]),
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    });
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after_seconds: number }
      | null;
    if (error || !row) {
      console.error('upgrade-guest: rate limiter unavailable', error);
      return json({ error: 'unavailable' }, 503);
    }
    if (!row.allowed) retryAfter = Math.max(retryAfter, row.retry_after_seconds);
  }
  if (retryAfter > 0) {
    return json({ error: 'rate_limited', retryAfter }, 429, { 'Retry-After': String(retryAfter) });
  }

  // Update the email as the guest themself (their token, not the service
  // role), exactly what supabase.auth.updateUser() does from the browser.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, data: { display_name: displayName } }),
  });

  if (res.ok) return json({ status: 'upgraded' });

  const err = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string | number; msg?: string; message?: string };
  const code = err.error_code ?? (typeof err.code === 'string' ? err.code : undefined);
  const message = err.msg ?? err.message ?? '';
  if (code === 'email_exists' || /already (registered|exists|in use)/i.test(message)) {
    return json({ error: 'email_exists' }, 409);
  }
  if (res.status === 429) return json({ error: 'rate_limited' }, 429);
  console.error('upgrade-guest: GoTrue rejected the upgrade', res.status, code, message);
  return json({ error: 'upgrade_failed' }, 400);
}
