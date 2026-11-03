'use client';

import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { openProfile } from '@/lib/profileSheet';

interface ProfileAvatarButtonProps {
  userId: string | null | undefined;
  name?: string | null;
  onMessage?: () => void;
  style?: CSSProperties;
  // Inside another <button> (e.g. a chat list row): render a span role=button,
  // since nested buttons are invalid HTML.
  nested?: boolean;
  children: ReactNode;
}

// Wraps an avatar so tapping it opens that person's profile sheet. Stops
// propagation so a tappable parent row (chat list, feed row) doesn't also fire.
export default function ProfileAvatarButton({ userId, name, onMessage, style, nested, children }: ProfileAvatarButtonProps) {
  if (!userId) return <>{children}</>;
  const id = userId;
  const props = {
    'aria-label': `View ${name ?? 'this person'}'s profile`,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      openProfile(id, { onMessage });
    },
    style: { background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', flexShrink: 0, display: 'block', borderRadius: 999, ...style },
  };
  if (nested) {
    return (
      <span
        role="button"
        tabIndex={0}
        {...props}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openProfile(id, { onMessage });
          }
        }}
      >
        {children}
      </span>
    );
  }
  return <button type="button" {...props}>{children}</button>;
}
