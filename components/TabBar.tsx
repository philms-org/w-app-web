'use client';

import { Home, MapPin, Navigation, MessageCircle, User } from 'lucide-react';
import { useStore } from '@/lib/store';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount?: number;
}

export default function TabBar({ activeTab, onTabChange, unreadCount = 0 }: TabBarProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'location', label: 'My Location', icon: Navigation, isWingLogo: true },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTop: '1px solid #F3F3F3',
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
              color: isActive ? '#17BFD9' : '#919191',
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            <div style={{ position: 'relative' }}>
              {/* Wing Me Logo for Location Tab */}
              {tab.id === 'location' ? (
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}>
                  {/* Wing Me Logo - Stylized W with Wings */}
                  <svg 
                    width="28" 
                    height="28" 
                    viewBox="0 0 28 28" 
                    style={{
                      fill: isActive ? '#17BFD9' : '#919191',
                      transition: 'fill 0.2s ease'
                    }}
                  >
                    {/* Left Wing */}
                    <path d="M2 14 Q6 8 14 14 Q10 10 6 12 Q4 13 2 14" opacity="0.8"/>
                    {/* Right Wing */}  
                    <path d="M26 14 Q22 8 14 14 Q18 10 22 12 Q24 13 26 14" opacity="0.8"/>
                    {/* Center W */}
                    <path d="M8 8 L10 18 L12 12 L14 18 L16 12 L18 18 L20 8" 
                          strokeWidth="1.5" 
                          stroke="currentColor" 
                          fill="none"/>
                  </svg>
                </div>
              ) : (
                <Icon style={{ width: '24px', height: '24px' }} strokeWidth={isActive ? 2.5 : 2} />
              )}
              
              {/* Badge for messages */}
              {tab.id === 'messages' && unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#EC2C91',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </div>
            <span style={{ fontSize: '12px', marginTop: '4px' }}>
              {tab.id === 'location' ? 'My Location' : tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
