'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { getSmartCache, setSmartCache, CACHE_DURATIONS } from '@/utils/smartCache';
import { POSITION_GROUPS } from '@/lib/constants/positions';
import { usePermissions } from '@/hooks/usePermissions';

export default function CommitteeDashboard() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  // Debug: log user object and seasonId
  useEffect(() => {
    if (user) {
      console.log('👤 User object:', user);
      console.log('🆔 User seasonId field:', (user as any).seasonId);
      console.log('🎯 userSeasonId from usePermissions:', userSeasonId);
    }
  }, [user, userSeasonId]);
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch season details for the committee admin's assigned season
  const fetchCurrentSeason = useCallback(async () => {
      if (!user || user.role !== 'committee_admin' || !userSeasonId) {
        console.log('Skipping season fetch - user not committee admin or no season assigned');
        return;
      }

      try {
        // Check cache first
        const cacheKey = `committee_season_${userSeasonId}`;
        const cachedSeason = getSmartCache<any>(cacheKey, CACHE_DURATIONS.MEDIUM);
        
        if (cachedSeason) {
          console.log('📋 Using cached season data');
          setCurrentSeason(cachedSeason);
          return;
        }
        
        console.log('🔥 Fetching season from Firebase:', userSeasonId);
        // Fetch the assigned season
        const seasonRef = doc(db, 'seasons', userSeasonId);
        const seasonSnapshot = await getDoc(seasonRef);
        
        if (seasonSnapshot.exists()) {
          const seasonData = { id: seasonSnapshot.id, ...seasonSnapshot.data() };
          console.log('Season data:', seasonData);
          
          // Cache the season data
          setSmartCache(cacheKey, seasonData, CACHE_DURATIONS.MEDIUM);
          setCurrentSeason(seasonData);
        } else {
          console.log('Season not found:', userSeasonId);
        }
      } catch (err) {
        console.error('Error fetching season:', err);
      }
    }, [user, userSeasonId]);

  useEffect(() => {
    fetchCurrentSeason();
  }, [fetchCurrentSeason]);

  // Fetch player statistics with smart caching
  const fetchPlayerStats = useCallback(async () => {
      if (!user || user.role !== 'committee_admin') return;

      try {
        // Check cache first
        const cacheKey = 'committee_player_stats';
        const cachedStats = getSmartCache<any>(cacheKey, CACHE_DURATIONS.MEDIUM);
        
        if (cachedStats) {
          console.log('📋 Using cached player stats');
          setPlayerStats(cachedStats);
          return;
        }
        
        console.log('🔥 Fetching player stats from API...');
        // Fetch all players to calculate stats
        const response = await fetch('/api/players');
        const { data: players, success } = await response.json();

        if (success) {
          const eligible = players.filter((p: any) => p.is_auction_eligible);
          
          // Group by position
          const positionGroups: { [key: string]: number } = {
            'GK': 0,
            'DEF': 0,
            'MID': 0,
            'FWD': 0
          };

          eligible.forEach((player: any) => {
            const pos = player.position?.toUpperCase() as string;
            
            // Check each position group
            for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
              if ((positions as readonly string[]).includes(pos)) {
                positionGroups[group]++;
                break;
              }
            }
          });

          const stats = {
            total: players.length,
            eligible: eligible.length,
            byPosition: positionGroups
          };
          
          // Cache the calculated stats
          setSmartCache(cacheKey, stats, CACHE_DURATIONS.MEDIUM);
          setPlayerStats(stats);
        }
      } catch (err) {
        console.error('Error fetching player stats:', err);
      }
    }, [user]);

  useEffect(() => {
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  // Fetch teams for current season
  const fetchTeams = useCallback(async () => {
      if (!userSeasonId || !user || user.role !== 'committee_admin') return;

      try {
        const response = await fetchWithTokenRefresh(`/api/team/all?season_id=${userSeasonId}`);
        const data = await response.json();

        if (data.success && data.data?.teams) {
          console.log('✅ Fetched teams:', data.data.teams.length);
          console.log('📸 First team logo:', data.data.teams[0]?.team?.logoUrl);
          setTeams(data.data.teams);
        } else {
          console.log('❌ Failed to fetch teams:', data.error);
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    }, [userSeasonId, user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Fetch active rounds and tiebreakers
  const fetchActiveRounds = useCallback(async () => {
      if (!userSeasonId || !user || user.role !== 'committee_admin') return;

      setLoadingRounds(true);
      try {
        // Fetch active rounds
        const roundsResponse = await fetchWithTokenRefresh(`/api/admin/rounds?season_id=${userSeasonId}&status=active`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const roundsData = await roundsResponse.json();

        if (roundsData.success) {
          setActiveRounds(roundsData.data || []);
        }

        // Fetch tiebreakers for active rounds
        const tbResponse = await fetchWithTokenRefresh(`/api/admin/tiebreakers?seasonId=${userSeasonId}&status=active`);
        const tbData = await tbResponse.json();

        if (tbData.success && tbData.data?.tiebreakers) {
          // Group tiebreakers by round_id
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
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchActiveRounds, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveRounds]);

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

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <header className="mb-8 hidden sm:block">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                Committee Dashboard
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Manage your assigned season
              </p>
            </div>
            
            <div className="bg-[#0066FF]/10 text-[#0066FF] px-4 py-2 rounded-lg border border-[#0066FF]/20">
              <div className="text-sm font-medium">Current Season</div>
              <div className="font-bold">{currentSeason?.name || 'Loading...'}</div>
              <div className="text-xs opacity-75">{teams.length} teams</div>
            </div>
          </div>
        </header>

        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col gap-5 mb-6">
            {/* Navigation Cards */}
            <div className="glass rounded-2xl p-5 mb-8 shadow-lg backdrop-blur-md border border-white/20">
              <div className="mb-6">
                <h2 className="text-xl font-bold gradient-text mb-5">Quick Navigation</h2>
                
                {/* Team & Player Management */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Team & Player Management</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/dashboard/committee/teams" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Season Teams</h4>
                      </div>
                      <p className="text-sm text-gray-600">View teams registered for current season</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/registration" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Team Registration</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage team registration for season</p>
                    </Link>
                    
                    <Link href={userSeasonId ? `/register/players?season=${userSeasonId}` : '#'} className="glass group rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-500/10 text-purple-600 group-hover:from-purple-600/30 group-hover:to-purple-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">Player Registration</h4>
                      </div>
                      <p className="text-sm text-gray-600">Register players to teams for season</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/players" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">All Players</h4>
                      </div>
                      <p className="text-sm text-gray-600">Browse all players in database</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/contracts" className="glass group rounded-2xl p-4 border border-white/10 hover:border-orange-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-500/10 text-orange-600 group-hover:from-orange-600/30 group-hover:to-orange-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-orange-600 transition-colors">Player Contracts</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage 2-season player contracts</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/team-contracts" className="glass group rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-500/10 text-purple-600 group-hover:from-purple-600/30 group-hover:to-purple-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">Team Contracts</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage team 2-season contracts & penalties</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/player-ratings" className="glass group rounded-2xl p-4 border border-white/10 hover:border-amber-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-600/20 to-amber-500/10 text-amber-600 group-hover:from-amber-600/30 group-hover:to-amber-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-amber-600 transition-colors">Player Ratings</h4>
                      </div>
                      <p className="text-sm text-gray-600">Assign star ratings & auto-distribute categories</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/real-players" className="glass group rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 text-emerald-600 group-hover:from-emerald-600/30 group-hover:to-emerald-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-emerald-600 transition-colors">SS Members (Real Players)</h4>
                      </div>
                      <p className="text-sm text-gray-600">Assign teams & auction values for SS Members</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/fantasy/create" className="glass group rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-pink-500/10 text-purple-600 group-hover:from-purple-600/30 group-hover:to-pink-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">🏆 Fantasy League</h4>
                      </div>
                      <p className="text-sm text-gray-600">Create league & manage draft assignments</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/fantasy/enable-teams" className="glass group rounded-2xl p-4 border border-white/10 hover:border-blue-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-500/10 text-blue-600 group-hover:from-blue-600/30 group-hover:to-indigo-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">✅ Enable Fantasy Teams</h4>
                      </div>
                      <p className="text-sm text-gray-600">Bulk enable fantasy participation for teams</p>
                    </Link>
                  </div>
                </div>
                
                {/* Auction Configuration */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Auction Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/dashboard/committee/auction-settings" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Auction Settings</h4>
                      </div>
                      <p className="text-sm text-gray-600">Configure auction rounds and rules</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/position-groups" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Position Groups</h4>
                      </div>
                      <p className="text-sm text-gray-600">Organize players into auction groups (CB, DMF, CMF, AMF, CF)</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/database" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Database Management</h4>
                      </div>
                      <p className="text-sm text-gray-600">Import/export player data</p>
                    </Link>
                    
                    <Link href="/dashboard/committee/rounds" className="glass group rounded-2xl p-4 border border-white/10 hover:border-green-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-400/10 text-green-600 group-hover:from-green-500/30 group-hover:to-green-400/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-green-600 transition-colors">Create Rounds</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage auction rounds and bidding</p>
                    </Link>
                  </div>
                </div>
                
                {/* System Administration */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">System Administration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/dashboard/committee/team-management" className="glass group rounded-2xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Team Management</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage tournament teams, members, and matches</p>
                    </Link>
                  </div>
                </div>
                
                {/* Awards & Recognition */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Awards & Recognition</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/dashboard/committee/awards" className="glass group rounded-2xl p-4 border border-white/10 hover:border-amber-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1 bg-gradient-to-br from-amber-50/50 to-yellow-50/50">
                      <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-600/20 to-yellow-500/10 text-amber-600 group-hover:from-amber-600/30 group-hover:to-yellow-500/20 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <h4 className="ml-3 text-base font-semibold text-gray-800 group-hover:text-amber-600 transition-colors">🏆 Awards Management</h4>
                      </div>
                      <p className="text-sm text-gray-600">Manage POTD, POTW, Team of the Day & Season awards</p>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Player Selection Stats */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Auction Player Selection
              </h2>
              
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/committee/player-selection" className="inline-flex items-center px-4 py-2 bg-white/30 hover:bg-white/50 text-indigo-600 text-sm font-medium rounded-lg transition-colors border border-indigo-100/30">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Manage Player Selection
                </Link>
                
                <button className="inline-flex items-center px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-700 text-sm font-medium rounded-lg transition-colors border border-green-200/30">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Create Round
                </button>
              </div>
            </div>
            
            <div className="glass p-5 rounded-xl backdrop-blur-sm bg-white/10 mb-5 border border-white/10">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <h3 className="text-md font-medium text-gray-800 mb-4">Auction Eligible Players</h3>
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">Eligible Players</span>
                        <span className="text-sm text-indigo-600 font-medium">{playerStats.eligible} / {playerStats.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                          style={{ width: `${playerStats.total > 0 ? (playerStats.eligible / playerStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                      {['GK', 'DEF', 'MID', 'FWD'].map((position) => (
                        <div key={position} className="glass p-3 rounded-xl bg-white/30 backdrop-blur-sm border border-white/10">
                          <div className="flex items-center mb-1.5">
                            <span className={`w-3 h-3 rounded-full mr-1.5 ${
                              position === 'GK' ? 'bg-yellow-400' :
                              position === 'DEF' ? 'bg-blue-400' :
                              position === 'MID' ? 'bg-green-400' : 'bg-red-400'
                            }`}></span>
                            <span className="text-xs font-medium text-gray-600">{position}</span>
                          </div>
                          <p className="text-2xl font-bold text-indigo-600 text-center">
                            {playerStats.byPosition[position] || 0}
                          </p>
                          <p className="text-xs text-gray-500 text-center mt-1">
                            {position === 'GK' ? '🧤 Keeper' : 
                             position === 'DEF' ? '🛡️ Defenders' : 
                             position === 'MID' ? '⚙️ Midfield' : '⚽ Forwards'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Active Rounds Section */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Active Rounds
                {activeRounds.length > 0 && (
                  <span className="ml-2 text-xs font-medium px-2 py-1 bg-green-500/20 text-green-700 rounded-full">
                    {activeRounds.length}
                  </span>
                )}
              </h2>
              
              <Link href="/dashboard/committee/rounds" className="text-xs font-medium text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors">
                Manage All Rounds
              </Link>
            </div>
            
            {loadingRounds ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF] mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading rounds...</p>
              </div>
            ) : activeRounds.length === 0 ? (
              <div className="glass p-5 rounded-xl backdrop-blur-sm bg-white/10 border border-white/10 text-center">
                <p className="text-sm text-gray-600">No active rounds at the moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeRounds.map((round) => {
                  const tiebreakers = roundTiebreakers[round.id] || [];
                  
                  return (
                    <div key={round.id} className="glass p-4 rounded-xl backdrop-blur-sm bg-white/10 border border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-green-500/20 text-green-700 text-xs font-medium rounded-full">
                            {round.position}
                          </span>
                          <div>
                            <h3 className="font-medium text-gray-800">{round.position} Round</h3>
                            <p className="text-xs text-gray-500">Max {round.max_bids_per_team} bids per team</p>
                          </div>
                        </div>
                        <Link 
                          href={`/dashboard/committee/rounds`}
                          className="text-xs font-medium text-[#0066FF] hover:text-[#0052CC] transition-colors"
                        >
                          View Details →
                        </Link>
                      </div>
                      
                      {/* Round Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-500">Total Bids</p>
                          <p className="text-lg font-bold text-[#0066FF]">{round.total_bids || 0}</p>
                        </div>
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-500">Teams</p>
                          <p className="text-lg font-bold text-[#0066FF]">{round.teams_bid || 0}</p>
                        </div>
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-500">Tiebreakers</p>
                          <p className="text-lg font-bold text-orange-600">{tiebreakers.length}</p>
                        </div>
                        <div className="glass p-2 rounded-lg bg-white/30">
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="text-xs font-medium text-green-600">ACTIVE</p>
                        </div>
                      </div>
                      
                      {/* Tiebreakers */}
                      {tiebreakers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700 flex items-center">
                              <svg className="w-4 h-4 mr-1.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Active Tiebreakers
                            </h4>
                            <Link 
                              href="/dashboard/committee/rounds"
                              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                            >
                              Manage →
                            </Link>
                          </div>
                          <div className="space-y-2">
                            {tiebreakers.slice(0, 3).map((tb: any) => (
                              <div key={tb.id} className="flex items-center justify-between p-2 bg-orange-50/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  <span className="text-sm font-medium text-gray-800">{tb.player_name}</span>
                                  <span className="text-xs text-gray-500">({tb.position})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600">{tb.teams_involved || 0} teams</span>
                                  <span className="text-xs font-medium text-orange-600">£{tb.original_amount?.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                            {tiebreakers.length > 3 && (
                              <div className="text-center pt-1">
                                <Link 
                                  href="/dashboard/committee/rounds"
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  +{tiebreakers.length - 3} more tiebreakers
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Bulk Bidding Round */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Bulk Bidding Round
              </h2>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-gray-500 px-3 py-1.5 bg-white/30 rounded-full">
                  No Active Round
                </div>
                <Link href="/dashboard/committee/bulk-rounds" className="text-xs font-medium text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors">
                  View All Rounds
                </Link>
                <button className="text-xs font-medium text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors">
                  Manage Tiebreakers
                </button>
              </div>
            </div>
            
            <div className="glass p-5 rounded-xl backdrop-blur-sm bg-white/10 mb-5 border border-white/10">
              <h3 className="text-md font-medium text-gray-800 mb-3">How It Works</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-xs font-bold mr-2 mt-0.5">1</span>
                  <p className="text-sm text-gray-700">
                    Teams can bid on multiple players at a fixed base price.
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-xs font-bold mr-2 mt-0.5">2</span>
                  <p className="text-sm text-gray-700">
                    If multiple teams bid for the same player, a tiebreaker auction will be held.
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0066FF]/20 text-[#0066FF] flex items-center justify-center text-xs font-bold mr-2 mt-0.5">3</span>
                  <p className="text-sm text-gray-700">
                    This special round helps teams fill their remaining slots and ensures all players are assigned.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Team Summary */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Team Summary
              </h2>
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-gray-500 px-3 py-1.5 bg-white/30 rounded-full flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 4 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {teams.length} Teams
                </div>
                <Link href="/dashboard/committee/teams" className="text-xs font-medium text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View All Teams
                </Link>
              </div>
            </div>
            
            {teams.length === 0 ? (
              <div className="text-center py-12 glass rounded-xl">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-600 mb-2">No teams found</h3>
                <p className="text-gray-500 mb-4">Start by registering teams for the auction system</p>
                <Link href="/dashboard/committee/registration" className="inline-flex items-center px-5 py-2.5 bg-[#0066FF] border border-transparent rounded-lg font-medium text-sm text-white tracking-wider hover:bg-[#0052CC] transition ease-in-out duration-150">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Register Teams
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.slice(0, 6).map((teamData: any) => (
                  <div key={teamData.team.id} className="glass rounded-xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      {teamData.team.logoUrl ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center relative">
                          <Image 
                            src={teamData.team.logoUrl} 
                            alt={teamData.team.name} 
                            width={48}
                            height={48}
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                          <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{teamData.team.name}</h3>
                        <p className="text-xs text-gray-500">{teamData.totalPlayers} players</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="glass p-2 rounded-lg bg-white/20">
                        <p className="text-xs text-gray-500">Balance</p>
                        <p className="font-semibold text-[#0066FF]">£{teamData.team.balance?.toLocaleString()}</p>
                      </div>
                      <div className="glass p-2 rounded-lg bg-white/20">
                        <p className="text-xs text-gray-500">Squad Value</p>
                        <p className="font-semibold text-green-600">£{teamData.totalValue?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
