'use client';

import { theme, type as typeTokens, elevation, glassBlur } from '@/lib/theme';
import { resolveTagIcon } from '@/lib/tagIcons';
import { tagIconPublicUrl } from '@/lib/data';
import type { RoleBadge } from '@/lib/types';

// A badge is a role an organizer approved you for at a venue or event, so it
// is drawn as the thing you'd actually wear there: an event credential on a
// lanyard. Glass card, punched lanyard slot, the role in big type, a
// perforated tear line, then where and when.

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

function RoleIcon({ badge, size }: { badge: RoleBadge; size: number }) {
  if (badge.iconKind === 'emoji' || (badge.iconKind === 'legacy' && badge.icon)) {
    return <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>{badge.icon}</span>;
  }
  if (badge.iconKind === 'image' && badge.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- organizer-uploaded tag icon, same as TagBadge
    return <img src={tagIconPublicUrl(badge.icon)} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  const Icon = resolveTagIcon(badge.icon ?? 'award');
  return <Icon aria-hidden style={{ width: size, height: size, color: theme.text }} strokeWidth={1.75} />;
}

// Lanyard slot punched through the top of the card.
function Slot({ width, ground }: { width: number; ground: string }) {
  return (
    <div aria-hidden style={{
      width, height: 7, borderRadius: 999, margin: '0 auto',
      background: ground, boxShadow: `inset 0 1px 2px rgba(0,0,0,.45), 0 1px 0 ${theme.glassHighlight}`,
    }} />
  );
}

// Perforation: a dashed rule with two half-circle bites out of the card
// edges. The bites are painted in the colour of whatever the card sits on.
function TearLine({ inset, ground }: { inset: number; ground: string }) {
  const bite: React.CSSProperties = {
    position: 'absolute', top: -7, width: 14, height: 14, borderRadius: 999, background: ground,
  };
  return (
    <div aria-hidden style={{ position: 'relative', margin: `0 -${inset}px`, height: 0 }}>
      <div style={{ ...bite, left: -7 }} />
      <div style={{ ...bite, right: -7 }} />
      <div style={{ margin: '0 14px', borderTop: `1.5px dashed ${theme.glassBorder}` }} />
    </div>
  );
}

const cardBase: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: theme.glassFill,
  border: `1px solid ${theme.glassBorder}`,
  boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
  backdropFilter: glassBlur,
  WebkitBackdropFilter: glassBlur,
  fontFamily: typeTokens.family,
  color: theme.text,
};

// Faint diagonal sheen, like the laminate on a printed pass.
const sheen: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: `linear-gradient(115deg, transparent 35%, ${theme.glassHighlight} 50%, transparent 65%)`,
  opacity: 0.35,
};

const eyebrow: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.muted,
};

export default function RolePass({
  badge,
  variant = 'full',
  ground = theme.bg,
}: {
  badge: RoleBadge;
  variant?: 'full' | 'mini';
  /** Colour of the surface behind the pass (for the slot and tear-line bites). */
  ground?: string;
}) {
  const kind = badge.isEvent ? 'Event' : 'Venue';
  const when = fmtDate(badge.isEvent ? badge.eventDate ?? badge.assignedAt : badge.assignedAt);

  if (variant === 'mini') {
    return (
      <div
        role="img"
        aria-label={`${badge.label} at ${badge.venueName}${when ? `, ${when}` : ''}`}
        style={{ ...cardBase, flex: '0 0 128px', borderRadius: 16, padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={sheen} />
        <Slot width={28} ground={ground} />
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.glassFill, border: `1px solid ${theme.glassBorder}`,
        }}>
          <RoleIcon badge={badge} size={20} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
          {badge.label}
        </div>
        <TearLine inset={12} ground={ground} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {badge.venueName}
          </span>
          {when && <span style={{ fontSize: 11, color: theme.muted }}>{when}</span>}
        </div>
      </div>
    );
  }

  return (
    <article
      aria-label={`${badge.label} at ${badge.venueName}`}
      style={{ ...cardBase, borderRadius: 20, padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={sheen} />
      <Slot width={40} ground={ground} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={eyebrow}>{kind} credential</span>
        {when && <span style={{ ...eyebrow, letterSpacing: '0.06em' }}>{when}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.glassFill, border: `1px solid ${theme.glassBorder}`, boxShadow: `inset 0 1px 0 ${theme.glassHighlight}`,
        }}>
          <RoleIcon badge={badge} size={28} />
        </div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', textWrap: 'balance', wordBreak: 'break-word' }}>
          {badge.label}
        </h2>
      </div>
      <TearLine inset={18} ground={ground} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>Approved at</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {badge.venueName}
          </div>
        </div>
        <span style={{ ...eyebrow, color: theme.text, opacity: 0.7, flexShrink: 0 }}>
          Since {fmtDate(badge.assignedAt)}
        </span>
      </div>
    </article>
  );
}
