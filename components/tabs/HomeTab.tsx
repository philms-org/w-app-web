'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { fetchMyCurrentVenue } from '@/lib/data';
import { venueToLocation } from '@/lib/geo';
import type { Venue } from '@/lib/types';
import { Clock, Trophy, QrCode, ChevronRight } from 'lucide-react';
import CheckedInHero from '@/components/home/CheckedInHero';
import NearbyBanner from '@/components/home/NearbyBanner';
import QuickAccessRow from '@/components/home/QuickAccessRow';
import HistoryPanel from '@/components/home/HistoryPanel';
import RewardsPanel from '@/components/home/RewardsPanel';
import ConnectSheet from '@/components/home/ConnectSheet';
import FriendsActivityFeed from '@/components/home/FriendsActivityFeed';
import ConnectionsPosts from '@/components/home/ConnectionsPosts';
import AnnouncementBanner from '@/components/home/AnnouncementBanner';

type PanelId = 'history' | 'rewards' | 'connect';

// Two screens. Inside a venue (selectedLocation set): just the venue — its
// carousel, people and feed. Home (no venue open): the location card, the
// History/Rewards/Connect tiles, and the locked friends'-activity card, plus a
// "You're at …" pill back into your current event — still there after you walk
// out of the room, until the check-in expires.
export default function HomeTab() {
  const { selectedLocation, setSelectedLocation } = useStore();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [current, setCurrent] = useState<{ venue: Venue; checkedIn: boolean } | null>(null);
  const checkedInVenue = current?.venue ?? null;

  // Re-read on every return to Home: back keeps you checked in; walking out
  // (or checking out) turns the green dot off but keeps the way back in.
  useEffect(() => {
    if (selectedLocation) return;
    let cancelled = false;
    fetchMyCurrentVenue()
      .then((result) => { if (!cancelled) setCurrent(result); })
      .catch((err) => console.error('Failed to load current check-in:', err));
    return () => { cancelled = true; };
  }, [selectedLocation]);

  if (selectedLocation) {
    return (
      // Leave room for the docked composer above the tab bar.
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
        <AnnouncementBanner locationId={selectedLocation.id} venueName={selectedLocation.name} />
        <CheckedInHero />
      </div>
    );
  }

  const togglePanel = (id: PanelId) => {
    setActivePanel((current) => (current === id ? null : id));
  };

  const quickAccessItems = [
    {
      id: 'history',
      label: 'History',
      icon: <Clock style={{ width: '30px', height: '30px', color: activePanel === 'history' ? theme.onAccent : theme.text }} />,
      onClick: () => togglePanel('history')
    },
    {
      id: 'rewards',
      label: 'Rewards',
      icon: <Trophy style={{ width: '30px', height: '30px', color: activePanel === 'rewards' ? theme.onAccent : theme.text }} />,
      onClick: () => togglePanel('rewards')
    },
    {
      id: 'connect',
      label: 'Connect',
      icon: <QrCode style={{ width: '30px', height: '30px', color: activePanel === 'connect' ? theme.onAccent : theme.text }} />,
      onClick: () => togglePanel('connect')
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: '24px' }}>
      {checkedInVenue && (
        <button
          type="button"
          onClick={() => setSelectedLocation(venueToLocation(checkedInVenue))}
          aria-label={`Open ${checkedInVenue.name}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: 'calc(100% - 40px)',
            margin: '16px 20px 0',
            padding: '14px 16px',
            minHeight: '56px',
            borderRadius: '16px',
            border: `1px solid ${theme.accent}`,
            backgroundColor: theme.surface,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          <span aria-hidden style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: current?.checkedIn ? theme.green : theme.muted, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', color: theme.muted, fontSize: '12px' }}>
              {current?.checkedIn ? <>You&apos;re at</> : 'Your event · away from the room'}
            </span>
            <span style={{ display: 'block', color: theme.text, fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {checkedInVenue.name}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: theme.accent, fontSize: '14px', fontWeight: 600 }}>
            Open <ChevronRight style={{ width: '18px', height: '18px' }} />
          </span>
        </button>
      )}

      <NearbyBanner checkedInVenueId={checkedInVenue?.id ?? null} />

      <QuickAccessRow items={quickAccessItems} activeId={activePanel} />

      {activePanel === 'history' && <HistoryPanel />}
      {activePanel === 'rewards' && <RewardsPanel locationId={checkedInVenue?.id} />}
      {activePanel === 'connect' && <ConnectSheet />}
      {activePanel === null && <ConnectionsPosts />}
      {activePanel === null && <FriendsActivityFeed onAddFriends={() => setActivePanel('connect')} />}
    </div>
  );
}
