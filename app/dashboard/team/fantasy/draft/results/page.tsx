'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/firebase/fetchWithTokenRefresh';
import { 
  ArrowLeft, 
  Trophy, 
  XCircle, 
  MinusCircle, 
  DollarSign, 
  Users, 
  TrendingUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Bid {
  bid_id: string;
  tier_id: string;
  tier_number: number;
  tier_name: string;
  player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  total_points: number;
  bid_amount: number;
  is_skip: boolean;
  status: 'won' | 'lost' | 'skipped' | 'pending';
  submitted_at: string;
  processed_at: string;
}

interface SquadPlayer {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  purchase_price: number;
  acquisition_tier: number;
  total_points: number;
  games_played: number;
  avg_points_per_game: number;
}

interface DraftResults {
  team: {
    team_id: string;
    team_name: string;
    budget: number;
    budget_remaining: number;
    budget_spent: number;
    squad_size: number;
  };
  bids: Bid[];
  squad: SquadPlayer[];
  stats: {
    total_bids: number;
    won: number;
    lost: number;
    skipped: number;
    budget_spent: number;
    budget_remaining: number;
    squad_size: number;
  };
}

export default function DraftResultsPage() {
  const router = useRouter();
  
  const [results, setResults] = useState<DraftResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError('');

      const storedTeamId = localStorage.getItem('fantasy_team_id');
      const storedLeagueId = localStorage.getItem('fantasy_league_id');
      
      if (!storedTeamId || !storedLeagueId) {
        setError('Team or league information not found');
        return;
      }

      const response = await fetchWithTokenRefresh(
        `/api/fantasy/draft/my-results?team_id=${storedTeamId}&league_id=${storedLeagueId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch draft results');
      }

      const data = await response.json();
      setResults(data);

    } catch (err) {
      console.error('Error loading results:', err);
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'lost':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'skipped':
        return <MinusCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won':
        return 'WON';
      case 'lost':
        return 'LOST';
      case 'skipped':
        return 'SKIPPED';
      default:
        return 'PENDING';
    }
  };

  // Group squad by position
  const groupSquadByPosition = (squad: SquadPlayer[]) => {
    const grouped: Record<string, SquadPlayer[]> = {};
    squad.forEach(player => {
      if (!grouped[player.position]) {
        grouped[player.position] = [];
      }
      grouped[player.position].push(player);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading draft results...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading Results</h2>
          <p className="text-gray-600 text-center mb-6">{error || 'Failed to load draft results'}</p>
          <button
            onClick={() => router.back()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const groupedSquad = groupSquadByPosition(results.squad);
  const positionOrder = ['GK', 'DEF', 'MID', 'FWD'];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => router.push('/dashboard/team/fantasy/my-team')}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Draft Results</h1>
              <p className="text-blue-100 mt-1">{results.team.team_name}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-sm text-blue-100">Won</span>
              </div>
              <p className="text-2xl font-bold">{results.stats.won}</p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-sm text-blue-100">Lost</span>
              </div>
              <p className="text-2xl font-bold">{results.stats.lost}</p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <MinusCircle className="w-4 h-4" />
                <span className="text-sm text-blue-100">Skipped</span>
              </div>
              <p className="text-2xl font-bold">{results.stats.skipped}</p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm text-blue-100">Squad Size</span>
              </div>
              <p className="text-2xl font-bold">{results.stats.squad_size}</p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm text-blue-100">Remaining</span>
              </div>
              <p className="text-2xl font-bold">€{results.stats.budget_remaining.toFixed(1)}M</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Budget Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Budget Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Starting Budget</p>
              <p className="text-2xl font-bold text-gray-900">€{results.team.budget.toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Budget Spent</p>
              <p className="text-2xl font-bold text-blue-600">€{results.stats.budget_spent.toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Budget Remaining</p>
              <p className="text-2xl font-bold text-green-600">€{results.stats.budget_remaining.toFixed(1)}M</p>
            </div>
          </div>
          
          {/* Budget Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Budget Usage</span>
              <span>{((results.stats.budget_spent / results.team.budget) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${(results.stats.budget_spent / results.team.budget) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tier-by-Tier Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tier-by-Tier Results</h2>
          <div className="space-y-3">
            {results.bids.map((bid) => (
              <div
                key={bid.bid_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(bid.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-gray-900">Tier {bid.tier_number}</span>
                          <span className="text-sm text-gray-600">• {bid.tier_name}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(bid.status)}`}>
                            {getStatusText(bid.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!bid.is_skip && bid.player_name && (
                      <div className="ml-8">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{bid.player_name}</p>
                            <p className="text-sm text-gray-600">
                              {bid.position} • {bid.real_team_name} • {bid.total_points} pts
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">€{bid.bid_amount.toFixed(1)}M</p>
                            <p className="text-xs text-gray-500">Bid Amount</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {bid.is_skip && (
                      <div className="ml-8">
                        <p className="text-sm text-gray-500 italic">Tier skipped - no bid placed</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final Squad */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Final Squad</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {results.squad.length} Players
            </span>
          </div>

          {results.squad.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No players acquired in this draft</p>
              <p className="text-sm text-gray-500 mt-1">All bids were either lost or tiers were skipped</p>
            </div>
          ) : (
            <div className="space-y-6">
              {positionOrder.map(position => {
                const players = groupedSquad[position] || [];
                if (players.length === 0) return null;

                return (
                  <div key={position}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {position} ({players.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {players.map((player) => (
                        <div
                          key={player.real_player_id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{player.player_name}</p>
                              <p className="text-sm text-gray-600">{player.real_team_name}</p>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                              T{player.acquisition_tier}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <p className="text-gray-600">
                                {player.total_points} pts • {player.games_played} games
                              </p>
                              <p className="text-xs text-gray-500">
                                Avg: {player.avg_points_per_game.toFixed(1)} pts/game
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">€{player.purchase_price.toFixed(1)}M</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Squad Summary Stats */}
        {results.squad.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Squad Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {results.squad.reduce((sum, p) => sum + p.total_points, 0).toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">Total Points</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{results.squad.length}</p>
                <p className="text-sm text-gray-600">Players</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  €{(results.stats.budget_spent / results.squad.length).toFixed(1)}M
                </p>
                <p className="text-sm text-gray-600">Avg Cost</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {(results.squad.reduce((sum, p) => sum + p.avg_points_per_game, 0) / results.squad.length).toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Avg Pts/Game</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push('/dashboard/team/fantasy/my-team')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            View My Team
          </button>
          <button
            onClick={() => router.push('/dashboard/team/fantasy/all-teams')}
            className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            View League Standings
          </button>
        </div>
      </div>
    </div>
  );
}
