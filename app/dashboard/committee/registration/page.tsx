'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById, updateSeason } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

export default function TeamRegistrationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  
  const [registeredTeamsCount, setRegisteredTeamsCount] = useState(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    if (!isCommitteeAdmin || !userSeasonId) {
      setLoadingData(false);
      return;
    }

    const fetchInitialData = async () => {
      try {
        setLoadingData(true);
        
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        setTotalTeamsCount(teamsSnapshot.docs.length);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchInitialData();

    // Set up real-time listener for team registrations
    console.log('🔴 Setting up real-time listener for season:', userSeasonId);
    
    const teamSeasonsQuery = query(
      collection(db, 'team_seasons'),
      where('season_id', '==', userSeasonId),
      where('status', '==', 'registered')
    );

    const unsubscribe = onSnapshot(
      teamSeasonsQuery,
      (snapshot) => {
        console.log('🟢 Real-time update received! Registered teams:', snapshot.docs.length);
        setRegisteredTeamsCount(snapshot.docs.length);
      },
      (error) => {
        console.error('❌ Error listening to team registrations:', error);
      }
    );

    console.log('✅ Real-time listener set up successfully');

    return () => {
      console.log('🔴 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [isCommitteeAdmin, userSeasonId]);

  const toggleTeamRegistration = async () => {
    if (!currentSeason || isToggling) return;

    const confirmMessage = currentSeason.is_team_registration_open
      ? `Close team registration for ${currentSeason.name}?`
      : `Open team registration for ${currentSeason.name}?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      setIsToggling(true);
      const newValue = !currentSeason.is_team_registration_open;
      
      await updateSeason(currentSeason.id, {
        is_team_registration_open: newValue
      });

      setCurrentSeason({
        ...currentSeason,
        is_team_registration_open: newValue
      });

      alert(
        newValue 
          ? 'Team registration opened successfully!' 
          : 'Team registration closed successfully!'
      );
    } catch (error) {
      console.error('Error toggling team registration:', error);
      alert('Failed to toggle team registration');
    } finally {
      setIsToggling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (!currentSeason) {
    return (
      <div className="min-h-screen py-4 sm:py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass rounded-3xl p-6 sm:p-8 shadow-lg text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">No Season Assigned</h2>
            <p className="text-gray-600 mb-6">
              You need to be assigned to a season to manage team registration.
            </p>
            <Link
              href="/dashboard/committee"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#0066FF] to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const teamRegistrationLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/register/team?season=${currentSeason.id}`;
  const availableTeams = totalTeamsCount - registeredTeamsCount;

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Team Registration</h1>
                  <p className="text-sm text-gray-600">{currentSeason.name}</p>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/committee"
              className="px-4 py-2 text-sm glass rounded-xl hover:bg-white/90 transition-all flex items-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-2xl p-4 sm:p-5 shadow-md backdrop-blur-md border border-white/20 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Teams</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalTeamsCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 shadow-md backdrop-blur-md border border-white/20 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Registered</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{registeredTeamsCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 shadow-md backdrop-blur-md border border-white/20 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Available</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600">{availableTeams}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Registration Control */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg backdrop-blur-md border border-white/20 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-semibold text-gray-700">Registration Status:</span>
              {currentSeason.is_team_registration_open ? (
                <span className="inline-flex items-center px-3 py-1 text-xs sm:text-sm font-bold rounded-full bg-green-100 text-green-800 border border-green-200">
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                  </svg>
                  OPEN
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 text-xs sm:text-sm font-bold rounded-full bg-red-100 text-red-800 border border-red-200">
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                  CLOSED
                </span>
              )}
            </div>
            
            <button
              onClick={toggleTeamRegistration}
              disabled={isToggling}
              className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                currentSeason.is_team_registration_open
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isToggling ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : currentSeason.is_team_registration_open ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close Registration
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Open Registration
                </>
              )}
            </button>
          </div>

          {currentSeason.is_team_registration_open ? (
            <div>
              <div className="mb-4 p-3 sm:p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs sm:text-sm text-green-800 flex items-start">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span><strong>Registration Active:</strong> Share the link below with teams to register for {currentSeason.name}.</span>
                </p>
              </div>
              
              <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Link</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={teamRegistrationLink}
                  readOnly
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm font-mono text-gray-700"
                />
                <button
                  onClick={() => copyToClipboard(teamRegistrationLink)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                >
                  <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">{copiedUrl ? 'Copied!' : 'Copy Link'}</span>
                  <span className="sm:hidden">{copiedUrl ? '✓' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-xs sm:text-sm text-red-800 flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span><strong>Registration Closed:</strong> Teams cannot register at this time. Click "Open Registration" to allow teams to join.</span>
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg backdrop-blur-md border border-white/20">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Registration Information
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong className="text-gray-800">Season-Specific Link:</strong> The registration link is tied directly to {currentSeason.name}. Teams will automatically register for this season.
            </p>
            <p>
              <strong className="text-gray-800">Process:</strong> New teams will create an account, be associated with {currentSeason.name}, and receive an initial balance upon approval.
            </p>
            <p>
              <strong className="text-gray-800">Control:</strong> You can open or close registration at any time using the toggle above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
