'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronUp, ChevronDown, Trash2, Plus, X } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { useStore } from '@/lib/store';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImage,
  fetchLocationManagers,
  addLocationManager,
  removeLocationManager,
  fetchAllProfiles,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Banner, LocationManager, Profile } from '@/lib/types';
import HeroCarousel from '@/components/HeroCarousel';
import VenueSwitcher from '@/components/shared/VenueSwitcher';
import PersonPicker from '@/components/shared/PersonPicker';

const MAX_BANNERS = 5;

export default function VenueCarouselPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueCarouselPageInner />
    </Suspense>
  );
}

function VenueCarouselPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');
  const { user } = useStore();

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [editedLinks, setEditedLinks] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<LocationManager[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const { canManage, isMasterAdmin } = useIsOrganizer(venue?.id);
  const isPrimaryOwner = !!user && venue?.owner_id === user.id;

  // A direct ?locationId= link (e.g. from the admin panel) always wins and
  // skips the "which of my venues" picker — this is how master admins (who
  // don't own any venue via fetchMyVenues()) reach a specific one.
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
        // Fall back to the single-venue lookup in case fetchMyVenues fails
        // for a reason fetchMyVenue wouldn't (defensive, shouldn't normally hit).
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

  const loadManagers = (locationId: string) => {
    Promise.all([fetchLocationManagers(locationId), fetchAllProfiles()])
      .then(([mgrs, profiles]) => {
        setManagers(mgrs);
        setAllProfiles(profiles);
      })
      .catch((err) => console.error('Failed to load co-owners:', err));
  };

  useEffect(() => {
    if (venue) loadManagers(venue.id);
  }, [venue]);

  const handleAddManager = (person: Profile) => {
    if (!venue) return;
    setError(null);
    addLocationManager(venue.id, person.id)
      .then(() => loadManagers(venue.id))
      .catch((err) => {
        console.error('Failed to add co-owner:', err);
        setError("Couldn't add co-owner — try again");
      });
  };

  const handleRemoveManager = (manager: LocationManager) => {
    setError(null);
    removeLocationManager(manager.id)
      .then(() => {
        if (venue) loadManagers(venue.id);
      })
      .catch((err) => {
        console.error('Failed to remove co-owner:', err);
        setError("Couldn't remove co-owner — try again");
      });
  };

  const loadBanners = (locationId: string) => {
    setBannersLoading(true);
    fetchBanners(locationId, false)
      .then((rows) => {
        setBanners(rows);
        setEditedLinks(Object.fromEntries(rows.map((b) => [b.id, b.link ?? ''])));
      })
      .catch((err) => {
        console.error('Failed to load banners:', err);
        setError("Couldn't load banners — try again");
      })
      .finally(() => setBannersLoading(false));
  };

  useEffect(() => {
    if (venue) loadBanners(venue.id);
  }, [venue]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !venue) return;

    setUploading(true);
    setError(null);
    uploadBannerImage(file, venue.id)
      .then((url) => createBanner(venue.id, url, null))
      .then(() => loadBanners(venue.id))
      .catch((err) => {
        console.error('Failed to upload banner:', err);
        setError("Couldn't upload banner — try again");
      })
      .finally(() => setUploading(false));
  };

  const handleLinkBlur = (banner: Banner) => {
    const value = editedLinks[banner.id]?.trim() ?? '';
    const nextLink = value.length > 0 ? value : null;
    if (nextLink === (banner.link ?? null)) return;

    setBusyId(banner.id);
    setError(null);
    updateBanner(banner.id, { link: nextLink })
      .then(() => {
        setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, link: nextLink } : b)));
      })
      .catch((err) => {
        console.error('Failed to update banner link:', err);
        setError("Couldn't save link — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleToggleActive = (banner: Banner) => {
    setBusyId(banner.id);
    setError(null);
    updateBanner(banner.id, { is_active: !banner.is_active })
      .then(() => {
        if (venue) loadBanners(venue.id);
      })
      .catch((err) => {
        console.error('Failed to update banner:', err);
        setError("Couldn't update banner — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleDelete = (banner: Banner) => {
    setBusyId(banner.id);
    setError(null);
    deleteBanner(banner.id)
      .then(() => {
        setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      })
      .catch((err) => {
        console.error('Failed to delete banner:', err);
        setError("Couldn't delete banner — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleMove = (banner: Banner, direction: 'up' | 'down') => {
    const sorted = [...banners].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((b) => b.id === banner.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    setBusyId(banner.id);
    setError(null);
    Promise.all([
      updateBanner(banner.id, { display_order: other.display_order }),
      updateBanner(other.id, { display_order: banner.display_order }),
    ])
      .then(() => {
        const swappedSelf = { ...banner, display_order: other.display_order };
        const swappedOther = { ...other, display_order: banner.display_order };
        setBanners((prev) =>
          prev
            .map((b) => {
              if (b.id === banner.id) return swappedSelf;
              if (b.id === other.id) return swappedOther;
              return b;
            })
            .sort((a, b) => a.display_order - b.display_order)
        );
      })
      .catch((err) => {
        console.error('Failed to reorder banners:', err);
        setError("Couldn't reorder banners — try again");
      })
      .finally(() => setBusyId(null));
  };

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!venue || !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to manage this venue&apos;s banners.
        </p>
        <Link
          href="/main"
          style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to app
        </Link>
      </div>
    );
  }

  const sortedBanners = [...banners].sort((a, b) => a.display_order - b.display_order);
  const previewImages = sortedBanners.map((b) => b.image_url);
  const previewLinks = sortedBanners.map((b) => b.link ?? null);
  const atCap = banners.length >= MAX_BANNERS;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <button
          onClick={() => router.push('/main')}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1 style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>Manage Banners</h1>
        <div style={{ width: '40px' }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <HeroCarousel
        images={previewImages}
        title={venue.name}
        onBack={() => router.push('/main')}
        links={previewLinks}
      />

      <div style={{ padding: '20px 20px 40px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {bannersLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading banners...</p>
        ) : sortedBanners.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: '20px' }}>
            No banners yet — add up to {MAX_BANNERS} photos for your venue&apos;s carousel.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {sortedBanners.map((banner, i) => {
              const isBusy = busyId === banner.id;
              return (
                <div
                  key={banner.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: '16px',
                    border: `1px solid ${theme.divider}`,
                    padding: '12px',
                    display: 'flex',
                    gap: '12px',
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <img
                    src={banner.image_url}
                    alt={`Banner ${i + 1}`}
                    style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                  />

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                    <input
                      type="text"
                      value={editedLinks[banner.id] ?? ''}
                      onChange={(e) => setEditedLinks((prev) => ({ ...prev, [banner.id]: e.target.value }))}
                      onBlur={() => handleLinkBlur(banner)}
                      placeholder="Link (opens when tapped)"
                      disabled={isBusy}
                      style={{
                        backgroundColor: theme.pill,
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        color: theme.bg,
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleToggleActive(banner)}
                        disabled={isBusy}
                        style={{
                          backgroundColor: banner.is_active ? theme.green : theme.surface2,
                          color: 'white',
                          border: 'none',
                          borderRadius: '9999px',
                          padding: '5px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: isBusy ? 'default' : 'pointer',
                          fontFamily: 'Montserrat, system-ui, sans-serif',
                        }}
                      >
                        {banner.is_active ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        onClick={() => handleMove(banner, 'up')}
                        disabled={isBusy || i === 0}
                        aria-label="Move up"
                        style={{
                          backgroundColor: theme.surface2,
                          border: 'none',
                          borderRadius: '9999px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isBusy || i === 0 ? 'default' : 'pointer',
                          opacity: i === 0 ? 0.4 : 1,
                        }}
                      >
                        <ChevronUp style={{ width: '16px', height: '16px', color: theme.text }} />
                      </button>
                      <button
                        onClick={() => handleMove(banner, 'down')}
                        disabled={isBusy || i === sortedBanners.length - 1}
                        aria-label="Move down"
                        style={{
                          backgroundColor: theme.surface2,
                          border: 'none',
                          borderRadius: '9999px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isBusy || i === sortedBanners.length - 1 ? 'default' : 'pointer',
                          opacity: i === sortedBanners.length - 1 ? 0.4 : 1,
                        }}
                      >
                        <ChevronDown style={{ width: '16px', height: '16px', color: theme.text }} />
                      </button>

                      <button
                        onClick={() => handleDelete(banner)}
                        disabled={isBusy}
                        aria-label="Delete banner"
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '9999px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isBusy ? 'default' : 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        <Trash2 style={{ width: '16px', height: '16px', color: theme.accent2 }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {atCap ? (
          <p style={{ color: theme.muted, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            You&apos;ve reached the {MAX_BANNERS}-banner limit — remove one to add another.
          </p>
        ) : (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: theme.accent,
            color: 'white',
            borderRadius: '9999px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            cursor: uploading ? 'default' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}>
            <Plus style={{ width: '18px', height: '18px' }} />
            {uploading ? 'Uploading...' : 'Add banner'}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        )}

        {(isPrimaryOwner || isMasterAdmin) && (
          <div style={{
            marginTop: '32px',
            backgroundColor: theme.surface,
            borderRadius: '16px',
            border: `1px solid ${theme.divider}`,
            padding: '16px',
          }}>
            <p style={{
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: theme.muted,
              fontFamily: 'Montserrat, system-ui, sans-serif',
              marginBottom: '10px',
            }}>Co-Owners</p>
            <p style={{
              color: theme.muted,
              fontSize: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              marginBottom: '10px',
            }}>
              Co-owners can manage this venue&apos;s carousel and tags, same as you — they just can&apos;t add or remove other co-owners.
            </p>

            {managers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {managers.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, color: theme.text, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {m.profiles?.display_name ?? m.user_id}
                    </span>
                    <button
                      onClick={() => handleRemoveManager(m)}
                      aria-label="Remove co-owner"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                    >
                      <X style={{ width: '14px', height: '14px', color: theme.accent2 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PersonPicker people={allProfiles} onPick={handleAddManager} placeholder="Add a co-owner by name or email…" />
          </div>
        )}
      </div>
    </div>
  );
}
