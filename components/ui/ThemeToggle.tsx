'use client';

import { useEffect, useState } from 'react';

import { useTheme } from '@/lib/hooks/useTheme';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { mode, toggle } = useTheme();

  // `mode` is 'dark' during SSR but the real value on the client, so deriving
  // the icon/label straight from it hydration-mismatches when the boot script
  // picked light. Hold a stable placeholder until mounted, then render for real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mode === 'dark';
  const icon = !mounted ? null : isDark ? <Moon size={18} /> : <Sun size={18} />;
  const value = !mounted ? '' : isDark ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        !mounted ? 'Toggle theme' : isDark ? 'Switch to light theme' : 'Switch to dark theme'
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '12px 16px',
        background: theme.surface,
        border: `1px solid ${theme.divider}`,
        borderRadius: radius.control,
        color: theme.text,
        fontFamily: typeTokens.family,
        fontSize: typeTokens.label.fontSize,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      {icon}
      <span style={{ flex: 1, textAlign: 'left' }}>Theme</span>
      <span style={{ color: theme.muted, fontWeight: 400 }}>{value}</span>
    </button>
  );
}
