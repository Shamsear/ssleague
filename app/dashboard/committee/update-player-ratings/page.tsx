'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerUpdate {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  team_id: string;
  season_id: string;
  current_star_rating: number;
  current_points: number;
  auction_value: number;
  new_star_rating: number;
  new_points: number;
  needs_update: boolean;
}

// Star upgrade matrix
const UPGRADE_MATRIX: Record<number, Record<number, number>> = {
  3: { 40: 3, 70: 4, 100: 5, 130: 6, 175: 7, 225: 8, 300: 9, 400: 10 },
  4: { 70: 4, 100: 5, 130: 6, 175: 7, 225: 8, 300: 9, 400: 10 },
  5: { 100: 5, 130: 6, 175: 7, 225: 8, 300: 9, 400: 10 },
  6: { 130: 6, 175: 7, 225: 8, 300: 9, 400: 10 },
  7: { 175: 7, 225: 8, 300: 9, 400: 10 },
  8: { 225: 8, 300: 9, 400: 10 },
  9: { 300: 9, 400: 10 },
  10: { 400: 10 }
};

// Points based on star rating
const STAR_RATING_POINTS: Record<number, number> = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375
};

const calculateNewStarRating = (initialStars: number, auctionValue: number): number => {
  if (initialStars < 3 || initialStars > 10 || !auctionValue) return initialStars;
  if (initialStars === 10) return 10;
  
  const upgrades = UPGRADE_MATRIX[initialStars];
  if (!upgrades) return initialStars;
  
  // Find the highest upgrade the auction value qualifies for
  const sortedThresholds = Object.keys(upgrades)
    .map(Number)
    .sort((a, b) => b - a); // Sort descending
  
  for (const threshold of sortedThresholds) {
    if (auctionValue >= threshold) {
      return upgrades[threshold];
    }
  }
  
  return initialStars;
};

export default function UpdatePlayerRatingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [players, setPlayers] = useState<PlayerUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!userSeasonId) return;
      
      try {
        setIsLoading(true);
        const response = await fetchWithTokenRefresh(`/api/stats/players?seasonId=${userSeasonId}&limit=1000`);
        const result = await response.json();
        
        if (result.success && result.data) {
          // Filter only players who have been assigned to teams
          const assignedPlayers = result.data.filter((p: any) => 
            p.team_id && p.auction_value && p.auction_value > 0
          );
          
          const playerUpdates: PlayerUpdate[] = assignedPlayers.map((p: any) => {
            const currentStars = p.star_rating || 3;
            const auctionValue = p.auction_value || 0;
            const newStars = calculateNewStarRating(currentStars, auctionValue);
            const newPoints = STAR_RATING_POINTS[newStars] || 100;
            const currentPoints = p.points || 100;
            
            return {
              id: p.id,
              player_id: p.player_id,
              player_name: p.player_name,
              team: p.team || 'Unknown Team',
              team_id: p.team_id,
              season_id: p.season_id,
              current_star_rating: currentStars,
              current_points: currentPoints,
              auction_value: auctionValue,
              new_star_rating: newStars,
              new_points: newPoints,
              needs_update: newStars !== currentStars || newPoints !== currentPoints
            };
          });
          
          setPlayers(playerUpdates);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
        setError('Failed to load players');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isCommitteeAdmin && userSeasonId) {
      fetchPlayers();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const handleUpdateAll = async () => {
    const playersToUpdate = players.filter(p => p.needs_update);
    
    if (playersToUpdate.length === 0) {
      setError('No players need updating');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);

      const response = await fetchWithTokenRefresh('/api/admin/update-player-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          updates: playersToUpdate.map(p => ({
            player_id: p.player_id,
            season_id: p.season_id,
            star_rating: p.new_star_rating,
            points: p.new_points
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update players');
      }

      setSuccess(`✅ Successfully updated ${playersToUpdate.length} player(s)!`);
      
      // Refresh the page data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update players');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading players...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  const playersNeedingUpdate = players.filter(p => p.needs_update);

  return (
    <div className="min-h-screen py-6 px-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                ⭐ Update Player Ratings
              </h1>
              <p className="text-gray-600">
                Update star ratings and points based on auction values
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/committee')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
            >
              ← Back
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Assigned</div>
              <div className="text-2xl font-bold text-blue-700">{players.length}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Need Update</div>
              <div className="text-2xl font-bold text-orange-700">{playersNeedingUpdate.length}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="text-sm text-green-600 font-medium">Up to Date</div>
              <div className="text-2xl font-bold text-green-700">{players.length - playersNeedingUpdate.length}</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg animate-pulse">
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Update Button */}
        {playersNeedingUpdate.length > 0 && (
          <div className="mb-6">
            <button
              onClick={handleUpdateAll}
              disabled={isUpdating}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </span>
              ) : (
                `🚀 Update ${playersNeedingUpdate.length} Player${playersNeedingUpdate.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}

        {/* Players List */}
        <div className="space-y-3">
          {players.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Assigned Players</h3>
              <p className="text-gray-600">
                Players will appear here once they have been assigned to teams with auction values.
              </p>
            </div>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-all ${
                  player.needs_update
                    ? 'border-orange-200 bg-orange-50/30'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{player.player_name}</h3>
                      {player.needs_update && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                          Needs Update
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {player.team}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Auction: ${player.auction_value}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Current */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Current</div>
                      <div className="text-lg font-bold text-gray-700">{player.current_star_rating}⭐</div>
                      <div className="text-sm text-gray-600">{player.current_points} pts</div>
                    </div>

                    {/* Arrow */}
                    {player.needs_update && (
                      <div className="flex items-center">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    )}

                    {/* New */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">New</div>
                      <div className={`text-lg font-bold ${
                        player.new_star_rating > player.current_star_rating ? 'text-green-600' : 'text-gray-700'
                      }`}>
                        {player.new_star_rating}⭐
                      </div>
                      <div className={`text-sm ${
                        player.new_points > player.current_points ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {player.new_points} pts
                      </div>
                    </div>

                    {/* Change indicator */}
                    {player.needs_update && (
                      <div className="text-center px-3 py-2 bg-green-100 rounded-lg">
                        {player.new_star_rating > player.current_star_rating && (
                          <div className="text-xs text-green-700 font-semibold">
                            +{player.new_star_rating - player.current_star_rating} ⭐
                          </div>
                        )}
                        {player.new_points > player.current_points && (
                          <div className="text-xs text-green-700 font-semibold">
                            +{player.new_points - player.current_points} pts
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Players' star ratings are upgraded based on their auction values</li>
                <li>Points are automatically set according to the new star rating</li>
                <li>Only players assigned to teams with auction values are shown</li>
                <li>Changes are applied to all players at once</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
