'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import Link from 'next/link';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id?: string;
  team_name?: string;
  category?: string;
  star_rating: number;
  points: number;
  auction_value?: number;
  salary_per_match?: number;
  status: string;
  updated_at: string;
}

interface PlayerUpdate {
  player_id: string;
  season_id: string;
  star_rating: number;
  points: number;
}

interface StarRatingConfig {
  star_rating: number;
  starting_points: number;
  base_auction_value: number;
}

const STAR_RATINGS = [3, 4, 5, 6, 7, 8, 9, 10];

export default function PlayerStarsPointsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [starRatingConfig, setStarRatingConfig] = useState<StarRatingConfig[]>([]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading_data, setLoadingData] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStarRating, setFilterStarRating] = useState('');

  // Bulk updates
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PlayerUpdate>>(new Map());
  const [bulkStarRating, setBulkStarRating] = useState<number | ''>('');
  const [bulkPoints, setBulkPoints] = useState<number | ''>('');
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  // Get unique values for filters
  const teams = Array.from(new Set(players.filter(p => p.team_name).map(p => p.team_name!))).sort();
  const categories = Array.from(new Set(players.filter(p => p.category).map(p => p.category!))).sort();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        setLoadingData(true);
        setError(null);

        // Fetch season info
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);

        // Fetch star rating config
        try {
          const configResponse = await fetchWithTokenRefresh(`/api/star-rating-config?seasonId=${userSeasonId}`);
          const configResult = await configResponse.json();
          if (configResult.success && configResult.data) {
            setStarRatingConfig(configResult.data);
            console.log('Loaded star rating config:', configResult.data);
          }
        } catch (err) {
          console.warn('Could not load star rating config:', err);
        }

        // Fetch players
        const response = await fetchWithTokenRefresh(`/api/committee/update-player-stars-points?seasonId=${userSeasonId}`);
        const result = await response.json();

        if (result.success) {
          setPlayers(result.data);
          console.log(`Loaded ${result.data.length} players for star/points management`);
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoadingData(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  // Apply filters
  useEffect(() => {
    let filtered = players;

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.player_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterTeam) {
      filtered = filtered.filter(p => p.team_name === filterTeam);
    }

    if (filterCategory) {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    if (filterStarRating) {
      filtered = filtered.filter(p => p.star_rating === parseInt(filterStarRating));
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, filterTeam, filterCategory, filterStarRating]);

  // Helper function to calculate star rating from points
  const calculateStarRatingFromPoints = (points: number): number => {
    if (starRatingConfig.length === 0) {
      // Fallback to default logic if config not loaded
      if (points >= 350) return 10;
      if (points >= 300) return 9;
      if (points >= 250) return 8;
      if (points >= 210) return 7;
      if (points >= 175) return 6;
      if (points >= 145) return 5;
      if (points >= 120) return 4;
      return 3;
    }

    // Use season's star rating config
    // Sort by starting_points descending to find the highest matching tier
    const sortedConfig = [...starRatingConfig].sort((a, b) => b.starting_points - a.starting_points);

    for (const config of sortedConfig) {
      if (points >= config.starting_points) {
        return config.star_rating;
      }
    }

    // If points are below all thresholds, return lowest star rating
    return starRatingConfig[0]?.star_rating || 3;
  };

  const handlePlayerUpdate = (playerId: string, field: 'star_rating' | 'points', value: number) => {
    if (!userSeasonId) return;

    const player = players.find(p => p.player_id === playerId);
    if (!player) return;

    const currentUpdate = pendingUpdates.get(playerId) || {
      player_id: playerId,
      season_id: userSeasonId,
      star_rating: player.star_rating,
      points: player.points
    };

    let newUpdate = {
      ...currentUpdate,
      [field]: value
    };

    // Auto-adjust star rating when points change
    if (field === 'points') {
      const autoStarRating = calculateStarRatingFromPoints(value);
      newUpdate.star_rating = autoStarRating;
      console.log(`Auto-adjusted star rating for ${player.player_name}: ${value} points → ${autoStarRating}⭐`);
    }

    const newUpdates = new Map(pendingUpdates);
    newUpdates.set(playerId, newUpdate);
    setPendingUpdates(newUpdates);
  };

  const handleBulkUpdate = () => {
    if (selectedPlayers.size === 0) {
      setError('Please select players to update');
      return;
    }

    if (bulkStarRating === '' && bulkPoints === '') {
      setError('Please specify star rating or points for bulk update');
      return;
    }

    const newUpdates = new Map(pendingUpdates);

    selectedPlayers.forEach(playerId => {
      const player = players.find(p => p.player_id === playerId);
      if (!player) return;

      const currentUpdate = newUpdates.get(playerId) || {
        player_id: playerId,
        season_id: userSeasonId!,
        star_rating: player.star_rating,
        points: player.points
      };

      const updatedData = { ...currentUpdate };

      if (bulkStarRating !== '') {
        updatedData.star_rating = bulkStarRating as number;
      }

      if (bulkPoints !== '') {
        updatedData.points = bulkPoints as number;
      }

      newUpdates.set(playerId, updatedData);
    });

    setPendingUpdates(newUpdates);
    setBulkStarRating('');
    setBulkPoints('');
    setSuccess(`Staged bulk update for ${selectedPlayers.size} players`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveUpdates = async () => {
    if (pendingUpdates.size === 0) {
      setError('No updates to save');
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);

      const updates = Array.from(pendingUpdates.values());

      const response = await fetchWithTokenRefresh('/api/committee/update-player-stars-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const result = await response.json();

      if (result.success) {
        // Update local player data with the response data
        const updatedPlayers = players.map(player => {
          const updateResult = result.results.find((r: any) => r.player_id === player.player_id && r.success);
          if (updateResult) {
            const newSalary = updateResult.new_salary !== undefined ? updateResult.new_salary :
              (player.auction_value && player.team_id ?
                calculateRealPlayerSalary(player.auction_value, updateResult.new_star_rating) :
                null);

            return {
              ...player,
              star_rating: updateResult.new_star_rating,
              points: updateResult.new_points,
              salary_per_match: newSalary
            };
          }
          return player;
        });

        setPlayers(updatedPlayers);
        setPendingUpdates(new Map());
        setSelectedPlayers(new Set());

        setSuccess(`✅ ${result.summary.successful} players updated successfully!`);

        if (result.summary.failed > 0) {
          console.log('Failed updates:', result.results.filter((r: any) => !r.success));
        }

        setTimeout(() => setSuccess(null), 5000);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Error saving updates:', err);
      setError(`Failed to save updates: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSelectPlayer = (playerId: string, checked: boolean) => {
    const newSelected = new Set(selectedPlayers);
    if (checked) {
      newSelected.add(playerId);
    } else {
      newSelected.delete(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPlayers(new Set(filteredPlayers.map(p => p.player_id)));
    } else {
      setSelectedPlayers(new Set());
    }
  };

  const clearPendingUpdate = (playerId: string) => {
    const newUpdates = new Map(pendingUpdates);
    newUpdates.delete(playerId);
    setPendingUpdates(newUpdates);
  };

  const getPreviewSalary = (player: Player, pendingUpdate?: PlayerUpdate): number | null => {
    if (!player.auction_value || !player.team_id) return null;

    const starRating = pendingUpdate?.star_rating || player.star_rating;
    return calculateRealPlayerSalary(player.auction_value, starRating);
  };

  if (loading || !user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isCommitteeAdmin) {
    return <div className="flex justify-center items-center min-h-screen">Unauthorized</div>;
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Player Star Ratings & Points</h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Set star ratings and points for players. Salaries are automatically calculated.
            </p>
          </div>
          <Link
            href="/dashboard/committee"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm sm:text-base self-start sm:self-auto"
          >
            ← Back
          </Link>
        </div>

        {currentSeason && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-800">Season: {currentSeason.season_id}</h2>
            <p className="text-blue-600">{currentSeason.name}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">❌ {error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-600">{success}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="text-lg font-semibold mb-4">Filters & Search</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Player</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Player name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Teams</option>
              <option value="">Available (No Team)</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Star Rating</label>
            <select
              value={filterStarRating}
              onChange={(e) => setFilterStarRating(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Ratings</option>
              {STAR_RATINGS.map(star => (
                <option key={star} value={star}>{star} ⭐</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Update Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="text-lg font-semibold mb-4">Bulk Update Selected Players</h3>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Star Rating</label>
            <select
              value={bulkStarRating}
              onChange={(e) => setBulkStarRating(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Keep current</option>
              {STAR_RATINGS.map(star => (
                <option key={star} value={star}>{star} ⭐</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input
              type="number"
              value={bulkPoints}
              onChange={(e) => setBulkPoints(e.target.value === '' ? '' : parseInt(e.target.value))}
              placeholder="Keep current"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <button
            onClick={handleBulkUpdate}
            disabled={selectedPlayers.size === 0}
            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm whitespace-nowrap"
          >
            Stage Bulk Update ({selectedPlayers.size})
          </button>
        </div>
      </div>

      {/* Pending Updates Summary */}
      {pendingUpdates.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
            <h3 className="text-lg font-semibold">Pending Updates ({pendingUpdates.size})</h3>
            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
              <button
                onClick={() => setPendingUpdates(new Map())}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
              >
                Clear All
              </button>
              <button
                onClick={handleSaveUpdates}
                disabled={updating}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm"
              >
                {updating ? 'Saving...' : 'Save All Updates'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(pendingUpdates.values()).map(update => {
              const player = players.find(p => p.player_id === update.player_id);
              if (!player) return null;

              return (
                <div key={update.player_id} className="bg-white p-3 rounded border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{player.player_name}</p>
                      <p className="text-xs text-gray-600">{player.team_name || 'Available'}</p>
                      <div className="text-xs mt-1">
                        <span className={player.star_rating !== update.star_rating ? 'text-orange-600' : ''}>
                          {player.star_rating}⭐ → {update.star_rating}⭐
                        </span>
                        {' | '}
                        <span className={player.points !== update.points ? 'text-orange-600' : ''}>
                          {player.points} → {update.points} pts
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => clearPendingUpdate(update.player_id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Players Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <h3 className="text-lg font-semibold">
            Players ({filteredPlayers.length})
          </h3>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedPlayers.size === filteredPlayers.length && filteredPlayers.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Select All</span>
          </div>
        </div>

        {loading_data ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading players...</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden">
              {filteredPlayers.map((player) => {
                const pendingUpdate = pendingUpdates.get(player.player_id);
                const hasChanges = pendingUpdate && (
                  pendingUpdate.star_rating !== player.star_rating ||
                  pendingUpdate.points !== player.points
                );

                return (
                  <div key={player.id} className={`p-4 border-b border-gray-200 ${hasChanges ? 'bg-orange-50' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.has(player.player_id)}
                          onChange={(e) => handleSelectPlayer(player.player_id, e.target.checked)}
                          className="rounded mt-1"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{player.player_name}</p>
                          <p className="text-xs text-gray-500">ID: {player.player_id}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full ${player.team_name
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                              {player.team_name || 'Available'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${player.category === 'Legend'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                              }`}>
                              {player.category || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {hasChanges && (
                        <button
                          onClick={() => clearPendingUpdate(player.player_id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Current</p>
                        <p className="text-sm">
                          <span className="font-medium">{player.star_rating}⭐</span>
                          <br />
                          <span className="text-gray-600">{player.points} pts</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Salary</p>
                        {(() => {
                          const previewSalary = getPreviewSalary(player, pendingUpdate);
                          const currentSalary = player.salary_per_match;
                          const salaryChanged = previewSalary !== currentSalary;

                          return (
                            <div className="text-sm">
                              {previewSalary !== null ? (
                                <div>
                                  <span className={salaryChanged ? 'text-orange-600 font-medium' : ''}>
                                    ₹{previewSalary.toFixed(2)}
                                  </span>
                                  {salaryChanged && currentSalary && (
                                    <div className="text-xs text-gray-500">
                                      Was: ₹{Number(currentSalary).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                              {player.auction_value && (
                                <div className="text-xs text-gray-500">
                                  AV: ₹{player.auction_value}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Star Rating</label>
                        <select
                          value={pendingUpdate?.star_rating || player.star_rating}
                          onChange={(e) => handlePlayerUpdate(player.player_id, 'star_rating', parseInt(e.target.value))}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {STAR_RATINGS.map(star => (
                            <option key={star} value={star}>{star} ⭐</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Points</label>
                        <input
                          type="number"
                          value={pendingUpdate?.points || player.points}
                          onChange={(e) => handlePlayerUpdate(player.player_id, 'points', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current ⭐/Pts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Star Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPlayers.map((player) => {
                    const pendingUpdate = pendingUpdates.get(player.player_id);
                    const hasChanges = pendingUpdate && (
                      pendingUpdate.star_rating !== player.star_rating ||
                      pendingUpdate.points !== player.points
                    );

                    return (
                      <tr key={player.id} className={hasChanges ? 'bg-orange-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedPlayers.has(player.player_id)}
                            onChange={(e) => handleSelectPlayer(player.player_id, e.target.checked)}
                            className="rounded"
                          />
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{player.player_name}</p>
                            <p className="text-xs text-gray-500">ID: {player.player_id}</p>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${player.team_name
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                            {player.team_name || 'Available'}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${player.category === 'Legend'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                            }`}>
                            {player.category || 'N/A'}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>
                            <span className="font-medium">{player.star_rating}⭐</span>
                            <br />
                            <span className="text-gray-600">{player.points} pts</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={pendingUpdate?.star_rating || player.star_rating}
                            onChange={(e) => handlePlayerUpdate(player.player_id, 'star_rating', parseInt(e.target.value))}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {STAR_RATINGS.map(star => (
                              <option key={star} value={star}>{star} ⭐</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={pendingUpdate?.points || player.points}
                            onChange={(e) => handlePlayerUpdate(player.player_id, 'points', parseInt(e.target.value) || 0)}
                            min="0"
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                          />
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {(() => {
                            const previewSalary = getPreviewSalary(player, pendingUpdate);
                            const currentSalary = player.salary_per_match;
                            const salaryChanged = previewSalary !== currentSalary;

                            return (
                              <div>
                                {previewSalary !== null ? (
                                  <div>
                                    <span className={salaryChanged ? 'text-orange-600 font-medium' : ''}>
                                      ₹{previewSalary.toFixed(2)}
                                    </span>
                                    {salaryChanged && currentSalary && (
                                      <div className="text-xs text-gray-500">
                                        Was: ₹{Number(currentSalary).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span>N/A</span>
                                )}
                                {player.auction_value && (
                                  <div className="text-xs text-gray-500">
                                    AV: ₹{player.auction_value}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {hasChanges && (
                            <button
                              onClick={() => clearPendingUpdate(player.player_id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Reset
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}