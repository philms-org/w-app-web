'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import Image from 'next/image';
import { theme } from '@/lib/theme';

export default function LaunchPage() {
  const router = useRouter();
  const { isAuthenticated } = useStore();

  useEffect(() => {
    // Check authentication status after a brief delay
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.push('/main');
      } else {
        router.push('/welcome');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        padding: '32px'
      }}
    >
      <div style={{ animation: 'scaleIn 0.6s ease-out' }}>
        {/* W App Logo */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '128px',
            height: '128px',
            backgroundColor: 'white',
            borderRadius: '50%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            margin: '0 auto 32px'
          }}
        >
          <span 
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            W
          </span>
        </div>
        
        <h1 style={{ 
          fontSize: '48px', 
          fontWeight: 'bold', 
          textAlign: 'center', 
          color: 'white',
          marginBottom: '8px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          The W App
        </h1>
        <p style={{ 
          textAlign: 'center', 
          fontSize: '18px',
          color: 'rgba(255, 255, 255, 0.8)',
          marginBottom: '32px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          Connect at your location
        </p>
        
        {/* Loading indicator */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div 
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          ></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}