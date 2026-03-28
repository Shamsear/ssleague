'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface LineupHistory {
  lineup_id: string;
  round_id: string;
  round_number: number;
  round_name: string;
  starting_players: Array<{
    player_id: string;
    player_name: string;
    position: string;
    points: number;
    is_captain: boolean;
    is_vice_captain: boolean;
  }>;
  bench_players: Array<{
    player_id: string;
    player_name: string;
    position: string;
    points: number;
  }>;
  total_points: number;
  captain_points: number;
  vice_captain_points: number;
  created_at: string;
}

export default function LineupHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [lineups, setLineups] = useState<LineupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('all');

  useEffect(() => {
    loadLineupHistory();
  }, []);

  const loadLineupHistory = async () => {
    try {
      setLoading(true);
      setError('');

      // Get team ID
      const teamRes = await fetch('/api/fantasy/my-team');
      const teamData = await teamRes.json();
      
      if (!teamData.success) {
        throw new Error('Failed to load team');
      }

      const teamId = teamData.team.team_id;

      // Get lineup history
      const response = await fetch(`/api/fantasy/lineups/history?team_id=${teamId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load lineup history');
      }

      setLineups(data.lineups || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLineups = selectedRound === 'all'
    ? lineups
    : lineups.filter(l => l.round_id === selectedRound);

  const uniqueRounds = Array.from(new Set(lineups.map(l => l.round_id)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lineup history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lineup History</h1>
        <p className="text-gray-600">View your past lineup selections and points</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by Round:</label>
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Rounds</option>
            {uniqueRounds.map(roundId => {
              const lineup = lineups.find(l => l.round_id === roundId);
              return (
                <option key={roundId} value={roundId}>
                  Round {lineup?.round_number} - {lineup?.round_name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Lineups */}
      {filteredLineups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500 text-lg">No lineup history found</p>
          <button
            onClick={() => router.push('/dashboard/team/fantasy/my-team')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to My Team
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredLineups.map(lineup => (
            <div key={lineup.lineup_id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Round {lineup.round_number} - {lineup.round_name}
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {new Date(lineup.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-100 text-sm">Total Points</p>
                    <p className="text-3xl font-bold text-white">
                      {lineup.total_points.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Starting 5 */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Starting 5</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lineup.starting_players.map(player => (
                    <div
                      key={player.player_id}
                      className={`border rounded-lg p-4 ${
                        player.is_captain ? 'border-yellow-400 bg-yellow-50' :
                        player.is_vice_captain ? 'border-blue-400 bg-blue-50' :
                        'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {player.player_name}
                          </h4>
                          <p className="text-sm text-gray-600">{player.position}</p>
                        </div>
                        {player.is_captain && (
                          <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
                            C
                          </span>
                        )}
                        {player.is_vice_captain && (
                          <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">
                            VC
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Points:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {player.points.toFixed(1)}
                        </span>
                      </div>
                      {player.is_captain && (
                        <p className="text-xs text-gray-500 mt-1">
                          (2x multiplier applied)
                        </p>
                      )}
                      {player.is_vice_captain && (
                        <p className="text-xs text-gray-500 mt-1">
                          (1.5x multiplier applied)
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bench */}
                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Bench</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lineup.bench_players.map(player => (
                    <div
                      key={player.player_id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {player.player_name}
                          </h4>
                          <p className="text-sm text-gray-600">{player.position}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">
                            {player.points.toFixed(1)}
                          </span>
                          <p className="text-xs text-gray-500">pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Points</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {lineup.total_points.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Captain Points</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {lineup.captain_points.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Vice-Captain Points</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {lineup.vice_captain_points.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back Button */}
      <div className="mt-8 text-center">
        <button
          onClick={() => router.push('/dashboard/team/fantasy/my-team')}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Back to My Team
        </button>
      </div>
    </div>
  );
}
