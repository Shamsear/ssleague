/**
 * Fantasy Player Analysis Page
 * Detailed player statistics, form, and fixture difficulty
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface PlayerInfo {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  price: number;
  ownership: number;
  captain_count: number;
  total_points: number;
}

interface FormData {
  status: string;
  emoji: string;
  label: string;
  color: string;
  multiplier: number;
  last_5_avg: number;
  streak: number;
}

interface Performance {
  round_id: string;
  round_number: number;
  points: number;
  played_at: Date;
}

export default function PlayerAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const playerId = params.playerId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);

  useEffect(() => {
    loadPlayerData();
  }, [playerId]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get leagueId from localStorage or context
      const leagueId = localStorage.getItem('fantasy_league_id');
      
      if (!leagueId) {
        throw new Error('No league selected. Please select a league first.');
      }

      const response = await fetch(`/api/fantasy/players/${playerId}?leagueId=${leagueId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load player data');
      }

      const data = await response.json();
      setPlayer(data.player);
      setForm(data.form);
      setPerformances(data.performances);

    } catch (err) {
      console.error('Error loading player data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load player data');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `€${(price / 1000000).toFixed(1)}M`;
  };

  const getMaxPoints = () => {
    if (performances.length === 0) return 20;
    return Math.max(...performances.map(p => p.points), 20);
  };

  const getFormBgColor = (status: string) => {
    switch (status) {
      case 'fire': return 'from-red-500 to-orange-500';
      case 'hot': return 'from-orange-500 to-yellow-500';
      case 'steady': return 'from-gray-400 to-gray-500';
      case 'cold': return 'from-blue-400 to-blue-500';
      case 'frozen': return 'from-blue-600 to-blue-700';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !player || !form) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Player not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const maxPoints = getMaxPoints();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {player.player_name}
        </h1>
        <p className="text-gray-600">
          {player.position} • {player.team}
        </p>
      </div>

      {/* Player Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Price</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatPrice(player.price)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Points</div>
          <div className="text-2xl font-bold text-gray-900">
            {player.total_points}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Ownership</div>
          <div className="text-2xl font-bold text-gray-900">
            {player.ownership.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Captain Picks</div>
          <div className="text-2xl font-bold text-gray-900">
            {player.captain_count}
          </div>
        </div>
      </div>

      {/* Form Indicator */}
      <div className={`bg-gradient-to-r ${getFormBgColor(form.status)} rounded-lg p-6 mb-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl">{form.emoji}</span>
              <div>
                <h2 className="text-2xl font-bold">{form.label}</h2>
                <p className="text-sm opacity-90">Current Form Status</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{form.multiplier}x</div>
            <div className="text-sm opacity-90">Points Multiplier</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <div className="text-sm opacity-90">Last 5 Games Average</div>
            <div className="text-2xl font-bold">{form.last_5_avg} pts</div>
          </div>
          <div>
            <div className="text-sm opacity-90">Streak</div>
            <div className="text-2xl font-bold">
              {form.streak > 0 ? `+${form.streak}` : form.streak} games
            </div>
          </div>
        </div>
      </div>

      {/* Performance Graph */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📊 Performance History (Last 10 Games)
        </h2>
        
        {performances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No performance data available
          </div>
        ) : (
          <div className="space-y-2">
            {performances.map((perf, index) => {
              const barWidth = (perf.points / maxPoints) * 100;
              const isGoodPerformance = perf.points >= 10;
              const isExcellent = perf.points >= 15;
              
              return (
                <div key={perf.round_id} className="flex items-center gap-3">
                  <div className="w-16 text-sm text-gray-600 text-right">
                    R{perf.round_number}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isExcellent ? 'bg-green-500' :
                        isGoodPerformance ? 'bg-blue-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${Math.max(barWidth, 5)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className={`text-sm font-medium ${
                        barWidth > 30 ? 'text-white' : 'text-gray-900 ml-2'
                      }`}>
                        {perf.points} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-600">Excellent (15+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Good (10-14)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            <span className="text-gray-600">Below Average (&lt;10)</span>
          </div>
        </div>
      </div>

      {/* Fixture Difficulty (Placeholder) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📅 Upcoming Fixtures
        </h2>
        <div className="text-center py-8 text-gray-500">
          <p>Fixture difficulty data coming soon</p>
          <p className="text-sm mt-2">Check back after H2H fixtures are generated</p>
        </div>
      </div>

      {/* Ownership Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          👥 Ownership Statistics
        </h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Owned by teams</span>
              <span className="font-medium text-gray-900">{player.ownership.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${player.ownership}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Captain selections</span>
              <span className="font-medium text-gray-900">{player.captain_count} teams</span>
            </div>
            <div className="text-xs text-gray-500">
              {player.captain_count > 0 
                ? `Popular captain choice this week`
                : `Not commonly selected as captain`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About Player Analysis</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Form status affects points multiplier (0.85x - 1.15x)</li>
          <li>• Based on last 5 game performances</li>
          <li>• Excellent games: 15+ points</li>
          <li>• Poor games: &lt;5 points</li>
          <li>• Use this data to make informed transfer decisions</li>
        </ul>
      </div>
    </div>
  );
}
