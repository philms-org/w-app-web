'use client';

// Shared UI primitives — design-system.md §6. Colours come from lib/theme.ts
// `theme`, whose values are `var(--*)` custom properties resolved per
// `data-theme` in app/globals.css — so these primitives follow the active
// theme (dark by default, light via the toggle) automatically, no per-theme
// branching here. New screens should reach for these instead of hand-rolled
// inline styles.

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { theme, radius, elevation, type as typeTokens, onAccent, glassBlur } from '@/lib/theme';
import { Lock } from 'lucide-react';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const buttonBase: React.CSSProperties = {
  fontFamily: typeTokens.family,
  fontSize: typeTokens.label.fontSize,
  fontWeight: 700,
  borderRadius: radius.control,
  padding: '14px 24px',
  cursor: 'pointer',
  transition: 'opacity .15s ease, background-color .15s ease',
  lineHeight: 1,
};

const buttonVariants: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: theme.accent, color: onAccent, border: 'none' },
  secondary: {
    background: theme.glassFill,
    color: theme.text,
    border: `1px solid ${theme.glassBorder}`,
    backdropFilter: glassBlur,
    WebkitBackdropFilter: glassBlur,
  },
  ghost: { background: 'transparent', color: theme.text, border: 'none', padding: '8px 12px' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', fullWidth, disabled, style, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      style={{
        ...buttonBase,
        ...buttonVariants[variant],
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------- Card */

interface CardProps {
  cta?: boolean; // 1.5px accent border variant
  as?: 'div' | 'section' | 'article';
  style?: React.CSSProperties;
  children: ReactNode;
}

export function Card({ cta, as: Tag = 'div', style, children }: CardProps) {
  return (
    <Tag
      style={{
        background: theme.glassFill,
        borderRadius: radius.card,
        padding: 20,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        border: `1px solid ${cta ? theme.accent : theme.glassBorder}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------- Chip */

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  children: ReactNode;
}

export function Chip({ selected, onClick, style, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: typeTokens.family,
        fontSize: typeTokens.label.fontSize,
        fontWeight: 600,
        borderRadius: radius.pill,
        padding: '6px 12px',
        cursor: onClick ? 'pointer' : 'default',
        background: selected ? theme.accent : theme.glassFill,
        color: selected ? onAccent : theme.text,
        border: selected ? 'none' : `1px solid ${theme.glassBorder}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Input */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, label, hint, style, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: typeTokens.family,
            fontSize: typeTokens.label.fontSize,
            fontWeight: 600,
            color: theme.text,
          }}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        style={{
          fontFamily: typeTokens.family,
          fontSize: 16, // keeps iOS from zooming on focus
          color: theme.text,
          background: theme.surface2,
          border: `1px solid ${invalid ? theme.accent2 : theme.divider}`,
          borderRadius: radius.control,
          padding: '12px 16px',
          outline: 'none',
          boxSizing: 'border-box',
          width: '100%',
          ...style,
        }}
        {...rest}
      />
      {hint && (
        <span
          style={{
            fontFamily: typeTokens.family,
            fontSize: typeTokens.caption.fontSize,
            color: invalid ? theme.accent2 : theme.muted,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
});

/* ----------------------------------------------------------------- FeedRow */

interface FeedRowProps {
  avatar?: string | ReactNode; // image URL or a custom node
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  divider?: boolean; // bottom hairline
  style?: React.CSSProperties;
}

export function FeedRow({
  avatar,
  title,
  subtitle,
  trailing,
  onClick,
  divider,
  style,
}: FeedRowProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'transparent',
        borderBottom: divider ? `1px solid ${theme.divider}` : undefined,
        cursor: onClick ? 'pointer' : undefined,
        fontFamily: typeTokens.family,
        ...style,
      }}
    >
      {avatar != null &&
        (typeof avatar === 'string' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: radius.pill, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{ flexShrink: 0 }}>{avatar}</div>
        ))}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: typeTokens.heading.fontSize,
            fontWeight: 700,
            color: theme.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {subtitle != null && (
          <div
            style={{
              fontSize: typeTokens.caption.fontSize,
              color: theme.muted,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {trailing != null && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- GlassPanel */
export function GlassPanel({
  style,
  floatingAction,
  children,
}: {
  style?: React.CSSProperties;
  floatingAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius.card,
        padding: 16,
        background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        ...style,
      }}
    >
      {children}
      {floatingAction != null && (
        <div style={{ position: 'absolute', left: '50%', bottom: -16, transform: 'translateX(-50%)' }}>
          {floatingAction}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ GlowIconButton */
// Name kept for continuity with the design conversation; it does NOT glow —
// depth is a soft black drop shadow.
export function GlowIconButton({
  icon,
  label,
  onClick,
  style,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        flex: 1,
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        color: theme.text,
        background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

/* ------------------------------------------------------------- SectionHeader */
export function SectionHeader({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ textAlign: 'center', ...style }}>
      <span
        style={{
          display: 'inline-block',
          fontFamily: typeTokens.family,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.17em',
          textTransform: 'uppercase',
          color: theme.text,
          borderBottom: `1.5px solid ${theme.glassHighlight}`,
          paddingBottom: 3,
        }}
      >
        {children}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- LockedOverlay */
export function LockedOverlay({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 8,
          padding: 22,
          background: 'rgba(12,12,14,0.28)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          borderRadius: radius.card,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.text,
            background: theme.glassFill,
            border: `1.5px solid ${theme.glassHighlight}`,
          }}
        >
          <Lock size={22} />
        </div>
        <div style={{ fontFamily: typeTokens.family, fontWeight: 700, fontSize: 14, color: theme.text }}>{title}</div>
        <div style={{ fontFamily: typeTokens.family, fontSize: 12, color: theme.muted, maxWidth: 220 }}>{body}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ReactionCount */
// Presentational only in P1. P3 wires the toggle + real counts.
export function ReactionCount({
  count,
  reacted,
  onClick,
  style,
}: {
  count: number;
  reacted?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        fontFamily: typeTokens.family,
        fontWeight: 800,
        fontSize: 13,
        color: reacted ? theme.accentReact : theme.countRest,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {count}
    </span>
  );
}

/* --------------------------------------------------------------------- WMark */
// PLACEHOLDER winged-W. Swap the <svg> body when the founder delivers the
// real asset — keep the name, the `size` prop, and currentColor.
export function WMark({ size = 28, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 32" fill="none" style={style} aria-label="The W App">
      <path
        d="M2 4c6 0 10 3 12 9 2-6 6-9 10-9 4 0 8 3 10 9 2-6 6-9 12-9-3 8-9 22-13 24-3-2-5-8-9-14-4 6-6 12-9 14C13 26 5 12 2 4Z"
        fill="currentColor"
      />
    </svg>
  );
}
