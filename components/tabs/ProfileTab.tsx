'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { signOut } from '@/lib/auth';
import {
  fetchOwnProfile, setShareCheckinsWithFriends,
  fetchMyRoleBadges, fetchMyVenues, fetchMyProfileStats,
} from '@/lib/data';
import type { Profile, RoleBadge } from '@/lib/types';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import RolePass from '@/components/profile/RolePass';
import { theme, elevation } from '@/lib/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';
import {
  Camera, Edit2, Shield, Link2, Award,
  LogOut, ChevronRight, User, MapPin, Briefcase, Heart, Users, LayoutDashboard, ShieldCheck
} from 'lucide-react';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [shareCheckins, setShareCheckins] = useState(false);
  const [shareCheckinsSaving, setShareCheckinsSaving] = useState(false);
  const [roleBadges, setRoleBadges] = useState<RoleBadge[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<{ connections: number; locations: number; checkins: number } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchMyProfileStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((err) => console.error('Failed to load profile stats:', err));
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchOwnProfile(user.id)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setShareCheckins(p?.share_checkins_with_friends ?? false);
      })
      .catch((err) => console.error('Failed to load sharing preference:', err));
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    fetchMyRoleBadges()
      .then((b) => { if (!cancelled) setRoleBadges(b); })
      .catch((err) => console.error('Failed to load badges:', err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchMyVenues()
      .then((venues) => { if (!cancelled) setIsOrganizer(venues.length > 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

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
    ...(user?.isMasterAdmin ? [{ id: 'admin', label: 'W Staff Admin', icon: ShieldCheck, action: () => router.push('/admin') }] : []),
    ...(isOrganizer ? [{ id: 'organizer', label: 'Organizer Dashboard', icon: LayoutDashboard, action: () => router.push('/main/organizer') }] : []),
    { id: 'connections', label: 'My Connections', icon: Users, action: () => router.push('/main/connections') },
    { id: 'links', label: 'My Links', icon: Link2, action: () => router.push('/main/connect/links') },
    { id: 'edit', label: 'Edit Profile', icon: Edit2, action: () => router.push('/profile/edit') },
    { id: 'badges', label: 'Badges', icon: Award, action: () => router.push('/profile/badges') },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, action: () => router.push('/privacy') },
  ];

  // Read the picks from the DB row, not the store: the store's string ids are
  // only populated by the password-login path, so for other sessions they're
  // undefined and `undefined !== '0'` lit every category up.
  const pick = (options: { id: number; emoji: string; label: string }[], id?: number | null) =>
    id ? options.find((o) => o.id === id) : undefined;
  const lookingForItems = [
    { id: 'socializing', label: 'Socializing', icon: Users, choice: pick(LOOKING_FOR_OPTIONS.socializing.options, profile?.socialising_id) },
    { id: 'business', label: 'Business', icon: Briefcase, choice: pick(LOOKING_FOR_OPTIONS.business.options, profile?.networking_id) },
    { id: 'love', label: 'Love', icon: Heart, choice: pick(LOOKING_FOR_OPTIONS.love.options, profile?.dating_id) },
  ].map((item) => ({ ...item, active: !!item.choice }));

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
            <button
              onClick={() => router.push('/profile/edit')}
              aria-label="Change profile photo"
              style={{
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
          }}>{user?.name || 'Your profile'}</h1>
          {user?.email && (
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{user.email}</p>
          )}
          
          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>{stats ? stats.connections : '–'}</p>
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
              }}>{stats ? stats.locations : '–'}</p>
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
              }}>{stats ? stats.checkins : '–'}</p>
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
                  <span style={{ fontSize: '13px', fontWeight: 600, color: item.active ? theme.text : theme.muted }}>
                    {item.choice ? `${item.choice.emoji} ${item.choice.label}` : 'Not set'}
                  </span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ fontWeight: 600, margin: 0, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Badges</h3>
            {roleBadges.length > 0 && (
              <span style={{ fontSize: '12px', color: theme.muted }}>
                {roleBadges.length} {roleBadges.length === 1 ? 'role' : 'roles'}
              </span>
            )}
          </div>
          {roleBadges.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: '14px', margin: 0, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              No badges yet. Roles organizers approve you for at events (like Staff or Judge) show up here.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', margin: '0 -16px', padding: '4px 16px 8px', scrollbarWidth: 'none' }}>
              {roleBadges.slice(0, 6).map((b) => <RolePass key={b.id} badge={b} variant="mini" ground={theme.surface} />)}
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
            // Neutral label (was #D52600: 3.40:1 on the dark card); the icon
            // carries the destructive colour, and a confirm step follows.
            color: theme.text,
            fontWeight: '600',
            marginBottom: '20px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          <LogOut style={{ width: '20px', height: '20px', color: theme.accent2 }} />
          <span>Logout</span>
        </button>

        {/* Delete account: deliberately quiet; the sheet does the warning. */}
        <button
          onClick={() => setShowDeleteAccount(true)}
          style={{
            display: 'block',
            margin: '0 auto 40px',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: '#FF6B5B',
            fontSize: '14px',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          Delete account
        </button>
      </div>

      {showDeleteAccount && (
        <DeleteAccountSheet
          onClose={() => setShowDeleteAccount(false)}
          onDeleted={() => {
            logout();
            router.replace('/auth/login');
          }}
        />
      )}

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
