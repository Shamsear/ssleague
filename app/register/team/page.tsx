'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface Season {
  id: string;
  name: string;
  short_name?: string;
  is_active: boolean;
  status: string;
  starting_balance?: number;
}

function SeasonRegistrationContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const seasonId = searchParams?.get('season');
  const [season, setSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<'none' | 'registered' | 'declined'>('none');
  
  // Phase 1: New state for registration form
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [joinFantasy, setJoinFantasy] = useState(false);
  
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'team') {
      // Redirect non-team users to their role-specific dashboard
      switch (user.role) {
        case 'super_admin':
          router.push('/dashboard/superadmin');
          break;
        case 'committee_admin':
          router.push('/dashboard/committee');
          break;
        default:
          router.push('/dashboard');
      }
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchSeasonAndStatus = async () => {
      if (!seasonId || !user) return;

      if (!seasonId) {
        showAlert({
          type: 'error',
          title: 'Invalid Link',
          message: 'No season ID provided in the link'
        });
        router.push('/dashboard/team');
        return;
      }

      try {
        // Fetch season data
        const response = await fetch(`/api/seasons/${seasonId}`);
        const { success, data } = await response.json();

        if (success) {
          setSeason(data);

          // Check registration status
          const { db } = await import('@/lib/firebase/config');
          const { doc, getDoc } = await import('firebase/firestore');
          
          const teamSeasonId = `${user.uid}_${seasonId}`;
          try {
            const existingDoc = await getDoc(doc(db, 'team_seasons', teamSeasonId));
            if (existingDoc.exists()) {
              const docData = existingDoc.data();
              setRegistrationStatus(docData.status === 'registered' ? 'registered' : 'declined');
            }
          } catch (err) {
            // No existing registration
            setRegistrationStatus('none');
          }
        } else {
          showAlert({
            type: 'error',
            title: 'Invalid Season',
            message: 'Season not found or link is invalid'
          });
          router.push('/dashboard/team');
        }
      } catch (err) {
        console.error('Error fetching season:', err);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load season information'
        });
        router.push('/dashboard/team');
      } finally {
        setIsLoading(false);
      }
    };

    if (user && seasonId) {
      fetchSeasonAndStatus();
    }
  }, [seasonId, router, user]);

  const handleDecision = async (action: 'join' | 'decline') => {
    if (!season || isSubmitting || !user) return;

    // Phase 1: Show form for joining (to collect manager name and fantasy opt-in)
    if (action === 'join') {
      setShowRegistrationForm(true);
      return;
    }

    // For decline, show confirmation directly
    const confirmMessage = `Are you sure you want to skip ${season.name}?`;

    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Skip Season',
      message: confirmMessage,
      confirmText: 'Skip',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      // Use API endpoint for decline
      const response = await fetch(`/api/seasons/${seasonId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'decline',
          userId: user.uid,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Decline failed');
      }

      showAlert({
        type: 'success',
        title: 'Season Skipped',
        message: `You have declined ${season.name}. You can join future seasons.`
      });
      setTimeout(() => router.push('/dashboard/team'), 1500);
    } catch (err) {
      console.error('Error processing decision:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An error occurred. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistrationSubmit = async () => {
    if (!season || isSubmitting || !user) return;

    // Validation: Manager name is optional, but let's trim it
    const trimmedManagerName = managerName.trim();

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/seasons/${seasonId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          userId: user.uid,
          managerName: trimmedManagerName || undefined,
          joinFantasy: joinFantasy,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Registration failed');
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: `Successfully joined ${season.name}!${joinFantasy ? ' You\'re also registered for Fantasy League!' : ''}`
      });
      setTimeout(() => router.push('/dashboard/team'), 1500);
    } catch (err) {
      console.error('Error processing registration:', err);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An error occurred. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team' || !season) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center px-4 py-2 rounded-2xl text-gray-700 glass backdrop-blur-md border border-white/20 hover:shadow-lg transition-all duration-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0066FF] via-blue-500 to-[#0066FF] bg-clip-text text-transparent mb-4">
            Season Invitation
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            You've been invited to participate in {season.name}. Choose whether you'd like to join this season.
          </p>
        </div>

        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{season.name}</h2>
                {season.short_name && (
                  <p className="text-lg text-gray-600">{season.short_name}</p>
                )}
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  season.is_active
                    ? 'bg-green-100 text-green-800'
                    : season.status === 'upcoming'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {season.is_active ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                      Active Season
                    </>
                  ) : season.status === 'upcoming' ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Upcoming Season
                    </>
                  ) : (
                    season.status
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="glass rounded-2xl p-6 border border-white/10">
                <dt className="text-sm font-semibold text-gray-600 mb-2">Your Team</dt>
                <dd className="text-xl font-bold text-gray-900">{user.teamName || 'My Team'}</dd>
              </div>
              <div className="glass rounded-2xl p-6 border border-white/10">
                <dt className="text-sm font-semibold text-gray-600 mb-2">Season Status</dt>
                <dd className="text-xl font-bold text-gray-900">{season.is_active ? 'Active' : season.status === 'upcoming' ? 'Upcoming' : 'Scheduled'}</dd>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="glass rounded-2xl p-6 border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-2">
                  <dt className="text-sm font-semibold text-blue-900">Football Players Budget</dt>
                  <span className="text-2xl">⚽</span>
                </div>
                <dd className="text-3xl font-bold text-blue-900">€10,000</dd>
                <p className="text-xs text-blue-700 mt-2">For FIFA/Football players</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="flex items-center justify-between mb-2">
                  <dt className="text-sm font-semibold text-green-900">Real Players Budget</dt>
                  <span className="text-2xl">🎮</span>
                </div>
                <dd className="text-3xl font-bold text-green-900">$5,000</dd>
                <p className="text-xs text-green-700 mt-2">For real/human players</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What to Expect
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">✅ As a Participant:</h4>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• Receive €10,000 for football players + $5,000 for real players</li>
                    <li>• Build your squad with both FIFA and real players</li>
                    <li>• Track your team's performance throughout the season</li>
                    <li>• Compete with other teams in the league</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">🎯 Season Features:</h4>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• Dual currency system - separate budgets for different player types</li>
                    <li>• Multi-season support - track performance across seasons</li>
                    <li>• Squad building with football and real players</li>
                    <li>• Season leaderboards and comprehensive statistics</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {registrationStatus === 'registered' ? (
                // Already registered message
                <div className="text-center">
                  <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">You're Already Registered!</h3>
                  <p className="text-lg text-gray-600 mb-8">
                    <strong>{user.teamName || 'Your team'}</strong> has already joined <strong>{season.name}</strong>.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8">
                    <p className="text-green-800 font-medium mb-2">✓ Registration Confirmed</p>
                    <p className="text-green-700 text-sm mb-3">
                      Your starting budgets have been allocated:
                    </p>
                    <div className="flex gap-4 justify-center mb-3">
                      <div className="bg-white rounded-lg px-4 py-2">
                        <p className="text-xs text-blue-600 font-medium">Football Players</p>
                        <p className="text-lg font-bold text-blue-900">€10,000</p>
                      </div>
                      <div className="bg-white rounded-lg px-4 py-2">
                        <p className="text-xs text-green-600 font-medium">Real Players</p>
                        <p className="text-lg font-bold text-green-900">$5,000</p>
                      </div>
                    </div>
                    <p className="text-green-700 text-sm">
                      Check your dashboard to start building your squad!
                    </p>
                  </div>
                  <Link
                    href="/dashboard/team"
                    className="inline-flex items-center px-8 py-4 rounded-2xl bg-gradient-to-r from-[#0066FF] to-[#9580FF] text-white font-semibold hover:from-[#0052CC] hover:to-[#7A66CC] transition-all duration-300 shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Dashboard
                  </Link>
                </div>
              ) : registrationStatus === 'declined' ? (
                // Already declined message
                <div className="text-center">
                  <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100">
                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">You Declined This Season</h3>
                  <p className="text-lg text-gray-600 mb-8">
                    <strong>{user.teamName || 'Your team'}</strong> has declined to join <strong>{season.name}</strong>.
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
                    <p className="text-gray-800 font-medium mb-2">Season Declined</p>
                    <p className="text-gray-700 text-sm">
                      You can participate in future seasons. If you'd like to change your decision, please contact the committee admin.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/team"
                    className="inline-flex items-center px-8 py-4 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all duration-300"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Dashboard
                  </Link>
                </div>
              ) : showRegistrationForm ? (
                // Registration form with manager name and fantasy opt-in
                <div className="max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={() => setShowRegistrationForm(false)}
                    className="mb-6 text-gray-600 hover:text-gray-900 flex items-center transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Complete Your Registration</h3>
                  
                  <div className="space-y-6">
                    {/* Manager Name Input */}
                    <div>
                      <label htmlFor="managerName" className="block text-sm font-semibold text-gray-700 mb-2">
                        Manager Name (Optional)
                      </label>
                      <input
                        type="text"
                        id="managerName"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">This is for your personal reference and won't be publicly displayed</p>
                    </div>

                    {/* Fantasy League Opt-in */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          id="joinFantasy"
                          checked={joinFantasy}
                          onChange={(e) => setJoinFantasy(e.target.checked)}
                          className="mt-1 h-5 w-5 text-[#0066FF] rounded focus:ring-[#0066FF] border-gray-300 cursor-pointer"
                        />
                        <label htmlFor="joinFantasy" className="ml-3 cursor-pointer">
                          <span className="block text-base font-semibold text-purple-900 mb-1">
                            🎮 Join Fantasy League
                          </span>
                          <span className="block text-sm text-purple-700">
                            Participate in the fantasy league! Draft players, set weekly lineups, earn points based on real match performance, and compete against other managers.
                          </span>
                        </label>
                      </div>
                      
                      {joinFantasy && (
                        <div className="mt-4 pl-8 bg-white/60 rounded-xl p-4 border border-purple-100">
                          <p className="text-sm font-semibold text-purple-900 mb-2">✨ Fantasy Features:</p>
                          <ul className="text-xs text-purple-800 space-y-1">
                            <li>• Draft players from your real team's roster</li>
                            <li>• Set weekly lineups with Captain/Vice-Captain</li>
                            <li>• Earn bonus points when your real team wins</li>
                            <li>• Track dual scoring: player points + team bonuses</li>
                            <li>• Compete on fantasy league leaderboards</li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={handleRegistrationSubmit}
                        disabled={isSubmitting}
                        className="flex-1 group relative px-10 py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-600/20 hover:shadow-xl hover:shadow-green-600/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{isSubmitting ? 'Processing...' : 'Confirm Registration'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Initial decision buttons
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Your Decision</h3>
                  <p className="text-gray-600 mb-8">
                    Would you like <strong>{user.teamName || 'your team'}</strong> to participate in <strong>{season.name}</strong>?
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    type="button"
                    onClick={() => handleDecision('join')}
                    disabled={isSubmitting}
                    className="group relative px-10 py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-600/20 hover:shadow-xl hover:shadow-green-600/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{isSubmitting ? 'Processing...' : `Join ${season.name}`}</span>
                    {!isSubmitting && (
                      <span className="absolute right-4 opacity-0 group-hover:opacity-100 group-hover:right-3 transition-all duration-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision('decline')}
                    disabled={isSubmitting}
                    className="group relative px-10 py-4 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Skip This Season</span>
                  </button>
                </div>
              </div>
            )}
            </div>

            <div className="mt-8 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200">
              <h4 className="font-semibold text-amber-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Important Notes
              </h4>
              <ul className="text-amber-800 text-sm space-y-1">
                <li>• Once you join a season, you cannot change your decision without admin assistance</li>
                <li>• If you decline, you can participate in future seasons</li>
                <li>• Your team will remain registered in the system regardless of your choice</li>
                <li>• Committee admins may send you invitations to other seasons in the future</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}

export default function SeasonRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SeasonRegistrationContent />
    </Suspense>
  );
}
