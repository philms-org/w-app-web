'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { fetchConversations } from '@/lib/data';
import { Search, MessageCircle } from 'lucide-react';
import { theme } from '@/lib/theme';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import ChatView, { type ChatConversation } from '@/components/ChatView';
import VitalsGate from '@/components/onboarding/VitalsGate';
import { Button, LockedOverlay } from '@/components/ui/primitives';

export default function MessagesTab() {
  const { setActiveChat, setActiveTab, user } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, unread, groups
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [openChat, setOpenChat] = useState<ChatConversation | null>(null);
  const [showVitalsGate, setShowVitalsGate] = useState(false);

  const loadConversations = useCallback(() => {
    fetchConversations()
      .then((rows) => {
        setLoadError(false);
        setConversations(
          rows.map((c) => ({
            id: c.id,
            userId: c.other_profile?.id ?? c.id,
            userName: c.is_group ? (c.name ?? 'Group') : (c.other_profile?.display_name ?? 'Unknown'),
            userImage: c.other_profile?.avatar_url ?? '',
            lastMessage: c.last_message ?? 'No messages yet',
            timestamp: c.last_message_at ?? '',
            unread: false,
            online: false,
            isGroup: !!c.is_group,
            myStatus: c.my_status ?? 'accepted',
          }))
        );
      })
      .catch((err) => {
        console.error('Failed to load conversations:', err);
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // No server-side filter: postgres_changes can't express
  // `conversation_id IN (my conversations)`. Listen for every message
  // INSERT and refetch — RLS still scopes fetchConversations() to the
  // current user, so an unrelated message just costs one cheap refetch.
  // Scaling note: at high volume every client wakes per message; revisit
  // with a per-user broadcast channel if that becomes a problem.
  useTableSubscription({
    table: 'messages',
    event: 'INSERT',
    onEvent: loadConversations,
  });

  const filteredMessages = conversations.filter(message => {
    const matchesSearch = message.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          message.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' ||
                          (activeFilter === 'unread' && message.unread) ||
                          (activeFilter === 'groups' && message.isGroup);
    return matchesSearch && matchesFilter;
  });

  const handleOpenChat = (message: any) => {
    setActiveChat(message.id);
    setOpenChat({
      id: message.id,
      userName: message.userName,
      userImage: message.userImage,
      isGroup: message.isGroup,
      myStatus: message.myStatus,
    });
  };

  const handleCloseChat = () => {
    setOpenChat(null);
    setActiveChat(null);
    loadConversations(); // refresh previews after chatting
  };

  const formatTimestamp = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (user?.isAnonymous) {
    return (
      <div style={{ padding: 20 }}>
        <LockedOverlay
          title="Say hi when you're ready"
          body="Messaging unlocks the moment you check in somewhere or want to reach out — just your name and email, no password."
        >
          {/* A plausible-looking blurred backdrop: reuse the same empty-state
             shape the real list uses, just static. */}
          <div style={{ height: 220 }} />
        </LockedOverlay>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => setShowVitalsGate(true)}>Unlock messaging</Button>
        </div>
        <VitalsGate
          open={showVitalsGate}
          intent="messages"
          onClose={() => setShowVitalsGate(false)}
          onIdentified={() => setShowVitalsGate(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      {openChat && <ChatView conversation={openChat} onClose={handleCloseChat} />}
      {/* Header */}
      <div style={{
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.divider}`,
        padding: '24px',
        paddingTop: 'max(48px, env(safe-area-inset-top) + 16px)',
        paddingBottom: '16px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Messages</h1>
        
        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '20px',
            color: theme.muted
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            style={{
              width: '100%',
              paddingLeft: '48px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              backgroundColor: theme.surface2,
              borderRadius: '9999px',
              border: 'none',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'unread', 'groups'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease',
                backgroundColor: activeFilter === filter ? theme.accent : theme.surface2,
                color: activeFilter === filter ? theme.onAccent : theme.muted,
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              {filter === 'all' ? 'All Messages' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div style={{ backgroundColor: theme.surface }}>
        {loadError ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Couldn&apos;t load messages
            </h3>
            <p style={{ color: theme.muted, fontSize: '14px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Check your connection and try again
            </p>
            <button
              onClick={loadConversations}
              style={{
                backgroundColor: theme.accent,
                color: theme.onAccent,
                fontWeight: '600',
                padding: '10px 24px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              Try again
            </button>
          </div>
        ) : filteredMessages.length > 0 ? (
          filteredMessages.map((message, index) => (
            <button
              key={message.id}
              onClick={() => handleOpenChat(message)}
              style={{
                width: '100%',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: theme.surface,
                borderBottom: index < filteredMessages.length - 1 ? `1px solid ${theme.divider}` : 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.surface2}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.surface}
            >
              {/* Profile Image */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: theme.surface2,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: theme.muted,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.userName.charAt(0)}
                  </span>
                </div>
                {message.online && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#10B981', // TODO(P7): tokenize online-status green
                    borderRadius: '50%',
                    border: `2px solid ${theme.surface}`
                  }}></div>
                )}
              </div>

              {/* Message Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <h3 style={{
                    fontWeight: '600',
                    color: message.unread ? theme.text : theme.muted,
                    fontSize: '16px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.userName}
                  </h3>
                  <span style={{
                    fontSize: '12px',
                    color: message.unread ? theme.accent : theme.muted,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{
                    fontSize: '14px',
                    color: message.unread ? theme.text : theme.muted,
                    fontWeight: message.unread ? '500' : '400',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingRight: '8px',
                    flex: 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.lastMessage}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {message.unread && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: theme.accent,
                        borderRadius: '50%'
                      }}></div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: '96px',
              height: '96px',
              backgroundColor: theme.surface2,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Search style={{ width: '48px', height: '48px', color: theme.muted }} />
            </div>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No messages found</h3>
            <p style={{
              color: theme.muted,
              fontSize: '14px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              {searchQuery ? 'Try a different search term' : 'Start a conversation by connecting with people at your location'}
            </p>
          </div>
        )}
      </div>

      {/* Empty State (when no messages at all) */}
      {!searchQuery && filteredMessages.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '96px',
              height: '96px',
              // TODO(P7): tokenize accent-tint circle (bg + icon colour below)
              backgroundColor: '#D0F2F7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <MessageCircle style={{ width: '48px', height: '48px', color: '#17BFD9' }} />
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: theme.text,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No Messages Yet</h2>
            <p style={{
              color: theme.muted,
              marginBottom: '24px',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              Connect with people at locations to start chatting
            </p>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                backgroundColor: theme.accent,
                color: theme.onAccent,
                fontWeight: '600',
                padding: '12px 24px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              Explore Locations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
