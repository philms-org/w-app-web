'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Shield, UserX, Check, X } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchVenueConversation,
  fetchOrCreateVenueConversation,
  ensureVenueChatAdmin,
  fetchChatParticipants,
  removeChatParticipant,
  setChatJoinMode,
  requestToJoinVenueChat,
  fetchMyJoinRequests,
  fetchMyParticipation,
  fetchPendingJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Conversation, ChatParticipant, JoinRequest } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';
import ChatView, { type ChatConversation } from '@/components/ChatView';

export default function VenueChatPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueChatPageInner />
    </Suspense>
  );
}

function VenueChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openChat, setOpenChat] = useState<ChatConversation | null>(null);
  const [modeSaving, setModeSaving] = useState(false);

  const { canManage } = useIsOrganizer(venue?.id);

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId)
        .then(setVenue)
        .catch((err) => {
          console.error('Failed to load venue:', err);
          setVenue(null);
        })
        .finally(() => setVenueLoading(false));
      return;
    }

    setVenueLoading(true);
    fetchMyVenues()
      .then((venues) => {
        setMyVenues(venues);
        setSelectedVenueId((current) => current ?? venues[0]?.id ?? null);
        if (venues.length === 0) setVenue(null);
      })
      .catch((err) => {
        console.error('Failed to load venues:', err);
        fetchMyVenue().then(setVenue).catch(() => setVenue(null));
      })
      .finally(() => setVenueLoading(false));
  }, [paramLocationId]);

  useEffect(() => {
    if (paramLocationId || !selectedVenueId) return;
    fetchVenue(selectedVenueId)
      .then(setVenue)
      .catch((err) => {
        console.error('Failed to load selected venue:', err);
        setVenue(null);
      });
  }, [selectedVenueId, paramLocationId]);

  const loadConversationState = useCallback(
    async (conv: Conversation, isManager: boolean) => {
      if (isManager) {
        await ensureVenueChatAdmin(conv.id).catch((err) => console.error('Failed to ensure chat admin:', err));
      }
      const [participation, participantRows] = await Promise.all([
        fetchMyParticipation(conv.id),
        isManager ? fetchChatParticipants(conv.id) : Promise.resolve([]),
      ]);
      setMyRole(participation?.role ?? null);
      setMyStatus(participation?.status ?? null);
      setParticipants(participantRows);

      if (isManager) {
        const pending = await fetchPendingJoinRequests(conv.id).catch((err) => {
          console.error('Failed to load join requests:', err);
          return [] as JoinRequest[];
        });
        setPendingRequests(pending);
      } else {
        const mine = await fetchMyJoinRequests(conv.id).catch(() => [] as JoinRequest[]);
        setMyRequests(mine);
      }
    },
    []
  );

  const loadEverything = useCallback(() => {
    if (!venue) return;
    setConversationLoading(true);
    setError(null);
    fetchVenueConversation(venue.id)
      .then(async (conv) => {
        setConversation(conv);
        if (conv) await loadConversationState(conv, canManage);
      })
      .catch((err) => {
        console.error('Failed to load venue chat:', err);
        setError("Couldn't load venue chat — try again");
      })
      .finally(() => setConversationLoading(false));
  }, [venue, canManage, loadConversationState]);

  useEffect(loadEverything, [loadEverything]);

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          Venue not found.
        </p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
          Back to app
        </Link>
      </div>
    );
  }

  const handleCreate = () => {
    setCreating(true);
    setError(null);
    fetchOrCreateVenueConversation(venue)
      .then(async (conv) => {
        setConversation(conv);
        await loadConversationState(conv, canManage);
      })
      .catch((err) => {
        console.error('Failed to create venue chat:', err);
        setError("Couldn't create venue chat — try again");
      })
      .finally(() => setCreating(false));
  };

  const handleToggleMode = () => {
    if (!venue) return;
    const nextMode = venue.chat_join_mode === 'auto' ? 'request' : 'auto';
    setModeSaving(true);
    setError(null);
    setChatJoinMode(venue.id, nextMode)
      .then(() => setVenue((v) => (v ? { ...v, chat_join_mode: nextMode } : v)))
      .catch((err) => {
        console.error('Failed to update join mode:', err);
        setError("Couldn't update join mode — try again");
      })
      .finally(() => setModeSaving(false));
  };

  const handleRequestJoin = () => {
    if (!conversation) return;
    setBusyId('request');
    setError(null);
    requestToJoinVenueChat(conversation.id)
      .then(() => fetchMyJoinRequests(conversation.id))
      .then(setMyRequests)
      .catch((err) => {
        console.error('Failed to request to join:', err);
        setError(err?.message?.includes('attempt cap') ? "You've used all 3 join attempts for this chat." : "Couldn't send join request — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleApprove = (request: JoinRequest) => {
    setBusyId(request.id);
    setError(null);
    approveJoinRequest(request)
      .then(() => conversation && loadConversationState(conversation, true))
      .catch((err) => {
        console.error('Failed to approve join request:', err);
        setError("Couldn't approve — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleDeny = (request: JoinRequest) => {
    setBusyId(request.id);
    setError(null);
    denyJoinRequest(request.id)
      .then(() => conversation && loadConversationState(conversation, true))
      .catch((err) => {
        console.error('Failed to deny join request:', err);
        setError("Couldn't deny — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleRemove = (participant: ChatParticipant) => {
    if (!conversation) return;
    setBusyId(participant.user_id);
    setError(null);
    removeChatParticipant(conversation.id, participant.user_id)
      .then(() => loadConversationState(conversation, true))
      .catch((err) => {
        console.error('Failed to remove participant:', err);
        setError("Couldn't remove member — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleOpenChat = () => {
    if (!conversation) return;
    setOpenChat({
      id: conversation.id,
      userName: conversation.name ?? `${venue.name} Chat`,
      isGroup: true,
      myStatus: myStatus ?? 'accepted',
    });
  };

  const isMember = myStatus === 'accepted';
  const latestMyRequest = myRequests[0] ?? null;
  const attemptsUsed = myRequests.length;
  const attemptsLeft = Math.max(0, 3 - attemptsUsed);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      {openChat && <ChatView conversation={openChat} onClose={() => setOpenChat(null)} />}

      <div style={{ backgroundColor: theme.bg, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.divider}` }}>
        <button onClick={() => router.push('/main')} style={{ padding: '8px', marginLeft: '-8px', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 600, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Venue Chat
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      {canManage && <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />}

      <div style={{ padding: '20px 20px 40px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <p style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {venue.name}
        </p>
        <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          A persistent group chat for everyone connected to this venue.
        </p>

        {canManage && (
          <div style={{ backgroundColor: theme.surface, borderRadius: '14px', border: `1px solid ${theme.divider}`, padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <p style={{ color: theme.text, fontSize: '13px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Join mode: {venue.chat_join_mode === 'auto' ? 'Auto-join on check-in' : 'Request to join'}
              </p>
              <p style={{ color: theme.muted, fontSize: '11px', fontFamily: 'Montserrat, system-ui, sans-serif', marginTop: '2px' }}>
                {venue.chat_join_mode === 'auto'
                  ? 'Anyone who checks in here is added to the chat instantly.'
                  : 'Members must request to join; you approve or deny each request.'}
              </p>
            </div>
            <button
              onClick={handleToggleMode}
              disabled={modeSaving}
              style={{
                backgroundColor: theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '9999px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: modeSaving ? 'default' : 'pointer',
                opacity: modeSaving ? 0.6 : 1,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Switch to {venue.chat_join_mode === 'auto' ? 'Request' : 'Auto-join'}
            </button>
          </div>
        )}

        {conversationLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        ) : !conversation ? (
          canManage ? (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                backgroundColor: theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '9999px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: creating ? 'default' : 'pointer',
                opacity: creating ? 0.6 : 1,
                fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              {creating ? 'Creating...' : 'Create this venue’s chat'}
            </button>
          ) : (
            <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              This venue&apos;s chat hasn&apos;t been set up yet.
            </p>
          )
        ) : (
          <>
            {isMember ? (
              <button
                onClick={handleOpenChat}
                style={{
                  width: '100%',
                  backgroundColor: theme.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '14px 20px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  marginBottom: '20px',
                }}
              >
                Open Chat {myRole === 'admin' ? '(Admin)' : ''}
              </button>
            ) : venue.chat_join_mode === 'auto' ? (
              <div style={{ backgroundColor: theme.surface, borderRadius: '14px', border: `1px solid ${theme.divider}`, padding: '16px', marginBottom: '20px' }}>
                <p style={{ color: theme.text, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  Check in to {venue.name} to join this chat automatically.
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: theme.surface, borderRadius: '14px', border: `1px solid ${theme.divider}`, padding: '16px', marginBottom: '20px' }}>
                {latestMyRequest?.status === 'pending' ? (
                  <p style={{ color: theme.text, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    Your request to join is pending approval.
                  </p>
                ) : attemptsLeft <= 0 ? (
                  <p style={{ color: theme.accent2, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    You&apos;ve used all 3 join attempts for this chat.
                  </p>
                ) : (
                  <>
                    {latestMyRequest?.status === 'denied' && (
                      <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                        Your last request was denied. {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left.
                      </p>
                    )}
                    <button
                      onClick={handleRequestJoin}
                      disabled={busyId === 'request'}
                      style={{
                        backgroundColor: theme.accent,
                        color: 'white',
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: busyId === 'request' ? 'default' : 'pointer',
                        opacity: busyId === 'request' ? 0.6 : 1,
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      Request to Join
                    </button>
                  </>
                )}
              </div>
            )}

            {canManage && (
              <>
                <p style={{ color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  Join Requests {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}
                </p>
                {pendingRequests.length === 0 ? (
                  <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    No pending requests.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    {pendingRequests.map((req) => (
                      <div key={req.id} style={{ backgroundColor: theme.surface, borderRadius: '12px', border: `1px solid ${theme.divider}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ flex: 1, color: theme.text, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                          {req.profiles?.display_name ?? 'Someone'} <span style={{ color: theme.muted }}>({req.attempt_count}/3)</span>
                        </span>
                        <button onClick={() => handleApprove(req)} disabled={busyId === req.id} aria-label="Approve" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <Check style={{ width: '18px', height: '18px', color: theme.green }} />
                        </button>
                        <button onClick={() => handleDeny(req)} disabled={busyId === req.id} aria-label="Deny" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <X style={{ width: '18px', height: '18px', color: theme.accent2 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  Members ({participants.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {participants.map((p) => (
                    <div key={p.user_id} style={{ backgroundColor: theme.surface, borderRadius: '12px', border: `1px solid ${theme.divider}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {p.role === 'admin' && <Shield style={{ width: '14px', height: '14px', color: theme.accent, flexShrink: 0 }} />}
                      <span style={{ flex: 1, color: theme.text, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                        {p.profiles?.display_name ?? 'Someone'} {p.role === 'admin' ? '— Admin' : ''}
                      </span>
                      {p.role !== 'admin' && (
                        <button onClick={() => handleRemove(p)} disabled={busyId === p.user_id} aria-label="Remove member" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <UserX style={{ width: '16px', height: '16px', color: theme.accent2 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
