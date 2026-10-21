'use client';

import { useCallback, useEffect } from 'react';
import { fetchConversations } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';

// Keeps the Messages tab badge (store.unreadCount) current from anywhere in
// the app: counts conversations with an unread latest message (0043) on
// mount and whenever a new message lands. MessagesTab also writes the count
// after its own loads and after you open a chat.
export function useUnreadCount(enabled: boolean) {
  const recount = useCallback(() => {
    if (!enabled) return;
    fetchConversations()
      .then((rows) => useStore.getState().setUnreadCount(rows.filter((c) => c.unread).length))
      .catch((err) => console.error('Failed to count unread conversations:', err));
  }, [enabled]);

  useEffect(() => { recount(); }, [recount]);

  useTableSubscription({ table: 'messages', event: 'INSERT', onEvent: recount });
}
