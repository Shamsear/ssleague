'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, Target, Shield, Award, Crown, Star } from 'lucide-react';

interface PlayerBreakdownModalProps {
  playerId: string;
  playerName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PlayerStats {
  total_matches: number;
  total_goals: number;
  total_clean_sheets: number;
  total_motm: number;
  total_base_points: number;
  total_bonus_points: number;
  average_points: string;
  best_performance: number;
}

interface MatchPerformance {
  fixture_id: string;
  round_number: number;
  goals_scored: number;
  goals_conceded: number;
  clean_sheet: boolean;
  motm: boolean;
  base_points: number;
  bonus_points: number;
  total_points: number;
  is_captain: boolean;
  points_multiplier: number;
  recorded_at: string;
}

interface PlayerData {
  player: {
    real_player_id: string;
    player_name: string;
    position: string;
    real_team_name: string;
    purchase_price: number;
    current_value: number;
    total_points: number;
    is_captain: boolean;
    is_vice_captain: boolean;
    fantasy_team_name: string;
    owner_name: string;
  };
  stats: PlayerStats;
  matches: MatchPerformance[];
}

export default function PlayerBreakdownModal({
  playerId,
  playerName,
  isOpen,
  onClose,
}: PlayerBreakdownModalProps) {
  const [data, setData] = useState<PlayerData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && playerId) {
      loadPlayerData();
    }
  }, [isOpen, playerId]);

  const loadPlayerData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fantasy/players/${playerId}/points`);
      if (!response.ok) {
        throw new Error('Failed to load player data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{playerName}</h2>
              <p className="text-indigo-100 text-sm">Points Breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Player Info */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Team</p>
                    <p className="font-bold text-gray-900">{data.player.real_team_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Position</p>
                    <p className="font-bold text-gray-900">{data.player.position}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="font-bold text-green-600">${data.player.purchase_price}M</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fantasy Team</p>
                    <p className="font-bold text-gray-900">{data.player.fantasy_team_name}</p>
                  </div>
                </div>

                {/* Captain/VC Badge */}
                {(data.player.is_captain || data.player.is_vice_captain) && (
                  <div className="mt-4 flex gap-2">
                    {data.player.is_captain && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
                        <Crown className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-bold text-yellow-700">Captain (2x Points)</span>
                      </div>
                    )}
                    {data.player.is_vice_captain && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-300 rounded-full">
                        <Star className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-700">Vice-Captain (1.5x Points)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-600">Total Points</p>
                  </div>
                  <p className="text-3xl font-bold text-purple-600">{data.player.total_points}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600">Goals</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{data.stats.total_goals}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600">Clean Sheets</p>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{data.stats.total_clean_sheets}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-sm text-gray-600">MOTM</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-600">{data.stats.total_motm}</p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Matches</p>
                    <p className="text-xl font-bold text-gray-900">{data.stats.total_matches}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg Points</p>
                    <p className="text-xl font-bold text-indigo-600">{data.stats.average_points}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Best Game</p>
                    <p className="text-xl font-bold text-green-600">{data.stats.best_performance}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Bonus Points</p>
                    <p className="text-xl font-bold text-purple-600">{data.stats.total_bonus_points}</p>
                  </div>
                </div>
              </div>

              {/* Match-by-Match Breakdown */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Match-by-Match Performance</h3>
                
                {data.matches.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No match data available yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.matches.map((match, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <span className="font-bold text-indigo-600">R{match.round_number}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">Round {match.round_number}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(match.recorded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-purple-600">{match.total_points}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-green-600" />
                            <span className="text-gray-700">{match.goals_scored} Goals</span>
                          </div>
                          {match.clean_sheet && (
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-700 font-medium">Clean Sheet</span>
                            </div>
                          )}
                          {match.motm && (
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-600" />
                              <span className="text-amber-700 font-medium">MOTM</span>
                            </div>
                          )}
                          {match.is_captain && (
                            <div className="flex items-center gap-2">
                              <Crown className="w-4 h-4 text-yellow-600" />
                              <span className="text-yellow-700 font-medium">{match.points_multiplier}x Captain</span>
                            </div>
                          )}
                          <div className="text-gray-600">
                            Base: {match.base_points} | Bonus: {match.bonus_points}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
