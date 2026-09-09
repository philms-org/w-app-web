'use client';

import type { ContactMethod } from '@/lib/types';
import { contactTypeMeta, contactLink } from '@/lib/contact-methods';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Plus } from 'lucide-react';

interface ContactGridProps {
  methods: ContactMethod[];
  mode: 'edit' | 'readonly';
  onSlotClick?: (slotOrder: number) => void;
  onLinkOpen?: (type: string) => void;
}

const SLOTS = [0, 1, 2, 3, 4, 5];

const tileBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
  padding: 14,
  minHeight: 84,
  borderRadius: radius.card,
  border: `1px solid ${theme.divider}`,
  backgroundColor: theme.surface,
  fontFamily: typeTokens.family,
  textAlign: 'left',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

export default function ContactGrid({ methods, mode, onSlotClick, onLinkOpen }: ContactGridProps) {
  const bySlot = new Map<number, ContactMethod>();
  for (const m of methods) bySlot.set(m.slot_order, m);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {SLOTS.map((slot) => {
        const m = bySlot.get(slot);
        const meta = m ? contactTypeMeta(m.type) : null;
        const Icon = meta?.icon ?? Plus;

        if (mode === 'readonly') {
          const usable = m && m.is_enabled && (m.value ?? '').trim() !== '';
          if (!usable || !m || !meta) return <div key={slot} aria-hidden style={{ minHeight: 84 }} />;
          const href = contactLink(m.type, m.value);
          const content = (
            <>
              <Icon style={{ width: 18, height: 18, color: theme.accent }} />
              <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text }}>{meta.label}</span>
              <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, wordBreak: 'break-all' }}>{m.value}</span>
            </>
          );
          return href ? (
            <a
              key={slot}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLinkOpen?.(m.type)}
              style={{ ...tileBase, cursor: 'pointer' }}
            >
              {content}
            </a>
          ) : (
            <div key={slot} style={tileBase}>{content}</div>
          );
        }

        const disabled = m ? !m.is_enabled : false;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSlotClick?.(slot)}
            style={{ ...tileBase, cursor: 'pointer', opacity: disabled ? 0.5 : 1, position: 'relative' }}
          >
            {m && meta ? (
              <>
                <Icon style={{ width: 18, height: 18, color: theme.accent }} />
                <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text }}>{meta.label}</span>
                <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, wordBreak: 'break-all' }}>
                  {(m.value ?? '').trim() || 'Not set'}
                </span>
                {disabled && (
                  <span style={{
                    position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700,
                    color: theme.muted, border: `1px solid ${theme.divider}`, borderRadius: radius.pill, padding: '1px 6px',
                  }}>Off</span>
                )}
              </>
            ) : (
              <>
                <Plus style={{ width: 18, height: 18, color: theme.muted }} />
                <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 600, color: theme.muted }}>Add</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
