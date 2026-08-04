'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { upsertProfile } from '@/lib/data';
import { ChevronLeft, Users, Briefcase, Heart } from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, setUser } = useStore();

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    datingId: '0',
    socialisingId: '0',
    networkingId: '0',
    nationality: '',
    city: '',
    drink: '',
    activity: '',
    profession: '',
  });

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setIsLoading(true);

    try {
      await upsertProfile({
        id: user.id,
        display_name: user.name,
        dating_id: formData.datingId ? parseInt(formData.datingId, 10) : null,
        socialising_id: formData.socialisingId ? parseInt(formData.socialisingId, 10) : null,
        networking_id: formData.networkingId ? parseInt(formData.networkingId, 10) : null,
        nationality: formData.nationality || null,
        city: formData.city || null,
        fave_drink: formData.drink || null,
        friday_night: formData.activity || null,
        profession: formData.profession || null,
      });

      setUser({
        ...user,
        ...formData,
        setupComplete: true,
      });
      router.push('/main');
    } catch (err) {
      console.error('Profile save failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Looking For (like ThirdSetupVC)
  const renderStep3 = () => (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#231E20',
      padding: '24px'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>What are you looking for?</h2>
      <p style={{
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '32px',
        fontSize: '16px',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Choose what type of connections you want</p>

      {/* Socializing */}
      <div style={{ marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users style={{ width: '24px', height: '24px', color: '#17BFD9' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Socializing
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {LOOKING_FOR_OPTIONS.socializing.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setFormData(prev => ({ ...prev, socialisingId: option.id.toString() }))}
              style={{
                padding: '12px',
                borderRadius: '12px',
                border: `2px solid ${formData.socialisingId === option.id.toString() ? '#17BFD9' : '#444'}`,
                backgroundColor: formData.socialisingId === option.id.toString() ? '#17BFD9' : 'transparent',
                color: formData.socialisingId === option.id.toString() ? 'white' : 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Business */}
      <div style={{ marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Briefcase style={{ width: '24px', height: '24px', color: '#EC2C91' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Business
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {LOOKING_FOR_OPTIONS.business.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setFormData(prev => ({ ...prev, networkingId: option.id.toString() }))}
              style={{
                padding: '12px',
                borderRadius: '12px',
                border: `2px solid ${formData.networkingId === option.id.toString() ? '#EC2C91' : '#444'}`,
                backgroundColor: formData.networkingId === option.id.toString() ? '#EC2C91' : 'transparent',
                color: formData.networkingId === option.id.toString() ? 'white' : 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Love */}
      <div style={{ marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Heart style={{ width: '24px', height: '24px', color: '#F59E0B' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Love is always in the air — let people know where you stand
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {LOOKING_FOR_OPTIONS.love.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setFormData(prev => ({ ...prev, datingId: option.id.toString() }))}
              style={{
                padding: '12px',
                borderRadius: '12px',
                border: `2px solid ${formData.datingId === option.id.toString() ? '#F59E0B' : '#444'}`,
                backgroundColor: formData.datingId === option.id.toString() ? '#F59E0B' : 'transparent',
                color: formData.datingId === option.id.toString() ? 'white' : 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 4: Personal Details
  const renderStep4 = () => (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#231E20',
      padding: '24px'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>About You</h2>
      <p style={{
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '32px',
        fontSize: '16px',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Tell us more about yourself</p>

      <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Nationality */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'white',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Nationality</label>
          <input
            type="text"
            value={formData.nationality}
            onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '12px',
              fontSize: '16px',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
            placeholder="Your nationality"
          />
        </div>

        {/* Profession */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'white',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Profession</label>
          <input
            type="text"
            value={formData.profession}
            onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '12px',
              fontSize: '16px',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
            placeholder="What do you do for work?"
          />
        </div>
      </div>
    </div>
  );

  // Step 5: Final Details (like FifthSetupVC)
  const renderStep5 = () => (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#231E20',
      padding: '24px'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Final Details</h2>
      <p style={{
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '32px',
        fontSize: '16px',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Almost done! Just a few more details</p>

      <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* City */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'white',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '12px',
              fontSize: '16px',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
            placeholder="Your city"
          />
        </div>

        {/* Drink */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'white',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Do you drink?</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Yes', 'No', 'Sometimes'].map((option) => (
              <button
                key={option}
                onClick={() => setFormData(prev => ({ ...prev, drink: option }))}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${formData.drink === option ? '#17BFD9' : '#444'}`,
                  backgroundColor: formData.drink === option ? '#17BFD9' : 'transparent',
                  color: formData.drink === option ? 'white' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'white',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Friday Activity</label>
          <input
            type="text"
            value={formData.activity}
            onChange={(e) => setFormData(prev => ({ ...prev, activity: e.target.value }))}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '12px',
              fontSize: '16px',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
            placeholder="What do you like to do on Fridays?"
          />
        </div>
      </div>
    </div>
  );

  // Use the already defined functions above

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#231E20' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#231E20',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #444'
      }}>
        <button
          onClick={handleBack}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: '#17BFD9' }} />
        </button>
        <h1 style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: '600',
          color: 'white',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Setup Profile</h1>
        <div style={{ width: '40px' }} />
      </div>

      {/* Content */}
      <div>
        {renderStep3()}
      </div>

      {/* Bottom Button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#231E20',
        borderTop: '1px solid #444',
        padding: '16px 24px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
      }}>
        <button
          onClick={handleSave}
          disabled={isLoading}
          style={{
            width: '100%',
            backgroundColor: '#17BFD9',
            color: 'white',
            fontWeight: '600',
            padding: '16px 24px',
            borderRadius: '12px',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            fontSize: '18px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isLoading ? (
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          ) : (
            'Complete Setup'
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}