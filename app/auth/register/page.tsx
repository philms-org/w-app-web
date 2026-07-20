'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { signUp } from '@/lib/auth';
import { upsertProfile, uploadAvatar } from '@/lib/data';
import { Eye, EyeOff, ChevronLeft, Camera, Calendar, ChevronDown } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    gender: '',
    birthDate: '',
  });
  
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('+1');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.phone || 
        !formData.password || !formData.confirmPassword || 
        !formData.gender || !formData.birthDate) {
      setError('Please fill in all fields');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { user: authUser, session } = await signUp(formData.email, formData.password);
      if (!authUser) {
        setError('Registration failed');
        return;
      }

      let avatarUrl: string | undefined;
      if (profileImage) {
        try {
          avatarUrl = await uploadAvatar(profileImage, authUser.id);
        } catch {
          avatarUrl = undefined;
        }
      }

      await upsertProfile({
        id: authUser.id,
        display_name: formData.name,
        email: formData.email,
        phone: countryCode + formData.phone,
        avatar_url: avatarUrl ?? null,
      });

      if (session) {
        setToken(session.access_token);
      }
      setUser({
        id: authUser.id,
        name: formData.name,
        email: formData.email,
        phone: countryCode + formData.phone,
        gender: formData.gender,
        birth: formData.birthDate,
        image: avatarUrl,
        setupComplete: false,
      });

      router.push('/profile/setup');
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: '1px solid #F3F3F3',
        backgroundColor: 'white'
      }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: '#231E20' }} />
        </button>
        <h1 style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: '600',
          color: '#231E20',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Create Account</h1>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px', paddingBottom: '80px' }}>
        {/* Profile Image */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{
              width: '112px',
              height: '112px',
              backgroundColor: '#F3F3F3',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera style={{ width: '32px', height: '32px', color: '#919191' }} />
              )}
            </div>
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '32px',
              height: '32px',
              backgroundColor: '#17BFD9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>+</span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'white',
                border: '1px solid #D5D5D5',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your full name"
            />
          </div>

          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'white',
                border: '1px solid #D5D5D5',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Phone Number</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{
                  width: '96px',
                  padding: '12px 8px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+91">+91</option>
                <option value="+86">+86</option>
                <option value="+81">+81</option>
              </select>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
                placeholder="Phone number"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Gender</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: 'M' }))}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${formData.gender === 'M' ? '#17BFD9' : '#D5D5D5'}`,
                  backgroundColor: formData.gender === 'M' ? '#D0F2F7' : 'white',
                  color: formData.gender === 'M' ? '#17BFD9' : '#231E20',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: 'F' }))}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${formData.gender === 'F' ? '#EC2C91' : '#D5D5D5'}`,
                  backgroundColor: formData.gender === 'F' ? '#FCE7F3' : 'white',
                  color: formData.gender === 'F' ? '#EC2C91' : '#231E20',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Female
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: 'O' }))}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${formData.gender === 'O' ? '#009193' : '#D5D5D5'}`,
                  backgroundColor: formData.gender === 'O' ? '#ECFDF5' : 'white',
                  color: formData.gender === 'O' ? '#009193' : '#231E20',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Other
              </button>
            </div>
          </div>

          {/* Birth Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Date of Birth</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
                max={new Date().toISOString().split('T')[0]}
              />
              <Calendar style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                color: '#919191',
                pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
                placeholder="Create a password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#919191'
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '20px', height: '20px' }} />
                ) : (
                  <Eye style={{ width: '20px', height: '20px' }} />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#919191'
                }}
              >
                {showConfirmPassword ? (
                  <EyeOff style={{ width: '20px', height: '20px' }} />
                ) : (
                  <Eye style={{ width: '20px', height: '20px' }} />
                )}
              </button>
            </div>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#17BFD9',
              color: 'white',
              fontWeight: '600',
              padding: '12px 24px',
              borderRadius: '9999px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontSize: '16px',
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
              'Create Account'
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          color: '#919191',
          fontSize: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{
            color: '#17BFD9',
            fontWeight: '600',
            textDecoration: 'none'
          }}>
            Sign In
          </Link>
        </p>
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
