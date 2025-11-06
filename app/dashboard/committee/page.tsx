'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { getSmartCache, setSmartCache, CACHE_DURATIONS } from '@/utils/smartCache';
import { POSITION_GROUPS } from '@/lib/constants/positions';
import { usePermissions } from '@/hooks/usePermissions';
import Image from 'next/image';

export default function CommitteeDashboard() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<{
    total: number;
    eligible: number;
    byPosition: { [key: string]: number };
  }>({ total: 0, eligible: 0, byPosition: {} });
  const [activeRounds, setActiveRounds] = useState<any[]>([]);
  const [roundTiebreakers, setRoundTiebreakers] = useState<{[key: string]: any[]}>({});
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [currentSeason, setCurrentSeason] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    teamPlayer: true,
    ratings: true,
    contracts: true,
    auction: true,
    fantasy: true,
    content: false,
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch all initial data in parallel
  const fetchAllStats = useCallback(async () => {
      if (!user || user.role !== 'committee_admin' || !userSeasonId) return;

      setLoadingStats(true);
      
      try {
        // Fetch all data in parallel
        await Promise.all([
          // Fetch season
          (async () => {
            try {
              const cacheKey = `committee_season_${userSeasonId}`;
              const cachedSeason = getSmartCache<any>(cacheKey, CACHE_DURATIONS.MEDIUM);
              
              if (cachedSeason) {
                setCurrentSeason(cachedSeason);
                return;
              }
              
              const seasonRef = doc(db, 'seasons', userSeasonId);
              const seasonSnapshot = await getDoc(seasonRef);
              
              if (seasonSnapshot.exists()) {
                const seasonData = { id: seasonSnapshot.id, ...seasonSnapshot.data() };
                setSmartCache(cacheKey, seasonData, CACHE_DURATIONS.MEDIUM);
                setCurrentSeason(seasonData);
              }
            } catch (err) {
              console.error('Error fetching season:', err);
            }
          })(),

          // Fetch player stats from footballplayers (auction DB)
          (async () => {
            try {
              const cacheKey = `committee_football_players_${userSeasonId}`;
              const cachedStats = getSmartCache<any>(cacheKey, CACHE_DURATIONS.MEDIUM);
              
              if (cachedStats) {
                setPlayerStats(cachedStats);
                return;
              }
              
              const response = await fetchWithTokenRefresh(`/api/stats/registered-players?season_id=${userSeasonId}`);
              const data = await response.json();

              if (data.success && data.stats) {
                setSmartCache(cacheKey, data.stats, CACHE_DURATIONS.MEDIUM);
                setPlayerStats(data.stats);
              }
            } catch (err) {
              console.error('Error fetching registered player stats:', err);
            }
          })(),

          // Fetch teams
          (async () => {
            try {
              const response = await fetchWithTokenRefresh(`/api/team/all?season_id=${userSeasonId}`);
              const data = await response.json();

              if (data.success && data.data?.teams) {
                setTeams(data.data.teams);
              }
            } catch (err) {
              console.error('Error fetching teams:', err);
            }
          })(),
        ]);
      } finally {
        setLoadingStats(false);
      }
    }, [user, userSeasonId]);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  // Fetch active rounds
  const fetchActiveRounds = useCallback(async () => {
      if (!userSeasonId || !user || user.role !== 'committee_admin') return;

      setLoadingRounds(true);
      try {
        const roundsResponse = await fetchWithTokenRefresh(`/api/admin/rounds?season_id=${userSeasonId}&status=active`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const roundsData = await roundsResponse.json();

        if (roundsData.success) {
          setActiveRounds(roundsData.data || []);
        }

        const tbResponse = await fetchWithTokenRefresh(`/api/admin/tiebreakers?seasonId=${userSeasonId}&status=active`);
        const tbData = await tbResponse.json();

        if (tbData.success && tbData.data?.tiebreakers) {
          const tiebreakersByRound: {[key: string]: any[]} = {};
          tbData.data.tiebreakers.forEach((tb: any) => {
            if (!tiebreakersByRound[tb.round_id]) {
              tiebreakersByRound[tb.round_id] = [];
            }
            tiebreakersByRound[tb.round_id].push(tb);
          });
          setRoundTiebreakers(tiebreakersByRound);
        }
      } catch (err) {
        console.error('Error fetching active rounds:', err);
      } finally {
        setLoadingRounds(false);
      }
    }, [userSeasonId, user]);

  useEffect(() => {
    fetchActiveRounds();
    const interval = setInterval(fetchActiveRounds, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveRounds]);

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-screen-2xl">
        
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-3">
                Committee Dashboard
              </h1>
              <p className="text-gray-600 text-lg">
                Complete administrative control center
              </p>
            </div>
            
            {currentSeason && (
              <div className="glass rounded-2xl p-5 shadow-xl border border-white/30 min-w-[240px]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[#0066FF]/20 to-blue-500/20">
                    <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Active Season</div>
                    <div className="font-bold text-gray-900 text-lg">{currentSeason.name}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                  <span className="text-xs text-gray-600">Teams Registered</span>
                  <span className="font-bold text-[#0066FF]">{teams.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 mb-6 md:mb-8">
          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg sm:shadow-xl border border-white/30 hover:border-[#0066FF]/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#0066FF] to-blue-600 shadow-md sm:shadow-lg">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Total Teams</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text">{teams.length}</div>
          </div>

          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg sm:shadow-xl border border-white/30 hover:border-purple-500/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-md sm:shadow-lg">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Total Players</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">{playerStats.total}</div>
          </div>

          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg sm:shadow-xl border border-white/30 hover:border-green-500/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-md sm:shadow-lg">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Eligible Players</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{playerStats.eligible}</div>
          </div>

          <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg sm:shadow-xl border border-white/30 hover:border-orange-500/40 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-md sm:shadow-lg">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Active Rounds</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600">{activeRounds.length}</div>
          </div>
        </div>

        {/* Organized Navigation with Collapsible Sections */}
        <div className="space-y-6 mb-8">
          
          {/* Team & Player Management Section */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <button
              onClick={() => toggleSection('teamPlayer')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Team & Player Management
              </h2>
              {expandedSections.teamPlayer ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {expandedSections.teamPlayer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/dashboard/committee/teams" className="group glass rounded-2xl p-4 border border-white/20 hover:border-[#0066FF]/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#0066FF]/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#0066FF] to-blue-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-[#0066FF] transition-colors mb-1">Season Teams</h4>
                    <p className="text-xs text-gray-600">View teams registered for current season</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/registration" className="group glass rounded-2xl p-4 border border-white/20 hover:border-[#0066FF]/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#0066FF]/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#0066FF] to-blue-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-[#0066FF] transition-colors mb-1">Team Registration</h4>
                    <p className="text-xs text-gray-600">Manage team registration for season</p>
                  </div>
                </Link>

                <Link href={userSeasonId ? `/register/players?season=${userSeasonId}` : '#'} className="group glass rounded-2xl p-4 border border-white/20 hover:border-purple-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors mb-1">Player Registration</h4>
                    <p className="text-xs text-gray-600">Register players to teams for season</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/players" className="group glass rounded-2xl p-4 border border-white/20 hover:border-blue-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-1">All Players</h4>
                    <p className="text-xs text-gray-600">Browse all players in database</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/contracts" className="group glass rounded-2xl p-4 border border-white/20 hover:border-orange-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors mb-1">Player Contracts</h4>
                    <p className="text-xs text-gray-600">Manage 2-season player contracts</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/players/transfers" className="group glass rounded-2xl p-4 border border-white/20 hover:border-emerald-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-emerald-600 transition-colors mb-1">Player Transfers</h4>
                    <p className="text-xs text-gray-600">Release, transfer & swap players</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/team-contracts" className="group glass rounded-2xl p-4 border border-white/20 hover:border-pink-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-pink-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-pink-600 transition-colors mb-1">Team Contracts</h4>
                    <p className="text-xs text-gray-600">Manage team 2-season contracts</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Player Ratings & Configuration Section */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <button
              onClick={() => toggleSection('ratings')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Player Ratings & Configuration
              </h2>
              {expandedSections.ratings ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {expandedSections.ratings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/dashboard/committee/player-ratings" className="group glass rounded-2xl p-4 border border-white/20 hover:border-amber-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-amber-600 transition-colors mb-1">Player Ratings</h4>
                    <p className="text-xs text-gray-600">Assign star ratings</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/star-rating-config" className="group glass rounded-2xl p-4 border border-white/20 hover:border-yellow-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-yellow-600 transition-colors mb-1">⭐ Star Config</h4>
                    <p className="text-xs text-gray-600">Points & pricing setup</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/real-players" className="group glass rounded-2xl p-4 border border-white/20 hover:border-emerald-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-emerald-600 transition-colors mb-1">SS Members</h4>
                    <p className="text-xs text-gray-600">Real player assignments</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Contracts & Financial Management Section */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <button
              onClick={() => toggleSection('contracts')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Contracts & Financial Management
              </h2>
              {expandedSections.contracts ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {expandedSections.contracts && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/dashboard/committee/contracts/mid-season-salary" className="group glass rounded-2xl p-4 border border-white/20 hover:border-green-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-green-600 transition-colors mb-1">💰 Mid-Season Salary</h4>
                    <p className="text-xs text-gray-600">Process football player salaries</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/salary-transactions" className="group glass rounded-2xl p-4 border border-white/20 hover:border-purple-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors mb-1">💎 Real Player Salaries</h4>
                    <p className="text-xs text-gray-600">View salary transactions by team</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/contracts/reconcile" className="group glass rounded-2xl p-4 border border-white/20 hover:border-red-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-red-600 transition-colors mb-1">📄 Contract Reconciliation</h4>
                    <p className="text-xs text-gray-600">Handle season transitions</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Auction Management Section */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <button
              onClick={() => toggleSection('auction')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Auction Management
              </h2>
              {expandedSections.auction ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {expandedSections.auction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/dashboard/committee/auction-settings" className="group glass rounded-2xl p-4 border border-white/20 hover:border-[#0066FF]/50 transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-[#0066FF]/20 to-blue-500/20">
                      <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-800 group-hover:text-[#0066FF] transition-colors mb-1 text-sm">Auction Settings</h4>
                  <p className="text-xs text-gray-600">Configure rounds & rules</p>
                </Link>

                <Link href="/dashboard/committee/position-groups" className="group glass rounded-2xl p-4 border border-white/20 hover:border-cyan-500/50 transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20">
                      <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-800 group-hover:text-cyan-600 transition-colors mb-1 text-sm">Position Groups</h4>
                  <p className="text-xs text-gray-600">Organize auction groups</p>
                </Link>

                <Link href="/dashboard/committee/database" className="group glass rounded-2xl p-4 border border-white/20 hover:border-teal-500/50 transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/20">
                      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-800 group-hover:text-teal-600 transition-colors mb-1 text-sm">Database</h4>
                  <p className="text-xs text-gray-600">Import/export data</p>
                </Link>

                <Link href="/dashboard/committee/rounds" className="group glass rounded-2xl p-4 border border-white/20 hover:border-green-500/50 transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-800 group-hover:text-green-600 transition-colors mb-1 text-sm">Create Rounds</h4>
                  <p className="text-xs text-gray-600">Manage auction rounds</p>
                </Link>

                <Link href="/dashboard/committee/bulk-rounds" className="group glass rounded-2xl p-4 border border-white/20 hover:border-orange-500/50 transition-all hover:-translate-y-1 shadow-md hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors mb-1 text-sm">Bulk Rounds</h4>
                  <p className="text-xs text-gray-600">Manage bulk bidding</p>
                </Link>
              </div>
            )}
          </div>

          {/* Fantasy & Content Management Section */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <button
              onClick={() => toggleSection('fantasy')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Fantasy & Content Management
              </h2>
              {expandedSections.fantasy ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {expandedSections.fantasy && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/dashboard/committee/fantasy/create" className="group glass rounded-2xl p-4 border border-white/20 hover:border-purple-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors mb-1">🏆 Fantasy League</h4>
                    <p className="text-xs text-gray-600">Create & manage draft</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/fantasy/enable-teams" className="group glass rounded-2xl p-4 border border-white/20 hover:border-violet-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-violet-600 transition-colors mb-1">💪 Enable Fantasy Teams</h4>
                    <p className="text-xs text-gray-600">Bulk enable teams</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/team-management" className="group glass rounded-2xl p-4 border border-white/20 hover:border-indigo-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors mb-1">Team Management</h4>
                    <p className="text-xs text-gray-600">Tournament operations</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/trophies" className="group glass rounded-2xl p-4 border border-white/20 hover:border-yellow-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m-3.75 1.5a3 3 0 11-6 0 3 3 0 016 0zm8.25 0a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-yellow-600 transition-colors mb-1">🏆 Trophy Management</h4>
                    <p className="text-xs text-gray-600">Award season trophies</p>
                  </div>
                </Link>

                <Link href="/dashboard/committee/awards" className="group glass rounded-2xl p-4 border border-white/20 hover:border-amber-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-amber-600 transition-colors mb-1">🏆 Awards</h4>
                    <p className="text-xs text-gray-600">POTD, POTW & more</p>
                  </div>
                </Link>

                <Link href="/admin/news" className="group glass rounded-2xl p-4 border border-white/20 hover:border-blue-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-1">📰 News Management</h4>
                    <p className="text-xs text-gray-600">View AI-generated news</p>
                  </div>
                </Link>

                <Link href="/admin/notifications" className="group glass rounded-2xl p-4 border border-white/20 hover:border-red-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800 group-hover:text-red-600 transition-colors mb-1">📬 Send Notifications</h4>
                    <p className="text-xs text-gray-600">Manual notifications to teams</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Active Rounds & Player Stats - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Rounds */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Active Rounds
                {activeRounds.length > 0 && (
                  <span className="ml-2 text-xs font-bold px-2.5 py-1 bg-green-500/20 text-green-700 rounded-full">
                    {activeRounds.length}
                  </span>
                )}
              </h2>
              <Link href="/dashboard/committee/rounds" className="text-xs font-semibold text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors">
                View All
              </Link>
            </div>
            
            {loadingRounds ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-[#0066FF] mx-auto"></div>
                <p className="mt-3 text-sm text-gray-600">Loading...</p>
              </div>
            ) : activeRounds.length === 0 ? (
              <div className="glass p-6 rounded-2xl text-center">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">No active rounds</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRounds.map((round) => {
                  const tiebreakers = roundTiebreakers[round.id] || [];
                  
                  return (
                    <div key={round.id} className="glass p-4 rounded-2xl border border-white/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-green-500/20 text-green-700 text-xs font-bold rounded-full">
                            {round.position}
                          </span>
                          <h3 className="font-bold text-gray-800 text-sm">{round.position} Round</h3>
                        </div>
                        <Link href="/dashboard/committee/rounds" className="text-xs font-medium text-[#0066FF] hover:text-[#0052CC]">
                          Details →
                        </Link>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-600">Bids</p>
                          <p className="text-lg font-bold text-[#0066FF]">{round.total_bids || 0}</p>
                        </div>
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-600">Teams</p>
                          <p className="text-lg font-bold text-[#0066FF]">{round.teams_bid || 0}</p>
                        </div>
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-600">Tiebreakers</p>
                          <p className="text-lg font-bold text-orange-600">{tiebreakers.length}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Player Stats */}
          <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Player Distribution
              </h2>
              <Link href="/dashboard/committee/player-selection" className="text-xs font-semibold text-indigo-600 px-3 py-1.5 bg-indigo-100/50 rounded-full hover:bg-indigo-100 transition-colors">
                Manage
              </Link>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Auction Eligible</span>
                <span className="text-sm text-indigo-600 font-bold">{playerStats.eligible} / {playerStats.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${playerStats.total > 0 ? (playerStats.eligible / playerStats.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { pos: 'GK', color: 'yellow', icon: '🧤', label: 'Keepers' },
                { pos: 'DEF', color: 'blue', icon: '🛡️', label: 'Defenders' },
                { pos: 'MID', color: 'green', icon: '⚙️', label: 'Midfielders' },
                { pos: 'FWD', color: 'red', icon: '⚽', label: 'Forwards' }
              ].map(({ pos, color, icon, label }) => (
                <div key={pos} className="glass p-4 rounded-xl bg-white/30 hover:bg-white/50 transition-all">
                  <div className="flex items-center mb-2">
                    <span className={`w-3 h-3 rounded-full mr-2 bg-${color}-400`}></span>
                    <span className="text-xs font-bold text-gray-700">{pos}</span>
                  </div>
                  <p className="text-3xl font-bold text-indigo-600 mb-1">
                    {playerStats.byPosition[pos] || 0}
                  </p>
                  <p className="text-xs text-gray-600">{icon} {label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
