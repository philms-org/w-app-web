// QR payload encoding + RPC error copy for the connect flow.
// The payload is a short-lived single-use token minted by mint_connect_token(),
// NOT a user id. The `w://connect/` prefix lets the scanner reject unrelated QR
// codes with a clear message instead of calling the RPC on arbitrary text.

export const CONNECT_QR_PREFIX = 'w://connect/';
// Current payload: a real web link (https://<app>/c/<token>) so a plain phone
// camera opens it. /c/<token> connects signed-in users straight away and
// carries the token through sign-in for everyone else. The legacy w://
// payload is still accepted by the in-app scanner.
export const CONNECT_PATH = '/c/';

// mint_connect_token() returns translate(base64(18 bytes), '+/=', '-_') → 24
// chars from [A-Za-z0-9_-]. Be generous on the bound in case the impl changes.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function encodeConnectPayload(token: string): string {
  return `${window.location.origin}${CONNECT_PATH}${token}`;
}

export function isValidConnectToken(token: string | null | undefined): token is string {
  return !!token && TOKEN_RE.test(token);
}

// Returns the token, or null if this isn't a well-formed W connect code.
// Accepts https://<any host>/c/<token> (prod, previews, localhost) and the
// legacy w://connect/<token>. The server validates the token either way.
export function decodeConnectPayload(raw: string): string | null {
  const text = raw.trim();
  if (text.startsWith(CONNECT_QR_PREFIX)) {
    const token = text.slice(CONNECT_QR_PREFIX.length).trim();
    return isValidConnectToken(token) ? token : null;
  }
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.pathname.startsWith(CONNECT_PATH)) return null;
    const token = decodeURIComponent(url.pathname.slice(CONNECT_PATH.length)).replace(/\/+$/, '');
    return isValidConnectToken(token) ? token : null;
  } catch {
    return null;
  }
}

// Best-effort: resolve to coords if the browser cooperates within `timeoutMs`,
// else resolve undefined. Never rejects: a denied prompt must not block a
// connect.
export function getScanCoords(timeoutMs = 5000): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

// record_qr_scan / mint_connect_token raise bare sentinel strings; Supabase
// surfaces them on error.message. Map each to copy a real person can act on.
export function connectErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (raw.includes('self_scan')) return "That's your own code.";
  if (raw.includes('invalid_or_expired_token')) return 'That code has expired. Ask them to show a fresh one.';
  if (raw.includes('not_signed_in')) return 'You need to be signed in.';
  return "Couldn't connect. Try again.";
}
