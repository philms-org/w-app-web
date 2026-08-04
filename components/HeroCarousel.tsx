'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { theme } from '@/lib/theme';

interface HeroCarouselProps {
  images: string[];
  title: string;
  onBack: () => void;
}

export default function HeroCarousel({ images, title, onBack }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const hasImages = images.length > 0;

  const goPrev = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div style={{ position: 'relative', height: '220px', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: hasImages ? `url(${images[index]})` : undefined,
        background: hasImages ? undefined : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
      }} />

      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          width: '36px',
          height: '36px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <ArrowLeft style={{ width: '18px', height: '18px', color: 'white' }} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous photo"
            style={{
              position: 'absolute',
              top: '50%',
              left: '12px',
              transform: 'translateY(-50%)',
              width: '32px',
              height: '32px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft style={{ width: '18px', height: '18px', color: 'white' }} />
          </button>
          <button
            onClick={goNext}
            aria-label="Next photo"
            style={{
              position: 'absolute',
              top: '50%',
              right: '12px',
              transform: 'translateY(-50%)',
              width: '32px',
              height: '32px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronRight style={{ width: '18px', height: '18px', color: 'white' }} />
          </button>
        </>
      )}

      <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px' }}>
        <h1 style={{
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px'
        }}>
          <span style={{ color: theme.accent }}>W</span>
          {title}
        </h1>
      </div>

      {images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '20px',
          display: 'flex',
          gap: '6px'
        }}>
          {images.map((_, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: i === index ? 'white' : 'rgba(255, 255, 255, 0.45)'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
