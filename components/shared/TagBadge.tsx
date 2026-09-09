'use client';

import { resolveTagIcon } from '@/lib/tagIcons';
import { tagIconPublicUrl } from '@/lib/data';
import type { VerificationTag } from '@/lib/types';
import { theme, type as typeTokens } from '@/lib/theme';

// Single renderer for a granted verification tag. type_id set -> use the
// linked catalog type (lucide | emoji | uploaded image). type_id null ->
// legacy free-text path: the row's own emoji/text `icon` + `tag`.
export default function TagBadge({ tag, size = 'md' }: { tag: VerificationTag; size?: 'sm' | 'md' }) {
  const label = tag.type?.label ?? tag.tag;
  const dim = size === 'sm' ? 14 : 16;

  let icon: React.ReactNode = null;
  if (tag.type) {
    if (tag.type.icon_kind === 'lucide') {
      const Icon = resolveTagIcon(tag.type.icon);
      icon = <Icon style={{ width: dim, height: dim, color: theme.accent }} />;
    } else if (tag.type.icon_kind === 'emoji') {
      icon = <span style={{ fontSize: dim }}>{tag.type.icon}</span>;
    } else {
      icon = (
        <img
          src={tagIconPublicUrl(tag.type.icon)}
          alt=""
          style={{ width: dim, height: dim, objectFit: 'contain', borderRadius: 3 }}
        />
      );
    }
  } else if (tag.icon) {
    icon = <span style={{ fontSize: dim }}>{tag.icon}</span>;
  } else {
    // Legacy free-text grant with no icon (custom / null-icon case): still
    // needs a visible glyph, especially in the icon-only `sm` variant.
    const Fallback = resolveTagIcon('award');
    icon = <Fallback style={{ width: dim, height: dim, color: theme.accent }} />;
  }

  // Final safety net: any branch above that resolved to an empty node
  // (e.g. a catalog type with an empty `icon` string) still gets a glyph.
  if (!icon) {
    const Fallback = resolveTagIcon('award');
    icon = <Fallback style={{ width: dim, height: dim, color: theme.accent }} />;
  }

  if (size === 'sm') {
    return (
      <span
        title={label}
        aria-label={label}
        style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      >
        {icon}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999,
        backgroundColor: theme.surface2, color: theme.text,
        fontSize: typeTokens.caption.fontSize, fontWeight: 600,
        fontFamily: typeTokens.family, whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  );
}
