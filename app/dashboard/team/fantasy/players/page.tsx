'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ChevronDown, Trophy, Target, Award, TrendingUp } from 'lucide-react';

interface Player {
  real_player_id: string;
  player_name: string;
  real_team_name: string;
  category: string;
  star_rating: number;
  total_base_points: number;
  matches_played: number;
  average_points: number;
  goals: number;
  clean_sheets: number;
  motm_count: number;
}

interface MatchBreakdown {
  fixture_id: string;
  round_number: number;
  opponent: string;
  goals_scored: number;
  goals_conceded: number;
  result: string;
  is_motm: boolean;
  is_clean_sheet: boolean;
  fine_goals: number;
  substitution_penalty: number;
  points_breakdown: {
    goals?: number;
    conceded?: number;
    result?: number;
    motm?: number;
    fines?: number;
    clean_sheet?: number;
    substitution?: number;
    brace?: number;
    hat_trick?: number;
  };
  base_points: number;
}

export default function FantasyPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [leagueId, setLeagueId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [matchBreakdowns, setMatchBreakdowns] = useState<Record<string, MatchBreakdown[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'name' | 'matches'>('points');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadPlayers = async () => {
      if (!user) return;

      try {
        // Get league ID from my-team
        const myTeamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        if (!myTeamResponse.ok) {
          throw new Error('Failed to load fantasy team');
        }

        const myTeamData = await myTeamResponse.json();
        const leagueIdValue = myTeamData.team.fantasy_league_id;
        setLeagueId(leagueIdValue);

        // Fetch all players performance
        const playersResponse = await fetch(`/api/fantasy/players-performance?league_id=${leagueIdValue}`);
        if (!playersResponse.ok) {
          throw new Error('Failed to load players');
        }

        const playersData = await playersResponse.json();
        setPlayers(playersData.players || []);
        setFilteredPlayers(playersData.players || []);
      } catch (error) {
        console.error('Error loading players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadPlayers();
    }
  }, [user]);

  useEffect(() => {
    let filtered = [...players];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.real_team_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'points') return b.total_base_points - a.total_base_points;
      if (sortBy === 'matches') return b.matches_played - a.matches_played;
      if (sortBy === 'name') return a.player_name.localeCompare(b.player_name);
      return 0;
    });

    setFilteredPlayers(filtered);
  }, [searchQuery, sortBy, players]);

  const loadMatchBreakdown = async (playerId: string) => {
    if (matchBreakdowns[playerId]) {
      // Already loaded, just toggle
      setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
      return;
    }

    setLoadingBreakdown({ ...loadingBreakdown, [playerId]: true });
    setExpandedPlayer(playerId);

    try {
      const response = await fetch(`/api/fantasy/players/${playerId}/breakdown?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load breakdown');

      const data = await response.json();
      setMatchBreakdowns({ ...matchBreakdowns, [playerId]: data.matches || [] });
    } catch (error) {
      console.error('Error loading match breakdown:', error);
    } finally {
      setLoadingBreakdown({ ...loadingBreakdown, [playerId]: false });
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
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Player Performance</h1>
              <p className="text-gray-600 mt-1">Base fantasy points by player (without multipliers)</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or team..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="points">Total Points (High to Low)</option>
                <option value="matches">Matches Played</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Total Players</p>
            <p className="text-3xl font-bold text-blue-600">{filteredPlayers.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Active Players</p>
            <p className="text-3xl font-bold text-green-600">
              {filteredPlayers.filter((p) => p.matches_played > 0).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">Top Scorer</p>
            <p className="text-lg font-bold text-purple-600">
              {filteredPlayers[0]?.player_name || 'N/A'}
            </p>
            <p className="text-sm text-gray-500">{filteredPlayers[0]?.total_base_points || 0} pts</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 mb-1">Avg Points</p>
            <p className="text-3xl font-bold text-orange-600">
              {filteredPlayers.length > 0
                ? Math.round(
                    filteredPlayers.reduce((sum, p) => sum + p.total_base_points, 0) / filteredPlayers.length
                  )
                : 0}
            </p>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">All Players ({filteredPlayers.length})</h2>

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No players found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlayers.map((player) => (
                <div key={player.real_player_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Player Summary */}
                  <button
                    onClick={() => loadMatchBreakdown(player.real_player_id)}
                    className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white hover:from-indigo-50 hover:to-purple-50 transition-all"
                  >
                    <div className="flex items-center gap-4 mb-2 sm:mb-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {'⭐'.repeat(player.star_rating || 3)}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900">{player.player_name}</p>
                        <p className="text-sm text-gray-600">
                          {player.real_team_name} • {player.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-gray-600">Base Points</p>
                        <p className="text-lg font-bold text-indigo-600">{player.total_base_points}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Matches</p>
                        <p className="text-lg font-bold text-gray-900">{player.matches_played}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Avg</p>
                        <p className="text-lg font-bold text-green-600">{player.average_points}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Goals</p>
                        <p className="text-lg font-bold text-orange-600">{player.goals}</p>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedPlayer === player.real_player_id ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Match Breakdown */}
                  {expandedPlayer === player.real_player_id && (
                    <div className="border-t border-gray-200 bg-white p-4">
                      {loadingBreakdown[player.real_player_id] ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                          <p className="mt-2 text-sm text-gray-600">Loading breakdown...</p>
                        </div>
                      ) : matchBreakdowns[player.real_player_id]?.length > 0 ? (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Match-by-Match Breakdown</h4>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {matchBreakdowns[player.real_player_id].map((match, idx) => (
                              <div key={idx} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      Round {match.round_number} vs {match.opponent}
                                    </p>
                                    <div className="flex gap-2 mt-1">
                                      {match.goals_scored > 0 && (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                          ⚽ {match.goals_scored}
                                        </span>
                                      )}
                                      {match.is_clean_sheet && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                          🛡️ Clean Sheet
                                        </span>
                                      )}
                                      {match.is_motm && (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                          ⭐ MOTM
                                        </span>
                                      )}
                                      <span
                                        className={`px-2 py-1 text-xs rounded ${
                                          match.result === 'win'
                                            ? 'bg-green-100 text-green-800'
                                            : match.result === 'draw'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        {match.result.toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-indigo-600">{match.base_points}</p>
                                    <p className="text-xs text-gray-500">base pts</p>
                                  </div>
                                </div>

                                {/* Points Breakdown */}
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                  <p className="text-xs font-semibold text-gray-700 mb-2">Points Breakdown:</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                    {match.points_breakdown.goals !== undefined && match.points_breakdown.goals !== 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Goals:</span>
                                        <span className="font-semibold">{match.points_breakdown.goals}</span>
                                      </div>
                                    )}
                                    {match.points_breakdown.result !== undefined && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Result:</span>
                                        <span className="font-semibold">{match.points_breakdown.result}</span>
                                      </div>
                                    )}
                                    {match.points_breakdown.clean_sheet !== undefined &&
                                      match.points_breakdown.clean_sheet !== 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Clean Sheet:</span>
                                          <span className="font-semibold">{match.points_breakdown.clean_sheet}</span>
                                        </div>
                                      )}
                                    {match.points_breakdown.motm !== undefined && match.points_breakdown.motm !== 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">MOTM:</span>
                                        <span className="font-semibold">{match.points_breakdown.motm}</span>
                                      </div>
                                    )}
                                    {match.points_breakdown.brace !== undefined && match.points_breakdown.brace !== 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Brace:</span>
                                        <span className="font-semibold">{match.points_breakdown.brace}</span>
                                      </div>
                                    )}
                                    {match.points_breakdown.hat_trick !== undefined &&
                                      match.points_breakdown.hat_trick !== 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Hat Trick:</span>
                                          <span className="font-semibold">{match.points_breakdown.hat_trick}</span>
                                        </div>
                                      )}
                                    {match.points_breakdown.conceded !== undefined &&
                                      match.points_breakdown.conceded !== 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Conceded:</span>
                                          <span className="font-semibold text-red-600">
                                            {match.points_breakdown.conceded}
                                          </span>
                                        </div>
                                      )}
                                    {match.points_breakdown.fines !== undefined && match.points_breakdown.fines !== 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Fines:</span>
                                        <span className="font-semibold text-red-600">{match.points_breakdown.fines}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-4">No match data available</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
