'use client';

import { useState, FormEvent, ChangeEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { changePassword } from '@/lib/firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/user';
import { validateResetToken, completeResetRequest } from '@/lib/firebase/passwordResetRequests';
import { PasswordResetRequest } from '@/types/passwordResetRequest';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { firebaseUser, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [validatingToken, setValidatingToken] = useState(!!token);
  const [resetRequest, setResetRequest] = useState<PasswordResetRequest | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    strength: 0,
    text: 'Weak',
    color: 'red',
    feedback: [] as string[]
  });

  // Validate reset token if present
  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setValidatingToken(false);
        return;
      }

      try {
        // Call API to validate token
        const response = await fetch('/api/auth/validate-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok || !data.valid) {
          setError(data.error || 'Invalid or expired reset link. Please request a new password reset.');
          setValidatingToken(false);
          return;
        }

        // Set request data from API response
        setResetRequest(data.request as any);
        setValidatingToken(false);
      } catch (error) {
        console.error('Error validating token:', error);
        setError('Failed to validate reset link.');
        setValidatingToken(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    if (newPassword !== confirmPassword) {
      setPasswordsMatch(false);
      setError('Passwords do not match');
      return;
    }

    // Check if using token-based reset or logged-in reset
    if (token && resetRequest) {
      // Token-based reset (approved by admin)
      if (!resetRequest) {
        setError('Invalid reset request. Please try again.');
        return;
      }

      setIsLoading(true);

      try {
        // Call API to reset password using admin-approved token
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: token,
            newPassword: newPassword,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to reset password');
        }

        setSuccess(true);
        
        alert('Password reset successful! You can now log in with your new password.');
        
        // Redirect to login page
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } catch (error: any) {
        console.error('Password reset failed:', error);
        setError(error.message || 'Failed to reset password. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (firebaseUser) {
      // Logged-in user changing their own password
      setIsLoading(true);

      try {
        await changePassword(newPassword);
        setSuccess(true);
        
        // Redirect to role-specific dashboard after a short delay
        setTimeout(() => {
          if (user) {
            switch (user.role) {
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
          } else {
            router.push('/dashboard');
          }
        }, 2000);
      } catch (error: any) {
        console.error('Password reset failed:', error);
        setError(error.message || 'Failed to reset password. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('You must be logged in or have a valid reset link to change your password');
      return;
    }
  };

  const calculatePasswordStrength = (pass: string) => {
    let strength = 0;
    const feedback: string[] = [];
    
    if (pass.length >= 8) {
      strength += 25;
    } else {
      feedback.push('Use at least 8 characters');
    }
    
    if (/[A-Z]/.test(pass)) {
      strength += 25;
    } else {
      feedback.push('Add uppercase letters');
    }
    
    if (/[0-9]/.test(pass)) {
      strength += 25;
    } else {
      feedback.push('Add numbers');
    }
    
    if (/[^A-Za-z0-9]/.test(pass)) {
      strength += 25;
    } else {
      feedback.push('Add special characters');
    }

    let text = 'Weak';
    let color = 'red';
    
    if (strength >= 75) {
      text = 'Strong';
      color = 'green';
    } else if (strength >= 50) {
      text = 'Medium';
      color = 'yellow';
    }

    return { strength, text, color, feedback };
  };

  const handleNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const pass = e.target.value;
    setNewPassword(pass);
    
    if (pass.length > 0) {
      setPasswordStrength(calculatePasswordStrength(pass));
    }

    // Check if passwords match
    if (confirmPassword.length > 0) {
      setPasswordsMatch(pass === confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const pass = e.target.value;
    setConfirmPassword(pass);
    
    if (pass.length > 0) {
      setPasswordsMatch(newPassword === pass);
    } else {
      setPasswordsMatch(null);
    }
  };

  const toggleNewPasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowNewPassword(!showNewPassword);
  };

  const toggleConfirmPasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Show loading while validating token
  if (validatingToken) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating reset link...</p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (token && !resetRequest && error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
        <div className="max-w-md w-full">
          <div className="glass p-8 rounded-3xl shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Reset Link</h3>
              <p className="text-sm text-gray-600 mb-6">{error}</p>
              <Link
                href="/reset-password-request"
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
      {/* Decorative elements */}
      <div className="absolute top-40 left-0 w-64 h-64 bg-[rgba(0,102,255,0.05)] rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-20 right-0 w-72 h-72 bg-[rgba(149,128,255,0.05)] rounded-full blur-3xl -z-10"></div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="glass p-8 rounded-3xl shadow-lg shadow-[rgba(0,102,255,0.05)] border border-white/20 backdrop-blur-md hover:shadow-xl transition-all duration-300 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-blue-50 rounded-full mb-4">
              <svg className="w-8 h-8 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold gradient-text">Set New Password</h1>
            <p className="text-gray-600 mt-2">Your password reset request has been approved</p>
          </div>
          
          {/* Success Alert */}
          {success && (
            <div className="mb-6 px-4 py-3 rounded-xl border-l-4 bg-green-50 border-green-500 text-green-800" role="alert">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium">Password reset successful! Redirecting to dashboard...</p>
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
          
          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 shadow-sm">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium mb-1">Important Information</p>
                <p className="text-sm leading-relaxed">Please choose a strong password that is at least 8 characters long.</p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password Field */}
            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-[#0066FF] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="new_password"
                  name="new_password"
                  required
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  className="pl-10 pr-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={toggleNewPasswordVisibility}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-all duration-150"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  style={{ transform: 'scale(1)', transition: 'transform 0.15s ease' }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {showNewPassword ? (
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
              
              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center mb-1">
                    <span className="text-xs mr-2">Password strength:</span>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          passwordStrength.color === 'green' ? 'bg-green-400' :
                          passwordStrength.color === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${passwordStrength.strength}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs ml-2 font-medium ${
                      passwordStrength.color === 'green' ? 'text-green-500' :
                      passwordStrength.color === 'yellow' ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {passwordStrength.feedback.length > 0 
                      ? passwordStrength.feedback.join(' • ') 
                      : 'Great password!'}
                  </p>
                </div>
              )}
            </div>
            
            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-[#0066FF] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm_password"
                  name="confirm_password"
                  required
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  className="pl-10 pr-10 w-full py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[rgba(0,102,255,0.3)] focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-all duration-150"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  style={{ transform: 'scale(1)', transition: 'transform 0.15s ease' }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {showConfirmPassword ? (
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
              
              {/* Password Match Indicator */}
              {passwordsMatch !== null && confirmPassword.length > 0 && (
                <div className="mt-1">
                  <span className={`text-xs ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Submit Button */}
            <div className="pt-2 mt-6">
              <button
                type="submit"
                disabled={isLoading || passwordsMatch === false}
                className="group relative w-full py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#9580FF] text-white font-medium hover:from-[rgba(0,102,255,0.9)] hover:to-[rgba(149,128,255,0.9)] transition-all duration-300 shadow-lg shadow-[rgba(0,102,255,0.2)] hover:shadow-xl hover:shadow-[rgba(0,102,255,0.3)] vision-button flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>{isLoading ? 'Resetting Password...' : 'Reset Password'}</span>
                <span className="absolute right-4 opacity-0 group-hover:opacity-100 group-hover:right-3 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
          </form>
          
          {/* Return to Login Link */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link href="/login" className="inline-flex items-center text-sm text-[#0066FF] hover:text-[#9580FF] transition-colors">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Return to login page
            </Link>
          </div>
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
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
