import { theme, type as typeTokens } from '@/lib/theme';
import type { Profile } from '@/lib/types';

const MAX_AVATARS = 5;

// "In the room now · N" (migration 0037): who's physically checked in, so
// attendees who stepped out — and guests — can see what's happening and when
// to come back. Hidden when nobody's in the room.
export default function InRoomStrip({ profiles }: { profiles: Profile[] }) {
  if (profiles.length === 0) return null;
  const shown = profiles.slice(0, MAX_AVATARS);
  const more = profiles.length - shown.length;

  return (
    <div
      aria-label={`${profiles.length} in the room now`}
      style={{
        margin: '4px 0 8px', padding: '10px 12px', borderRadius: 12, fontFamily: typeTokens.family,
        background: 'color-mix(in srgb, #3ECF6B 12%, transparent)',
        border: '1px solid color-mix(in srgb, #3ECF6B 35%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: theme.text }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: theme.green, display: 'inline-block' }} />
        In the room now · {profiles.length}
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        {shown.map((p, i) => (
          <div key={p.id} title={p.display_name ?? undefined} style={{ marginLeft: i === 0 ? 0 : -8 }}>
            <AvatarWithLight profile={p} size={32} inRoom ring={theme.bg} />
          </div>
        ))}
        {more > 0 && (
          <div style={{
            marginLeft: -8, width: 32, height: 32, borderRadius: 999, background: theme.pill, color: theme.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
            border: `2px solid ${theme.bg}`,
          }}>
            +{more}
          </div>
        )}
      </div>
    </div>
  );
}

// Avatar (photo or initial) with the green "in the room" light in the corner.
export function AvatarWithLight({
  profile, size, inRoom, ring,
}: {
  profile: Profile;
  size: number;
  inRoom: boolean;
  /** Colour behind the avatar, used to separate the light from it. */
  ring: string;
}) {
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: 999, overflow: 'hidden', background: theme.pill,
        display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${ring}`, boxSizing: 'border-box',
      }}>
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention
          <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontWeight: 700, color: theme.text, fontSize: Math.round(size * 0.38) }}>
            {(profile.display_name ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {inRoom && (
        <span
          aria-label="In the room"
          style={{
            position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: 999,
            background: theme.green, border: `2px solid ${ring}`, boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
