'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { getFixturesByRounds } from '@/lib/firebase/fixtures';

interface Team {
  team: {
    id: string;
    name: string;
    logoUrl?: string;
    balance: number;
    dollar_balance?: number;
    euro_balance?: number;
  };
  totalPlayers: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
  realPlayerSpent?: number;
  footballSpent?: number;
}

interface Match {
  id: string;
  round_number: number;
  leg: string;
  match_number: number;
  status: string;
  result: string;
  home_team_name: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  updated_at?: any;
  created_at?: any;
}

export default function TeamManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasonName, setSeasonName] = useState<string>('');
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
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
      if (!user || user.role !== 'committee_admin') return;
      if (!userSeasonId) {
        setIsLoadingTeams(false);
        return;
      }
      
      try {
        setIsLoadingTeams(true);
        
        const season = await getSeasonById(userSeasonId);
        if (!season) {
          setIsLoadingTeams(false);
          return;
        }
        
        setSeasonName(season.name);
        
        const response = await fetch(`/api/team/all?season_id=${userSeasonId}`);
        const data = await response.json();
        
        if (data.success && data.data.teams) {
          setTeams(data.data.teams);
        } else {
          setTeams([]);
        }
        
        // Fetch recent matches
        try {
          setIsLoadingMatches(true);
          const fixtureRounds = await getFixturesByRounds(userSeasonId);
          
          const allMatches = fixtureRounds.flatMap(round => 
            round.matches
              .filter(match => match.status === 'completed')
              .map(match => ({
                ...match,
                round_number: round.round_number,
                leg: round.leg
              }))
          );
          
          const sortedMatches = allMatches.sort((a, b) => {
            const dateA = a.updated_at || a.created_at || new Date(0);
            const dateB = b.updated_at || b.created_at || new Date(0);
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          setRecentMatches(sortedMatches.slice(0, 5));
        } catch (error) {
          console.error('Error fetching matches:', error);
          setRecentMatches([]);
        } finally {
          setIsLoadingMatches(false);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setIsLoadingTeams(false);
      }
    };
    
    fetchTeams();
  }, [user, userSeasonId]);

  if (loading) {
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
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-3">
                Team Management
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-gray-600 text-base">
                  Complete control center for teams and tournament
                </p>
                {seasonName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-[#0066FF]/10 to-blue-500/10 text-[#0066FF] text-sm font-semibold border border-[#0066FF]/20">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {seasonName}
                  </span>
                )}
              </div>
            </div>
            <Link 
              href="/dashboard/committee" 
              className="inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-[#0066FF] to-blue-600 hover:from-[#0052CC] hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Quick Navigation - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="glass rounded-3xl p-6 shadow-xl border border-white/30 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text flex items-center">
                  <svg className="w-7 h-7 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Actions
                </h2>
                <span className="text-xs bg-gradient-to-r from-[#0066FF]/20 to-blue-500/20 text-[#0066FF] px-3 py-1.5 rounded-full font-semibold">
                  4 Modules
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link 
                  href="/dashboard/committee/team-management/categories" 
                  className="group glass rounded-2xl p-5 border border-white/20 hover:border-[#0066FF]/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#0066FF]/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center mb-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF] to-blue-600 text-white group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-[#0066FF] transition-colors">Categories</h3>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">Manage player categories, colors and point configurations</p>
                  </div>
                </Link>
                
                <Link 
                  href="/dashboard/committee/team-management/team-standings" 
                  className="group glass rounded-2xl p-5 border border-white/20 hover:border-blue-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center mb-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">Team Standings</h3>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">View league table and team rankings</p>
                  </div>
                </Link>
                
                <Link 
                  href="/dashboard/committee/team-management/player-stats" 
                  className="group glass rounded-2xl p-5 border border-white/20 hover:border-purple-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center mb-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors">Player Statistics</h3>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">View individual player performance metrics</p>
                  </div>
                </Link>
                
                <Link 
                  href="/dashboard/committee/team-management/tournament" 
                  className="group glass rounded-2xl p-5 border border-white/20 hover:border-green-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="flex items-center mb-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-600 transition-colors">Tournament</h3>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">Manage fixtures, standings, and tournament operations</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Summary Card */}
          <div className="lg:col-span-1">
            <div className="glass rounded-3xl p-6 shadow-xl border border-white/30 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold gradient-text">Overview</h2>
                <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              
              <div className="space-y-4">
                <div className="glass rounded-xl p-4 border border-white/20 hover:border-[#0066FF]/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                      <p className="text-3xl font-bold gradient-text">
                        {isLoadingTeams ? '...' : teams.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-blue-500/20">
                      <svg className="w-8 h-8 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-4 border border-white/20 hover:border-green-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Players</p>
                      <p className="text-3xl font-bold text-green-600">
                        {isLoadingTeams ? '...' : teams.reduce((sum, t) => sum + t.totalPlayers, 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-4 border border-white/20 hover:border-purple-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avg Rating</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {isLoadingTeams ? '...' : teams.length > 0 
                          ? (teams.reduce((sum, t) => sum + t.avgRating, 0) / teams.length).toFixed(1)
                          : '0.0'
                        }
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Matches Section */}
        <div className="glass rounded-3xl p-6 shadow-xl border border-white/30 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold gradient-text flex items-center">
              <svg className="w-7 h-7 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Recent Matches
            </h2>
            
            <Link 
              href="/dashboard/committee/team-management/tournament"
              className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View All Matches
            </Link>
          </div>
          
          {isLoadingMatches ? (
            <div className="text-center py-12 glass rounded-2xl">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading matches...</p>
            </div>
          ) : recentMatches.length === 0 ? (
            <div className="text-center py-12 glass rounded-2xl">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 font-semibold mb-2">No completed matches yet</p>
              <p className="text-sm text-gray-500">Matches will appear here once they are completed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div key={match.id} className="glass rounded-2xl p-5 border border-white/20 hover:border-green-500/40 transition-all duration-300 hover:shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full font-bold shadow-sm">
                        Round {match.round_number}
                      </span>
                      <span className="text-xs text-gray-600 font-medium">
                        {match.leg === 'first' ? '1st Leg' : '2nd Leg'} · Match {match.match_number}
                      </span>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold">
                      ✓ Completed
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`flex-1 text-right ${
                        match.result === 'home_win' ? 'font-bold text-green-600' : 'text-gray-700'
                      }`}>
                        <span className="text-sm font-semibold">{match.home_team_name}</span>
                        {match.home_score !== undefined && (
                          <span className="ml-3 text-2xl font-bold">{match.home_score}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-400 font-bold px-2">VS</span>
                      <div className={`flex-1 text-left ${
                        match.result === 'away_win' ? 'font-bold text-green-600' : 'text-gray-700'
                      }`}>
                        {match.away_score !== undefined && (
                          <span className="mr-3 text-2xl font-bold">{match.away_score}</span>
                        )}
                        <span className="text-sm font-semibold">{match.away_team_name}</span>
                      </div>
                    </div>
                    {match.result === 'draw' && (
                      <span className="ml-4 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-full font-bold">DRAW</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Overview Section */}
        <div className="glass rounded-3xl p-6 shadow-xl border border-white/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold gradient-text flex items-center">
                <svg className="w-7 h-7 mr-3 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Teams
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-600 px-4 py-2 bg-white/50 rounded-xl flex items-center shadow-sm">
                <svg className="w-4 h-4 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {teams.length} Teams
              </div>
            </div>
          </div>
          
          {isLoadingTeams ? (
            <div className="text-center py-12 glass rounded-2xl">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-[#0066FF] mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading teams...</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12 glass rounded-2xl">
              <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-600 mb-2">No Teams Yet</h3>
              <p className="text-gray-500">
                {seasonName ? `No teams have registered for ${seasonName} yet` : 'No active season found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {teams.map((teamData) => (
                <div
                  key={teamData.team.id}
                  className="glass rounded-2xl p-5 border border-white/20 hover:border-[#0066FF]/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3 mb-5">
                    {teamData.team.logoUrl ? (
                      <img
                        src={teamData.team.logoUrl}
                        alt={teamData.team.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/30 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0066FF] to-blue-600 flex items-center justify-center shadow-lg">
                        <span className="text-xl font-bold text-white">
                          {teamData.team.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-lg">
                        {teamData.team.name}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {teamData.totalPlayers} players
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                      <span className="text-gray-700 font-medium">Real Players ($)</span>
                      <span className="font-bold text-blue-600">
                        ${(teamData.realPlayerSpent || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                      <span className="text-gray-700 font-medium">Football (€)</span>
                      <span className="font-bold text-purple-600">
                        €{(teamData.footballSpent || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                      <span className="text-gray-700 font-medium">Avg Rating</span>
                      <span className="font-bold text-gray-900">
                        ⭐ {teamData.avgRating.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                        <span className="text-gray-700 font-medium text-xs">$ Balance</span>
                        <span className="font-bold text-green-600 text-sm">
                          ${(teamData.team.dollar_balance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm glass rounded-lg p-2.5">
                        <span className="text-gray-700 font-medium text-xs">€ Balance</span>
                        <span className="font-bold text-green-600 text-sm">
                          €{(teamData.team.euro_balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Position Distribution</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(teamData.positionBreakdown)
                        .filter(([_, count]) => count > 0)
                        .slice(0, 6)
                        .map(([position, count]) => (
                          <span
                            key={position}
                            className="text-xs px-2.5 py-1 bg-gradient-to-r from-[#0066FF]/10 to-blue-500/10 text-[#0066FF] rounded-full font-semibold border border-[#0066FF]/20"
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
  );
}
