'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerStats {
  id: string;
  player_id: string;
  player_name: string;
  season_id: string;
  team: string;
  points: number;
  base_points: number;
  matches_played: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  auction_value?: number;
  star_rating?: number;
  salary_per_match?: number;
}

interface MatchdayStats {
  matchday: number;
  fixture_id: string;
  player_side: 'home' | 'away';
  home_team_name: string;
  away_team_name: string;
  home_player_name: string;
  away_player_name: string;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  points: number;
  was_substitute: boolean;
}

export default function TeamPlayerStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [matchdayStats, setMatchdayStats] = useState<Map<string, MatchdayStats[]>>(new Map());
  const [loadingMatchday, setLoadingMatchday] = useState<string | null>(null);
  const [playerTotalPoints, setPlayerTotalPoints] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadPlayers();
    }
  }, [user]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const response = await fetchWithTokenRefresh('/api/committee/player-stats?season_id=SSPSLS16');
      if (response.ok) {
        const data = await response.json();
        console.log('[Player Stats Page] Loaded players:', data.players?.length);
        if (data.players?.length > 0) {
          console.log('[Player Stats Page] First player base_points:', data.players[0].base_points);
        }
        setPlayers(data.players || []);
        
        // Load total points for all players
        loadAllPlayerTotalPoints(data.players || []);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllPlayerTotalPoints = async (playersList: PlayerStats[]) => {
    const newPlayerTotalPoints = new Map<string, number>();
    
    // Load total points for each player in parallel
    const promises = playersList.map(async (player) => {
      try {
        const response = await fetchWithTokenRefresh(`/api/committee/player-matchday-stats?player_id=${player.id}&season_id=SSPSLS16`);
        if (response.ok) {
          const data = await response.json();
          newPlayerTotalPoints.set(player.id, data.totalPoints || 0);
        }
      } catch (error) {
        console.error(`Error loading total points for ${player.player_name}:`, error);
      }
    });
    
    await Promise.all(promises);
    setPlayerTotalPoints(newPlayerTotalPoints);
  };

  const loadMatchdayStats = async (playerId: string) => {
    if (matchdayStats.has(playerId)) {
      // Already loaded, just toggle
      setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
      return;
    }

    setLoadingMatchday(playerId);
    try {
      const response = await fetchWithTokenRefresh(`/api/committee/player-matchday-stats?player_id=${playerId}&season_id=SSPSLS16`);
      if (response.ok) {
        const data = await response.json();
        const newMatchdayStats = new Map(matchdayStats);
        newMatchdayStats.set(playerId, data.matchdayStats || []);
        setMatchdayStats(newMatchdayStats);
        
        // Store total points for this player
        const newPlayerTotalPoints = new Map(playerTotalPoints);
        newPlayerTotalPoints.set(playerId, data.totalPoints || 0);
        setPlayerTotalPoints(newPlayerTotalPoints);
        
        setExpandedPlayer(playerId);
      }
    } catch (error) {
      console.error('Error loading matchday stats:', error);
    } finally {
      setLoadingMatchday(null);
    }
  };

  const handleSort = (column: keyof PlayerStats) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const filteredPlayers = players
    .filter(p =>
      p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading player statistics...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Player Statistics
              </h1>
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  SSPSLS16
                </span>
                <span>Season player performance data</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by player name or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    Expand
                  </th>
                  <th 
                    onClick={() => handleSort('player_name')}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('team')}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Team {sortBy === 'team' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('points')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Points {sortBy === 'points' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('base_points')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Base {sortBy === 'base_points' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    Total Gained
                  </th>
                  <th 
                    onClick={() => handleSort('matches_played')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    MP {sortBy === 'matches_played' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goals_scored')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GS {sortBy === 'goals_scored' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goals_conceded')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GC {sortBy === 'goals_conceded' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goal_difference')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GD {sortBy === 'goal_difference' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    W-D-L
                  </th>
                  <th 
                    onClick={() => handleSort('clean_sheets')}
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    CS {sortBy === 'clean_sheets' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlayers.map((player, index) => {
                  const change = player.base_points > 0 ? player.points - player.base_points : 0;
                  
                  return (
                    <React.Fragment key={player.id}>
                      <tr 
                        className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-3 py-3">
                          <button
                            onClick={() => loadMatchdayStats(player.id)}
                            disabled={loadingMatchday === player.id}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            title="View matchday breakdown"
                          >
                            {loadingMatchday === player.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            ) : expandedPlayer === player.id ? (
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              {player.player_name.charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">{player.player_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{player.team || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                            {player.points || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-semibold text-gray-600">{player.base_points || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {player.base_points > 0 ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                              change > 0 
                                ? 'bg-green-100 text-green-700' 
                                : change < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {change > 0 ? '↑' : change < 0 ? '↓' : '='} 
                              {change > 0 ? '+' : ''}{change}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {playerTotalPoints.has(player.id) ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                              playerTotalPoints.get(player.id)! > 0 
                                ? 'bg-green-100 text-green-700' 
                                : playerTotalPoints.get(player.id)! < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {playerTotalPoints.get(player.id)! > 0 ? '+' : ''}{playerTotalPoints.get(player.id)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-medium text-gray-700">{player.matches_played || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            ⚽ {player.goals_scored || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-semibold text-red-600">{player.goals_conceded || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-bold ${
                            player.goal_difference > 0 ? 'text-green-600' : 
                            player.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {player.goal_difference > 0 ? '+' : ''}{player.goal_difference || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600 font-medium">
                            <span className="text-green-600 font-bold">{player.wins}</span>-
                            <span className="text-gray-500">{player.draws}</span>-
                            <span className="text-red-600 font-bold">{player.losses}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-semibold text-gray-700">{player.clean_sheets || 0}</span>
                        </td>
                      </tr>
                      {expandedPlayer === player.id && matchdayStats.has(player.id) && (
                        <tr key={`${player.id}-matchday`} className="bg-gradient-to-r from-blue-50 to-purple-50">
                          <td colSpan={13} className="px-6 py-6">
                            <div className="bg-white rounded-xl shadow-lg p-6">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Matchday Breakdown - {player.player_name}
                              </h3>
                              <p className="text-sm text-gray-600 mb-4">
                                Points are based on goal difference in each matchup (max +5 or -5 per match)
                              </p>
                              
                              {matchdayStats.get(player.id)!.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <p className="font-medium">No completed matches yet</p>
                                </div>
                              ) : (
                                <>
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Matchday</th>
                                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Matchup</th>
                                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Score</th>
                                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">GD</th>
                                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Points</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {matchdayStats.get(player.id)!.map((match, idx) => (
                                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                                Round {match.matchday}
                                              </span>
                                              {match.was_substitute && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700" title="Substitute">
                                                  SUB
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              <div className="text-sm">
                                                {match.player_side === 'home' ? (
                                                  <>
                                                    <span className="font-bold text-blue-600">{match.home_player_name}</span>
                                                    <span className="text-gray-500 mx-2">vs</span>
                                                    <span className="text-gray-700">{match.away_player_name}</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-gray-700">{match.home_player_name}</span>
                                                    <span className="text-gray-500 mx-2">vs</span>
                                                    <span className="font-bold text-blue-600">{match.away_player_name}</span>
                                                  </>
                                                )}
                                                <div className="text-xs text-gray-500 mt-1">
                                                  {match.home_team_name} vs {match.away_team_name}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="text-sm font-bold">
                                                {match.goals_scored} - {match.goals_conceded}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                                match.goal_difference > 0 
                                                  ? 'bg-green-100 text-green-700' 
                                                  : match.goal_difference < 0
                                                  ? 'bg-red-100 text-red-700'
                                                  : 'bg-gray-100 text-gray-600'
                                              }`}>
                                                {match.goal_difference > 0 ? '+' : ''}{match.goal_difference}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                                match.points > 0 
                                                  ? 'bg-green-100 text-green-700' 
                                                  : match.points < 0
                                                  ? 'bg-red-100 text-red-700'
                                                  : 'bg-gray-100 text-gray-600'
                                              }`}>
                                                {match.points > 0 ? '+' : ''}{match.points}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-gradient-to-r from-blue-100 to-purple-100">
                                        <tr>
                                          <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-800">
                                            Total Points:
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-bold ${
                                              matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) > 0
                                                ? 'bg-green-200 text-green-800' 
                                                : matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) < 0
                                                ? 'bg-red-200 text-red-800'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}>
                                              {matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) > 0 ? '+' : ''}
                                              {matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0)}
                                            </span>
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-xl mt-6">
            <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Players Found</h3>
            <p className="text-gray-500">Try adjusting your search criteria</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm font-medium opacity-90">Total Players</div>
            <div className="text-3xl font-bold mt-2">{filteredPlayers.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm font-medium opacity-90">Total Goals</div>
            <div className="text-3xl font-bold mt-2">
              {filteredPlayers.reduce((sum, p) => sum + (p.goals_scored || 0), 0)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm font-medium opacity-90">Total Matches</div>
            <div className="text-3xl font-bold mt-2">
              {filteredPlayers.reduce((sum, p) => sum + (p.matches_played || 0), 0)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-sm font-medium opacity-90">Clean Sheets</div>
            <div className="text-3xl font-bold mt-2">
              {filteredPlayers.reduce((sum, p) => sum + (p.clean_sheets || 0), 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
