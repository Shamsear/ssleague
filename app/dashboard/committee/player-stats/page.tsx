'use client';

import { useState, useEffect } from 'react';
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
  matches_played: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  assists: number;
}

export default function PlayerStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PlayerStats>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && (user.role === 'committee_admin' || user.role === 'super_admin')) {
      loadPlayers();
    }
  }, [user]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const response = await fetchWithTokenRefresh('/api/committee/player-stats?season_id=SSPSLS16');
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (player: PlayerStats) => {
    setEditingPlayer(player.id);
    setEditValues({
      points: player.points,
      matches_played: player.matches_played,
      goals_scored: player.goals_scored,
      goals_conceded: player.goals_conceded,
      wins: player.wins,
      draws: player.draws,
      losses: player.losses,
      clean_sheets: player.clean_sheets,
      assists: player.assists,
    });
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditValues({});
  };

  const saveEdit = async (playerId: string) => {
    try {
      const response = await fetchWithTokenRefresh('/api/committee/player-stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          ...editValues
        })
      });

      if (response.ok) {
        await loadPlayers();
        setEditingPlayer(null);
        setEditValues({});
      } else {
        alert('Failed to update player stats');
      }
    } catch (error) {
      console.error('Error updating stats:', error);
      alert('Error updating stats');
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'committee_admin' && user.role !== 'super_admin')) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Player Stats - SSPSLS16</h1>
          <p className="text-gray-600 mt-2">View and edit player statistics</p>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by player name or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th 
                  onClick={() => handleSort('player_name')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('team')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  Team {sortBy === 'team' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('points')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  Points {sortBy === 'points' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('matches_played')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  MP {sortBy === 'matches_played' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('goals_scored')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  GS {sortBy === 'goals_scored' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('goals_conceded')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  GC {sortBy === 'goals_conceded' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('goal_difference')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  GD {sortBy === 'goal_difference' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('wins')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  W-D-L {sortBy === 'wins' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('clean_sheets')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  CS {sortBy === 'clean_sheets' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('assists')}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                >
                  Assists {sortBy === 'assists' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => {
                const isEditing = editingPlayer === player.id;
                
                return (
                  <tr key={player.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{player.player_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{player.team || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.points ?? 0}
                          onChange={(e) => setEditValues({...editValues, points: parseInt(e.target.value) || 0})}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                      ) : (
                        <span className="font-semibold text-blue-600">{player.points || 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.matches_played ?? 0}
                          onChange={(e) => setEditValues({...editValues, matches_played: parseInt(e.target.value) || 0})}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                      ) : (
                        player.matches_played || 0
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.goals_scored ?? 0}
                          onChange={(e) => setEditValues({...editValues, goals_scored: parseInt(e.target.value) || 0})}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                      ) : (
                        <span className="text-green-600 font-semibold">{player.goals_scored || 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.goals_conceded ?? 0}
                          onChange={(e) => setEditValues({...editValues, goals_conceded: parseInt(e.target.value) || 0})}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                      ) : (
                        <span className="text-red-600">{player.goals_conceded || 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${player.goal_difference > 0 ? 'text-green-600' : player.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {player.goal_difference > 0 ? '+' : ''}{player.goal_difference || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {player.wins || 0}-{player.draws || 0}-{player.losses || 0}
                    </td>
                    <td className="px-4 py-3 text-center">{player.clean_sheets || 0}</td>
                    <td className="px-4 py-3 text-center">{player.assists || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => saveEdit(player.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(player)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No players found
          </div>
        )}
      </div>
    </div>
  );
}
