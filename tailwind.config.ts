import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bridges the few remaining `w-*` utility classes to the shared
        // light palette. New work should use lib/theme.ts, not these.
        'w-blue': 'var(--accent)',
        'w-pink': 'var(--accent-2)',
        'w-gray': '#D5D5D5',
        'w-light-gray': 'var(--surface-raised-2)',
        'w-back-gray': 'var(--surface)',
        'w-light-blue': '#D0F2F7',
        'w-dark-gray': 'var(--content-muted)',
        'w-black': 'var(--content)',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  // NOTE: `safelist` was removed — not supported by Tailwind v4 config
  // (it was a type error and silently ignored).
} satisfies Config;
