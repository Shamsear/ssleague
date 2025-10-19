'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import Link from 'next/link';

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
        // Fetch season
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        // Fetch categories
        const categoriesResponse = await fetch('/api/categories');
        const categoriesResult = await categoriesResponse.json();
        if (categoriesResult.success && categoriesResult.data) {
          setCategories(categoriesResult.data);
          console.log(`Loaded ${categoriesResult.data.length} categories`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
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
        console.log(`Loaded ${loadedPlayers.length} players`);
      } catch (error) {
        console.error('Error loading players:', error);
        setError('Failed to load players');
      }
    };

    loadPlayers();
  }, [userSeasonId, currentSeason]);

  const updatePlayer = (id: string, field: keyof Player, value: any) => {
    setPlayers(players.map(p => p.id === id ? { ...p, [field]: value } : p));
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
      const response = await fetch('/api/player-ratings/assign', {
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-amber-600">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if categories exist
  if (categories.length === 0) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Categories Required</h2>
            <p className="text-amber-600 mb-6">You must create categories before assigning player ratings. Categories will be equally distributed among players based on their star ratings.</p>
            <Link 
              href="/dashboard/committee/team-management/categories"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
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

  if (players.length === 0) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Players Found</h2>
            <p className="text-gray-600">No players are registered for {currentSeason?.name}. Please ensure players are registered first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            ⭐ Player Ratings & Categories
          </h1>
          <p className="text-gray-600">
            Assign star ratings to players. Categories will be auto-distributed equally based on ratings.
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Points</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Star Rating</th>
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
                        
                        {/* Points */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-700">{player.points}</span>
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

              {/* Save button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={submitting}
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
                <p>2. Click "Save" to auto-assign categories</p>
                <p>3. Go to <Link href="/dashboard/committee/real-players" className="underline font-semibold">SS Members</Link> to assign teams</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
