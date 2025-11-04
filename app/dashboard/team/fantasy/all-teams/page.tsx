'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Users, Crown, Star, ChevronDown, Target, Award, TrendingUp } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyTeam {
  fantasy_team_id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  rank: number;
}

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  purchase_price: number;
  total_points: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export default function AllTeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FantasyTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string>('');

  // Expandable player state
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<any>(null);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Get user's team to find league ID
        const myTeamResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (myTeamResponse.status === 404) {
          setIsLoading(false);
          return;
        }

        const myTeamData = await myTeamResponse.json();
        const leagueId = myTeamData.team.fantasy_league_id;
        setMyTeamId(myTeamData.team.id);

        // Get all teams via leaderboard API
        const leaderboardResponse = await fetchWithTokenRefresh(`/api/fantasy/leaderboard/${leagueId}`);
        
        if (!leaderboardResponse.ok) {
          throw new Error('Failed to load teams');
        }

        const leaderboardData = await leaderboardResponse.json();
        setLeagueName(leaderboardData.league.name);
        setTeams(leaderboardData.leaderboard);

        // Auto-select first team
        if (leaderboardData.leaderboard.length > 0) {
          loadTeamPlayers(leaderboardData.leaderboard[0]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const loadTeamPlayers = async (team: FantasyTeam) => {
    setSelectedTeam(team);
    setIsLoadingPlayers(true);

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/teams/${team.fantasy_team_id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Team has not completed draft setup yet');
          setTeamPlayers([]);
          return;
        }
        throw new Error('Failed to load team players');
      }

      const data = await response.json();
      setTeamPlayers(data.players || []);
    } catch (error) {
      console.error('Error loading team players:', error);
      setTeamPlayers([]);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const togglePlayerBreakdown = async (playerId: string) => {
    if (expandedPlayer === playerId) {
      setExpandedPlayer(null);
      setPlayerData(null);
      return;
    }

    if (!selectedTeam) {
      console.error('No team selected');
      return;
    }

    setExpandedPlayer(playerId);
    setIsLoadingPlayer(true);

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/players/${playerId}/points?team_id=${selectedTeam.fantasy_team_id}`);
      if (!response.ok) {
        throw new Error('Failed to load player data');
      }
      const result = await response.json();
      setPlayerData(result);
    } catch (err) {
      console.error('Error loading player:', err);
      setPlayerData(null);
    } finally {
      setIsLoadingPlayer(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Teams Yet</h2>
          <p className="text-gray-600 mb-6">
            No teams have registered for the fantasy league yet.
          </p>
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Team
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Fantasy Teams</h1>
              <p className="text-gray-600 mt-1">{leagueName} - View squads & player stats</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Teams ({teams.length})</h2>
              
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {teams.map((team) => (
                  <button
                    key={team.fantasy_team_id}
                    onClick={() => loadTeamPlayers(team)}
                    className={`w-full text-left p-4 rounded-xl transition-all ${
                      selectedTeam?.fantasy_team_id === team.fantasy_team_id
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg'
                        : myTeamId === team.fantasy_team_id
                        ? 'bg-green-50 border-2 border-green-300 text-gray-900 hover:bg-green-100'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          team.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                          team.rank === 2 ? 'bg-gray-300 text-gray-700' :
                          team.rank === 3 ? 'bg-orange-400 text-orange-900' :
                          selectedTeam?.fantasy_team_id === team.fantasy_team_id ? 'bg-white/20 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          #{team.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{team.team_name}</p>
                          {myTeamId === team.fantasy_team_id && (
                            <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                              Your Team
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-lg font-bold">{team.total_points}</p>
                    </div>
                    <p className={`text-sm ${
                      selectedTeam?.fantasy_team_id === team.fantasy_team_id ? 'text-indigo-100' : 'text-gray-600'
                    }`}>
                      {team.owner_name} • {team.player_count} players
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Team Squad */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              {selectedTeam && (
                <>
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.team_name}</h2>
                        <p className="text-gray-600">Owner: {selectedTeam.owner_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-bold text-purple-600">{selectedTeam.total_points}</p>
                        <p className="text-sm text-gray-500">points</p>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-3">
                      <div>
                        <p className="text-sm text-gray-500">Rank</p>
                        <p className="text-2xl font-bold text-indigo-600">#{selectedTeam.rank}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Squad Size</p>
                        <p className="text-2xl font-bold text-blue-600">{teamPlayers.length}</p>
                      </div>
                    </div>
                  </div>

                  {isLoadingPlayers ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : teamPlayers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">No players drafted yet</p>
                      <p className="text-sm">This team hasn't drafted any players</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamPlayers.map((player) => (
                        <div key={player.real_player_id} className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => togglePlayerBreakdown(player.real_player_id)}
                            className="w-full text-left p-4 bg-gray-50 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-900">{player.player_name}</p>
                                    {player.is_captain && (
                                      <Crown className="w-4 h-4 text-yellow-600" title="Captain (2x points)" />
                                    )}
                                    {player.is_vice_captain && (
                                      <Star className="w-4 h-4 text-blue-600" title="Vice-Captain (1.5x points)" />
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {player.position} • {player.real_team_name} • ${player.purchase_price}M
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-purple-600">{player.total_points}</p>
                                  <p className="text-xs text-gray-500 group-hover:text-indigo-600 transition">Click for details</p>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                                  expandedPlayer === player.real_player_id ? 'rotate-180' : ''
                                }`} />
                              </div>
                            </div>
                          </button>

                          {/* Expanded Player Breakdown */}
                          {expandedPlayer === player.real_player_id && (
                            <div className="border-t border-gray-200 bg-white p-6">
                              {isLoadingPlayer ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                              ) : playerData ? (
                                <>
                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                                      <TrendingUp className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-purple-600">{playerData.player.total_points}</p>
                                      <p className="text-xs text-gray-600">Total Points</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3 text-center">
                                      <Target className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-green-600">{playerData.stats.total_goals}</p>
                                      <p className="text-xs text-gray-600">Goals</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                      <Shield className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-blue-600">{playerData.stats.total_clean_sheets}</p>
                                      <p className="text-xs text-gray-600">Clean Sheets</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                                      <Award className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-amber-600">{playerData.stats.total_motm}</p>
                                      <p className="text-xs text-gray-600">MOTM</p>
                                    </div>
                                  </div>

                                  {/* Additional Stats */}
                                  <div className="bg-gray-50 rounded-lg p-3 mb-6 grid grid-cols-4 gap-3 text-center text-sm">
                                    <div>
                                      <p className="text-gray-600">Matches</p>
                                      <p className="font-bold text-gray-900">{playerData.stats.total_matches}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Avg Points</p>
                                      <p className="font-bold text-indigo-600">{playerData.stats.average_points}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Best Game</p>
                                      <p className="font-bold text-green-600">{playerData.stats.best_performance}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Bonus</p>
                                      <p className="font-bold text-purple-600">{playerData.stats.total_bonus_points}</p>
                                    </div>
                                  </div>

                                  {/* Match History */}
                                  <h4 className="font-bold text-gray-900 mb-3">Match-by-Match Performance</h4>
                                  {playerData.matches.length === 0 ? (
                                    <p className="text-center text-gray-500 py-4">No match data yet</p>
                                  ) : (
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                      {playerData.matches.map((match: any, idx: number) => {
                                        const matchKey = `${match.fixture_id}_${idx}`;
                                        const isExpanded = expandedMatch === matchKey;
                                        
                                        // Parse points breakdown
                                        let breakdown: any = {};
                                        if (match.points_breakdown) {
                                          breakdown = typeof match.points_breakdown === 'string' 
                                            ? JSON.parse(match.points_breakdown) 
                                            : match.points_breakdown;
                                        }
                                        
                                        return (
                                          <div key={matchKey} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <button
                                              onClick={() => setExpandedMatch(isExpanded ? null : matchKey)}
                                              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                  <span className="font-bold text-indigo-600 text-sm">R{match.round_number}</span>
                                                </div>
                                                <div className="flex gap-2 text-xs">
                                                  {match.goals_scored > 0 && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                                      ⚽ {match.goals_scored}
                                                    </span>
                                                  )}
                                                  {match.clean_sheet && (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">🛡️ CS</span>
                                                  )}
                                                  {match.motm && (
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">⭐ MOTM</span>
                                                  )}
                                                  {match.is_captain && (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                                      👑 {match.points_multiplier}x
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                  <p className="text-xl font-bold text-purple-600">{match.total_points}</p>
                                                  <p className="text-xs text-gray-500">pts</p>
                                                </div>
                                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                                                  isExpanded ? 'rotate-180' : ''
                                                }`} />
                                              </div>
                                            </button>
                                            
                                            {/* Expanded Match Breakdown */}
                                            {isExpanded && (
                                              <div className="border-t border-gray-200 p-4 bg-white">
                                                <div className="mb-3">
                                                  <p className="text-sm font-semibold text-gray-700 mb-1">Match Stats:</p>
                                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                      <span className="text-gray-600">Goals Scored:</span>
                                                      <span className="font-semibold">{match.goals_scored || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                      <span className="text-gray-600">Goals Conceded:</span>
                                                      <span className="font-semibold">{match.goals_conceded || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                      <span className="text-gray-600">Clean Sheet:</span>
                                                      <span className="font-semibold">{match.clean_sheet ? 'Yes' : 'No'}</span>
                                                    </div>
                                                    <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                      <span className="text-gray-600">MOTM:</span>
                                                      <span className="font-semibold">{match.motm ? 'Yes' : 'No'}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                                
                                                <div className="border-t border-gray-200 pt-3">
                                                  <p className="text-sm font-semibold text-gray-700 mb-2">Points Breakdown:</p>
                                                  {Object.keys(breakdown).length === 0 ? (
                                                    <p className="text-xs text-gray-500 italic">No detailed breakdown available</p>
                                                  ) : (
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                      {breakdown.goals !== undefined && breakdown.goals !== 0 && (
                                                      <div className="flex justify-between bg-green-50 p-2 rounded">
                                                        <span className="text-gray-600">Goals:</span>
                                                        <span className="font-semibold text-green-700">+{breakdown.goals}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.result !== undefined && (
                                                      <div className="flex justify-between bg-blue-50 p-2 rounded">
                                                        <span className="text-gray-600">Result:</span>
                                                        <span className="font-semibold text-blue-700">+{breakdown.result}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.clean_sheet !== undefined && breakdown.clean_sheet !== 0 && (
                                                      <div className="flex justify-between bg-blue-50 p-2 rounded">
                                                        <span className="text-gray-600">Clean Sheet:</span>
                                                        <span className="font-semibold text-blue-700">+{breakdown.clean_sheet}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.motm !== undefined && breakdown.motm !== 0 && (
                                                      <div className="flex justify-between bg-amber-50 p-2 rounded">
                                                        <span className="text-gray-600">MOTM:</span>
                                                        <span className="font-semibold text-amber-700">+{breakdown.motm}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.brace !== undefined && breakdown.brace !== 0 && (
                                                      <div className="flex justify-between bg-green-50 p-2 rounded">
                                                        <span className="text-gray-600">Brace:</span>
                                                        <span className="font-semibold text-green-700">+{breakdown.brace}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.hat_trick !== undefined && breakdown.hat_trick !== 0 && (
                                                      <div className="flex justify-between bg-green-50 p-2 rounded">
                                                        <span className="text-gray-600">Hat Trick:</span>
                                                        <span className="font-semibold text-green-700">+{breakdown.hat_trick}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.conceded !== undefined && breakdown.conceded !== 0 && (
                                                      <div className="flex justify-between bg-red-50 p-2 rounded">
                                                        <span className="text-gray-600">Conceded:</span>
                                                        <span className="font-semibold text-red-700">{breakdown.conceded}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.fines !== undefined && breakdown.fines !== 0 && (
                                                      <div className="flex justify-between bg-red-50 p-2 rounded">
                                                        <span className="text-gray-600">Fines:</span>
                                                        <span className="font-semibold text-red-700">{breakdown.fines}</span>
                                                      </div>
                                                    )}
                                                    {breakdown.substitution !== undefined && breakdown.substitution !== 0 && (
                                                      <div className="flex justify-between bg-red-50 p-2 rounded">
                                                        <span className="text-gray-600">Substitution:</span>
                                                        <span className="font-semibold text-red-700">{breakdown.substitution}</span>
                                                      </div>
                                                    )}
                                                    </div>
                                                  )}
                                                  
                                                  {match.is_captain && (
                                                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                                      <p className="text-xs text-yellow-800">
                                                        <span className="font-semibold">Multiplier Applied:</span> Base {match.base_points} pts × {match.points_multiplier}x = {match.total_points} pts
                                                      </p>
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
                                </>
                              ) : (
                                <p className="text-center text-red-600 py-4">Failed to load player data</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
