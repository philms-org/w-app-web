// QR payload encoding + RPC error copy for the connect flow.
// The payload is a short-lived single-use token minted by mint_connect_token(),
// NOT a user id. The `w://connect/` prefix lets the scanner reject unrelated QR
// codes with a clear message instead of calling the RPC on arbitrary text.

export const CONNECT_QR_PREFIX = 'w://connect/';

// mint_connect_token() returns translate(base64(18 bytes), '+/=', '-_') → 24
// chars from [A-Za-z0-9_-]. Be generous on the bound in case the impl changes.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function encodeConnectPayload(token: string): string {
  return `${CONNECT_QR_PREFIX}${token}`;
}

// Returns the token, or null if this isn't a well-formed W connect code.
export function decodeConnectPayload(raw: string): string | null {
  if (!raw.startsWith(CONNECT_QR_PREFIX)) return null;
  const token = raw.slice(CONNECT_QR_PREFIX.length).trim();
  return TOKEN_RE.test(token) ? token : null;
}

// record_qr_scan / mint_connect_token raise bare sentinel strings; Supabase
// surfaces them on error.message. Map each to copy a real person can act on.
export function connectErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (raw.includes('self_scan')) return "That's your own code.";
  if (raw.includes('invalid_or_expired_token')) return 'That code has expired — ask them to show a fresh one.';
  if (raw.includes('not_signed_in')) return 'You need to be signed in.';
  return "Couldn't connect. Try again.";
}
