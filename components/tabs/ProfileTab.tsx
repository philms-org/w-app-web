'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { signOut } from '@/lib/auth';
import { theme } from '@/lib/theme';
import {
  Camera, Edit2, Settings, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, User, MapPin, Briefcase, Heart, Users
} from 'lucide-react';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
    logout();
    router.push('/auth/login');
  };

  const menuItems = [
    { id: 'edit', label: 'Edit Profile', icon: Edit2, action: () => router.push('/profile/edit') },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => router.push('/settings') },
    { id: 'notifications', label: 'Notifications', icon: Bell, action: () => router.push('/settings/notifications') },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, action: () => router.push('/settings/privacy') },
    { id: 'help', label: 'Help & Support', icon: HelpCircle, action: () => router.push('/help') },
  ];

  const lookingForItems = [
    { id: 'socializing', label: 'Socializing', icon: Users, active: user?.socialisingId !== '0' },
    { id: 'business', label: 'Business', icon: Briefcase, active: user?.networkingId !== '0' },
    { id: 'love', label: 'Love', icon: Heart, active: user?.datingId !== '0' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      {/* Header with Profile Info */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        padding: '48px 24px 80px',
        paddingTop: 'max(48px, env(safe-area-inset-top) + 48px)'
      }}>
        <div style={{ textAlign: 'center' }}>
          {/* Profile Image */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
            <div style={{
              width: '112px',
              height: '112px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {user?.image ? (
                <img src={user.image} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <User style={{ width: '56px', height: '56px', color: 'white' }} />
              )}
            </div>
            <button style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '32px',
              height: '32px',
              backgroundColor: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: 'none',
              cursor: 'pointer'
            }}>
              <Camera style={{ width: '16px', height: '16px', color: '#17BFD9' }} />
            </button>
          </div>

          {/* Name and Bio */}
          <h1 style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '4px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>{user?.name || 'Guest User'}</h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '16px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>{user?.email || 'guest@example.com'}</p>
          
          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>0</p>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>Connections</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>0</p>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>Locations</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>0</p>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>Check-ins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 24px', marginTop: '-32px' }}>
        {/* Looking For Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>I'm Looking For</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {lookingForItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: `2px solid ${item.active ? '#17BFD9' : '#D5D5D5'}`,
                    backgroundColor: item.active ? '#D0F2F7' : 'white',
                    color: item.active ? '#17BFD9' : '#919191',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                  onClick={() => router.push('/profile/setup')}
                >
                  <Icon style={{ width: '20px', height: '20px' }} />
                  <span style={{ fontSize: '12px' }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile Details */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>About Me</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user?.city && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MapPin style={{ width: '16px', height: '16px', color: '#919191' }} />
                <span style={{ fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{user.city}</span>
              </div>
            )}
            {user?.profession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Briefcase style={{ width: '16px', height: '16px', color: '#919191' }} />
                <span style={{ fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{user.profession}</span>
              </div>
            )}
            {(!user?.city && !user?.profession) && (
              <p style={{
                color: '#919191',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>
                Complete your profile to let others know more about you
              </p>
            )}
          </div>
          <button
            onClick={() => router.push('/profile/setup')}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '8px',
              backgroundColor: '#D0F2F7',
              color: '#17BFD9',
              borderRadius: '8px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            Complete Profile
          </button>
        </div>

        {/* Menu Items */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                style={{
                  width: '100%',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'white',
                  borderBottom: index < menuItems.length - 1 ? '1px solid #F3F3F3' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F3F3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon style={{ width: '20px', height: '20px', color: '#919191' }} />
                  <span style={{ fontWeight: '500', fontSize: '16px' }}>{item.label}</span>
                </div>
                <ChevronRight style={{ width: '20px', height: '20px', color: '#919191' }} />
              </button>
            );
          })}
        </div>

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#D52600',
            fontWeight: '500',
            marginBottom: '32px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          <LogOut style={{ width: '20px', height: '20px' }} />
          <span>Logout</span>
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '384px',
            width: '100%',
            animation: 'scaleIn 0.2s ease-out'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Logout</h3>
            <p style={{
              color: '#919191',
              marginBottom: '24px',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Are you sure you want to logout?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#F3F3F3',
                  borderRadius: '12px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#D52600',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
