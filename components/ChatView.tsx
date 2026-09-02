'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { fetchMessages, sendMessage, fetchConversationStatus, respondToConversationRequest } from '@/lib/data';
import { getCurrentUserId } from '@/lib/auth';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import type { Message } from '@/lib/types';

const FONT = 'Montserrat, system-ui, sans-serif';

export interface ChatConversation {
  id: string;
  userName: string;
  userImage?: string;
  isGroup: boolean;
  myStatus: string;
}

interface ChatViewProps {
  conversation: ChatConversation;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function ChatView({ conversation, onClose }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState(conversation.myStatus);
  const [responding, setResponding] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldStickRef = useRef(true);

  const loadMessages = useCallback(async (isInitial: boolean) => {
    try {
      const rows = await fetchMessages(conversation.id);
      setMessages(rows);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (isInitial) setLoadError(true);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [conversation.id]);

  // Initial load: uid + messages + fresh participant status.
  useEffect(() => {
    let cancelled = false;
    getCurrentUserId().then((id) => { if (!cancelled) setUid(id); });
    loadMessages(true);
    fetchConversationStatus(conversation.id)
      .then((status) => { if (!cancelled) setMyStatus(status); })
      .catch(() => { /* keep the status we were handed */ });
    return () => { cancelled = true; };
  }, [conversation.id, loadMessages]);

  // Live updates for this thread. `messages` rows are insert-only in this
  // app, so listen for INSERT and refetch (fetchMessages does the profile
  // join + ordering the raw payload lacks). Disabled until the first load
  // succeeds so we don't refetch over a still-loading / errored view.
  useTableSubscription({
    table: 'messages',
    filter: `conversation_id=eq.${conversation.id}`,
    event: 'INSERT',
    onEvent: () => loadMessages(false),
    enabled: !loading && !loadError,
  });

  // Track whether the user is near the bottom so polling doesn't yank scroll.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    shouldStickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Stick to bottom on new messages (only if user was already at the bottom).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldStickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Escape closes the chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    // Optimistic append so the bubble shows instantly.
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: uid ?? '',
      content,
      created_at: new Date().toISOString(),
    };
    shouldStickRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    try {
      await sendMessage(conversation.id, content);
      await loadMessages(false);
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      setSendError("Couldn't send — check your connection and try again");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleRespond = async (accept: boolean) => {
    setResponding(true);
    try {
      await respondToConversationRequest(conversation.id, accept);
      if (accept) {
        setMyStatus('accepted');
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to respond to request:', err);
      setSendError("Couldn't update the request — try again");
    } finally {
      setResponding(false);
    }
  };

  const isPending = myStatus === 'pending';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${conversation.userName}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        borderBottom: '1px solid #F3F3F3',
        backgroundColor: 'white',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="Back to messages"
          style={{
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
          }}
        >
          <ArrowLeft style={{ width: '24px', height: '24px', color: '#231E20' }} />
        </button>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#F3F3F3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {conversation.userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversation.userImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#6B7280', fontFamily: FONT }}>
              {conversation.userName.charAt(0)}
            </span>
          )}
        </div>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#231E20',
          fontFamily: FONT,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {conversation.userName}
        </h2>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#FAFAFA' }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', fontFamily: FONT }}>Loading messages…</p>
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', paddingTop: '48px' }}>
            <AlertCircle style={{ width: '32px', height: '32px', color: '#EC2C91', margin: '0 auto 12px' }} />
            <p style={{ color: '#231E20', fontSize: '15px', fontFamily: FONT, marginBottom: '16px' }}>
              Couldn&apos;t load this conversation
            </p>
            <button
              onClick={() => { setLoading(true); setLoadError(false); loadMessages(true); }}
              style={{
                backgroundColor: '#17BFD9',
                color: 'white',
                border: 'none',
                borderRadius: '9999px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '48px' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', fontFamily: FONT }}>
              No messages yet — say hi 👋
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const mine = msg.sender_id === uid;
            const prev = messages[i - 1];
            const showName = conversation.isGroup && !mine && (!prev || prev.sender_id !== msg.sender_id);
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                  marginBottom: '10px',
                }}
              >
                {showName && (
                  <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: FONT, margin: '0 4px 2px' }}>
                    {msg.profiles?.display_name ?? 'Member'}
                  </span>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: mine ? '#17BFD9' : '#F3F3F3',
                  color: mine ? 'white' : '#231E20',
                  fontSize: '15px',
                  lineHeight: 1.4,
                  fontFamily: FONT,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: FONT, margin: '3px 4px 0' }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Composer / pending request bar */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #F3F3F3',
        backgroundColor: 'white',
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        {isPending ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#231E20', fontFamily: FONT, marginBottom: '12px' }}>
              {conversation.userName} wants to connect with you
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => handleRespond(true)}
                disabled={responding}
                style={{
                  backgroundColor: '#17BFD9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '12px 32px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: responding ? 'default' : 'pointer',
                  opacity: responding ? 0.6 : 1,
                  fontFamily: FONT,
                }}
              >
                Accept
              </button>
              <button
                onClick={() => handleRespond(false)}
                disabled={responding}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6B7280',
                  border: '1px solid #E5E7EB',
                  borderRadius: '9999px',
                  padding: '12px 32px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: responding ? 'default' : 'pointer',
                  opacity: responding ? 0.6 : 1,
                  fontFamily: FONT,
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message…"
                aria-label="Message text"
                style={{
                  flex: 1,
                  backgroundColor: '#F3F3F3',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '12px 18px',
                  fontSize: '16px',
                  color: '#231E20',
                  fontFamily: FONT,
                  minWidth: 0,
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#17BFD9',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending || !draft.trim() ? 'default' : 'pointer',
                  opacity: sending || !draft.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <Send style={{ width: '20px', height: '20px', color: 'white' }} />
              </button>
            </div>
            {sendError && (
              <p style={{ color: '#EC2C91', fontSize: '12px', marginTop: '6px', fontFamily: FONT }}>
                {sendError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
