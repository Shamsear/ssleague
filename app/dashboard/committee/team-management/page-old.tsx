'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { getFixturesByRounds, TournamentRound } from '@/lib/firebase/fixtures';

interface Team {
  team: {
    id: string;
    name: string;
    logoUrl?: string;
    balance: number;
  };
  totalPlayers: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
}

/**
 * LEGACY BACKUP - Original Team Management Page (Pre-Revamp)
 * This is the original implementation before the UI/UX overhaul
 * Date: October 2024
 * 
 * This component has been preserved for reference and potential rollback
 * The new implementation is in the main page.tsx file
 */
export default function LegacyTeamManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasonName, setSeasonName] = useState<string>('');
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    const fetchTeams = async () => {
      if (!user || user.role !== 'committee_admin') {
        console.log('Team fetch skipped: user not authorized');
        return;
      }
      
      if (!userSeasonId) {
        console.log('Team fetch skipped: no season ID');
        setIsLoadingTeams(false);
        return;
      }
      
      try {
        setIsLoadingTeams(true);
        console.log('🔍 Fetching season:', userSeasonId);
        
        // Get current season
        const season = await getSeasonById(userSeasonId);
        console.log('📅 Season:', season);
        
        if (!season) {
          console.warn('⚠️ Season not found');
          setIsLoadingTeams(false);
          return;
        }
        
        setSeasonName(season.name);
        console.log(`✅ Season: ${season.name} (${season.id})`);
        
        // Fetch teams for season
        const url = `/api/team/all?season_id=${userSeasonId}`;
        console.log('🔍 Fetching teams from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📦 API Response:', data);
        
        if (!response.ok) {
          console.error('❌ API Error:', data.error);
          setIsLoadingTeams(false);
          return;
        }
        
        if (data.success && data.data.teams) {
          console.log(`✅ Found ${data.data.teams.length} teams:`, data.data.teams);
          setTeams(data.data.teams);
        } else {
          console.warn('⚠️ No teams in response');
          setTeams([]);
        }
        
        // Fetch recent matches
        try {
          setIsLoadingMatches(true);
          const fixtureRounds = await getFixturesByRounds(userSeasonId);
          
          // Get all completed matches from all rounds
          const allMatches = fixtureRounds.flatMap(round => 
            round.matches
              .filter(match => match.status === 'completed')
              .map(match => ({
                ...match,
                round_number: round.round_number,
                leg: round.leg
              }))
          );
          
          // Sort by updated_at or created_at, most recent first
          const sortedMatches = allMatches.sort((a, b) => {
            const dateA = a.updated_at || a.created_at || new Date(0);
            const dateB = b.updated_at || b.created_at || new Date(0);
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          // Take only the 5 most recent
          setRecentMatches(sortedMatches.slice(0, 5));
        } catch (error) {
          console.error('❌ Error fetching matches:', error);
          setRecentMatches([]);
        } finally {
          setIsLoadingMatches(false);
        }
      } catch (error) {
        console.error('❌ Error fetching teams:', error);
      } finally {
        setIsLoadingTeams(false);
      }
    };
    
    fetchTeams();
  }, [user]);

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
        {/* Page Header - hidden on mobile */}
        <header className="mb-8 hidden sm:block">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                Team Management Dashboard
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Manage teams, players, and categories
              </p>
            </div>
            <Link 
              href="/dashboard/committee" 
              className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </header>

        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col gap-5 mb-6">
            <h2 className="text-2xl font-bold gradient-text">Quick Navigation</h2>
            
            {/* Navigation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Link href="/dashboard/committee/team-management/categories" className="glass group rounded-2xl p-5 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 text-[#0066FF] group-hover:from-[#0066FF]/30 group-hover:to-[#0066FF]/20 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-[#0066FF] transition-colors">Categories</h3>
                </div>
                <p className="text-sm text-gray-600">Manage player categories, colors and point configurations</p>
              </Link>
              
              <Link href="/dashboard/committee/team-management/team-standings" className="glass group rounded-2xl p-5 border border-white/10 hover:border-blue-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 text-blue-600 group-hover:from-blue-500/30 group-hover:to-blue-400/20 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">Team Standings</h3>
                </div>
                <p className="text-sm text-gray-600">View league table and team rankings</p>
              </Link>
              
              <Link href="/dashboard/committee/team-management/player-stats" className="glass group rounded-2xl p-5 border border-white/10 hover:border-purple-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 text-purple-600 group-hover:from-purple-500/30 group-hover:to-purple-400/20 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">Player Statistics</h3>
                </div>
                <p className="text-sm text-gray-600">View individual player performance metrics</p>
              </Link>
              
              <Link href="/dashboard/committee/team-management/tournament" className="glass group rounded-2xl p-5 border border-white/10 hover:border-green-500/30 transition-all duration-300 shadow-sm hover:shadow-lg flex flex-col gap-3 hover:-translate-y-1">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-400/10 text-green-600 group-hover:from-green-500/30 group-hover:to-green-400/20 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-800 group-hover:text-green-600 transition-colors">Tournament</h3>
                </div>
                <p className="text-sm text-gray-600">Manage fixtures, standings, and tournament operations</p>
              </Link>
            </div>
          </div>
        
          {/* Recently Completed Matches */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold gradient-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Recent Matches
              </h2>
              
              <Link 
                href="/dashboard/committee/team-management/tournament"
                className="inline-flex items-center px-4 py-2 bg-white/30 hover:bg-white/50 text-indigo-600 text-sm font-medium rounded-lg transition-colors border border-indigo-100/30"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View All Matches
              </Link>
            </div>
            
            {isLoadingMatches ? (
              <div className="text-center py-10 glass rounded-xl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading matches...</p>
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="text-center py-10 glass rounded-xl">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 mb-3">No completed matches yet</p>
                <p className="text-sm text-gray-400">Matches will appear here once they are completed</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match) => (
                  <div key={match.id} className="glass rounded-xl p-4 border border-white/10 hover:border-green-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Round {match.round_number}
                        </span>
                        <span className="text-xs text-gray-500">
                          {match.leg === 'first' ? '1st Leg' : '2nd Leg'} - Match {match.match_number}
                        </span>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Completed
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`flex-1 text-right ${
                          match.result === 'home_win' ? 'font-bold text-green-600' : 'text-gray-600'
                        }`}>
                          <span className="text-sm">{match.home_team_name}</span>
                          {match.home_score !== undefined && (
                            <span className="ml-2 text-lg">{match.home_score}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-bold">-</span>
                        <div className={`flex-1 text-left ${
                          match.result === 'away_win' ? 'font-bold text-green-600' : 'text-gray-600'
                        }`}>
                          {match.away_score !== undefined && (
                            <span className="mr-2 text-lg">{match.away_score}</span>
                          )}
                          <span className="text-sm">{match.away_team_name}</span>
                        </div>
                      </div>
                      {match.result === 'draw' && (
                        <span className="ml-4 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">Draw</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        
          {/* Team Overview Section */}
          <div className="glass rounded-2xl p-5 border border-white/10 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold gradient-text flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Team Overview
                </h2>
                {seasonName && (
                  <p className="text-sm text-gray-500 mt-1 ml-7">{seasonName}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-gray-500 px-3 py-1.5 bg-white/30 rounded-full flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {teams.length} Teams
                </div>
                
                <button className="text-xs font-medium text-[#0066FF] px-3 py-1.5 bg-white/50 rounded-full hover:bg-white/80 transition-colors flex items-center opacity-50 cursor-not-allowed">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Leaderboard
                </button>
              </div>
            </div>
            
            {isLoadingTeams ? (
              <div className="text-center py-10 glass rounded-xl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
                <p className="text-gray-500">Loading teams...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-10 glass rounded-xl">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-600 mb-2">No Teams Yet</h3>
                <p className="text-gray-500 mb-4">
                  {seasonName ? `No teams have registered for ${seasonName} yet` : 'No active season found'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((teamData) => (
                  <div
                    key={teamData.team.id}
                    className="glass rounded-xl p-4 border border-white/10 hover:border-[#0066FF]/30 transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {teamData.team.logoUrl ? (
                        <img
                          src={teamData.team.logoUrl}
                          alt={teamData.team.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-[#0066FF]">
                            {teamData.team.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {teamData.team.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {teamData.totalPlayers} players
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Real Players ($)</span>
                        <span className="font-semibold text-blue-600">
                          ${(teamData as any).realPlayerSpent?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Football (€)</span>
                        <span className="font-semibold text-purple-600">
                          €{(teamData as any).footballSpent?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Avg Rating</span>
                        <span className="font-semibold text-gray-900">
                          {teamData.avgRating.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">$ Balance</span>
                        <span className="font-semibold text-green-600">
                          ${teamData.team.dollar_balance?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">€ Balance</span>
                        <span className="font-semibold text-green-600">
                          €{teamData.team.euro_balance?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-200/50">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Position Distribution</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(teamData.positionBreakdown)
                          .filter(([_, count]) => count > 0)
                          .slice(0, 6)
                          .map(([position, count]) => (
                            <span
                              key={position}
                              className="text-xs px-2 py-0.5 bg-[#0066FF]/10 text-[#0066FF] rounded-full"
                            >
                              {position}: {count}
                            </span>
                          ))}
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