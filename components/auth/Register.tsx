'use client';

import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseAuth } from '@/hooks/useFirebase';
import { uploadTeamLogo } from '@/lib/firebase/auth';
import { validateAdminInvite, useAdminInvite } from '@/lib/firebase/invites';
import { AdminInvite } from '@/types/invite';

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, loading: authLoading } = useFirebaseAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ strength: 0, color: 'red' });
  const [error, setError] = useState<string>('');
  
  // Invite handling
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [invite, setInvite] = useState<AdminInvite | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [isAdminInvite, setIsAdminInvite] = useState(false);

  // Validate invite code on component mount
  useEffect(() => {
    const code = searchParams.get('invite');
    if (code) {
      setInviteCode(code);
      setIsAdminInvite(true); // Set immediately for faster UI update
      validateInviteCode(code);
    }
  }, [searchParams]);
  
  const validateInviteCode = async (code: string) => {
    try {
      setValidatingInvite(true);
      setError('');
      
      const validation = await validateAdminInvite(code);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid invite code');
        setInviteCode(null);
        setIsAdminInvite(false);
        return;
      }
      
      if (validation.invite) {
        setInvite(validation.invite);
        // Already set to true above for instant UI
      }
    } catch (err: any) {
      console.error('Error validating invite:', err);
      setError('Failed to validate invite code');
      setInviteCode(null);
      setIsAdminInvite(false);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Create email from username
    const email = username.includes('@') ? username : `${username}@ssleague.com`;

    try {
      // Determine role and additional data based on invite
      const role = isAdminInvite ? 'committee_admin' : 'team';
      const additionalData = isAdminInvite && invite
        ? {
            seasonId: invite.seasonId,
            seasonName: invite.seasonName,
            seasonYear: invite.seasonYear,
            permissions: ['manage_teams', 'manage_auctions', 'manage_players'],
            canManageTeams: true,
            canManageAuctions: true,
          }
        : {
            teamName,
            players: [],
          };
      
      // Sign up the user
      const { user, firebaseUser } = await signUp(
        email,
        password,
        username,
        role,
        additionalData
      );
      
      // Redirect immediately to role-specific dashboard for better UX
      switch (role) {
        case 'super_admin':
          router.push('/dashboard/superadmin');
          break;
        case 'committee_admin':
          router.push('/dashboard/committee');
          break;
        case 'team':
          router.push('/dashboard/team');
          break;
        default:
          router.push('/dashboard');
      }
      
      // Do background tasks asynchronously (don't block redirect)
      if (firebaseUser) {
        // Mark invite as used (non-blocking)
        if (isAdminInvite && inviteCode) {
          useAdminInvite(inviteCode, firebaseUser.uid, username, email).catch((inviteError) => {
            console.error('Failed to mark invite as used:', inviteError);
          });
        }
        
        // Upload team logo (non-blocking)
        if (!isAdminInvite && teamLogo) {
          uploadTeamLogo(firebaseUser.uid, teamLogo).catch((logoError) => {
            console.error('Logo upload failed:', logoError);
          });
        }
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed. Please try again.');
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword(!showPassword);
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeamLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const calculatePasswordStrength = (pass: string) => {
    let strength = 0;
    
    if (pass.length >= 8) strength += 25;
    if (/[A-Z]/.test(pass)) strength += 25;
    if (/[0-9]/.test(pass)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 25;

    let color = 'red';
    if (strength >= 75) color = 'green';
    else if (strength >= 50) color = 'yellow';

    return { strength, color };
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const pass = e.target.value;
    setPassword(pass);
    if (pass.length > 0) {
      setPasswordStrength(calculatePasswordStrength(pass));
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
      {/* Decorative elements */}
      <div className="absolute top-40 right-0 w-64 h-64 bg-[rgba(0,102,255,0.05)] rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-20 left-0 w-72 h-72 bg-[rgba(149,128,255,0.05)] rounded-full blur-3xl -z-10"></div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="glass p-8 rounded-3xl shadow-lg shadow-[rgba(0,102,255,0.05)] border border-white/20 backdrop-blur-md hover:shadow-xl transition-all duration-300 animate-fade-in">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold gradient-text">
              {isAdminInvite ? 'Join as Committee Admin' : 'Create Account'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAdminInvite && invite 
                ? `You're invited to manage ${invite.seasonName} (${invite.seasonYear})`
                : isAdminInvite && validatingInvite
                ? 'Validating your admin invitation...'
                : 'Join Football Auction and start building your dream team'
              }
            </p>
          </div>
          
          {/* Invite Info Banner - Show immediately for better UX */}
          {isAdminInvite && !error && (
            <div className="mb-6 px-4 py-3 rounded-xl border-l-4 bg-blue-50 border-blue-500 text-blue-800 animate-fade-in" role="alert">
              <div className="flex items-start">
                {validatingInvite ? (
                  <svg className="animate-spin w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {validatingInvite ? 'Validating Invite...' : 'Admin Invite Detected'}
                  </p>
                  {invite && (
                    <p className="text-sm mt-1">
                      You'll be registered as a Committee Admin for <strong>{invite.seasonName} ({invite.seasonYear})</strong>.
                    </p>
                  )}
                  {validatingInvite && !invite && (
                    <p className="text-sm mt-1">
                      Please wait while we verify your invitation code...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Error Alert */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl border-l-4 bg-red-50 border-red-500 text-red-800" role="alert">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-[#0066FF] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                    placeholder="Choose a unique username"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-1">This will be your login name</p>
              </div>
              
              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-[#0066FF] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`pl-10 pr-10 w-full py-3 bg-white/60 border ${
                      password.length > 0 
                        ? passwordStrength.color === 'green' 
                          ? 'border-green-300' 
                          : passwordStrength.color === 'yellow' 
                          ? 'border-yellow-300' 
                          : 'border-red-300'
                        : 'border-gray-200'
                    } rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm`}
                    placeholder="Create a secure password"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-all duration-150"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ transform: 'scale(1)', transition: 'transform 0.15s ease' }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-1">Use at least 8 characters with letters and numbers</p>
              </div>
              
              {/* Team Name Field - Only for team registration */}
              {!isAdminInvite && (
                <>
                  <div>
                    <label htmlFor="team_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Team Name
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-[#0066FF] transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        id="team_name"
                        name="team_name"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                        placeholder="Enter your team name"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">Be creative, this will be your team&apos;s identity</p>
                  </div>
                  
                  {/* Team Logo Upload Section */}
                  <div className="pt-3">
                    <label htmlFor="team_logo" className="block text-sm font-medium text-gray-700 mb-2">
                      Team Logo
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="relative group flex-shrink-0">
                        <div className={`w-24 h-24 rounded-xl bg-gray-100/80 backdrop-blur-sm border-2 ${
                          logoPreview ? 'border-solid border-[#0066FF]' : 'border-dashed border-gray-300'
                        } flex items-center justify-center overflow-hidden transition-all duration-300`}>
                          {logoPreview ? (
                            <div className="relative w-full h-full">
                              <Image 
                                src={logoPreview} 
                                alt="Logo preview" 
                                fill
                                className="object-contain p-2"
                              />
                            </div>
                          ) : (
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <label htmlFor="team_logo" className="w-full flex flex-col items-center px-4 py-3 bg-white/60 text-[#0066FF] rounded-xl border border-gray-200 cursor-pointer hover:bg-[rgba(0,102,255,0.05)] transition-colors duration-300 group relative">
                          <svg className="w-6 h-6 mb-1 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Choose Logo</span>
                          <span className="text-xs text-gray-500 mt-1">PNG, JPG or SVG (Max 2MB)</span>
                          <input 
                            type="file" 
                            id="team_logo" 
                            name="team_logo" 
                            accept="image/*" 
                            className="hidden"
                            onChange={handleLogoChange}
                          />
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-1">Upload a logo to make your team stand out</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Submit Button */}
            <div className="pt-2 mt-8">
              <button
                type="submit"
                disabled={authLoading || validatingInvite}
                className="group relative w-full py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#9580FF] text-white font-medium hover:from-[rgba(0,102,255,0.9)] hover:to-[rgba(149,128,255,0.9)] transition-all duration-300 shadow-lg shadow-[rgba(0,102,255,0.2)] hover:shadow-xl hover:shadow-[rgba(0,102,255,0.3)] vision-button flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>
                  {authLoading 
                    ? 'Creating Account...' 
                    : isAdminInvite 
                    ? 'Join as Admin' 
                    : 'Create Account'
                  }
                </span>
                <span className="absolute right-4 opacity-0 group-hover:opacity-100 group-hover:right-3 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
            
            {/* Terms and Privacy */}
            <div className="pt-4">
              <p className="text-xs text-center text-gray-500">
                By creating an account, you agree to our{' '}
                <Link href="/terms" className="text-[#0066FF] hover:text-[#9580FF] transition-colors">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-[#0066FF] hover:text-[#9580FF] transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </form>
        </div>
        
        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0066FF] font-medium hover:text-[#9580FF] transition-colors inline-flex items-center">
              Sign in
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
