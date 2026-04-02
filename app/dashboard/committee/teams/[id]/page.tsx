'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import Link from 'next/link';
import Image from 'next/image';
import ContractInfo from '@/components/ContractInfo';

interface Player {
  id: string;
  name: string;
  position: string;
  rating: number;
  category?: string;
  value?: number;
  is_real_player?: boolean;
}

interface TeamDetails {
  id: string;
  name: string;
  logoUrl: string | null;
  balance: number;
  dollar_balance?: number;
  euro_balance?: number;
  dollar_spent?: number;
  euro_spent?: number;
  skipped_seasons?: number;
  penalty_amount?: number;
  last_played_season?: string;
  contract_id?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  is_auto_registered?: boolean;
  owner_uid?: string;
  owner_name?: string;
  owner_email?: string;
}

interface TeamData {
  team: TeamDetails;
  players: Player[];
  totalPlayers: number;
  totalValue: number;
  avgRating: number;
  positionBreakdown: { [key: string]: number };
  categoryBreakdown?: { [key: string]: number };
}

interface TournamentStat {
  tournament_id: string;
  tournament_name: string;
  tournament_type: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  points: number;
  clean_sheets: number;
  win_rate: string;
  goals_per_game: string;
  conceded_per_game: string;
}

interface OverallStat {
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  points: number;
  clean_sheets: number;
  win_rate: string;
  goals_per_game: string;
  conceded_per_game: string;
}

export default function TeamDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [tournamentStats, setTournamentStats] = useState<TournamentStat[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStat | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'stats'>('players');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'real' | 'football'>('all');

  const teamId = params?.id as string;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!userSeasonId || !teamId) {
        setError('Missing required parameters');
        setLoadingTeam(false);
        return;
      }

      try {
        setLoadingTeam(true);
        const response = await fetchWithTokenRefresh(
          `/api/team/${teamId}?season_id=${userSeasonId}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          setTeamData(data.data);
          setError(null);
        } else {
          setError(data.error || 'Team not found');
        }
      } catch (err) {
        console.error('Error fetching team details:', err);
        setError('Failed to load team details');
      } finally {
        setLoadingTeam(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId && teamId) {
      fetchTeamDetails();
    }
  }, [isCommitteeAdmin, userSeasonId, teamId]);

  // Fetch tournament stats when Statistics tab is opened
  useEffect(() => {
    const fetchTournamentStats = async () => {
      if (!userSeasonId || !teamId || activeTab !== 'stats') {
        return;
      }

      try {
        setLoadingStats(true);
        const response = await fetchWithTokenRefresh(
          `/api/teams/${teamId}/statistics?seasonId=${userSeasonId}`
        );
        const data = await response.json();

        if (data.success) {
          // Map the new API response to the old format
          const tournaments = data.tournaments || [];
          const overall = data.overall || null;
          
          // Transform tournament data to match old format
          const transformedTournaments = tournaments.map((t: any) => ({
            tournament_id: t.tournament_id,
            tournament_name: t.tournament_name,
            tournament_type: t.format,
            matches_played: t.matches_played,
            wins: t.wins,
            draws: t.draws,
            losses: t.losses,
            goals_scored: t.goals_for,
            goals_conceded: t.goals_against,
            goal_difference: t.goal_difference,
            points: t.points,
            clean_sheets: t.clean_sheets,
            win_rate: t.matches_played > 0 ? ((t.wins / t.matches_played) * 100).toFixed(1) : '0.0',
            goals_per_game: t.matches_played > 0 ? (t.goals_for / t.matches_played).toFixed(2) : '0.00',
            conceded_per_game: t.matches_played > 0 ? (t.goals_against / t.matches_played).toFixed(2) : '0.00',
          }));
          
          // Transform overall data to match old format
          const transformedOverall = overall ? {
            matches_played: overall.matches_played,
            wins: overall.wins,
            draws: overall.draws,
            losses: overall.losses,
            goals_scored: overall.goals_for,
            goals_conceded: overall.goals_against,
            goal_difference: overall.goal_difference,
            points: overall.points,
            clean_sheets: overall.clean_sheets,
            win_rate: overall.win_percentage.toString(),
            goals_per_game: overall.matches_played > 0 ? (overall.goals_for / overall.matches_played).toFixed(2) : '0.00',
            conceded_per_game: overall.matches_played > 0 ? (overall.goals_against / overall.matches_played).toFixed(2) : '0.00',
          } : null;
          
          setTournamentStats(transformedTournaments);
          setOverallStats(transformedOverall);
        }
      } catch (err) {
        console.error('Error fetching tournament stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId && teamId && activeTab === 'stats') {
      fetchTournamentStats();
    }
  }, [isCommitteeAdmin, userSeasonId, teamId, activeTab]);

  if (loading || loadingTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (error || !teamData) {
    return (
      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-screen-2xl">
          <div className="glass rounded-3xl p-8 shadow-xl border border-white/30 text-center">
            <svg className="w-20 h-20 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Team not found'}</p>
            <Link
              href="/dashboard/committee/teams"
              className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-[#0066FF] to-blue-600 hover:from-[#0052CC] hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Teams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { team, players } = teamData;
  
  // Separate players by type
  const realPlayers = players.filter(p => p.is_real_player);
  const footballPlayers = players.filter(p => !p.is_real_player);

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-screen-2xl">
        
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/committee/teams"
            className="inline-flex items-center text-gray-600 hover:text-[#0066FF] mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Teams
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 flex-shrink-0 bg-gradient-to-br from-[#0066FF]/10 to-blue-500/10 rounded-2xl flex items-center justify-center p-2 shadow-xl">
                {team.logoUrl ? (
                  <Image 
                    src={team.logoUrl} 
                    alt={team.name} 
                    width={80} 
                    height={80} 
                    className="object-contain w-full h-full" 
                  />
                ) : (
                  <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {team.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Active
                  </span>
                  {team.owner_name && (
                    <span className="text-sm text-gray-600">
                      Owner: <span className="font-semibold">{team.owner_name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
            <div className="text-xs text-gray-500 mb-1">Total Players</div>
            <div className="text-2xl font-bold text-purple-600">{players.length}</div>
            <div className="text-xs text-gray-400 mt-1">
              {realPlayers.length} Real · {footballPlayers.length} Football
            </div>
          </div>

          {team.dollar_balance !== undefined || team.euro_balance !== undefined ? (
            <>
              <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
                <div className="text-xs text-gray-500 mb-1">SSCoin Balance</div>
                <div className="text-2xl font-bold text-green-600">
                  SSCoin {team.dollar_balance?.toLocaleString() ?? '0'}
                </div>
              </div>

              <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
                <div className="text-xs text-gray-500 mb-1">eCoin Balance</div>
                <div className="text-2xl font-bold text-blue-600">
                  eCoin {team.euro_balance?.toLocaleString() ?? '0'}
                </div>
              </div>
            </>
          ) : (
            <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
              <div className="text-xs text-gray-500 mb-1">Balance</div>
              <div className="text-2xl font-bold text-[#0066FF]">
                eCoin {team.balance.toLocaleString()}
              </div>
            </div>
          )}

          <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
            <div className="text-xs text-gray-500 mb-1">Avg Rating</div>
            <div className="text-2xl font-bold text-amber-600">
              {teamData.avgRating.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Contract Info */}
        {(team.contract_id || team.skipped_seasons || team.penalty_amount) && (
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Contract Information
            </h2>
            <ContractInfo
              skippedSeasons={team.skipped_seasons}
              penaltyAmount={team.penalty_amount}
              lastPlayedSeason={team.last_played_season}
              contractId={team.contract_id}
              contractStartSeason={team.contract_start_season}
              contractEndSeason={team.contract_end_season}
              isAutoRegistered={team.is_auto_registered}
            />
          </div>
        )}



        {/* Tabs */}
        <div className="glass rounded-xl shadow-lg border border-white/30 overflow-hidden">
          <div className="flex border-b border-gray-200/50">
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 px-4 py-3 font-medium transition-all text-sm ${
                activeTab === 'players'
                  ? 'bg-gradient-to-r from-[#0066FF] to-blue-600 text-white'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              Players ({players.length})
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 px-4 py-3 font-medium transition-all text-sm ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-[#0066FF] to-blue-600 text-white'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              Statistics
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'players' ? (
              <>
                {/* Player Type Filter */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setPlayerFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      playerFilter === 'all'
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({players.length})
                  </button>
                  <button
                    onClick={() => setPlayerFilter('real')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      playerFilter === 'real'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Real ({realPlayers.length})
                  </button>
                  <button
                    onClick={() => setPlayerFilter('football')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      playerFilter === 'football'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Football ({footballPlayers.length})
                  </button>
                </div>

                {/* Player Grid */}
                {(() => {
                  const filteredPlayers = 
                    playerFilter === 'all' ? players :
                    playerFilter === 'real' ? realPlayers : footballPlayers;
                  
                  return filteredPlayers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredPlayers.map((player) => {
                        const CardWrapper = player.is_real_player ? Link : 'div';
                        const cardProps = player.is_real_player 
                          ? { href: `/dashboard/players/${player.id}` }
                          : {};
                        
                        return (
                          <CardWrapper
                            key={player.id}
                            {...cardProps}
                            className={`glass rounded-xl p-4 border border-white/20 hover:border-[#0066FF]/40 transition-all hover:shadow-lg ${
                              player.is_real_player ? 'cursor-pointer' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold text-gray-900 text-base truncate flex-1">
                                {player.name}
                              </h3>
                              {player.is_real_player && (
                                <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold rounded-full">
                                  Real
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {!player.is_real_player && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Position</span>
                                  <span className="font-semibold text-gray-900 px-2 py-0.5 bg-[#0066FF]/10 rounded">
                                    {player.position}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Rating</span>
                                <span className="font-semibold text-amber-600">
                                  ⭐ {player.rating.toFixed(1)}
                                </span>
                              </div>
                              {player.category && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Category</span>
                                  <span className="font-semibold text-purple-600">
                                    {player.category}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardWrapper>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-gray-600">No players in this category</p>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="space-y-6">
                {loadingStats ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading statistics...</p>
                  </div>
                ) : (
                  <>
                    {/* Overall Stats */}
                    {overallStats && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Overall Season Statistics
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                          <div className="glass rounded-xl p-4 text-center border-2 border-green-200">
                            <div className="text-3xl font-bold text-green-600 mb-1">{overallStats.matches_played}</div>
                            <div className="text-xs text-gray-600 font-medium">Matches</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center border-2 border-blue-200">
                            <div className="text-3xl font-bold text-blue-600 mb-1">{overallStats.wins}</div>
                            <div className="text-xs text-gray-600 font-medium">Wins</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center border-2 border-yellow-200">
                            <div className="text-3xl font-bold text-yellow-600 mb-1">{overallStats.draws}</div>
                            <div className="text-xs text-gray-600 font-medium">Draws</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center border-2 border-red-200">
                            <div className="text-3xl font-bold text-red-600 mb-1">{overallStats.losses}</div>
                            <div className="text-xs text-gray-600 font-medium">Losses</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center border-2 border-purple-200">
                            <div className="text-3xl font-bold text-purple-600 mb-1">{overallStats.points}</div>
                            <div className="text-xs text-gray-600 font-medium">Points</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center border-2 border-indigo-200">
                            <div className="text-3xl font-bold text-indigo-600 mb-1">{overallStats.win_rate}%</div>
                            <div className="text-xs text-gray-600 font-medium">Win Rate</div>
                          </div>
                        </div>

                        {/* Goals Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="glass rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-emerald-600 mb-1">{overallStats.goals_scored}</div>
                            <div className="text-xs text-gray-600 font-medium">Goals Scored</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-rose-600 mb-1">{overallStats.goals_conceded}</div>
                            <div className="text-xs text-gray-600 font-medium">Goals Conceded</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center">
                            <div className={`text-2xl font-bold mb-1 ${overallStats.goal_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {overallStats.goal_difference >= 0 ? '+' : ''}{overallStats.goal_difference}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Goal Difference</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-teal-600 mb-1">{overallStats.goals_per_game}</div>
                            <div className="text-xs text-gray-600 font-medium">Goals/Game</div>
                          </div>
                          <div className="glass rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-cyan-600 mb-1">{overallStats.clean_sheets}</div>
                            <div className="text-xs text-gray-600 font-medium">Clean Sheets</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tournament Breakdown */}
                    {tournamentStats.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Tournament Statistics
                        </h3>
                        <div className="space-y-4">
                          {tournamentStats.map((stat) => (
                            <div key={stat.tournament_id} className="glass rounded-xl p-5 border border-white/30 hover:border-[#0066FF]/30 transition-all">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="text-lg font-bold text-gray-900">{stat.tournament_name}</h4>
                                  <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mt-1 capitalize">
                                    {stat.tournament_type}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-[#0066FF]">{stat.points}</div>
                                  <div className="text-xs text-gray-500">Points</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-gray-900">{stat.matches_played}</div>
                                  <div className="text-xs text-gray-600">Played</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600">{stat.wins}</div>
                                  <div className="text-xs text-gray-600">Wins</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-yellow-600">{stat.draws}</div>
                                  <div className="text-xs text-gray-600">Draws</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-red-600">{stat.losses}</div>
                                  <div className="text-xs text-gray-600">Losses</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-emerald-600">{stat.goals_scored}</div>
                                  <div className="text-xs text-gray-600">GF</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-rose-600">{stat.goals_conceded}</div>
                                  <div className="text-xs text-gray-600">GA</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                                <div className="text-center">
                                  <div className={`text-sm font-bold ${stat.goal_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stat.goal_difference >= 0 ? '+' : ''}{stat.goal_difference}
                                  </div>
                                  <div className="text-xs text-gray-600">GD</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold text-indigo-600">{stat.win_rate}%</div>
                                  <div className="text-xs text-gray-600">Win Rate</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold text-cyan-600">{stat.clean_sheets}</div>
                                  <div className="text-xs text-gray-600">Clean Sheets</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      !overallStats && (
                        <div className="text-center py-12">
                          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h3 className="text-xl font-medium text-gray-600 mb-2">No Statistics Available</h3>
                          <p className="text-gray-500">This team hasn't played any matches yet this season</p>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
