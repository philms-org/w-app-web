'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';

interface OptionButtonProps {
  emoji: string;
  label: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
}

export default function OptionButton({ emoji, label, selected, accent, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: radius.control,
        border: `2px solid ${selected ? accent : theme.divider}`,
        backgroundColor: selected ? accent : theme.surface,
        color: selected ? '#0D0D0F' : theme.text,
        fontSize: 14,
        fontWeight: selected ? 700 : 400,
        fontFamily: typeTokens.family,
        cursor: 'pointer',
        transition: 'all .15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
