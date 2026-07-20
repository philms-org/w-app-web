'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { MapPin, Users, MessageCircle, Share2, LogOut, User, Heart, Briefcase } from 'lucide-react';
import Image from 'next/image';

export default function LocationTab() {
  const { selectedLocation, setSelectedLocation, setActiveTab } = useStore();
  const [peopleHere, setPeopleHere] = useState<any[]>([]);

  // Mock data for people at location
  const mockPeople = [
    {
      id: '1',
      name: 'Sarah Johnson',
      age: 28,
      image: '',
      bio: 'Coffee enthusiast, loves hiking',
      lookingFor: ['socializing', 'business'],
      distance: '5m away',
    },
    {
      id: '2',
      name: 'Mike Chen',
      age: 32,
      image: '',
      bio: 'Entrepreneur, tech lover',
      lookingFor: ['business', 'socializing'],
      distance: '12m away',
    },
    {
      id: '3',
      name: 'Emma Wilson',
      age: 26,
      image: '',
      bio: 'Designer, foodie, traveler',
      lookingFor: ['socializing', 'love'],
      distance: '8m away',
    },
  ];

  useEffect(() => {
    if (selectedLocation) {
      // Simulate loading people at location
      setPeopleHere(mockPeople);
    }
  }, [selectedLocation]);

  const handleCheckIn = (person: any) => {
    setActiveTab('messages');
    // In real app, this would open a chat with the person
  };

  const handleLeaveLocation = () => {
    setSelectedLocation(null);
    setActiveTab('map');
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
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: '80px',
          textAlign: 'center',
          width: '100%'
        }}>
          <h1 style={{
            color: '#17BFD9',
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            textShadow: '0 0 20px rgba(23, 191, 217, 0.8), 0 0 40px rgba(23, 191, 217, 0.4)',
            marginBottom: '8px'
          }}>
            Locations nearby
          </h1>
        </div>

        {/* Center Content - Perfectly Centered */}
        <div style={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '100%',
          maxWidth: '350px'
        }}>
          {/* Location Pin */}
          <div style={{
            position: 'relative',
            display: 'inline-block',
            marginBottom: '48px'
          }}>
            {/* Pin Glow */}
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
            
            {/* Main Pin */}
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#000000',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #17BFD9',
              boxShadow: '0 0 40px rgba(23, 191, 217, 0.8), inset 0 0 20px rgba(23, 191, 217, 0.2)',
              position: 'relative'
            }}>
              {/* W App logo */}
              <span style={{
                fontSize: '32px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #17BFD9 0%, #EC2C91 100%)',
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

          {/* Message */}
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

        {/* Bottom Button - Fixed Position */}
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
              background: 'linear-gradient(135deg, #17BFD9 0%, #EC2C91 100%)',
              color: 'white',
              fontWeight: '600',
              padding: '16px 32px',
              borderRadius: '16px',
              border: '2px solid #17BFD9',
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
              background: 'linear-gradient(135deg, #EC2C91 0%, #17BFD9 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>➤</span>
            Explore Locations
            
            {/* Button glow effect */}
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
        
        {/* CSS Animations */}
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
      {/* Header */}
      <div className="bg-gradient-w px-6 pt-12 pb-6 safe-top">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-white text-2xl font-bold mb-1">{selectedLocation.name}</h1>
            <p className="text-white/80 text-sm">{selectedLocation.description}</p>
          </div>
          <button
            onClick={handleLeaveLocation}
            className="p-2 bg-white/20 rounded-full backdrop-blur-sm"
          >
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-white/80" />
            <span className="text-white font-medium">
              {selectedLocation.count} {selectedLocation.count === 1 ? 'person' : 'people'} here
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-white/80" />
            <span className="text-white font-medium">{selectedLocation.radius}m radius</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 -mt-3 mb-6">
        <div className="bg-white rounded-xl p-3 shadow-sm flex gap-2">
          <button className="flex-1 py-2 bg-w-light-blue text-w-blue rounded-lg font-medium">
            Share Location
          </button>
          <button className="flex-1 py-2 bg-pink-50 text-w-pink rounded-lg font-medium">
            Invite Friends
          </button>
        </div>
      </div>

      {/* People List */}
      <div className="px-6">
        <h3 className="font-semibold mb-4">People Here Now</h3>
        
        <div className="space-y-3">
          {peopleHere.map((person) => (
            <div key={person.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {/* Profile Image */}
                <div className="w-14 h-14 bg-w-light-gray rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-w-dark-gray" />
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{person.name}</h4>
                    <span className="text-w-dark-gray text-sm">• {person.age}</span>
                  </div>
                  <p className="text-w-dark-gray text-sm mb-2">{person.bio}</p>
                  
                  {/* Looking For Tags */}
                  <div className="flex gap-2 mb-3">
                    {person.lookingFor.includes('socializing') && (
                      <span className="badge-socializing flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Socializing
                      </span>
                    )}
                    {person.lookingFor.includes('business') && (
                      <span className="badge-business flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        Business
                      </span>
                    )}
                    {person.lookingFor.includes('love') && (
                      <span className="badge-love flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        Love
                      </span>
                    )}
                  </div>
                  
                  {/* Distance & Action */}
                  <div className="flex items-center justify-between">
                    <span className="text-w-dark-gray text-sm">{person.distance}</span>
                    <button
                      onClick={() => handleCheckIn(person)}
                      className="bg-w-blue text-white px-4 py-1.5 rounded-full text-sm font-medium
                                hover:opacity-90 active:scale-95 transition-all"
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
          <div className="bg-white rounded-xl p-6 text-center">
            <Users className="w-12 h-12 text-w-light-gray mx-auto mb-3" />
            <p className="text-w-dark-gray">No one else is here yet</p>
            <p className="text-w-dark-gray text-sm mt-1">Be the first to check in!</p>
          </div>
        )}
      </div>
    </div>
  );
}
