'use client';

// Shared UI primitives — design-system.md §6. Light theme only for now
// (colours come from lib/theme.ts `theme`, which is the active light view).
// New screens should reach for these instead of hand-rolled inline styles.

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { theme, radius, elevation, type as typeTokens, onAccent } from '@/lib/theme';

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
    background: 'transparent',
    color: theme.accent,
    border: `1.5px solid ${theme.accent}`,
  },
  ghost: { background: 'transparent', color: theme.accent, border: 'none', padding: '8px 12px' },
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
        background: theme.surface, // legacy `surface` == card (#FFFFFF)
        borderRadius: radius.card,
        padding: 20,
        boxShadow: elevation.card,
        border: cta ? `1.5px solid ${theme.accent}` : `1px solid ${theme.divider}`,
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
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        background: selected ? theme.accent : theme.surface2,
        color: selected ? onAccent : theme.text,
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
          background: theme.surface,
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
        background: theme.surface, // legacy `surface` == card
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
