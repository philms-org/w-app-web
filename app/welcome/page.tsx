'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { theme } from '@/lib/theme';

export default function WelcomePage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Welcome to The W App",
      description: "Connect with people at your location",
      emoji: "📍",
    },
    {
      title: "Discover Locations",
      description: "Find interesting places and see who's there",
      emoji: "🗺️",
    },
    {
      title: "Make Connections",
      description: "Chat with people who share your space",
      emoji: "💬",
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.push('/auth/login');
    }
  };

  const handleSkip = () => {
    router.push('/auth/login');
  };

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        position: 'relative'
      }}
    >
      {/* Skip button */}
      <div 
        style={{ 
          position: 'absolute',
          top: '32px',
          right: '16px',
          zIndex: 10
        }}
      >
        <button
          onClick={handleSkip}
          style={{ 
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '16px',
            fontWeight: '500',
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
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px'
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
            width: '100%',
            maxWidth: '400px'
          }}
        >
          {/* Emoji Icon */}
          <div style={{ fontSize: '128px', marginBottom: '32px' }}>{slides[currentSlide].emoji}</div>
          
          {/* Title */}
          <h1 style={{ 
            color: 'white', 
            fontSize: '32px', 
            fontWeight: 'bold', 
            marginBottom: '16px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            {slides[currentSlide].title}
          </h1>
          
          {/* Description */}
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.8)', 
            fontSize: '18px', 
            maxWidth: '384px', 
            margin: '0 auto',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            {slides[currentSlide].description}
          </p>
        </motion.div>
      </div>

      {/* Bottom section */}
      <div style={{ padding: '0 32px 48px' }}>
        {/* Dots indicator */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '32px'
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

        {/* Next button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            backgroundColor: 'white',
            color: '#17BFD9',
            fontWeight: '600',
            fontSize: '16px',
            padding: '16px',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            transition: 'all 0.2s ease'
          }}
        >
          {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
        </button>
      </div>
    </div>
  );
}
