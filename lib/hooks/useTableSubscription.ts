'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type PgEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseTableSubscriptionOptions {
  table: string;
  /** PostgREST-style filter, e.g. `conversation_id=eq.<uuid>`. Omit for all rows. */
  filter?: string;
  /** Which change type to listen for. Default '*'. */
  event?: PgEvent;
  /** Re-run this on any matching change (debounced). Also called once on
   *  subscribe, on tab-visible, and every 30s while visible. */
  onEvent: () => void;
  /** When false, no channel is opened. Default true. */
  enabled?: boolean;
}

const DEBOUNCE_MS = 250;
const BACKSTOP_MS = 30_000;

// Live-updates primitive for this app: open a Postgres change stream on
// `table` and call `onEvent` whenever a matching row changes. `onEvent` is
// always the caller's existing fetch function — realtime never reads the
// row payload, it just says "something changed, refetch". Subscribe, tab
// re-focus, and a 30s visible-only poll all also fire `onEvent`, so a
// dropped socket or missed event still reconciles.
export function useTableSubscription({
  table,
  filter,
  event = '*',
  onEvent,
  enabled = true,
}: UseTableSubscriptionOptions): void {
  // Latest onEvent without making it a resubscribe trigger.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        try {
          onEventRef.current();
        } catch (err) {
          console.error('useTableSubscription onEvent failed:', err);
        }
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`${table}:${filter ?? 'all'}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        () => fire(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fire();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);

    const backstop = setInterval(() => {
      if (document.visibilityState === 'visible') fire();
    }, BACKSTOP_MS);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(backstop);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled]);
}
