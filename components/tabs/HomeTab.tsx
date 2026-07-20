'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Bell, Search, TrendingUp, Users, Heart, Briefcase } from 'lucide-react';
import Image from 'next/image';

export default function HomeTab() {
  const { user, selectedLocation, setActiveTab } = useStore();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const quickActions = [
    {
      id: 'socializing',
      title: 'Socializing',
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      bgGradient: 'from-blue-400 to-blue-600',
    },
    {
      id: 'business',
      title: 'Business',
      icon: Briefcase,
      color: 'bg-green-100 text-green-600',
      bgGradient: 'from-green-400 to-green-600',
    },
    {
      id: 'love',
      title: 'Love',
      icon: Heart,
      color: 'bg-pink-100 text-pink-600',
      bgGradient: 'from-pink-400 to-pink-600',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #17BFD9 0%, #EC2C91 100%)',
        padding: '48px 24px 80px',
        paddingTop: 'max(48px, env(safe-area-inset-top) + 48px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{greeting}</p>
            <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {user?.name?.split(' ')[0] || 'Guest'}
            </h1>
          </div>
          <button style={{
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}>
            <Bell style={{ width: '20px', height: '20px', color: 'white' }} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '20px',
            color: '#919191'
          }} />
          <input
            type="text"
            placeholder="Search locations or people..."
            style={{
              width: '100%',
              paddingLeft: '48px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              backgroundColor: 'white',
              borderRadius: '9999px',
              border: 'none',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
            onFocus={() => setActiveTab('map')}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 24px', marginTop: '-32px' }}>
        {/* Current Location Card */}
        {selectedLocation ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontWeight: '600', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Current Location</h3>
              <button 
                onClick={() => setActiveTab('location')}
                style={{
                  color: '#17BFD9',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                View
              </button>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#17BFD9', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{selectedLocation.name}</p>
            <p style={{ color: '#919191', fontSize: '14px', marginTop: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {selectedLocation.count} {selectedLocation.count === 1 ? 'person' : 'people'} here
            </p>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#D0F2F7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <TrendingUp style={{ width: '32px', height: '32px', color: '#17BFD9' }} />
              </div>
              <h3 style={{ fontWeight: '600', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>No Location Selected</h3>
              <p style={{ color: '#919191', fontSize: '14px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Discover nearby locations and connect with people
              </p>
              <button 
                onClick={() => setActiveTab('map')}
                style={{
                  backgroundColor: '#17BFD9',
                  color: 'white',
                  fontWeight: '600',
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                Explore Map
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>What are you looking for?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s ease'
                  }}
                  onClick={() => setActiveTab('profile')}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: action.id === 'socializing' ? '#DBEAFE' : action.id === 'business' ? '#DCFCE7' : '#FCE7F3',
                    color: action.id === 'socializing' ? '#2563EB' : action.id === 'business' ? '#16A34A' : '#DB2777',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Icon style={{ width: '24px', height: '24px' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{action.title}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Recent Activity</h3>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#F3F3F3',
                borderRadius: '50%'
              }}></div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '500', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Welcome to Wing Me!</p>
                <p style={{ color: '#919191', fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Complete your profile to get started</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ color: '#919191', fontSize: '14px', marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Connections</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#17BFD9', fontFamily: 'Montserrat, system-ui, sans-serif' }}>0</p>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ color: '#919191', fontSize: '14px', marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Locations Visited</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#EC2C91', fontFamily: 'Montserrat, system-ui, sans-serif' }}>0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
