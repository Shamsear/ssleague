'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { Crown, Star, ChevronDown, Target, Award, TrendingUp, Shield as ShieldIcon } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyTeam {
  id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  rank: number;
  supported_team_id?: string;
  supported_team_name?: string;
  passive_points?: number;
}

interface Player {
  draft_id: string;
  real_player_id: string;
  player_name: string;
  total_points: number;
  matches_played: number;
  average_points: number;
  position?: string;
  real_team_name?: string;
  purchase_price?: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

export default function FantasyTeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [leagueId, setLeagueId] = useState<string>('');

  const [league, setLeague] = useState<any>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FantasyTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Expandable player state
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<any>(null);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);

  // Scoring rules from database
  const [scoringRules, setScoringRules] = useState<any>(null);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Get league ID from user's team
  useEffect(() => {
    const getLeagueId = async () => {
      if (!user) return;

      try {
        const myTeamResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (myTeamResponse.ok) {
          const myTeamData = await myTeamResponse.json();
          setLeagueId(myTeamData.team.fantasy_league_id);
        }
      } catch (error) {
        console.error('Error getting league ID:', error);
      }
    };

    if (user) {
      getLeagueId();
    }
  }, [user]);

  // Fetch scoring rules from database
  useEffect(() => {
    const loadScoringRules = async () => {
      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-rules?league_id=${leagueId}`);
        if (response.ok) {
          const data = await response.json();
          // Convert array to object for easy lookup
          const rulesMap: any = {};
          data.rules?.forEach((rule: any) => {
            if (rule.applies_to === 'player') {
              rulesMap[rule.rule_type] = rule.points_value;
            }
          });
          setScoringRules(rulesMap);
        }
      } catch (error) {
        console.error('Error loading scoring rules:', error);
        // Fallback to default values if API fails
        setScoringRules({
          goals_scored: 2,
          clean_sheet: 6,
          motm: 5,
          win: 3,
          draw: 1,
          match_played: 1,
          hat_trick: 5,
          concedes_4_plus_goals: -3,
        });
      }
    };

    if (leagueId) {
      loadScoringRules();
    }
  }, [leagueId]);

  useEffect(() => {
    const loadLeagueData = async () => {
      if (!leagueId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`);
        if (!response.ok) throw new Error('Failed to load league');

        const data = await response.json();
        setLeague(data.league);
        setTeams(data.teams || []);
        
        // Auto-select first team
        if (data.teams && data.teams.length > 0) {
          loadTeamPlayers(data.teams[0]);
        }
      } catch (error) {
        console.error('Error loading league:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeagueData();
    }
  }, [user, leagueId]);

  const loadTeamPlayers = async (team: FantasyTeam) => {
    setSelectedTeam(team);
    setIsLoadingPlayers(true);

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/teams/${team.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // If team not found in Firebase, show empty state gracefully
        if (response.status === 404) {
          console.log('Team has not completed draft setup yet - showing empty state');
          setTeamPlayers([]);
          return;
        }
        
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to load team players');
      }

      const data = await response.json();
      setTeamPlayers(data.players || []);
    } catch (error) {
      console.error('Error loading team players:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to load team players',
      });
      setTeamPlayers([]);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const togglePlayerBreakdown = async (playerId: string) => {
    // If clicking the same player, collapse it
    if (expandedPlayer === playerId) {
      setExpandedPlayer(null);
      setPlayerData(null);
      return;
    }

    // Expand new player
    setExpandedPlayer(playerId);
    setIsLoadingPlayer(true);
    setPlayerData(null);

    try {
      // Fetch player match details from API
      const response = await fetchWithTokenRefresh(`/api/fantasy/players/${playerId}/matches?league_id=${leagueId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load player match data');
      }

      const data = await response.json();
      setPlayerData(data);
    } catch (error) {
      console.error('Error loading player data:', error);
      setPlayerData({ error: true });
    } finally {
      setIsLoadingPlayer(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !league) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

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
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fantasy Teams</h1>
              <p className="text-gray-600 mt-1">{league.name} - Team Rosters</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Teams ({teams.length})</h2>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {teams.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-500 font-medium mb-2">No teams registered yet</p>
                    <p className="text-sm text-gray-400">Teams will appear here once players register for the fantasy league</p>
                  </div>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => loadTeamPlayers(team)}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        selectedTeam?.id === team.id
                          ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{team.team_name}</p>
                          <p className={`text-sm ${selectedTeam?.id === team.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                            {team.owner_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{team.total_points}</p>
                          <p className={`text-xs ${selectedTeam?.id === team.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                            {team.player_count} players
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Team Roster */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              {selectedTeam ? (
                <>
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.team_name}</h2>
                    <p className="text-gray-600">Owner: {selectedTeam.owner_name}</p>
                    <div className="flex gap-6 mt-3">
                      <div>
                        <p className="text-sm text-gray-500">Total Points</p>
                        <p className="text-2xl font-bold text-indigo-600">{selectedTeam.total_points}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Players</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedTeam.player_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Rank</p>
                        <p className="text-2xl font-bold text-gray-900">#{selectedTeam.rank || '-'}</p>
                      </div>
                    </div>

                    {/* Supported Team (Passive Points) */}
                    {selectedTeam.supported_team_name && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                              <ShieldIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-medium">Supported Team (Passive Points)</p>
                              <p className="text-lg font-bold text-gray-900">{selectedTeam.supported_team_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Passive Points</p>
                            <p className="text-2xl font-bold text-green-600">{selectedTeam.passive_points || 0}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {isLoadingPlayers ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-3 text-gray-600">Loading players...</p>
                    </div>
                  ) : teamPlayers.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-gray-500 font-medium mb-2">No players drafted yet</p>
                      <p className="text-sm text-gray-400">This team hasn't participated in the draft</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {teamPlayers.map((player, index) => (
                        <div key={player.draft_id} className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => togglePlayerBreakdown(player.real_player_id)}
                            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-indigo-50 hover:to-blue-50 transition-all group"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1 text-left">
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
                                  {player.real_team_name || 'Real Player'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xl font-bold text-indigo-600">{player.total_points}</p>
                                <p className="text-xs text-gray-500 group-hover:text-indigo-600 transition">Click for details</p>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedPlayer === player.real_player_id ? 'rotate-180' : ''
                              }`} />
                            </div>
                          </button>

                          {/* Expanded Player Breakdown */}
                          {expandedPlayer === player.real_player_id && (
                            <div className="border-t border-gray-200 bg-white p-6">
                              {isLoadingPlayer ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                              ) : playerData && playerData.stats ? (
                                <>
                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                                      <TrendingUp className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-purple-600">{playerData.stats?.total_points || 0}</p>
                                      <p className="text-xs text-gray-600">Total Points</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3 text-center">
                                      <Target className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-green-600">{playerData.stats?.total_goals || 0}</p>
                                      <p className="text-xs text-gray-600">Goals</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                      <ShieldIcon className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-blue-600">{playerData.stats?.total_clean_sheets || 0}</p>
                                      <p className="text-xs text-gray-600">Clean Sheets</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                                      <Award className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-amber-600">{playerData.stats?.total_motm || 0}</p>
                                      <p className="text-xs text-gray-600">MOTM</p>
                                    </div>
                                  </div>

                                  {/* Additional Stats */}
                                  <div className="bg-gray-50 rounded-lg p-3 mb-6 grid grid-cols-4 gap-3 text-center text-sm">
                                    <div>
                                      <p className="text-gray-600">Matches</p>
                                      <p className="font-bold text-gray-900">{playerData.stats?.total_matches || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Avg Points</p>
                                      <p className="font-bold text-indigo-600">{playerData.stats?.average_points || 0}</p>
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
                                        // Calculate individual point components using database rules
                                        if (!scoringRules) return null; // Wait for rules to load
                                        
                                        // Calculate result from actual goals (don't trust match.result field)
                                        const playerGoals = match.goals_scored || 0;
                                        const opponentGoals = match.goals_conceded || 0;
                                        const won = playerGoals > opponentGoals;
                                        const draw = playerGoals === opponentGoals;
                                        const actualResult = won ? 'win' : draw ? 'draw' : 'loss';
                                        
                                        const goalPoints = playerGoals * (scoringRules.goals_scored || 0);
                                        const cleanSheetPoints = match.clean_sheet ? (scoringRules.clean_sheet || 0) : 0;
                                        const motmPoints = match.motm ? (scoringRules.motm || 0) : 0;
                                        const resultPoints = won ? (scoringRules.win || 0) : draw ? (scoringRules.draw || 0) : 0;
                                        const appearancePoints = scoringRules.match_played || 0;
                                        const hatTrickPoints = (playerGoals >= 3 && scoringRules.hat_trick) ? scoringRules.hat_trick : 0;
                                        const concedePoints = (opponentGoals >= 4 && scoringRules.concedes_4_plus_goals) ? scoringRules.concedes_4_plus_goals : 0;
                                        
                                        const basePoints = goalPoints + cleanSheetPoints + motmPoints + resultPoints + appearancePoints + hatTrickPoints + concedePoints;
                                        const multiplier = match.is_captain ? 2 : match.is_vice_captain ? 1.5 : 1;
                                        const totalPoints = Math.round(basePoints * multiplier);

                                        return (
                                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* Match Header */}
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-blue-50">
                                              <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                                                  <span className="font-bold text-white">R{match.round_number}</span>
                                                </div>
                                                <div>
                                                  <p className="font-semibold text-gray-900">
                                                    {match.opponent_name || 'vs Opponent'}
                                                  </p>
                                                  <p className="text-xs text-gray-600">
                                                    {actualResult === 'win' ? '✅ Win' : actualResult === 'draw' ? '🤝 Draw' : '❌ Loss'}
                                                    {` • ${playerGoals}-${opponentGoals}`}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-2xl font-bold text-indigo-600">{totalPoints}</p>
                                                <p className="text-xs text-gray-500">pts</p>
                                              </div>
                                            </div>

                                            {/* Points Breakdown */}
                                            <div className="p-3 bg-white space-y-2">
                                              <div className="grid grid-cols-2 gap-2 text-sm">
                                                {/* Base Points */}
                                                {goalPoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-green-50 rounded">
                                                    <span className="text-gray-700 flex items-center gap-1">
                                                      <Target className="w-3 h-3 text-green-600" />
                                                      Goals ({match.goals_scored})
                                                    </span>
                                                    <span className="font-semibold text-green-700">{goalPoints}pts</span>
                                                  </div>
                                                )}
                                                {hatTrickPoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-orange-50 rounded">
                                                    <span className="text-gray-700 flex items-center gap-1">
                                                      <TrendingUp className="w-3 h-3 text-orange-600" />
                                                      Hat-trick Bonus
                                                    </span>
                                                    <span className="font-semibold text-orange-700">{hatTrickPoints}pts</span>
                                                  </div>
                                                )}
                                                {cleanSheetPoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-blue-50 rounded">
                                                    <span className="text-gray-700 flex items-center gap-1">
                                                      <ShieldIcon className="w-3 h-3 text-blue-600" />
                                                      Clean Sheet
                                                    </span>
                                                    <span className="font-semibold text-blue-700">{cleanSheetPoints}pts</span>
                                                  </div>
                                                )}
                                                {concedePoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-red-50 rounded">
                                                    <span className="text-gray-700 flex items-center gap-1">
                                                      <span className="text-red-600">⚠️</span>
                                                      Conceded 4+ Goals
                                                    </span>
                                                    <span className="font-semibold text-red-700">{concedePoints}pts</span>
                                                  </div>
                                                )}
                                                {motmPoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-amber-50 rounded">
                                                    <span className="text-gray-700 flex items-center gap-1">
                                                      <Award className="w-3 h-3 text-amber-600" />
                                                      MOTM
                                                    </span>
                                                    <span className="font-semibold text-amber-700">{motmPoints}pts</span>
                                                  </div>
                                                )}
                                                {resultPoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-purple-50 rounded">
                                                    <span className="text-gray-700">
                                                      {actualResult === 'win' ? '🏆 Win' : '🤝 Draw'}
                                                    </span>
                                                    <span className="font-semibold text-purple-700">{resultPoints}pts</span>
                                                  </div>
                                                )}
                                                {appearancePoints !== 0 && (
                                                  <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded">
                                                    <span className="text-gray-700">⚽ Appearance</span>
                                                    <span className="font-semibold text-gray-700">{appearancePoints}pt</span>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Multiplier & Total */}
                                              <div className="pt-2 border-t border-gray-200">
                                                <div className="flex items-center justify-between text-sm">
                                                  <span className="text-gray-600">Base Points</span>
                                                  <span className="font-semibold text-gray-900">{basePoints}pts</span>
                                                </div>
                                                {multiplier !== 1 && (
                                                  <>
                                                    <div className="flex items-center justify-between text-sm mt-1">
                                                      <span className="text-gray-600 flex items-center gap-1">
                                                        {match.is_captain ? (
                                                          <>
                                                            <Crown className="w-3 h-3 text-yellow-600" />
                                                            Captain Multiplier
                                                          </>
                                                        ) : (
                                                          <>
                                                            <Star className="w-3 h-3 text-blue-600" />
                                                            Vice-Captain Multiplier
                                                          </>
                                                        )}
                                                      </span>
                                                      <span className="font-semibold text-indigo-600">×{multiplier}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200">
                                                      <span className="text-gray-900">Final Points</span>
                                                      <span className="text-indigo-600">{totalPoints}pts</span>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            </div>
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
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-gray-500">Select a team to view roster</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}