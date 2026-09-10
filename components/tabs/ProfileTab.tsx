'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { signOut } from '@/lib/auth';
import {
  fetchProfile, setShareCheckinsWithFriends,
  fetchBadges, fetchMyBadgeIds, recomputeMyBadges,
} from '@/lib/data';
import type { Badge } from '@/lib/types';
import { theme, elevation } from '@/lib/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Camera, Edit2, Shield, Link2, Award,
  LogOut, ChevronRight, User, MapPin, Briefcase, Heart, Users
} from 'lucide-react';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [shareCheckins, setShareCheckins] = useState(false);
  const [shareCheckinsSaving, setShareCheckinsSaving] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => { if (!cancelled) setShareCheckins(p?.share_checkins_with_friends ?? false); })
      .catch((err) => console.error('Failed to load sharing preference:', err));
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    recomputeMyBadges().catch(() => {});
    Promise.all([fetchBadges(), fetchMyBadgeIds()])
      .then(([cat, ids]) => {
        if (cancelled) return;
        const set = new Set(ids);
        setEarnedBadges(cat.filter((b) => set.has(b.id)));
      })
      .catch((err) => console.error('Failed to load badges:', err));
    return () => { cancelled = true; };
  }, []);

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
    { id: 'connections', label: 'My Connections', icon: Users, action: () => router.push('/main/connections') },
    { id: 'links', label: 'My Links', icon: Link2, action: () => router.push('/main/connect/links') },
    { id: 'edit', label: 'Edit Profile', icon: Edit2, action: () => router.push('/profile/edit') },
    { id: 'badges', label: 'Badges', icon: Award, action: () => router.push('/profile/badges') },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, action: () => router.push('/privacy') },
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
              <Camera style={{ width: '16px', height: '16px', color: theme.accent }} />
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
          backgroundColor: theme.surface,
          borderRadius: '16px',
          padding: '16px',
          boxShadow: elevation.glass,
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
                    border: `2px solid ${item.active ? theme.accent : theme.divider}`,
                    backgroundColor: item.active ? 'rgba(34,195,201,0.12)' : theme.surface, // TODO(P7): tokenize accent-tint
                    color: item.active ? theme.accent : theme.muted,
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
          backgroundColor: theme.surface,
          borderRadius: '16px',
          padding: '16px',
          boxShadow: elevation.glass,
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
                <MapPin style={{ width: '16px', height: '16px', color: theme.muted }} />
                <span style={{ fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{user.city}</span>
              </div>
            )}
            {user?.profession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Briefcase style={{ width: '16px', height: '16px', color: theme.muted }} />
                <span style={{ fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{user.profession}</span>
              </div>
            )}
            {(!user?.city && !user?.profession) && (
              <p style={{
                color: theme.muted,
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
              backgroundColor: 'rgba(34,195,201,0.12)', // TODO(P7): tokenize accent-tint
              color: theme.accent,
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

        {/* Badges */}
        <button
          onClick={() => router.push('/profile/badges')}
          style={{
            width: '100%', textAlign: 'left', backgroundColor: theme.surface, borderRadius: '16px',
            padding: '16px', boxShadow: elevation.glass, marginBottom: '16px',
            border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          <h3 style={{ fontWeight: 600, marginBottom: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Badges</h3>
          {earnedBadges.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              No badges yet — check in and connect to earn them.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {earnedBadges.map((b) => (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '64px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '9999px', backgroundColor: theme.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Award style={{ width: '20px', height: '20px', color: theme.onAccent }} />
                  </div>
                  <span style={{ fontSize: '10px', color: theme.muted, textAlign: 'center', lineHeight: 1.2 }}>{b.name}</span>
                </div>
              ))}
            </div>
          )}
        </button>

        {/* Privacy */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '16px',
          padding: '16px',
          boxShadow: elevation.glass,
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Privacy</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Share check-ins with connections
              </div>
              <div style={{ color: theme.muted, fontSize: '12px', marginTop: '2px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Lets people you&apos;ve connected with see which venues you visit.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Share check-ins with connections"
              checked={shareCheckins}
              disabled={shareCheckinsSaving}
              onChange={(e) => {
                const next = e.target.checked;
                setShareCheckins(next);
                setShareCheckinsSaving(true);
                // Revert the optimistic flip if the write fails, so the switch
                // never claims a privacy setting that isn't actually saved.
                setShareCheckinsWithFriends(next)
                  .catch((err) => {
                    console.error('Failed to save check-in sharing preference:', err);
                    setShareCheckins(!next);
                  })
                  .finally(() => setShareCheckinsSaving(false));
              }}
              style={{ width: '20px', height: '20px', accentColor: theme.accent, flexShrink: 0, cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Theme toggle */}
        <ThemeToggle style={{ marginBottom: 12 }} />

        {/* Menu Items */}
        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '16px',
          boxShadow: elevation.glass,
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
                  backgroundColor: theme.surface,
                  borderBottom: index < menuItems.length - 1 ? `1px solid ${theme.divider}` : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.surface2}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.surface}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon style={{ width: '20px', height: '20px', color: theme.muted }} />
                  <span style={{ fontWeight: '500', fontSize: '16px' }}>{item.label}</span>
                </div>
                <ChevronRight style={{ width: '20px', height: '20px', color: theme.muted }} />
              </button>
            );
          })}
        </div>

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            width: '100%',
            backgroundColor: theme.surface,
            borderRadius: '16px',
            boxShadow: elevation.glass,
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
            backgroundColor: theme.surface,
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
              color: theme.muted,
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
                  backgroundColor: theme.surface2,
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
