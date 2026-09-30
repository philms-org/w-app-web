import { supabase } from './supabase';

// Mirrors WAPAuth.swift. Apple/Facebook sign-in are omitted here — they need
// separate OAuth app configuration for web that hasn't been set up yet.

export async function signUp(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) throw error;
  return data;
}

// signInWithOtp is captcha-protected once CAPTCHA protection is enabled —
// pass captchaToken once phone sign-in has UI wired up to collect one.
export async function signInWithPhone(phone: string, captchaToken?: string) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) throw error;
}

export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return data;
}

// Anonymous session — created on every fresh visit (see components/EnsureSession.tsx).
// Supabase issues a real auth.uid() with role `authenticated` and an
// `is_anonymous: true` JWT claim; every RLS policy in this repo that checks
// `to authenticated` + `auth.uid()` already works for this session as-is.
export async function signInAnonymously(captchaToken?: string) {
  const { data, error } = await supabase.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined
  );
  if (error) throw error;
  return data;
}

// Guest -> real account, via the server so the "email already exists" check
// is rate limited per IP (app/api/auth/upgrade-guest/route.ts). Same
// auth.uid(); refreshes the local session afterwards so the new email shows
// up in the JWT. Throws an Error whose `code` is 'email_exists',
// 'rate_limited' (with `retryAfter` seconds), or 'upgrade_failed'.
export class GuestUpgradeError extends Error {
  constructor(public code: 'email_exists' | 'rate_limited' | 'upgrade_failed', public retryAfter?: number) {
    super(code);
    this.name = 'GuestUpgradeError';
  }
}

export async function upgradeGuestAccount(email: string, displayName: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new GuestUpgradeError('upgrade_failed');

  const res = await fetch('/api/auth/upgrade-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, displayName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
    if (body.error === 'email_exists') throw new GuestUpgradeError('email_exists');
    if (res.status === 429) throw new GuestUpgradeError('rate_limited', body.retryAfter);
    throw new GuestUpgradeError('upgrade_failed');
  }
  await supabase.auth.refreshSession();
}

// Passwordless return path — replaces password login for the new flow.
// Existing password users can still use signIn() via /auth/login, untouched.
export async function signInWithMagicLink(email: string) {
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/main` : undefined;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Sends the Supabase recovery email. The link in it lands on /auth/reset,
// where detectSessionInUrl establishes a short-lived recovery session.
export async function requestPasswordReset(email: string, captchaToken?: string) {
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/reset` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken });
  if (error) throw error;
}

// Called from /auth/reset once the recovery session is active.
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
