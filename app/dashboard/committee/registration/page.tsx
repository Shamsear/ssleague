'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById, updateSeason } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { TeamData } from '@/types/team';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function CommitteeRegistrationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  
  const [registeredTeamsCount, setRegisteredTeamsCount] = useState(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [processingTeamId, setProcessingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) {
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);
        
        // Fetch current season
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        // Count registered teams for this season from team_seasons collection
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', userSeasonId),
          where('status', '==', 'registered')
        );
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        setRegisteredTeamsCount(teamSeasonsSnapshot.docs.length);
        
        // Count total teams from teams collection
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        setTotalTeamsCount(teamsSnapshot.docs.length);
        
        console.log(`📊 Stats for ${userSeasonId}: ${teamSeasonsSnapshot.docs.length} registered teams out of ${teamsSnapshot.docs.length} total teams`);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const toggleTeamRegistration = async () => {
    if (!currentSeason) return;

    try {
      const newValue = !currentSeason.is_team_registration_open;
      await updateSeason(currentSeason.id, {
        is_team_registration_open: newValue
      });

      setCurrentSeason({
        ...currentSeason,
        is_team_registration_open: newValue
      });

      showToast(
        currentSeason.is_team_registration_open 
          ? 'Team registration closed successfully' 
          : 'Team registration opened successfully',
        'success'
      );
    } catch (error) {
      console.error('Error toggling team registration:', error);
      showToast('Failed to toggle team registration', 'error');
    }
  };


  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${type} link copied to clipboard!`, 'success');
    }).catch(() => {
      showToast('Failed to copy link', 'error');
    });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    // Simple toast implementation - you can enhance this
    alert(message);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading registration data...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  const teamRegistrationLink = currentSeason 
    ? `${window.location.origin}/register/team?season=${currentSeason.id}`
    : '';
  

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Registration Overview */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Team Registration</h2>
              {currentSeason ? (
                <p className="text-gray-600 mt-1">Managing team participation for {currentSeason.name}</p>
              ) : (
                <p className="text-amber-600 mt-1">No season assigned</p>
              )}
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <Link
                href="/dashboard/committee"
                className="px-4 py-2.5 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300 flex items-center justify-center text-gray-800 sm:justify-start w-full sm:w-auto"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Team Registration Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 01 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 01 9.288 0M15 7a3 3 0 11-6 0 3 3 0 01 6 0zm6 3a2 2 0 11-4 0 2 2 0 01 4 0zM7 10a2 2 0 11-4 0 2 2 0 01 4 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Teams</dt>
                    <dd className="text-lg font-medium text-gray-900">{totalTeamsCount}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Registered Teams</dt>
                    <dd className="text-lg font-medium text-gray-900">{registeredTeamsCount}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Available Teams</dt>
                    <dd className="text-lg font-medium text-gray-900">{totalTeamsCount - registeredTeamsCount}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Season Registration Control */}
          <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {currentSeason ? currentSeason.name : 'Season'} Registration Control
            </h3>

            {currentSeason ? (
              <>
                {/* Registration Status and Controls */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-700">Team Registration Status:</span>
                      {currentSeason.is_team_registration_open ? (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                          </svg>
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                          Closed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {currentSeason.is_team_registration_open ? (
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to close team registration for ${currentSeason.name}?`)) {
                              toggleTeamRegistration();
                            }
                          }}
                          className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-700 bg-red-50 hover:bg-red-100 transition-all duration-200"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Close Team Registration
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to open team registration for ${currentSeason.name}?`)) {
                              toggleTeamRegistration();
                            }
                          }}
                          className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-xl text-green-700 bg-green-50 hover:bg-green-100 transition-all duration-200"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Open Team Registration
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Registration Link Section */}
                {currentSeason.is_team_registration_open ? (
                  <>
                    <p className="text-gray-600 mb-4">
                      Team registration is <strong>OPEN</strong>. Share this link with teams who want to register for <strong>{currentSeason.name}</strong>:
                    </p>
                    <div className="mb-3 p-3 bg-green-50/50 rounded-lg border border-green-100">
                      <p className="text-sm text-green-800">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <strong>Team Registration Active:</strong> Teams can use this link to register for {currentSeason.name}.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex-grow">
                        <input
                          type="text"
                          value={teamRegistrationLink}
                          readOnly
                          className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none text-gray-700 font-mono text-sm"
                        />
                      </div>
                      <button
                        onClick={() => copyToClipboard(teamRegistrationLink, 'Team registration')}
                        className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors duration-200 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Link
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-red-600 mb-4">
                      Team registration is <strong>CLOSED</strong>. Teams cannot register at this time.
                    </p>
                    <div className="mb-3 p-3 bg-red-50/50 rounded-lg border border-red-100">
                      <p className="text-sm text-red-800">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <strong>Team Registration Closed:</strong> Click "Open Team Registration" above to allow teams to register.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-amber-600 mb-4">No season assigned - teams cannot register at this time.</p>
            )}
          </div>


          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/committee/teams"
                className="glass p-4 rounded-xl hover:bg-white/20 transition-colors duration-200 flex items-center"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">View Team Details</h4>
                  <p className="text-sm text-gray-600">See detailed information about registered teams</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Registration Information</h3>
          <div className="prose prose-sm text-gray-600">
            <p className="mb-3">
              <strong>Season-Specific Registration:</strong> The registration link above is tied directly to {currentSeason?.name || 'the current season'}. Teams using this link will automatically register for this specific season.
            </p>
            <p className="mb-3">
              <strong>Registration Process:</strong> When teams use the season-specific link, they will:
              <br />• Create an account (if new)
              <br />• Automatically be associated with {currentSeason?.name || 'the current season'}
              <br />• Receive an initial balance upon approval
            </p>
            {currentSeason && (
              <p className="mb-3">
                <strong>Current Season:</strong> {currentSeason.name} is currently assigned to you. All registrations through this link will be for this season only.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
