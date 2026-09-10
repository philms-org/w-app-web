'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { fetchVenues, requestLocation as submitLocationRequest } from '@/lib/data';
import { Search, Filter, MapPin, Users, Navigation, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { theme, elevation } from '@/lib/theme';

// Dynamically import the map to avoid SSR issues
const WMap = dynamic(() => import('@/components/WMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh',
      backgroundColor: theme.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: `4px solid ${theme.accent}`,
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}></div>
        <p style={{
          color: theme.muted,
          fontSize: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Loading Map...</p>
      </div>
    </div>
  )
});

// Placeholder for Google Maps - will need API key to fully implement
export default function MapTab() {
  const { currentLocation, setCurrentLocation, locationDenied, setLocationDenied, nearbyLocations, setNearbyLocations, setSelectedLocation, setActiveTab } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDescription, setNewLocationDescription] = useState('');
  const [clickedLocation, setClickedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const categories = [
    { id: 'all', label: 'All', icon: '📍' },
    { id: 'cafe', label: 'Cafes', icon: '☕' },
    { id: 'bar', label: 'Bars', icon: '🍺' },
    { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
    { id: 'workspace', label: 'Workspaces', icon: '💼' },
    { id: 'event', label: 'Events', icon: '🎉' },
    { id: 'custom', label: 'Custom', icon: '📌' },
  ];

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationDenied(false);
      },
      (error) => {
        console.warn('Location error:', error.code, error.message);
        // Flagged fallback — the banner below tells the user and offers retry.
        setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
        setLocationDenied(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  useEffect(() => {
    // Request location permission with high accuracy
    requestLocation();

    // Load real venues from Supabase
    fetchVenues()
      .then((venues) => {
        setNearbyLocations(
          venues
            .filter((v) => v.lat != null && v.lng != null)
            .map((v) => ({
              id: v.id,
              name: v.name,
              description: v.description ?? '',
              latitude: v.lat as number,
              longitude: v.lng as number,
              radius: v.geofence_radius_meters ?? 50,
              count: 0,
              category: 'venue',
              isHot: false,
              banner_image: v.banner_image ?? null,
            }))
        );
      })
      .catch((err) => console.error('Failed to load venues:', err));
  }, [setCurrentLocation, setNearbyLocations]);

  const filteredLocations = useMemo(() => nearbyLocations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          location.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || location.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [nearbyLocations, searchQuery, selectedCategory]);

  const handleLocationSelect = useCallback((location: any) => {
    setSelectedLocation(location);
    setActiveTab('home');
  }, [setSelectedLocation, setActiveTab]);

  // Add-location is opt-in: stray map taps must NOT open the modal.
  const [addMode, setAddMode] = useState(false);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!addModeRef.current) return;
    setClickedLocation({ lat, lng });
    setShowAddLocation(true);
    setAddMode(false);
  }, []);
  const addModeRef = useRef(addMode);
  addModeRef.current = addMode;

  const mapCenter = useMemo(
    () => currentLocation || { lat: 40.7128, lng: -74.0060 },
    [currentLocation]
  );

  const handleAddLocation = () => {
    if (!newLocationName.trim() || !clickedLocation) return;

    setSubmittingRequest(true);
    setRequestError(null);
    submitLocationRequest(
      newLocationName.trim(),
      newLocationDescription.trim(),
      clickedLocation.lat,
      clickedLocation.lng
    )
      .then(() => {
        setRequestSent(true);
      })
      .catch((err) => {
        console.error('Failed to submit location request:', err);
        setRequestError("Couldn't send your request. Try again.");
      })
      .finally(() => setSubmittingRequest(false));
  };

  const handleCancelAddLocation = () => {
    setNewLocationName('');
    setNewLocationDescription('');
    setShowAddLocation(false);
    setClickedLocation(null);
    setRequestError(null);
    setRequestSent(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, position: 'relative' }}>
      {/* Location-denied notice: never silently show the wrong city */}
      {locationDenied && (
        <div style={{
          position: 'absolute',
          bottom: '96px',
          left: '16px',
          right: '16px',
          zIndex: 1100,
          backgroundColor: 'rgba(35, 30, 32, 0.92)',
          color: 'white',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
        }}>
          <span style={{ fontSize: '18px' }}>📍</span>
          <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.4 }}>
            Location is off — showing a default area, not where you are.
          </span>
          <button
            onClick={requestLocation}
            style={{
              backgroundColor: theme.accent,
              color: theme.onAccent,
              border: 'none',
              borderRadius: '9999px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              whiteSpace: 'nowrap'
            }}
          >
            Turn on
          </button>
        </div>
      )}
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: 'max(16px, env(safe-area-inset-top))'
      }}>
        <div style={{
          backgroundColor: theme.surface,
          backdropFilter: 'blur(8px)',
          padding: '16px',
          boxShadow: elevation.glass
        }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              color: theme.muted
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations..."
              style={{
                width: '100%',
                paddingLeft: '48px',
                paddingRight: searchQuery ? '48px' : '16px',
                paddingTop: '12px',
                paddingBottom: '12px',
                backgroundColor: theme.surface2,
                borderRadius: '9999px',
                border: 'none',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <X style={{ width: '20px', height: '20px', color: theme.muted }} />
              </button>
            )}
          </div>

          {/* Categories */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            margin: '0 -16px',
            padding: '0 16px'
          }}>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  backgroundColor: selectedCategory === category.id ? theme.accent : theme.surface2,
                  color: selectedCategory === category.id ? theme.onAccent : theme.muted,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                <span>{category.icon}</span>
                <span style={{ fontSize: '14px' }}>{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real Interactive Map */}
      <div style={{ position: 'relative', height: '100vh' }}>
        <WMap
          locations={filteredLocations}
          onLocationSelect={handleLocationSelect}
          onMapClick={handleMapClick}
          center={mapCenter}
          zoom={13}
        />
      </div>

      {/* Toggle List Button */}
      <button
        onClick={() => setShowList(!showList)}
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '16px',
          backgroundColor: theme.surface,
          borderRadius: '50%',
          padding: '12px',
          boxShadow: elevation.glass,
          border: 'none',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        <Filter style={{ width: '24px', height: '24px', color: theme.accent }} />
      </button>

      {/* Add Location Button (explicit opt-in; tap the map after arming) */}
      <button
        onClick={() => setAddMode(!addMode)}
        aria-label={addMode ? 'Cancel add location' : 'Add a location'}
        style={{
          position: 'absolute',
          bottom: '140px',
          right: '16px',
          backgroundColor: addMode ? theme.accent : theme.surface,
          borderRadius: '50%',
          padding: '12px',
          boxShadow: elevation.glass,
          border: 'none',
          cursor: 'pointer',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          fontSize: '24px',
          lineHeight: 1,
          color: addMode ? theme.onAccent : theme.accent,
          fontWeight: 600,
          transform: addMode ? 'rotate(45deg)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        +
      </button>
      {addMode && (
        <div style={{
          position: 'absolute',
          bottom: '196px',
          right: '16px',
          backgroundColor: 'rgba(35, 30, 32, 0.92)',
          color: 'white',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '13px',
          zIndex: 1000,
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          Tap the map to place your location
        </div>
      )}

      {/* Current Location Button */}
      <button
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '16px',
          backgroundColor: theme.surface,
          borderRadius: '50%',
          padding: '12px',
          boxShadow: elevation.glass,
          border: 'none',
          cursor: 'pointer',
          zIndex: 1000
        }}
        onClick={() => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const newLocation = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };
                setCurrentLocation(newLocation);
              },
              (error) => {
                console.error('Location error:', error);
                alert('Unable to get your location. Please enable location services.');
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              }
            );
          } else {
            alert('Geolocation is not supported by this browser.');
          }
        }}
      >
        <Navigation style={{ width: '24px', height: '24px', color: theme.accent }} />
      </button>

      {/* Locations List */}
      {showList && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.surface,
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: elevation.glass,
          zIndex: 1100,
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.divider}`
          }}>
            <div style={{
              width: '48px',
              height: '4px',
              backgroundColor: '#D5D5D5',
              borderRadius: '2px',
              margin: '0 auto 12px'
            }}></div>
            <h3 style={{
              fontWeight: '600',
              fontSize: '18px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Nearby Locations</h3>
            <p style={{
              color: theme.muted,
              fontSize: '14px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{filteredLocations.length} locations found</p>
          </div>
          
          <div style={{
            maxHeight: '384px',
            overflowY: 'auto',
            padding: '16px'
          }}>
            {filteredLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleLocationSelect(location)}
                style={{
                  width: '100%',
                  backgroundColor: theme.surface,
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: elevation.glass,
                  border: `1px solid ${theme.divider}`,
                  marginBottom: '12px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      fontWeight: '600',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}>{location.name}</h4>
                    <p style={{
                      color: theme.muted,
                      fontSize: '14px',
                      marginTop: '4px',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}>{location.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users style={{ width: '16px', height: '16px', color: theme.accent }} />
                        <span style={{
                          fontSize: '14px',
                          color: theme.accent,
                          fontWeight: '500',
                          fontFamily: 'Montserrat, system-ui, sans-serif'
                        }}>
                          {location.count} {location.count === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin style={{ width: '16px', height: '16px', color: theme.muted }} />
                        <span style={{
                          fontSize: '14px',
                          color: theme.muted,
                          fontFamily: 'Montserrat, system-ui, sans-serif'
                        }}>
                          {location.radius}m radius
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      // TODO(P7): tokenize accent-tint badge (bg + count colour below)
                      backgroundColor: '#D0F2F7',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span style={{
                        color: '#17BFD9',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        fontFamily: 'Montserrat, system-ui, sans-serif'
                      }}>{location.count}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showAddLocation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: elevation.glass
          }}>
            {requestSent ? (
              <>
                <h3 style={{
                  fontWeight: '600',
                  fontSize: '20px',
                  marginBottom: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>Request sent</h3>
                <p style={{
                  color: theme.muted,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  We&apos;ll message you once it&apos;s reviewed.
                </p>
                <button
                  onClick={handleCancelAddLocation}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: theme.accent,
                    color: theme.onAccent,
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 style={{
                  fontWeight: '600',
                  fontSize: '20px',
                  marginBottom: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>Request a Location</h3>

                <p style={{
                  color: theme.muted,
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  Before you request a venue: it should be a real place your group can
                  physically check into, and you should have some connection to it — you
                  work there, run events there, or can otherwise speak for it. This isn&apos;t
                  a general points-of-interest map. Duplicate, joke, or spam requests will
                  be rejected. Review is manual and may take a few days.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: theme.muted,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    Location Name *
                  </label>
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Enter location name"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${theme.divider}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: theme.muted,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    Description
                  </label>
                  <textarea
                    value={newLocationDescription}
                    onChange={(e) => setNewLocationDescription(e.target.value)}
                    placeholder="Enter location description"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${theme.divider}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {requestError && (
                  <p style={{
                    color: theme.accent2,
                    fontSize: '13px',
                    marginBottom: '16px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {requestError}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={handleCancelAddLocation}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: theme.surface2,
                      color: theme.muted,
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddLocation}
                    disabled={!newLocationName.trim() || submittingRequest}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: newLocationName.trim() ? theme.accent : theme.surface2,
                      color: newLocationName.trim() ? theme.onAccent : theme.muted,
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: newLocationName.trim() && !submittingRequest ? 'pointer' : 'not-allowed',
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}
                  >
                    {submittingRequest ? 'Sending…' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes slideUp {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
