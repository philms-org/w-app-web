'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { STORAGE_KEY } from '@/lib/theme';

export { STORAGE_KEY };
export type ThemeMode = 'dark' | 'light';

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function currentAttr(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from whatever ThemeScript already stamped — no second guess, no flash.
  const [mode, setModeState] = useState<ThemeMode>(currentAttr);

  const apply = useCallback((m: ThemeMode, persist: boolean) => {
    setModeState(m);
    document.documentElement.setAttribute('data-theme', m);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, m); } catch { /* private mode */ }
    }
  }, []);

  const setMode = useCallback((m: ThemeMode) => apply(m, true), [apply]);
  const toggle = useCallback(
    () => apply(currentAttr() === 'dark' ? 'light' : 'dark', true),
    [apply],
  );

  // Follow the OS ONLY while the user has never made an explicit choice.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (stored === 'light' || stored === 'dark') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      // An explicit choice made after mount must not be overridden by the OS.
      let now: string | null = null;
      try { now = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      if (now === 'light' || now === 'dark') return;
      apply(mq.matches ? 'light' : 'dark', false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [apply]);

  return <Ctx.Provider value={{ mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used within <ThemeProvider>');
  return v;
}
