'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import RegisteredTeamDashboard from './RegisteredTeamDashboard';
import { useCachedTeamSeasons, useCachedSeasons } from '@/hooks/useCachedFirebase';

export default function TeamDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [seasonStatus, setSeasonStatus] = useState<{
    hasActiveSeason: boolean;
    isRegistered: boolean;
    seasonName?: string;
    seasonId?: string;
  } | null>(null);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string>('');
  const [historicalStats, setHistoricalStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'seasons' | 'active'>('overview');
  const [activeSeasonDetails, setActiveSeasonDetails] = useState<any>(null);
  const [loadingActiveDetails, setLoadingActiveDetails] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch team seasons using cached API (60s cache)
  const { data: teamSeasons, loading: teamSeasonsLoading } = useCachedTeamSeasons(
    user?.role === 'team' ? { teamId: user.uid } : undefined
  );

  // Fetch current season (not completed) using cached API (120s cache)
  // This includes draft, active, and ongoing seasons
  const { data: activeSeasons, loading: activeSeasonsLoading } = useCachedSeasons(
    user?.role === 'team' ? { isActive: 'true' } : undefined // Will match isActive=true OR status != 'completed'
  );

  // Process cached data to determine season status
  useEffect(() => {
    if (!user || user.role !== 'team' || teamSeasonsLoading || activeSeasonsLoading) {
      return;
    }

    try {
      console.log('🔍 Season Status Debug:', {
        userId: user.uid,
        teamSeasons: teamSeasons,
        activeSeasons: activeSeasons
      });
      
      // Filter team seasons for registered status
      // Check both team_id and user_id fields for compatibility
      const registeredTeamSeason = teamSeasons?.find(
        (ts: any) => (ts.team_id === user.uid || ts.user_id === user.uid) && ts.status === 'registered'
      );
      
      console.log('✅ Found registered team season:', registeredTeamSeason);

      // Update team logo if available
      if (registeredTeamSeason?.team_logo) {
        setTeamLogoUrl(registeredTeamSeason.team_logo);
      }

      // Get active season (data is array from API)
      const activeSeason = Array.isArray(activeSeasons) ? activeSeasons[0] : activeSeasons;

      if (!registeredTeamSeason) {
        // Not registered
        if (activeSeason) {
          setSeasonStatus({
            hasActiveSeason: true,
            isRegistered: false,
            seasonName: activeSeason.name,
            seasonId: activeSeason.id,
          });
        } else {
          setSeasonStatus({
            hasActiveSeason: false,
            isRegistered: false,
          });
        }
      } else {
        // User is registered
        const seasonId = registeredTeamSeason.season_id;

        // Check if active season matches
        if (activeSeason && activeSeason.id === seasonId) {
          setSeasonStatus({
            hasActiveSeason: true,
            isRegistered: true,
            seasonName: activeSeason.name,
            seasonId: seasonId,
          });
        } else {
          // Need to fetch specific season (fallback)
          setSeasonStatus({
            hasActiveSeason: true,
            isRegistered: true,
            seasonName: registeredTeamSeason.season_name || 'Active Season',
            seasonId: seasonId,
          });
        }
      }
    } catch (err) {
      console.error('Error processing season status:', err);
      setSeasonStatus({
        hasActiveSeason: false,
        isRegistered: false,
      });
    }
  }, [user, teamSeasons, activeSeasons, teamSeasonsLoading, activeSeasonsLoading]);

  // Fetch historical stats
  useEffect(() => {
    const fetchHistoricalStats = async () => {
      if (!user || user.role !== 'team' || !seasonStatus) return;
      
      try {
        setLoadingStats(true);
        const queryParams = seasonStatus.seasonId 
          ? `?season_id=${seasonStatus.seasonId}` 
          : '';
        const response = await fetch(`/api/team/historical-stats${queryParams}`);
        const data = await response.json();
        
        if (data.success) {
          setHistoricalStats(data.data);
        }
      } catch (error) {
        console.error('Error fetching historical stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    
    fetchHistoricalStats();
  }, [user, seasonStatus]);

  // Fetch active season details
  const fetchActiveSeasonDetails = async () => {
    if (!seasonStatus?.seasonId) return;
    
    try {
      setLoadingActiveDetails(true);
      const response = await fetch(`/api/seasons/${seasonStatus.seasonId}/details`);
      const data = await response.json();
      
      if (data.success) {
        setActiveSeasonDetails(data.data);
      }
    } catch (error) {
      console.error('Error fetching active season details:', error);
    } finally {
      setLoadingActiveDetails(false);
    }
  };

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seasonId)) {
        newSet.delete(seasonId);
      } else {
        newSet.add(seasonId);
      }
      return newSet;
    });
  };

  const isCheckingStatus = teamSeasonsLoading || activeSeasonsLoading;

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

          {/* Tab Navigation */}
          <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-2 mb-8">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-6 py-3 rounded-2xl font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('seasons')}
                className={`flex-1 px-6 py-3 rounded-2xl font-semibold transition-all ${
                  activeTab === 'seasons'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                Seasons History
              </button>
              {seasonStatus?.hasActiveSeason && (
                <button
                  onClick={() => {
                    setActiveTab('active');
                    if (!activeSeasonDetails) fetchActiveSeasonDetails();
                  }}
                  className={`flex-1 px-6 py-3 rounded-2xl font-semibold transition-all ${
                    activeTab === 'active'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  Active Season
                </button>
              )}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8 mb-8">
              {/* Team Statistics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                    <dd className="text-3xl font-bold text-gray-900">
                      {loadingStats ? '...' : (historicalStats?.summary?.totalSeasons || 0)}
                    </dd>
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
                    <dt className="text-sm font-semibold text-gray-600">Total Players</dt>
                    <dd className="text-3xl font-bold text-gray-900">
                      {loadingStats ? '...' : (historicalStats?.summary?.totalPlayers || 0)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Championships</dt>
                    <dd className="text-3xl font-bold text-gray-900">
                      {loadingStats ? '...' : (historicalStats?.summary?.championships || 0)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <dt className="text-sm font-semibold text-gray-600">Win Rate</dt>
                    <dd className="text-3xl font-bold text-gray-900">
                      {loadingStats ? '...' : `${historicalStats?.summary?.winRate || 0}%`}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Performance */}
          {!loadingStats && historicalStats && historicalStats.summary.totalSeasons > 0 && (
            <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Historical Performance
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/60 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Matches Played</p>
                  <p className="text-2xl font-bold text-gray-900">{historicalStats.summary.totalMatches}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Wins / Draws / Losses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    <span className="text-green-600">{historicalStats.summary.totalWins}</span> / 
                    <span className="text-yellow-600">{historicalStats.summary.totalDraws}</span> / 
                    <span className="text-red-600">{historicalStats.summary.totalLosses}</span>
                  </p>
                </div>
                <div className="bg-white/60 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Goals For / Against</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {historicalStats.summary.totalGoalsScored} / {historicalStats.summary.totalGoalsConceded}
                  </p>
                </div>
                <div className="bg-white/60 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Total Points</p>
                  <p className="text-2xl font-bold text-gray-900">{historicalStats.summary.totalPoints}</p>
                </div>
              </div>
              {historicalStats.summary.cups > 0 && (
                <div className="mt-4 p-4 bg-yellow-50/50 rounded-xl border border-yellow-200">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">🏆 Trophy Cabinet</p>
                  <div className="flex flex-wrap gap-3">
                    {historicalStats.summary.championships > 0 && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        🥇 {historicalStats.summary.championships} Championship{historicalStats.summary.championships > 1 ? 's' : ''}
                      </span>
                    )}
                    {historicalStats.summary.runnerUps > 0 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                        🥈 {historicalStats.summary.runnerUps} Runner-up{historicalStats.summary.runnerUps > 1 ? 's' : ''}
                      </span>
                    )}
                    {historicalStats.summary.cups > 0 && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        🏆 {historicalStats.summary.cups} Cup{historicalStats.summary.cups > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

              {/* Current Season Info */}
              {!loadingStats && historicalStats?.currentSeason && (
                <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Current Season: {historicalStats.currentSeason.seasonName}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <p className="text-lg font-bold text-green-600 capitalize">{historicalStats.currentSeason.status}</p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1">Players Registered</p>
                      <p className="text-lg font-bold text-gray-900">{historicalStats.currentSeason.registeredPlayers}</p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1">Balance</p>
                      <p className="text-lg font-bold text-gray-900">£{historicalStats.currentSeason.balance?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seasons History Tab */}
          {activeTab === 'seasons' && !loadingStats && historicalStats && (
            <div className="space-y-4 mb-8">
              {historicalStats.teamStats && historicalStats.teamStats.length > 0 ? (
                historicalStats.teamStats.map((teamSeason: any) => {
                  const isExpanded = expandedSeasons.has(teamSeason.season_id);
                  const seasonPlayers = historicalStats.playerStats.filter(
                    (p: any) => p.season_id === teamSeason.season_id
                  );

                  return (
                    <div key={teamSeason.id} className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 overflow-hidden">
                      {/* Season Header */}
                      <button
                        onClick={() => toggleSeason(teamSeason.season_id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/30 transition-all"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
                            <span className="text-2xl font-bold text-blue-600">#{teamSeason.rank || '-'}</span>
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">
                              Season {teamSeason.season_id?.replace('SSPSLS', '')}
                            </h3>
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-sm text-gray-600">
                                {teamSeason.matches_played || 0} Matches
                              </span>
                              <span className="text-sm text-gray-400">•</span>
                              <span className="text-sm font-semibold text-green-600">
                                {teamSeason.wins || 0}W
                              </span>
                              <span className="text-sm font-semibold text-yellow-600">
                                {teamSeason.draws || 0}D
                              </span>
                              <span className="text-sm font-semibold text-red-600">
                                {teamSeason.losses || 0}L
                              </span>
                              <span className="text-sm text-gray-400">•</span>
                              <span className="text-sm font-bold text-gray-900">
                                {teamSeason.points || 0} Pts
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {teamSeason.rank === 1 && (
                            <span className="text-2xl">🏆</span>
                          )}
                          {teamSeason.rank === 2 && (
                            <span className="text-2xl">🥈</span>
                          )}
                          {teamSeason.cup_achievement && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {teamSeason.cup_achievement}
                            </span>
                          )}
                          <svg
                            className={`w-6 h-6 text-gray-600 transition-transform ${
                              isExpanded ? 'transform rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-6 pb-6 space-y-4 border-t border-gray-200/50">
                          {/* Team Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                            <div className="bg-white/60 rounded-xl p-4">
                              <p className="text-xs text-gray-600 mb-1">Position</p>
                              <p className="text-2xl font-bold text-gray-900">#{teamSeason.rank || '-'}</p>
                            </div>
                            <div className="bg-white/60 rounded-xl p-4">
                              <p className="text-xs text-gray-600 mb-1">Goal Difference</p>
                              <p className={`text-2xl font-bold ${
                                (teamSeason.goal_difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(teamSeason.goal_difference || 0) >= 0 ? '+' : ''}{teamSeason.goal_difference || 0}
                              </p>
                            </div>
                            <div className="bg-white/60 rounded-xl p-4">
                              <p className="text-xs text-gray-600 mb-1">Goals For/Against</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {teamSeason.goals_for || 0}/{teamSeason.goals_against || 0}
                              </p>
                            </div>
                            <div className="bg-white/60 rounded-xl p-4">
                              <p className="text-xs text-gray-600 mb-1">Win Rate</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {teamSeason.matches_played > 0
                                  ? ((teamSeason.wins / teamSeason.matches_played) * 100).toFixed(0)
                                  : '0'}%
                              </p>
                            </div>
                          </div>

                          {/* Players List */}
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Squad ({seasonPlayers.length} Players)
                            </h4>
                            {seasonPlayers.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {seasonPlayers.map((player: any) => (
                                  <button
                                    key={player.id}
                                    onClick={() => router.push(`/dashboard/players/${player.player_id}`)}
                                    className="bg-white/60 rounded-xl p-4 hover:bg-white/80 transition-all text-left w-full cursor-pointer hover:shadow-md"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-gray-900">{player.player_name}</h5>
                                        {player.category && (
                                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium mt-1">
                                            {player.category}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="text-sm text-gray-600">
                                          {player.matches_played || 0} MP
                                        </p>
                                        <p className="text-sm font-semibold text-gray-900">
                                          {player.goals_scored || 0}G {player.assists || 0}A
                                        </p>
                                      </div>
                                    </div>
                                    {(player.category_trophies?.length > 0 || player.individual_trophies?.length > 0) && (
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="flex flex-wrap gap-1">
                                          {player.category_trophies?.map((trophy: string, idx: number) => (
                                            <span key={idx} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                                              🏆 {trophy}
                                            </span>
                                          ))}
                                          {player.individual_trophies?.map((trophy: string, idx: number) => (
                                            <span key={idx} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                                              ⭐ {trophy}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 bg-white/40 rounded-xl p-4">No player data available for this season</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-8 text-center">
                  <p className="text-gray-600">No historical seasons found</p>
                </div>
              )}
            </div>
          )}

          {/* Active Season Tab */}
          {activeTab === 'active' && seasonStatus?.hasActiveSeason && (
            <div className="space-y-6 mb-8">
              {loadingActiveDetails ? (
                <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading active season details...</p>
                </div>
              ) : activeSeasonDetails ? (
                <>
                  {/* Registered Teams */}
                  <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Registered Teams ({activeSeasonDetails.teams?.length || 0})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeSeasonDetails.teams?.map((team: any) => (
                        <button
                          key={team.id}
                          onClick={() => router.push(`/teams/${team.team_id}`)}
                          className="bg-white/60 rounded-xl p-4 hover:bg-white/80 transition-all text-left w-full cursor-pointer hover:shadow-md"
                        >
                          <div className="flex items-center space-x-3">
                            {team.logo_url ? (
                              <img src={team.logo_url} alt={team.team_name} className="w-12 h-12 rounded-xl object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
                                <span className="text-lg font-bold text-blue-600">{team.team_name?.[0]}</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{team.team_name}</h4>
                              {team.dollar_balance !== undefined || team.euro_balance !== undefined ? (
                                <p className="text-sm text-gray-600">
                                  <span className="text-green-700 font-semibold">${team.dollar_balance?.toLocaleString() || 0}</span> / 
                                  <span className="text-blue-700 font-semibold">€{team.euro_balance?.toLocaleString() || 0}</span>
                                </p>
                              ) : (
                                <p className="text-sm text-gray-600">Balance: £{team.balance?.toLocaleString() || 0}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      )) || <p className="text-gray-500">No teams registered yet</p>}
                    </div>
                  </div>

                  {/* Real Players Pool */}
                  <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Active Players ({activeSeasonDetails.players?.length || 0})
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      All active players in the league. Stats are created when players participate in matches.
                    </p>
                    {activeSeasonDetails.players && activeSeasonDetails.players.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeSeasonDetails.players.map((player: any) => (
                          <button
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className={`rounded-xl p-3 transition-all text-left w-full cursor-pointer hover:shadow-md ${
                              player.hasPlayedThisSeason 
                                ? 'bg-blue-50/50 border border-blue-200 hover:bg-blue-50' 
                                : 'bg-white/60 hover:bg-white/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900">{player.name}</h5>
                                <div className="flex items-center gap-2 mt-1">
                                  {player.psn_id && (
                                    <p className="text-xs text-gray-600">PSN: {player.psn_id}</p>
                                  )}
                                  {player.hasPlayedThisSeason && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                      Has Stats
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No real players in the system yet</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 p-8 text-center">
                  <p className="text-gray-600">Unable to load active season details</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show registered dashboard with full features
  return <RegisteredTeamDashboard seasonStatus={seasonStatus} user={user} />;
}
