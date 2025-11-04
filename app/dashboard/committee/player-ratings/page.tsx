'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  id: string;
  playerName: string;
  points: number;
  starRating: number;
  categoryId?: string;
  categoryName?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

const STAR_RATINGS = [3, 4, 5, 6, 7, 8, 9, 10];

// Base points by star rating (same as system calculation)
const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375,
};

export default function PlayerRatingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [starRatingConfig, setStarRatingConfig] = useState<any>(null);

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
        setDataLoading(true);
        
        // Fetch season
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        // Fetch categories
        const categoriesResponse = await fetchWithTokenRefresh(/api/categories');
        const categoriesResult = await categoriesResponse.json();
        if (categoriesResult.success && categoriesResult.data) {
          setCategories(categoriesResult.data);
          console.log(`Loaded ${categoriesResult.data.length} categories`);
        }
        
        // Fetch star rating config for base prices
        try {
          const configResponse = await fetchWithTokenRefresh(`/api/star-rating-config?seasonId=${userSeasonId}`);
          const configResult = await configResponse.json();
          if (configResult.success && configResult.data) {
            setStarRatingConfig(configResult.data);
            console.log('Loaded star rating config with base prices');
          }
        } catch (err) {
          console.warn('Could not load star rating config:', err);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load initial data');
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  // Load registered players for the season
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId || !currentSeason) return;
      
      try {
        // Check if it's a modern season (16+) or historical
        const seasonNum = parseInt(userSeasonId.replace(/\D/g, '')) || 0;
        const isModernSeason = seasonNum >= 16;
        
        if (isModernSeason) {
          // For Season 16+: Fetch from Neon via API (player_seasons table)
          const response = await fetchWithTokenRefresh(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`);
          const result = await response.json();
          
          if (result.success && result.data && result.data.length > 0) {
            const loadedPlayers: Player[] = result.data.map((data: any) => ({
              id: data.player_id || data.id,
              playerName: data.player_name || '',
              points: data.points || 0,
              starRating: data.star_rating || 5,
              categoryId: data.category || '',
              categoryName: data.category || '',
            }));
            
            setPlayers(loadedPlayers);
            console.log(`Loaded ${loadedPlayers.length} players from Neon (Season 16+)`);
          } else {
            console.log('No players found for this season in Neon');
            setPlayers([]);
          }
        } else {
          // For historical seasons (1-15): Use Firebase
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase/config');
          
          const playersQuery = query(
            collection(db, 'realplayer'),
            where('season_id', '==', userSeasonId)
          );
          
          const playersSnapshot = await getDocs(playersQuery);
          
          if (playersSnapshot.empty) {
            console.log('No players registered for this season');
            setPlayers([]);
            return;
          }
          
          const loadedPlayers: Player[] = playersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              playerName: data.player_name || data.name || '',
              points: data.points || 0,
              starRating: data.star_rating || 5,
              categoryId: data.category_id || '',
              categoryName: data.category_name || '',
            };
          });
          
          setPlayers(loadedPlayers);
          console.log(`Loaded ${loadedPlayers.length} players from Firebase (Historical)`);
        }
      } catch (error) {
        console.error('Error loading players:', error);
        setError('Failed to load players');
      } finally {
        setDataLoading(false);
        setPageReady(true);
      }
    };

    if (currentSeason) {
      loadPlayers();
    }
  }, [userSeasonId, currentSeason]);

  const updatePlayer = (id: string, field: keyof Player, value: any) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        // Auto-calculate base points when star rating changes
        if (field === 'starRating') {
          updated.points = STAR_RATING_BASE_POINTS[value] || 100;
        }
        return updated;
      }
      return p;
    }));
  };

  const handleExportToXLSX = () => {
    try {
      // Prepare data for export
      const exportData = players.map(player => {
        // Find the config for this star rating
        const ratingConfig = Array.isArray(starRatingConfig) 
          ? starRatingConfig.find((c: any) => c.star_rating === player.starRating)
          : null;
        const basePrice = ratingConfig?.base_auction_value || 100; // Fallback to 100 if not found
        
        return {
          'Player Name': player.playerName,
          'Star Rating': player.starRating,
          'Category': player.categoryName || 'Not Assigned',
          'Points': player.points,
          'Base Price': basePrice,
        };
      });

      // Sort by star rating (descending) for better readability
      exportData.sort((a, b) => b['Star Rating'] - a['Star Rating']);

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 30 }, // Player Name
        { wch: 12 }, // Star Rating
        { wch: 20 }, // Category
        { wch: 10 }, // Points
        { wch: 12 }, // Base Price
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Player Ratings');

      // Generate filename with season and date
      const seasonName = currentSeason?.name?.replace(/\s+/g, '_') || 'Season';
      const date = new Date().toISOString().split('T')[0];
      const filename = `Player_Ratings_${seasonName}_${date}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);

      setSuccess(`Exported ${players.length} players to ${filename}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error exporting to XLSX:', err);
      setError('Failed to export to XLSX');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRecalculateCategories = async () => {
    if (categories.length === 0) {
      setError('Please create categories first');
      return;
    }

    try {
      setRecalculating(true);
      setError(null);
      setSuccess(null);

      // Sort players by star rating (descending)
      const sortedPlayers = [...players].sort((a, b) => b.starRating - a.starRating);
      const playersPerCategory = Math.ceil(sortedPlayers.length / categories.length);
      
      // Auto-assign categories based on star rating
      const playersWithCategories = sortedPlayers.map((player, index) => {
        const categoryIndex = Math.floor(index / playersPerCategory);
        const category = categories[Math.min(categoryIndex, categories.length - 1)];
        return {
          ...player,
          categoryId: category.id,
          categoryName: category.name,
        };
      });

      // Call API to update only categories (not star ratings)
      const response = await fetchWithTokenRefresh(/api/player-ratings/recalculate-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          players: playersWithCategories.map(p => ({
            id: p.id,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate categories');
      }

      const result = await response.json();
      setSuccess(`Successfully recalculated categories for ${playersWithCategories.length} players`);
      
      // Update local state to show new categories
      setPlayers(playersWithCategories);
    } catch (error) {
      console.error('Error recalculating:', error);
      setError(error instanceof Error ? error.message : 'Failed to recalculate categories');
    } finally {
      setRecalculating(false);
    }
  };

  const handleSave = async () => {
    if (categories.length === 0) {
      setError('Please create categories first');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Sort players by star rating (descending)
      const sortedPlayers = [...players].sort((a, b) => b.starRating - a.starRating);
      const playersPerCategory = Math.ceil(sortedPlayers.length / categories.length);
      
      // Auto-assign categories based on star rating
      const playersWithCategories = sortedPlayers.map((player, index) => {
        const categoryIndex = Math.floor(index / playersPerCategory);
        const category = categories[Math.min(categoryIndex, categories.length - 1)];
        return {
          ...player,
          categoryId: category.id,
          categoryName: category.name,
        };
      });

      // Call API to update player ratings and categories
      const response = await fetchWithTokenRefresh(/api/player-ratings/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          players: playersWithCategories.map(p => ({
            id: p.id,
            starRating: p.starRating,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save player ratings');
      }

      const result = await response.json();
      setSuccess(`Successfully assigned ratings and categories to ${playersWithCategories.length} players`);
      
      // Reload players to show updated data
      setPlayers(playersWithCategories);
    } catch (error) {
      console.error('Error saving:', error);
      setError(error instanceof Error ? error.message : 'Failed to save player ratings');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.playerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Unified loading state
  if (loading || !user || dataLoading || !pageReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading player ratings...</p>
        </div>
      </div>
    );
  }

  // After loading, check permissions
  if (!isCommitteeAdmin) {
    return null;
  }

  // Check season type
  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center shadow-xl">
            <div className="inline-flex items-center justify-center p-4 bg-amber-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Season Type Not Supported</h2>
            <p className="text-amber-700 text-lg">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if categories exist
  if (categories.length === 0) {
    return (
      <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center shadow-xl">
            <div className="inline-flex items-center justify-center p-4 bg-amber-100 rounded-full mb-4">
              <svg className="w-16 h-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Categories Required</h2>
            <p className="text-amber-600 mb-6">You must create categories before assigning player ratings. Categories will be equally distributed among players based on their points.</p>
            <Link 
              href="/dashboard/committee/team-management/categories"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Categories
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if players exist
  if (players.length === 0) {
    return (
      <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center shadow-xl">
            <div className="inline-flex items-center justify-center p-4 bg-blue-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Players Found</h2>
            <p className="text-gray-600">No players are registered for {currentSeason?.name}.</p>
            <p className="text-gray-500 text-sm mt-2">Please ensure players have registered for this season.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            ⭐ Player Ratings & Categories
          </h1>
          <p className="text-gray-600">
            Assign star ratings to players. Categories will be auto-distributed equally based on points.
          </p>
        </div>

        {/* Season banner */}
        <div className="mb-6 glass rounded-2xl p-4 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Managing Ratings for</p>
              <p className="text-xl font-bold text-indigo-900">{currentSeason?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Players</p>
              <p className="text-2xl font-bold text-indigo-600">{players.length}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="glass rounded-3xl p-6">
              {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Players table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Star Rating</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Points (Auto)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category (Preview)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                        {/* Player Name */}
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{player.playerName}</span>
                        </td>
                        
                        {/* Star Rating */}
                        <td className="px-4 py-3">
                          <select
                            value={player.starRating}
                            onChange={(e) => updatePlayer(player.id, 'starRating', Number(e.target.value))}
                            className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                          >
                            {STAR_RATINGS.map(rating => (
                              <option key={rating} value={rating}>
                                {rating} ⭐
                              </option>
                            ))}
                          </select>
                        </td>
                        
                        {/* Points (Auto-calculated) */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-600">{player.points}</span>
                            <span className="text-xs text-gray-500 italic">pts</span>
                          </div>
                        </td>
                        
                        {/* Category Preview */}
                        <td className="px-4 py-3">
                          {player.categoryName ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {player.categoryName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 italic">Assigned on save</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  {/* Recalculate button */}
                  <button
                    onClick={handleRecalculateCategories}
                    disabled={recalculating || submitting}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title="Recalculate categories based on current star ratings without saving"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {recalculating ? 'Recalculating...' : 'Recalculate Categories'}
                  </button>

                  {/* Export button */}
                  <button
                    onClick={handleExportToXLSX}
                    disabled={submitting || recalculating || players.length === 0}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title="Export player ratings to Excel file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to XLSX
                  </button>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={submitting || recalculating}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Ratings & Auto-Assign Categories'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info panel */}
            <div className="glass rounded-2xl p-5 bg-gradient-to-br from-amber-50 to-orange-50">
              <h3 className="font-semibold text-amber-900 mb-3">📝 Auto-Assignment Rules</h3>
              <div className="text-sm text-amber-800 space-y-2">
                <p>• Star ratings: 3-10 ⭐</p>
                <p>• <strong>Base Points:</strong> Auto-calculated from stars</p>
                <div className="text-xs text-amber-700 ml-4 space-y-0.5">
                  {STAR_RATINGS.map(rating => (
                    <p key={rating}>⭐ {rating} → {STAR_RATING_BASE_POINTS[rating]} pts</p>
                  ))}
                </div>
                <p>• Players sorted by rating (high to low)</p>
                <p>• <strong>Categories:</strong> Auto-distributed equally</p>
                <p className="text-xs text-amber-700 ml-4">
                  {categories.length} categories → ~{Math.ceil(players.length / categories.length)} players each
                </p>
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-1">Categories:</p>
                  {categories.map(cat => (
                    <p key={cat.id} className="text-xs text-amber-700 ml-2">• {cat.name}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Next steps */}
            <div className="glass rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h3 className="font-semibold text-blue-900 mb-3">➡️ Next Steps</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>1. Assign star ratings to all players</p>
                <p>2. Click "Recalculate" to preview category distribution</p>
                <p>3. Click "Save" to persist ratings & categories</p>
                <p>4. Go to <Link href="/dashboard/committee/real-players" className="underline font-semibold">SS Members</Link> to assign teams</p>
              </div>
            </div>
            
            {/* Recalculate info */}
            <div className="glass rounded-2xl p-5 bg-gradient-to-br from-purple-50 to-pink-50">
              <h3 className="font-semibold text-purple-900 mb-3">🔄 Recalculate Categories</h3>
              <div className="text-sm text-purple-800 space-y-2">
                <p>Use the <strong>Recalculate</strong> button to redistribute categories based on current star ratings without saving changes.</p>
                <p className="text-xs text-purple-700 mt-2">This is useful if categories were manually edited or if you want to preview the distribution before committing.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
