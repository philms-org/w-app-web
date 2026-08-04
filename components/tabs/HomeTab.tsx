'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { Clock, Trophy, QrCode } from 'lucide-react';
import CheckedInHero from '@/components/home/CheckedInHero';
import NearbyBanner from '@/components/home/NearbyBanner';
import QuickAccessRow from '@/components/home/QuickAccessRow';
import HistoryPanel from '@/components/home/HistoryPanel';
import RewardsPanel from '@/components/home/RewardsPanel';
import ConnectSheet from '@/components/home/ConnectSheet';
import FriendsActivityFeed from '@/components/home/FriendsActivityFeed';

type PanelId = 'history' | 'rewards' | 'connect';

// Assembles the new Home tab: checked-in hero (or nearby scroller) up top,
// the History/Rewards/Connect quick-access row, whichever of those panels is
// toggled open inline, and the locked friends'-activity feed as the default
// bottom section when no panel is open.
export default function HomeTab() {
  const { selectedLocation } = useStore();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  const togglePanel = (id: PanelId) => {
    setActivePanel((current) => (current === id ? null : id));
  };

  const quickAccessItems = [
    {
      id: 'history',
      label: 'History',
      icon: <Clock style={{ width: '24px', height: '24px', color: activePanel === 'history' ? 'white' : theme.text }} />,
      onClick: () => togglePanel('history')
    },
    {
      id: 'rewards',
      label: 'Rewards',
      icon: <Trophy style={{ width: '24px', height: '24px', color: activePanel === 'rewards' ? 'white' : theme.text }} />,
      onClick: () => togglePanel('rewards')
    },
    {
      id: 'connect',
      label: 'Connect',
      icon: <QrCode style={{ width: '24px', height: '24px', color: activePanel === 'connect' ? 'white' : theme.text }} />,
      onClick: () => togglePanel('connect')
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: '24px' }}>
      {selectedLocation ? <CheckedInHero /> : <NearbyBanner />}

      <QuickAccessRow items={quickAccessItems} activeId={activePanel} />

      {activePanel === 'history' && <HistoryPanel />}
      {activePanel === 'rewards' && <RewardsPanel />}
      {activePanel === 'connect' && <ConnectSheet />}
      {activePanel === null && <FriendsActivityFeed />}
    </div>
  );
}
