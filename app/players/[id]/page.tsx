'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import Image from 'next/image';
import { usePlayerStats } from '@/hooks';

interface PlayerData {
  id: string;
  player_id: string;
  name: string;
  display_name?: string;
  category?: string;
  team?: string;
  psn_id?: string;
  photo_url?: string;
  stats?: {
    matches_played?: number;
    matches_won?: number;
    matches_lost?: number;
    matches_drawn?: number;
    goals_scored?: number;
    goals_conceded?: number;
    assists?: number;
    clean_sheets?: number;
    points?: number;
    average_rating?: number;
    win_rate?: number;
  };
}

interface SeasonStats {
  season_id: string;
  season_name?: string;
  category?: string;
  team?: string;
  stats?: any;
}

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerId = params.id as string;
  
  // Use React Query hook for player stats from Neon
  const { data: playerStatsData, isLoading: statsLoading } = usePlayerStats({
    playerId: playerId
  });

  useEffect(() => {
    fetchPlayerData();
  }, [playerId]);
  
  // Process player stats data from Neon when it arrives
  useEffect(() => {
    if (!playerStatsData || playerStatsData.length === 0) return;
    
    const seasonsData = playerStatsData.map((data: any) => ({
      season_id: data.season_id,
      season_name: data.season_name,
      category: data.category,
      team: data.team,
      stats: data
    })) as SeasonStats[];
    
    setSeasonStats(seasonsData);
  }, [playerStatsData]);

  const fetchPlayerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch permanent player data from realplayers collection
      const playerDoc = await getDoc(doc(db, 'realplayers', playerId));
      
      if (!playerDoc.exists()) {
        setError('Player not found');
        setLoading(false);
        return;
      }
      
      const playerData = { id: playerDoc.id, ...playerDoc.data() } as PlayerData;
      setPlayer(playerData);
      
      // Season stats now come from React Query hook (Neon)
      // Processing happens in separate useEffect
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching player data:', error);
      setError('Failed to load player data');
      setLoading(false);
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading player...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-900 text-lg font-semibold mb-2">{error}</p>
          <Link href="/players" className="text-blue-600 hover:text-blue-700">
            ← Back to Players
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Button */}
      <Link
        href="/players"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Players
      </Link>

      {/* Player Header */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Player Photo */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 flex-shrink-0 mx-auto sm:mx-0">
            {player.photo_url ? (
              <Image
                src={player.photo_url}
                alt={player.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-24 h-24 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">
              {player.display_name || player.name}
            </h1>
            {player.display_name && player.name !== player.display_name && (
              <p className="text-gray-600 mb-3">Real Name: {player.name}</p>
            )}
            
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {player.category && (
                <span className={`px-4 py-2 rounded-lg font-semibold ${
                  player.category === 'Legend' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-blue-500 text-white'
                }`}>
                  {player.category}
                </span>
              )}
              {player.team && (
                <span className="px-4 py-2 rounded-lg bg-purple-100 text-purple-700 font-semibold">
                  {player.team}
                </span>
              )}
              {player.psn_id && (
                <span className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium">
                  🎮 {player.psn_id}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current Season Stats */}
      {player.stats && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Current Season Statistics</h2>
          
          {/* Match Record */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Match Record</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                  {player.stats.matches_played || 0}
                </div>
                <div className="text-sm text-gray-600">Matches</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                  {player.stats.matches_won || 0}
                </div>
                <div className="text-sm text-gray-600">Wins</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-600 mb-1">
                  {player.stats.matches_drawn || 0}
                </div>
                <div className="text-sm text-gray-600">Draws</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
                  {player.stats.matches_lost || 0}
                </div>
                <div className="text-sm text-gray-600">Losses</div>
              </div>
            </div>
          </div>

          {/* Goals & Assists */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Goals & Assists</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                  {player.stats.goals_scored || 0}
                </div>
                <div className="text-sm text-gray-600">Goals Scored</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
                  {player.stats.goals_conceded || 0}
                </div>
                <div className="text-sm text-gray-600">Goals Conceded</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-indigo-600 mb-1">
                  {((player.stats.goals_scored || 0) - (player.stats.goals_conceded || 0)) > 0 ? '+' : ''}
                  {(player.stats.goals_scored || 0) - (player.stats.goals_conceded || 0)}
                </div>
                <div className="text-sm text-gray-600">Net Goals</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
                  {player.stats.assists || 0}
                </div>
                <div className="text-sm text-gray-600">Assists</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Performance Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-amber-600 mb-1">
                  {player.stats.points || 0}
                </div>
                <div className="text-sm text-gray-600">Points</div>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-cyan-600 mb-1">
                  {player.stats.clean_sheets || 0}
                </div>
                <div className="text-sm text-gray-600">Clean Sheets</div>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-rose-600 mb-1">
                  {player.stats.average_rating?.toFixed(1) || '0.0'}
                </div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-teal-600 mb-1">
                  {player.stats.win_rate?.toFixed(0) || 0}%
                </div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Season History */}
      {seasonStats.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Season History</h2>
          <div className="space-y-4">
            {seasonStats.map((season, index) => (
              <div key={index} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{season.season_name || `Season ${index + 1}`}</h3>
                  <div className="flex gap-2">
                    {season.category && (
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        season.category === 'Legend' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {season.category}
                      </span>
                    )}
                    {season.team && (
                      <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">
                        {season.team}
                      </span>
                    )}
                  </div>
                </div>
                {/* Match Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Matches</div>
                    <div className="font-bold text-blue-600 text-lg">{season.stats?.matches_played || 0}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Wins</div>
                    <div className="font-bold text-green-600 text-lg">{season.stats?.matches_won || 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Draws</div>
                    <div className="font-bold text-gray-600 text-lg">{season.stats?.matches_drawn || 0}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Losses</div>
                    <div className="font-bold text-red-600 text-lg">{season.stats?.matches_lost || 0}</div>
                  </div>
                </div>

                {/* Goals & Assists Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Goals Scored</div>
                    <div className="font-bold text-green-600 text-lg">{season.stats?.goals_scored || 0}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Goals Conceded</div>
                    <div className="font-bold text-red-600 text-lg">{season.stats?.goals_conceded || 0}</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Net Goals</div>
                    <div className="font-bold text-indigo-600 text-lg">
                      {(season.stats?.goals_scored || 0) - (season.stats?.goals_conceded || 0) > 0 ? '+' : ''}
                      {(season.stats?.goals_scored || 0) - (season.stats?.goals_conceded || 0)}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Assists</div>
                    <div className="font-bold text-purple-600 text-lg">{season.stats?.assists || 0}</div>
                  </div>
                </div>

                {/* Additional Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Points</div>
                    <div className="font-bold text-amber-600 text-lg">{season.stats?.points || 0}</div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Clean Sheets</div>
                    <div className="font-bold text-cyan-600 text-lg">{season.stats?.clean_sheets || 0}</div>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Avg Rating</div>
                    <div className="font-bold text-rose-600 text-lg">
                      {season.stats?.average_rating?.toFixed(1) || '0.0'}
                    </div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Win Rate</div>
                    <div className="font-bold text-teal-600 text-lg">
                      {season.stats?.win_rate?.toFixed(0) || 0}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
