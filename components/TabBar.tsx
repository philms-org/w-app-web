'use client';

import { MapPin, MessageCircle } from 'lucide-react';
import { theme } from '@/lib/theme';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount?: number;
}

export default function TabBar({ activeTab, onTabChange, unreadCount = 0 }: TabBarProps) {
  const tabs = [
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'feed', label: 'Main Feed', icon: null },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.bg,
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: '64px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 50
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const color = isActive ? theme.accent : '#919191';

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              color,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            <div style={{ position: 'relative' }}>
              {tab.id === 'feed' ? (
                <span style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  color,
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  W
                </span>
              ) : (
                Icon && <Icon style={{ width: '24px', height: '24px' }} strokeWidth={isActive ? 2.5 : 2} />
              )}

              {tab.id === 'messages' && unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  backgroundColor: theme.accent2,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </div>
            <span style={{ fontSize: '12px', marginTop: '4px' }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
