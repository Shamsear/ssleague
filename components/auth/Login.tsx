'use client';

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirebaseAuth } from '@/hooks/useFirebase';
import { useAuth } from '@/contexts/AuthContext';

interface AlertMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
}

export default function Login() {
  const router = useRouter();
  const { user, loading: userLoading } = useAuth();
  const { signIn, loading: authLoading } = useFirebaseAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  // Redirect if user is already logged in to their role-specific dashboard
  useEffect(() => {
    if (!userLoading && user) {
      switch (user.role) {
        case 'super_admin':
          router.replace('/dashboard/superadmin');
          break;
        case 'committee_admin':
          router.replace('/dashboard/committee');
          break;
        case 'team':
          router.replace('/dashboard/team');
          break;
        default:
          router.replace('/dashboard');
      }
    }
  }, [user, userLoading, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAlerts([]);

    try {
      // Trim inputs to avoid whitespace issues
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();

      if (!trimmedUsername || !trimmedPassword) {
        setAlerts([{ 
          type: 'error', 
          message: 'Username and password are required.' 
        }]);
        return;
      }

      // Username-only login - look up email from username using API
      const lookupResponse = await fetch('/api/auth/username-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername }),
      });

      const lookupData = await lookupResponse.json();

      if (!lookupData.success || !lookupData.email) {
        setAlerts([{ 
          type: 'error', 
          message: 'Username not found. Please check your username.' 
        }]);
        return;
      }

      // Sign in with email
      const { user } = await signIn(lookupData.email, trimmedPassword);
      
      // Use router.replace for faster navigation (no page reload)
      // Redirect to role-specific dashboard
      if (user) {
        switch (user.role) {
          case 'super_admin':
            router.replace('/dashboard/superadmin');
            break;
          case 'committee_admin':
            router.replace('/dashboard/committee');
            break;
          case 'team':
            router.replace('/dashboard/team');
            break;
          default:
            router.replace('/dashboard');
        }
      } else {
        router.replace('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message?.includes('auth/invalid-credential')) {
        errorMessage = 'Invalid username or password.';
      } else if (error.message?.includes('auth/user-not-found')) {
        errorMessage = 'User not found. Please register first.';
      } else if (error.message?.includes('auth/wrong-password')) {
        errorMessage = 'Incorrect password.';
      } else if (error.message?.includes('auth/too-many-requests')) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      setAlerts([{ type: 'error', message: errorMessage }]);
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword(!showPassword);
  };

  const getAlertIcon = (type: string) => {
    if (type === 'error' || type === 'warning') {
      return (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      );
    }
    return (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    );
  };

  const getAlertClasses = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-500 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-500 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-500 text-blue-800';
    }
  };

  const getAlertIconColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  // Show loading while checking authentication
  if (userLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
      {/* Decorative elements */}
      <div className="absolute top-40 left-0 w-64 h-64 bg-[rgba(0,102,255,0.05)] rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-20 right-0 w-72 h-72 bg-[rgba(149,128,255,0.05)] rounded-full blur-3xl -z-10"></div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="glass p-8 rounded-3xl shadow-lg shadow-[rgba(0,102,255,0.05)] border border-white/20 backdrop-blur-md hover:shadow-xl transition-all duration-300 animate-fade-in">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold gradient-text">Welcome Back</h1>
            <p className="text-gray-600 mt-2">Sign in to your Football Auction account</p>
          </div>
          
          {/* Flash Messages Display */}
          {alerts.length > 0 && (
            <div className="space-y-4 mb-6">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`px-4 py-3 rounded-xl border-l-4 ${getAlertClasses(alert.type)}`}
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-start">
                    <svg
                      className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${getAlertIconColor(alert.type)}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {getAlertIcon(alert.type)}
                    </svg>
                    <div className="flex-1">
                      <p className="font-medium">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* Anti cache token */}
            <input type="hidden" name="timestamp" value={Date.now()} />
            
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
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                    placeholder="Enter your username"
                  />
                </div>
              </div>
              
              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link href="/reset-password-request" className="text-xs text-[#0066FF] hover:text-[#9580FF] transition-colors">
                    Forgot password?
                  </Link>
                </div>
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
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                    placeholder="Enter your password"
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
              </div>
              
              {/* Remember me checkbox */}
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-5 w-5 text-[#0066FF] focus:ring-[rgba(0,102,255,0.5)] border-gray-300 rounded transition-all cursor-pointer"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  Remember me for 30 days
                </label>
              </div>
            </div>
            
            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={authLoading}
                className="group relative w-full py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#9580FF] text-white font-medium hover:from-[rgba(0,102,255,0.9)] hover:to-[rgba(149,128,255,0.9)] transition-all duration-300 shadow-lg shadow-[rgba(0,102,255,0.2)] hover:shadow-xl hover:shadow-[rgba(0,102,255,0.3)] vision-button flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>{authLoading ? 'Signing In...' : 'Sign In'}</span>
                <span className="absolute right-4 opacity-0 group-hover:opacity-100 group-hover:right-3 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
            
            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative z-10 px-4 bg-transparent">
                <span className="text-sm text-gray-500">or</span>
              </div>
            </div>
            
            {/* Create Account Button */}
            <div className="flex items-center justify-center">
              <Link
                href="/register"
                className="w-full text-center py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-white/80 transition-all duration-200 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Create New Account
              </Link>
            </div>
          </form>
        </div>
        
        {/* Support Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Having trouble logging in?{' '}
            <Link href="/support" className="text-[#0066FF] font-medium hover:text-[#9580FF] transition-colors">
              Contact Support
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
        
        .group:focus-within .scale-\\[1\\.02\\] {
          transform: scale(1.02);
          transition: transform 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
