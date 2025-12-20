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
  base_points: number;
  matches_played: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
}

export default function PlayerStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editMode, setEditMode] = useState(false);
  const [editedPlayers, setEditedPlayers] = useState<Map<string, Partial<PlayerStats>>>(new Map());
  const [saving, setSaving] = useState(false);

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
        console.log('[Player Stats Page] Loaded players:', data.players?.length);
        if (data.players?.length > 0) {
          console.log('[Player Stats Page] First player base_points:', data.players[0].base_points);
        }
        setPlayers(data.players || []);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      setEditedPlayers(new Map());
    }
    setEditMode(!editMode);
  };

  const updatePlayerValue = (playerId: string, field: keyof PlayerStats, value: number) => {
    const currentEdits = new Map(editedPlayers);
    const playerEdits = currentEdits.get(playerId) || {};
    currentEdits.set(playerId, { ...playerEdits, [field]: value });
    setEditedPlayers(currentEdits);
  };

  const getPlayerValue = (player: PlayerStats, field: keyof PlayerStats): number => {
    const edits = editedPlayers.get(player.id);
    if (edits && field in edits) {
      return edits[field] as number;
    }
    return player[field] as number;
  };

  const saveAllChanges = async () => {
    if (editedPlayers.size === 0) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      const updates = Array.from(editedPlayers.entries()).map(([playerId, edits]) => {
        const player = players.find(p => p.id === playerId);
        return {
          player_id: playerId,
          points: edits.points ?? player?.points ?? 0,
          base_points: edits.base_points ?? player?.base_points ?? 0,
          matches_played: edits.matches_played ?? player?.matches_played ?? 0,
          goals_scored: edits.goals_scored ?? player?.goals_scored ?? 0,
          goals_conceded: edits.goals_conceded ?? player?.goals_conceded ?? 0,
          wins: edits.wins ?? player?.wins ?? 0,
          draws: edits.draws ?? player?.draws ?? 0,
          losses: edits.losses ?? player?.losses ?? 0,
          clean_sheets: edits.clean_sheets ?? player?.clean_sheets ?? 0,
        };
      });

      for (const update of updates) {
        const response = await fetchWithTokenRefresh('/api/committee/player-stats', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        });

        if (!response.ok) {
          throw new Error('Failed to update player');
        }
      }

      await loadPlayers();
      setEditedPlayers(new Map());
      setEditMode(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error saving changes. Please try again.');
    } finally {
      setSaving(false);
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

  if (!user || (user.role !== 'committee_admin' && user.role !== 'super_admin')) return null;

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
            
            <div className="flex items-center gap-3">
              {editMode && (
                <>
                  <button
                    onClick={toggleEditMode}
                    disabled={saving}
                    className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAllChanges}
                    disabled={saving || editedPlayers.size === 0}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes {editedPlayers.size > 0 && `(${editedPlayers.size})`}
                      </>
                    )}
                  </button>
                </>
              )}
              {!editMode && (
                <button
                  onClick={toggleEditMode}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Mode
                </button>
              )}
            </div>
          </div>

          {editMode && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800 font-medium">
                  Edit mode is active. Click on any cell to modify values. Don't forget to save your changes!
                </p>
              </div>
            </div>
          )}
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
                  <th 
                    onClick={() => handleSort('player_name')}
                    className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('team')}
                    className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Team {sortBy === 'team' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('points')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Points {sortBy === 'points' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('base_points')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Base {sortBy === 'base_points' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                    Change
                  </th>
                  <th 
                    onClick={() => handleSort('matches_played')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    MP {sortBy === 'matches_played' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goals_scored')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GS {sortBy === 'goals_scored' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goals_conceded')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GC {sortBy === 'goals_conceded' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('goal_difference')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    GD {sortBy === 'goal_difference' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                    W-D-L
                  </th>
                  <th 
                    onClick={() => handleSort('clean_sheets')}
                    className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    CS {sortBy === 'clean_sheets' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlayers.map((player, index) => {
                  const hasEdits = editedPlayers.has(player.id);
                  const currentPoints = getPlayerValue(player, 'points');
                  const currentBasePoints = getPlayerValue(player, 'base_points');
                  const change = currentBasePoints > 0 ? currentPoints - currentBasePoints : 0;
                  
                  return (
                    <tr 
                      key={player.id} 
                      className={`hover:bg-blue-50 transition-colors ${hasEdits ? 'bg-yellow-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {player.player_name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{player.player_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{player.team || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'points')}
                            onChange={(e) => updatePlayerValue(player.id, 'points', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 border-2 border-blue-300 rounded-lg text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                            {player.points || 0}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'base_points')}
                            onChange={(e) => updatePlayerValue(player.id, 'base_points', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 border-2 border-gray-300 rounded-lg text-center font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-600">{player.base_points || 0}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {currentBasePoints > 0 ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
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
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'matches_played')}
                            onChange={(e) => updatePlayerValue(player.id, 'matches_played', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-700">{player.matches_played || 0}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'goals_scored')}
                            onChange={(e) => updatePlayerValue(player.id, 'goals_scored', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            ⚽ {player.goals_scored || 0}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'goals_conceded')}
                            onChange={(e) => updatePlayerValue(player.id, 'goals_conceded', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-red-600">{player.goals_conceded || 0}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-bold ${
                          player.goal_difference > 0 ? 'text-green-600' : 
                          player.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {player.goal_difference > 0 ? '+' : ''}{player.goal_difference || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-600 font-medium">
                          <span className="text-green-600 font-bold">{getPlayerValue(player, 'wins')}</span>-
                          <span className="text-gray-500">{getPlayerValue(player, 'draws')}</span>-
                          <span className="text-red-600 font-bold">{getPlayerValue(player, 'losses')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={getPlayerValue(player, 'clean_sheets')}
                            onChange={(e) => updatePlayerValue(player.id, 'clean_sheets', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">{player.clean_sheets || 0}</span>
                        )}
                      </td>
                    </tr>
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
