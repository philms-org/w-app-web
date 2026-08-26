'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchBanners } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Banner } from '@/lib/types';
import HeroCarousel from '@/components/HeroCarousel';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';

interface VenuePeekModalProps {
  venue: Venue;
  onClose: () => void;
}

// Round 1 Peek is preview-only: venue info, real photo carousel, and a
// blurred feed teaser. No peek-tracking row, no notification to anyone at
// the venue, no reciprocal matching — that mechanic is Round 2's spec.
export default function VenuePeekModal({ venue, onClose }: VenuePeekModalProps) {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    fetchBanners(venue.id)
      .then(setBanners)
      .catch((err) => console.error('Failed to load venue banners:', err));
  }, [venue.id]);

  const images = banners.length > 0
    ? banners.map((b) => b.image_url)
    : venue.banner_image
      ? [venue.banner_image]
      : [];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.bg, borderRadius: '20px', width: '100%', maxWidth: '420px',
          maxHeight: '85vh', overflowY: 'auto', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '32px', height: '32px', borderRadius: '9999px',
            backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        {images.length > 0 && (
          <HeroCarousel images={images} title={venue.name} onBack={onClose} />
        )}

        <div style={{ padding: '20px' }}>
          <h2 style={{
            color: theme.text, fontSize: '18px', fontWeight: 700, marginBottom: '8px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>{venue.name}</h2>
          {venue.description && (
            <p style={{
              color: theme.muted, fontSize: '13px', lineHeight: 1.5, marginBottom: '20px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}>{venue.description}</p>
          )}

          <div style={{
            position: 'relative', height: '160px', borderRadius: '16px', overflow: 'hidden',
            backgroundColor: theme.surface, border: `1px solid ${theme.divider}`,
          }}>
            <FeedBlurBackdrop />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center', padding: '0 24px',
            }}>
              <p style={{
                color: theme.text, fontSize: '13px', fontWeight: 600,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}>
                Check in to see what&apos;s happening here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
