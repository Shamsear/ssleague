'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import Image from 'next/image';

interface RealPlayerDetails {
  id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  auction_value: number;
  star_rating: number;
  category?: string;
  contract_start_season?: string;
  contract_end_season?: string;
  salary_per_match?: number;
  season_id: string;
  // Season stats
  matches_played?: number;
  goals_scored?: number;
  assists?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  clean_sheets?: number;
  motm_awards?: number;
  points?: number;
  // Awards
  awards?: string[];
  potm_count?: number;
  pots_count?: number;
}

export default function RealPlayerDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [playerData, setPlayerData] = useState<RealPlayerDetails | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerId = params?.id as string;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchPlayerDetails = async () => {
      if (!userSeasonId || !playerId) {
        setError('Missing required parameters');
        setLoadingPlayer(false);
        return;
      }

      try {
        setLoadingPlayer(true);
        
        // Fetch from API endpoint
        const response = await fetch(`/api/real-player/${playerId}?season_id=${userSeasonId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setPlayerData(result.data);
        } else {
          setError(result.error || 'Player not found');
        }
      } catch (err) {
        console.error('Error fetching player details:', err);
        setError('Failed to load player details');
      } finally {
        setLoadingPlayer(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId && playerId) {
      fetchPlayerDetails();
    }
  }, [isCommitteeAdmin, userSeasonId, playerId]);

  if (loading || loadingPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (error || !playerData) {
    return (
      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-screen-2xl">
          <div className="glass rounded-3xl p-8 shadow-xl border border-white/30 text-center">
            <svg className="w-20 h-20 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Player not found'}</p>
            <Link
              href="/dashboard/committee/real-players"
              className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-[#0066FF] to-blue-600 hover:from-[#0052CC] hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Real Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-6 h-6 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-screen-xl">
        
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/committee/real-players"
            className="inline-flex items-center text-gray-600 hover:text-[#0066FF] mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Real Players
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-2">
            {playerData.player_name}
          </h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Real Player
          </span>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
            <div className="text-xs text-gray-500 mb-1">Star Rating</div>
            <div className="flex items-center gap-1 mt-2">
              {renderStars(playerData.star_rating)}
            </div>
          </div>

          <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
            <div className="text-xs text-gray-500 mb-1">Auction Value</div>
            <div className="text-2xl font-bold text-green-600">
              ${playerData.auction_value?.toLocaleString() ?? '0'}
            </div>
          </div>

          {playerData.salary_per_match !== undefined && (
            <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
              <div className="text-xs text-gray-500 mb-1">Salary/Match</div>
              <div className="text-2xl font-bold text-blue-600">
                ${playerData.salary_per_match?.toLocaleString() ?? '0'}
              </div>
            </div>
          )}

          {playerData.category && (
            <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
              <div className="text-xs text-gray-500 mb-1">Category</div>
              <div className="text-2xl font-bold text-purple-600">
                {playerData.category}
              </div>
            </div>
          )}
        </div>

        {/* Team Info */}
        {playerData.team_id && (
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Team Information</h2>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Current Team:</span>
              <Link
                href={`/dashboard/committee/teams/${playerData.team_id}`}
                className="font-semibold text-[#0066FF] hover:underline"
              >
                {playerData.team_name || playerData.team_id}
              </Link>
            </div>
          </div>
        )}

        {/* Contract Info */}
        {(playerData.contract_start_season || playerData.contract_end_season) && (
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Contract Information</h2>
            <div className="space-y-2">
              {playerData.contract_start_season && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Start Season:</span>
                  <span className="font-semibold text-gray-800">{playerData.contract_start_season}</span>
                </div>
              )}
              {playerData.contract_end_season && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">End Season:</span>
                  <span className="font-semibold text-gray-800">{playerData.contract_end_season}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Season Stats */}
        {(playerData.matches_played !== undefined || playerData.goals_scored !== undefined) && (
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Season Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {playerData.matches_played !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0066FF]">{playerData.matches_played}</div>
                  <div className="text-xs text-gray-500 mt-1">Matches</div>
                </div>
              )}
              {playerData.goals_scored !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{playerData.goals_scored}</div>
                  <div className="text-xs text-gray-500 mt-1">Goals</div>
                </div>
              )}
              {playerData.assists !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{playerData.assists}</div>
                  <div className="text-xs text-gray-500 mt-1">Assists</div>
                </div>
              )}
              {playerData.clean_sheets !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{playerData.clean_sheets}</div>
                  <div className="text-xs text-gray-500 mt-1">Clean Sheets</div>
                </div>
              )}
              {playerData.wins !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{playerData.wins}</div>
                  <div className="text-xs text-gray-500 mt-1">Wins</div>
                </div>
              )}
              {playerData.draws !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-500">{playerData.draws}</div>
                  <div className="text-xs text-gray-500 mt-1">Draws</div>
                </div>
              )}
              {playerData.losses !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{playerData.losses}</div>
                  <div className="text-xs text-gray-500 mt-1">Losses</div>
                </div>
              )}
              {playerData.motm_awards !== undefined && playerData.motm_awards > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{playerData.motm_awards}</div>
                  <div className="text-xs text-gray-500 mt-1">MOTM Awards</div>
                </div>
              )}
              {playerData.points !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{playerData.points}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Points</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Awards Section */}
        {((playerData.awards && playerData.awards.length > 0) || (playerData.potm_count && playerData.potm_count > 0) || (playerData.pots_count && playerData.pots_count > 0)) && (
          <div className="glass rounded-xl p-4 shadow-lg border border-white/30">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Awards & Honors
            </h2>
            
            {/* POTM and POTS counts */}
            {((playerData.potm_count && playerData.potm_count > 0) || (playerData.pots_count && playerData.pots_count > 0)) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {playerData.potm_count !== undefined && playerData.potm_count > 0 && (
                  <div className="glass rounded-lg p-3 bg-gradient-to-br from-amber-50 to-yellow-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-amber-600">{playerData.potm_count}</div>
                        <div className="text-xs text-gray-600 font-medium">Player of the Match</div>
                      </div>
                      <div className="text-3xl">🏆</div>
                    </div>
                  </div>
                )}
                {playerData.pots_count !== undefined && playerData.pots_count > 0 && (
                  <div className="glass rounded-lg p-3 bg-gradient-to-br from-purple-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{playerData.pots_count}</div>
                        <div className="text-xs text-gray-600 font-medium">Player of the Season</div>
                      </div>
                      <div className="text-3xl">👑</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Awards list */}
            {playerData.awards && playerData.awards.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Other Awards</h3>
                <div className="flex flex-wrap gap-2">
                  {playerData.awards.map((award, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 border border-amber-200"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {award}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
