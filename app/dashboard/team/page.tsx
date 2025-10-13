'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RegisteredTeamDashboard from './RegisteredTeamDashboard';

export default function TeamDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [seasonStatus, setSeasonStatus] = useState<{
    hasActiveSeason: boolean;
    isRegistered: boolean;
    seasonName?: string;
    seasonId?: string;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Check season registration status (optimized with parallel queries)
  useEffect(() => {
    const checkSeasonStatus = async () => {
      if (!user || user.role !== 'team') return;

      try {
        // Import Firestore (cached after first load)
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs, limit, doc, getDoc } = await import('firebase/firestore');

        // Run both queries in parallel for faster loading
        const [teamSeasonsSnapshot, activeSeasonsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'team_seasons'),
            where('team_id', '==', user.uid),
            where('status', '==', 'registered'),
            limit(1)
          )),
          getDocs(query(
            collection(db, 'seasons'),
            where('isActive', '==', true),
            limit(1)
          ))
        ]);
        
        // Update team logo from team_seasons if available
        if (!teamSeasonsSnapshot.empty) {
          const teamSeasonData = teamSeasonsSnapshot.docs[0].data();
          if (teamSeasonData.team_logo) {
            setTeamLogoUrl(teamSeasonData.team_logo);
          }
        }

        if (teamSeasonsSnapshot.empty) {
          // Not registered
          if (!activeSeasonsSnapshot.empty) {
            const seasonDoc = activeSeasonsSnapshot.docs[0];
            setSeasonStatus({
              hasActiveSeason: true,
              isRegistered: false,
              seasonName: seasonDoc.data().name,
              seasonId: seasonDoc.id,
            });
          } else {
            setSeasonStatus({
              hasActiveSeason: false,
              isRegistered: false,
            });
          }
        } else {
          // User is registered - get season details (already have active season from parallel query)
          const teamSeasonData = teamSeasonsSnapshot.docs[0].data();
          const seasonId = teamSeasonData.season_id;

          // Check if the season we already fetched matches
          if (!activeSeasonsSnapshot.empty && activeSeasonsSnapshot.docs[0].id === seasonId) {
            // Use cached season data
            const seasonData = activeSeasonsSnapshot.docs[0].data();
            setSeasonStatus({
              hasActiveSeason: true,
              isRegistered: true,
              seasonName: seasonData.name,
              seasonId: seasonId,
            });
          } else {
            // Fetch specific season if different
            const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));
            if (seasonDoc.exists()) {
              const seasonData = seasonDoc.data();
              setSeasonStatus({
                hasActiveSeason: true,
                isRegistered: true,
                seasonName: seasonData.name,
                seasonId: seasonId,
              });
            } else {
              setSeasonStatus({
                hasActiveSeason: false,
                isRegistered: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('Error checking season status:', err);
        setSeasonStatus({
          hasActiveSeason: false,
          isRegistered: false,
        });
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkSeasonStatus();
  }, [user]);

  if (loading || isCheckingStatus) {
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

  // Show unassigned dashboard if no active season or not registered
  if (!seasonStatus?.hasActiveSeason || !seasonStatus?.isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Team Header */}
          <div className="glass rounded-3xl p-8 mb-8 shadow-xl backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {teamLogoUrl ? (
                  <img 
                    src={teamLogoUrl} 
                    alt="Team logo" 
                    className="w-20 h-20 rounded-3xl object-cover mr-6 border-2 border-[#0066FF]/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center mr-6">
                    <span className="text-2xl font-bold text-[#0066FF]">{user.teamName?.[0]?.toUpperCase() || 'T'}</span>
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0066FF] via-blue-500 to-[#0066FF] bg-clip-text text-transparent">
                    {user.teamName || 'My Team'}
                  </h1>
                  <p className="text-xl text-gray-600 mt-2">Independent Team Dashboard</p>
                  <div className="flex items-center mt-3">
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Registered Team
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* No Active Season */}
          {!seasonStatus?.hasActiveSeason && (
            <div className="glass rounded-3xl p-6 mb-8 shadow-xl backdrop-blur-md border border-blue-200/50 bg-gradient-to-r from-blue-50/20 to-indigo-50/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-blue-800">No Active Season</h3>
                      <p className="text-blue-700 text-sm">Waiting for new season to begin</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-2xl p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      There is currently no active season. The committee will start a new season soon.
                    </p>
                    <div className="flex items-center text-sm">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                        <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                        WAITING
                      </span>
                      <span className="text-gray-500">Check back later for updates</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Status
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Season Registration Open */}
          {seasonStatus?.hasActiveSeason && !seasonStatus?.isRegistered && (
            <div className="glass rounded-3xl p-6 mb-8 shadow-xl backdrop-blur-md border border-green-200/50 bg-gradient-to-r from-green-50/20 to-emerald-50/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-green-800">Season Registration Available!</h3>
                      <p className="text-green-700 text-sm">Contact admin to join the active season</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">{seasonStatus.seasonName}</h4>
                        <p className="text-sm text-gray-600">An active season is available for registration</p>
                        <div className="flex items-center mt-2 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                            ACTIVE
                          </span>
                          <span className="text-gray-500">Contact committee to register</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-1">🏆</div>
                        <p className="text-xs text-gray-500">Active Season</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl mb-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-yellow-800">Action Required</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          Please contact the committee administrator to register your team for this season.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Check Registration Status
                    </button>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Registration managed by committee
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Seasons Played</dt>
                    <dd className="text-3xl font-bold text-gray-900">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Players Acquired</dt>
                    <dd className="text-3xl font-bold text-gray-900">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Total Spent</dt>
                    <dd className="text-3xl font-bold text-gray-900">£0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Total Bids</dt>
                    <dd className="text-3xl font-bold text-gray-900">0</dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Getting Started</h3>
                <div className="mt-2 text-sm text-gray-600">
                  <p className="mb-2">Your team is registered but not currently participating in a season.</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Wait for the committee to start a new season</li>
                    <li>Contact the committee admin for season registration</li>
                    <li>Check back regularly for updates</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show registered dashboard with full features
  return <RegisteredTeamDashboard seasonStatus={seasonStatus} user={user} />;
}
