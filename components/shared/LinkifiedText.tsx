'use client';

import { Fragment } from 'react';
import { theme } from '@/lib/theme';

// Only http(s):// and bare www. links are matched, so a post can never smuggle
// in a javascript:/data: href. Trailing punctuation ("see x.com/a.") is
// trimmed off the link and rendered as plain text.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCT_RE = /[.,!?;:)\]}'"]+$/;

export default function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trail = raw.match(TRAILING_PUNCT_RE)?.[0] ?? '';
    const link = trail ? raw.slice(0, -trail.length) : raw;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a
        key={start}
        href={link.startsWith('www.') ? `https://${link}` : link}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        onClick={(e) => e.stopPropagation()}
        style={{ color: theme.accent, textDecoration: 'underline', wordBreak: 'break-all' }}
      >
        {link}
      </a>,
    );
    if (trail) parts.push(trail);
    last = start + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
