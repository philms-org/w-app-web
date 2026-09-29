// Supabase/Postgrest errors extend Error, but not everything a try/catch can
// see does — a blocked/full localStorage write (zustand's persist middleware)
// throws a DOMException, which does not. `instanceof Error` alone silently
// drops the real message on anything like that, so check for `.message`
// directly instead.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}
