'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { checkIn, checkOut, fetchPresence } from '@/lib/data';
import { theme } from '@/lib/theme';
import { MapPin, Users, User, Heart, Briefcase, Clock, Trophy, UserCircle, BadgeCheck, UserPlus } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';

export default function MainFeedTab() {
  const { selectedLocation, setSelectedLocation, setActiveTab } = useStore();
  const [peopleHere, setPeopleHere] = useState<any[]>([]);
  const [comingSoon, setComingSoon] = useState<'history' | 'rewards' | null>(null);
  const [venueTab, setVenueTab] = useState<'who' | 'connections'>('who');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (!selectedLocation) return;

    checkIn(selectedLocation.id).catch((err) => console.error('Check-in failed:', err));

    fetchPresence(selectedLocation.id)
      .then((rows) => {
        setPeopleHere(
          rows.map((row) => ({
            id: row.id,
            name: row.profiles?.display_name ?? 'Someone',
            bio: row.profiles?.profession ?? '',
            role: row.profiles?.role ?? '',
            isVerified: !!row.profiles?.is_verified,
            lookingFor: [
              ...(row.profiles?.socialising_id ? ['socializing'] : []),
              ...(row.profiles?.networking_id ? ['business'] : []),
              ...(row.profiles?.dating_id ? ['love'] : []),
            ],
            distance: 'here now',
          }))
        );
      })
      .catch((err) => console.error('Failed to load presence:', err));
  }, [selectedLocation]);

  const handleCheckIn = () => {
    setActiveTab('messages');
  };

  const handleLeaveLocation = () => {
    if (selectedLocation) {
      checkOut(selectedLocation.id).catch((err) => console.error('Check-out failed:', err));
    }
    setSelectedLocation(null);
    setActiveTab('map');
  };

  const quickAccessItems = [
    { id: 'history' as const, label: 'History', icon: Clock },
    { id: 'rewards' as const, label: 'Rewards', icon: Trophy },
    { id: 'profile' as const, label: 'Profile', icon: UserCircle },
  ];

  const handleQuickAccess = (id: 'history' | 'rewards' | 'profile') => {
    if (id === 'profile') {
      setActiveTab('profile');
      return;
    }
    setComingSoon(id);
  };

  if (!selectedLocation) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at center, rgba(23, 191, 217, 0.1) 0%, rgba(0, 0, 0, 0.9) 100%),
          url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><defs><pattern id="brick" width="200" height="80" patternUnits="userSpaceOnUse"><rect width="200" height="80" fill="%23222"/><rect width="96" height="36" x="2" y="2" fill="%23333" rx="2"/><rect width="96" height="36" x="102" y="2" fill="%232a2a2a" rx="2"/><rect width="96" height="36" x="52" y="42" fill="%232d2d2d" rx="2"/><rect width="44" height="36" x="2" y="42" fill="%232f2f2f" rx="2"/><rect width="44" height="36" x="154" y="42" fill="%23272727" rx="2"/></pattern></defs><rect width="200" height="80" fill="url(%23brick)"/></svg>') repeat
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '80px', textAlign: 'center', width: '100%' }}>
          <h1 style={{
            color: theme.accent,
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            textShadow: '0 0 20px rgba(23, 191, 217, 0.8), 0 0 40px rgba(23, 191, 217, 0.4)',
            marginBottom: '8px'
          }}>
            Locations nearby
          </h1>
        </div>

        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '100%',
          maxWidth: '350px'
        }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '48px' }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              left: '-20px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(23, 191, 217, 0.4) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>

            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#000000',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.accent}`,
              boxShadow: '0 0 40px rgba(23, 191, 217, 0.8), inset 0 0 20px rgba(23, 191, 217, 0.2)',
              position: 'relative'
            }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 'bold',
                background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transform: 'rotate(45deg)',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textShadow: '0 0 10px rgba(23, 191, 217, 0.5)'
              }}>
                W
              </span>
            </div>
          </div>

          <p style={{
            color: 'white',
            fontSize: '18px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.4,
            marginBottom: '48px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
          }}>
            You are not checked into a location. Go to the map to see nearby locations.
          </p>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '200px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '24px'
        }}>
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleQuickAccess(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: theme.pill,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(23, 191, 217, 0.3)'
                }}>
                  <Icon style={{ width: '24px', height: '24px', color: theme.bg }} />
                </div>
                <span style={{
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '300px',
          padding: '0 24px'
        }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              width: '100%',
              background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
              color: 'white',
              fontWeight: '600',
              padding: '16px 32px',
              borderRadius: '16px',
              border: `2px solid ${theme.accent}`,
              cursor: 'pointer',
              fontSize: '18px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 0 30px rgba(23, 191, 217, 0.6)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <span style={{
              fontSize: '20px',
              background: `linear-gradient(135deg, ${theme.accent2} 0%, ${theme.accent} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>➤</span>
            Explore Locations
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 2s ease-in-out infinite'
            }}></div>
          </button>
        </div>

        {comingSoon && (
          <div
            onClick={() => setComingSoon(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div style={{
              backgroundColor: theme.pill,
              borderRadius: '16px',
              padding: '32px 24px',
              maxWidth: '320px',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                marginBottom: '8px',
                color: theme.bg,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textTransform: 'capitalize'
              }}>{comingSoon} — Coming Soon</h3>
              <p style={{ color: '#919191', fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                This screen is on the way. Check back soon.
              </p>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  const description = selectedLocation.description ?? '';
  const isLongDescription = description.length > 90;
  const bannerImages = selectedLocation.banner_image ? [selectedLocation.banner_image] : [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <HeroCarousel images={bannerImages} title={selectedLocation.name} onBack={handleLeaveLocation} />

      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: theme.accent }} />
            <span style={{ color: 'white', fontWeight: 500, fontSize: '14px' }}>
              {selectedLocation.count} {selectedLocation.count === 1 ? 'person' : 'people'} here
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin style={{ width: '18px', height: '18px', color: theme.accent }} />
            <span style={{ color: 'white', fontWeight: 500, fontSize: '14px' }}>{selectedLocation.radius}m radius</span>
          </div>
        </div>

        {description && (
          <div style={{
            backgroundColor: theme.pill,
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px'
          }}>
            <p style={{ color: theme.bg, fontSize: '14px', lineHeight: 1.4 }}>
              Welcome to {selectedLocation.name}, we have for you{' '}
              {isLongDescription && !descriptionExpanded
                ? `${description.slice(0, 90)}... `
                : `${description} `}
              {isLongDescription && (
                <button
                  onClick={() => setDescriptionExpanded((v) => !v)}
                  style={{
                    color: theme.accent,
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '14px'
                  }}
                >
                  {descriptionExpanded ? 'Show Less' : 'Read More'}
                </button>
              )}
            </p>
          </div>
        )}

        <div style={{
          backgroundColor: theme.pill,
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          gap: '8px',
          marginBottom: '20px'
        }}>
          <button style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: '#D0F2F7',
            color: theme.accent,
            borderRadius: '8px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer'
          }}>
            Share Location
          </button>
          <button style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: '#FDF2F8',
            color: theme.accent2,
            borderRadius: '8px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer'
          }}>
            Invite Friends
          </button>
        </div>

        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setVenueTab('who')}
            style={{
              flex: 1,
              padding: '0 0 12px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${venueTab === 'who' ? theme.accent : 'transparent'}`,
              color: venueTab === 'who' ? theme.accent : '#919191',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.03em',
              cursor: 'pointer'
            }}
          >
            WHO&apos;S HERE
          </button>
          <button
            onClick={() => setVenueTab('connections')}
            style={{
              flex: 1,
              padding: '0 0 12px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${venueTab === 'connections' ? theme.accent : 'transparent'}`,
              color: venueTab === 'connections' ? theme.accent : '#919191',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.03em',
              cursor: 'pointer'
            }}
          >
            CONNECTIONS
          </button>
        </div>
      </div>

      {venueTab === 'connections' ? (
        <div style={{ padding: '0 24px' }}>
          <div style={{ backgroundColor: theme.pill, borderRadius: '12px', padding: '32px 24px', textAlign: 'center' }}>
            <UserPlus style={{ width: '40px', height: '40px', color: '#B9B9B9', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: theme.bg, fontWeight: 600 }}>No connections here yet</p>
            <p style={{ color: '#919191', fontSize: '14px', marginTop: '4px' }}>
              People you connect with will show up here when they&apos;re at this location.
            </p>
          </div>
        </div>
      ) : (
      <div style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {peopleHere.map((person) => (
            <div key={person.id} style={{ backgroundColor: theme.pill, borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#F3F3F3',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User style={{ width: '24px', height: '24px', color: '#919191' }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <h4 style={{ fontWeight: 600 }}>{person.name}</h4>
                    {person.isVerified && (
                      <BadgeCheck style={{ width: '16px', height: '16px', color: theme.accent }} />
                    )}
                    {person.role && (
                      <span style={{ color: '#919191', fontSize: '13px' }}>· {person.role}</span>
                    )}
                  </div>
                  {person.bio && <p style={{ color: '#919191', fontSize: '14px', marginBottom: '8px' }}>{person.bio}</p>}

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {person.lookingFor.includes('socializing') && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#DBEAFE',
                        color: '#1E40AF',
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <Users style={{ width: '12px', height: '12px' }} />
                        Socializing
                      </span>
                    )}
                    {person.lookingFor.includes('business') && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#DCFCE7',
                        color: '#166534',
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <Briefcase style={{ width: '12px', height: '12px' }} />
                        Business
                      </span>
                    )}
                    {person.lookingFor.includes('love') && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#FCE7F3',
                        color: '#9D174D',
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <Heart style={{ width: '12px', height: '12px' }} />
                        Love
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#919191', fontSize: '14px' }}>{person.distance}</span>
                    <button
                      onClick={handleCheckIn}
                      style={{
                        backgroundColor: theme.accent,
                        color: 'white',
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s, transform 0.2s'
                      }}
                    >
                      Check In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {peopleHere.length === 0 && (
          <div style={{ backgroundColor: theme.pill, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <Users style={{ width: '48px', height: '48px', color: '#F3F3F3', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#919191' }}>No one else is here yet</p>
            <p style={{ color: '#919191', fontSize: '14px', marginTop: '4px' }}>Be the first to check in!</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
