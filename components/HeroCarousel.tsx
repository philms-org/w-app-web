'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { theme } from '@/lib/theme';
import InAppBrowserModal from '@/components/ui/InAppBrowserModal';

interface HeroCarouselProps {
  images: string[];
  title: string;
  onBack: () => void;
  links?: (string | null)[];
  // Called when someone swipes/taps through the carousel or opens a slide's
  // link, with the element they used. Feeds the room activity meter.
  onEngage?: (el: Element | null) => void;
}

const SWIPE_PX = 40;

// Organizer slides (event graphics, schedules, sponsor cards) carry text and
// QR codes, so they are shown whole (`contain`, 3:2 frame) and never cropped.
// The venue name sits below the image instead of on top of it.
export default function HeroCarousel({ images, title, onBack, links, onEngage }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hasImages = images.length > 0;
  const many = images.length > 1;
  const current = Math.min(index, Math.max(0, images.length - 1));
  const currentLink = links?.[current] ?? null;

  const goPrev = () => setIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i >= images.length - 1 ? 0 : i + 1));

  const roundBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 9999, border: 'none', cursor: 'pointer',
    backgroundColor: 'rgba(0, 0, 0, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      {browserUrl && <InAppBrowserModal url={browserUrl} onClose={() => setBrowserUrl(null)} />}

      <div
        ref={frameRef}
        role={hasImages ? 'region' : undefined}
        aria-roledescription={hasImages ? 'carousel' : undefined}
        aria-label={hasImages ? `${title} slides` : undefined}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (!many || touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < SWIPE_PX) return;
          if (dx < 0) goNext(); else goPrev();
          onEngage?.(frameRef.current);
        }}
        style={{
          position: 'relative', width: '100%', maxWidth: '100%',
          aspectRatio: hasImages ? '3 / 2' : undefined, height: hasImages ? undefined : 150,
          maxHeight: 360, overflow: 'hidden',
          background: hasImages ? '#000' : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        }}
      >
        {hasImages && (
          // Only ever set ONE background key here. React writes '' for an
          // undefined `background`, which also wipes backgroundImage.
          <div
            role="img"
            aria-label={`Slide ${current + 1} of ${images.length}`}
            onClick={currentLink ? (e) => { setBrowserUrl(currentLink); onEngage?.(e.currentTarget); } : undefined}
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${images[current]})`,
              backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
              cursor: currentLink ? 'pointer' : undefined,
            }}
          />
        )}

        <button onClick={onBack} aria-label="Back" style={{ ...roundBtn, position: 'absolute', top: 10, left: 10 }}>
          <ArrowLeft style={{ width: 20, height: 20, color: 'white' }} />
        </button>

        {many && (
          <>
            <span style={{
              position: 'absolute', top: 18, right: 12, padding: '3px 10px', borderRadius: 9999,
              backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 12, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {current + 1} / {images.length}
            </span>
            <button
              onClick={(e) => { goPrev(); onEngage?.(e.currentTarget); }}
              aria-label="Previous slide"
              style={{ ...roundBtn, position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)' }}
            >
              <ChevronLeft style={{ width: 22, height: 22, color: 'white' }} />
            </button>
            <button
              onClick={(e) => { goNext(); onEngage?.(e.currentTarget); }}
              aria-label="Next slide"
              style={{ ...roundBtn, position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)' }}
            >
              <ChevronRight style={{ width: 22, height: 22, color: 'white' }} />
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px 0' }}>
        <h1 style={{
          flex: 1, minWidth: 0, margin: 0, color: theme.text, fontSize: 20, fontWeight: 800,
          display: 'flex', alignItems: 'baseline', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: theme.accent }}>W</span>
          {title}
        </h1>
        {many && images.length <= 8 && (
          <div aria-hidden="true" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === current ? 18 : 7, height: 7, borderRadius: 9999, transition: 'width .2s ease',
                  backgroundColor: i === current ? theme.text : theme.divider,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
