'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { theme } from '@/lib/theme';
import { STORAGE_KEYS } from '@/lib/constants';

interface OrganizerWelcomeModalProps {
  onClose: () => void;
}

// First-run overlay explaining the new organizer tools (verification tags,
// carousel/banners, groups). Reuses app/welcome/page.tsx's slide-carousel
// visual pattern (gradient background, emoji, dot pagination, Skip/Next
// button) but as a modal overlay rather than a full-page route, since it's
// shown on top of CheckedInHero rather than during signup. Dismissing
// (Skip or the final "Got it") marks STORAGE_KEYS.ORGANIZER_WELCOME_SEEN so
// it never shows again on this browser/device.
export default function OrganizerWelcomeModal({ onClose }: OrganizerWelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'New: Verification Tags',
      description: 'Tag attendees like "DJ" or "Host" so everyone at your venue knows who\'s who.',
      emoji: '🏷️',
    },
    {
      title: 'New: Carousel & Links',
      description: "Add photos to your venue's carousel, each with its own clickable link.",
      emoji: '🖼️',
    },
    {
      title: 'New: Groups',
      description: 'Create a group from your attendees and message them all at once.',
      emoji: '👥',
    },
  ];

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_WELCOME_SEEN, 'true');
    onClose();
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      dismiss();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          borderRadius: '24px',
          background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '32px 24px 24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Skip button */}
        <div style={{ position: 'absolute', top: '16px', right: '20px', zIndex: 10 }}>
          <button
            onClick={dismiss}
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            Skip
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 8px 24px',
            minHeight: '220px'
          }}
        >
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            style={{
              textAlign: 'center',
              width: '100%'
            }}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>{slides[currentSlide].emoji}</div>

            <h2 style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: 'bold',
              marginBottom: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              {slides[currentSlide].title}
            </h2>

            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '15px',
              lineHeight: 1.4,
              maxWidth: '320px',
              margin: '0 auto',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              {slides[currentSlide].description}
            </p>
          </motion.div>
        </div>

        {/* Dots indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}
        >
          {slides.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentSlide ? '32px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: index === currentSlide ? 'white' : 'rgba(255, 255, 255, 0.4)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Next / Got it button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            backgroundColor: 'white',
            color: '#17BFD9',
            fontWeight: 600,
            fontSize: '16px',
            padding: '16px',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            transition: 'all 0.2s ease'
          }}
        >
          {currentSlide === slides.length - 1 ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  );
}
