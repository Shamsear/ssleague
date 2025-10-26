'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';

export default function EditTeamProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState('');
  const [fileName, setFileName] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal system
  const { alertState, showAlert, closeAlert } = useModal();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Password validation state
  const [passwordLengthValid, setPasswordLengthValid] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!user) return;

      try {
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

        setUsername(user.username || '');
        
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('team_id', '==', user.uid),
          where('status', '==', 'registered'),
          limit(1)
        );
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

        if (!teamSeasonsSnapshot.empty) {
          const teamSeasonData = teamSeasonsSnapshot.docs[0].data();
          setTeamName(teamSeasonData.team_name || (user as any).teamName || '');
          setCurrentLogoUrl(teamSeasonData.team_logo || (user as any).logoUrl || '');
        } else {
          setTeamName((user as any).teamName || '');
          setCurrentLogoUrl((user as any).logoUrl || '');
        }
      } catch (error) {
        console.error('Error fetching team data:', error);
        setUsername(user.username || '');
        setTeamName((user as any).teamName || '');
        setCurrentLogoUrl((user as any).logoUrl || '');
      }
    };

    fetchTeamData();
  }, [user]);

  // Password validation
  useEffect(() => {
    if (newPassword) {
      setPasswordLengthValid(newPassword.length >= 6);
    } else {
      setPasswordLengthValid(false);
    }
  }, [newPassword]);

  useEffect(() => {
    if (newPassword || confirmPassword) {
      setPasswordsMatch(newPassword === confirmPassword);
    } else {
      setPasswordsMatch(true);
    }
  }, [newPassword, confirmPassword]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName('');
      setNewLogoPreview('');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert({
        type: 'warning',
        title: 'File Too Large',
        message: 'File size must be less than 5MB'
      });
      e.target.value = '';
      return;
    }

    setFileName(file.name);
    setNewLogoFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewLogoPreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword) {
      setError('Current password is required to make changes');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (teamName.length < 3) {
      setError('Team name must be at least 3 characters long');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters long');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Reauthenticate user
      const { auth } = await import('@/lib/firebase/config');
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword: firebaseUpdatePassword } = await import('firebase/auth');
      
      const credential = EmailAuthProvider.credential(
        user!.email!,
        currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser!, credential);

      // Upload logo if changed
      let logoUrl = currentLogoUrl;
      let logoFileId = '';
      
      if (newLogoFile) {
        // Upload to ImageKit
        const { uploadImage } = await import('@/lib/imagekit/upload');
        
        const timestamp = Date.now();
        const fileName = `${user?.uid}_${timestamp}_${newLogoFile.name}`;
        
        const result = await uploadImage({
          file: newLogoFile,
          fileName,
          folder: '/team-logos',
          tags: ['team', 'logo', user?.uid || ''],
          useUniqueFileName: true,
        });
        
        logoUrl = result.url;
        logoFileId = result.fileId;
      }

      // Update Firestore
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');

      const userDocRef = doc(db, 'users', user!.uid);
      await updateDoc(userDocRef, {
        username: username.trim(),
        teamName: teamName.trim(),
        logoUrl: logoUrl,
      });

      const teamSeasonsQuery = query(
        collection(db, 'team_seasons'),
        where('team_id', '==', user!.uid)
      );
      const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

      const updatePromises = teamSeasonsSnapshot.docs.map(async (teamSeasonDoc) => {
        const teamSeasonRef = doc(db, 'team_seasons', teamSeasonDoc.id);
        const updateData: any = {
          team_name: teamName.trim(),
          team_logo: logoUrl,
        };
        
        // Add fileId if new logo was uploaded
        if (logoFileId) {
          updateData.team_logo_file_id = logoFileId;
        }
        
        return updateDoc(teamSeasonRef, updateData);
      });

      await Promise.all(updatePromises);

      // Update password if provided
      if (newPassword) {
        await firebaseUpdatePassword(auth.currentUser!, newPassword);
        setSuccess('Profile updated successfully! You will be logged out to sign in with your new password.');
        
        // Sign out user after password change
        setTimeout(async () => {
          const { signOut } = await import('firebase/auth');
          await signOut(auth);
          router.push('/login');
        }, 3000);
      } else {
        setSuccess('Profile updated successfully!');
        setTimeout(() => {
          router.push('/dashboard/team/profile');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === 'auth/wrong-password') {
        setError('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        setError('New password is too weak');
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 hidden sm:block">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-primary-dark rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-dark mb-2">Edit Profile</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Manage your account information and team settings. All changes require your current password for security.</p>
        </div>

        {/* Flash Messages */}
        {error && (
          <div className="mb-6 glass rounded-2xl p-4 border-l-4 border-red-500 bg-red-50/80 backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
              </svg>
              <div className="text-red-800">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 glass rounded-2xl p-4 border-l-4 border-green-500 bg-green-50/80 backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <div className="text-green-800">
                <p className="font-medium">Success</p>
                <p className="text-sm">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Security Verification */}
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">Security Verification</h2>
                <p className="text-gray-600 text-sm">Confirm your identity to make changes</p>
              </div>
            </div>
            
            <div className="relative">
              <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <input 
                  type={showCurrentPassword ? "text" : "password"}
                  id="current_password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-gray-400"
                  placeholder="Enter your current password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showCurrentPassword ? (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-1.414-1.414m4.242 4.242L16.95 16.95M16.95 16.95l1.414 1.414M16.95 16.95l-1.414 1.414" />
                      </>
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">Required to authenticate any profile changes</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Account Information */}
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark">Account Information</h2>
                  <p className="text-gray-600 text-sm">Update your account details</p>
                </div>
              </div>

              {/* Username */}
              <div className="mb-6">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    id="username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-gray-400"
                    placeholder={user.username || 'Enter username'}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">Leave unchanged to keep your current username</p>
              </div>

              {/* Password Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Change Password
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input 
                        type={showNewPassword ? "text" : "password"}
                        id="new_password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-gray-400"
                        placeholder="Enter new password (optional)"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {showNewPassword ? (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-1.414-1.414m4.242 4.242L16.95 16.95M16.95 16.95l1.414 1.414M16.95 16.95l-1.414 1.414" />
                            </>
                          ) : (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center text-xs text-gray-500 space-x-4">
                        <span className={`flex items-center ${newPassword ? (passwordLengthValid ? 'text-green-600' : 'text-red-600') : ''}`}>
                          <svg className={`w-3 h-3 mr-1 ${newPassword ? (passwordLengthValid ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                          </svg>
                          At least 6 characters
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirm_password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-gray-400"
                        placeholder="Confirm new password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {showConfirmPassword ? (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-1.414-1.414m4.242 4.242L16.95 16.95M16.95 16.95l1.414 1.414M16.95 16.95l-1.414 1.414" />
                            </>
                          ) : (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                    <p className={`text-xs mt-1 ${(newPassword || confirmPassword) ? (passwordsMatch ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
                      {(newPassword || confirmPassword) ? (passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match') : 'Passwords must match'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Information */}
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark">Team Information</h2>
                  <p className="text-gray-600 text-sm">Manage your team settings</p>
                </div>
              </div>

              {/* Team Name */}
              <div className="mb-6">
                <label htmlFor="team_name" className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    id="team_name" 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-gray-400"
                    placeholder={user.teamName || 'Enter team name'}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">Leave unchanged to keep your current team name</p>
              </div>

              {/* Team Logo */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Logo</label>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Current Logo:</p>
                  <div className="flex items-center gap-4">
                    {currentLogoUrl ? (
                      <img 
                        src={currentLogoUrl} 
                        alt="Current team logo" 
                        className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center">
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    )}
                    
                    {newLogoPreview && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">New Logo:</p>
                        <img src={newLogoPreview} alt="New logo preview" className="w-24 h-24 rounded-xl object-cover border-2 border-primary" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input 
                    type="file" 
                    id="team_logo" 
                    accept="image/png,image/jpg,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <label 
                    htmlFor="team_logo" 
                    className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Choose New Logo
                  </label>
                  <span className="ml-3 text-sm text-gray-600">{fileName}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">Accepted formats: PNG, JPG, JPEG, GIF, WEBP. Max size: 5MB</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard" 
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Cancel
                </Link>
                <Link 
                  href="/dashboard/team/profile" 
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  View Profile
                </Link>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {isSubmitting ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </div>
        </form>

        {/* Security Notice */}
        <div className="glass rounded-3xl p-6 sm:p-8 border-l-4 border-blue-500">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Security & Privacy</h3>
              <div className="text-blue-800 space-y-2 text-sm">
                <p><strong>🔒 Password Security:</strong> If you change your password, you'll be automatically logged out and need to sign in again with your new password.</p>
                <p><strong>🛡️ Authentication:</strong> Your current password is required to make any profile changes for security.</p>
                <p><strong>📸 Logo Storage:</strong> Team logos are stored securely in Firebase Storage and optimized for performance.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Component */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  );
}
