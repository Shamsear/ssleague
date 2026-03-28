/**
 * Fantasy Power-Ups Page
 * View available power-ups, activate them, and see usage history
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type PowerUpType = 'triple_captain' | 'bench_boost' | 'free_hit' | 'wildcard';

interface PowerUpInventory {
  power_up_id: string;
  triple_captain_remaining: number;
  bench_boost_remaining: number;
  free_hit_remaining: number;
  wildcard_remaining: number;
}

interface PowerUpUsage {
  usage_id: string;
  round_id: string;
  power_up_type: PowerUpType;
  used_at: Date;
}

interface PowerUpInfo {
  type: PowerUpType;
  name: string;
  emoji: string;
  description: string;
  effect: string;
  maxUses: number;
  strategy: string;
  color: string;
}

const POWER_UPS: PowerUpInfo[] = [
  {
    type: 'triple_captain',
    name: 'Triple Captain',
    emoji: '👑',
    description: 'Your captain gets 3x points instead of 2x for one round',
    effect: '3x captain multiplier',
    maxUses: 1,
    strategy: 'Use when your captain has an easy fixture or is in great form',
    color: 'from-yellow-400 to-yellow-600'
  },
  {
    type: 'bench_boost',
    name: 'Bench Boost',
    emoji: '💪',
    description: 'All bench players earn points for one round',
    effect: 'Bench players score',
    maxUses: 2,
    strategy: 'Use when you have strong bench players with good fixtures',
    color: 'from-blue-400 to-blue-600'
  },
  {
    type: 'free_hit',
    name: 'Free Hit',
    emoji: '🎯',
    description: 'Make unlimited temporary changes for one round',
    effect: 'Temporary lineup',
    maxUses: 1,
    strategy: 'Use for a difficult round or when many players are unavailable',
    color: 'from-green-400 to-green-600'
  },
  {
    type: 'wildcard',
    name: 'Wildcard',
    emoji: '🃏',
    description: 'Make unlimited permanent transfers in one window',
    effect: 'Unlimited transfers',
    maxUses: 2,
    strategy: 'Use to rebuild your squad after injuries or poor form',
    color: 'from-purple-400 to-purple-600'
  }
];

export default function PowerUpsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<PowerUpType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [teamId, setTeamId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<PowerUpInventory | null>(null);
  const [history, setHistory] = useState<PowerUpUsage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentRound, setCurrentRound] = useState('round_1'); // TODO: Get from API

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Get team info
      const teamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
      if (!teamResponse.ok) {
        if (teamResponse.status === 404) {
          setError('You are not registered in a fantasy league');
          return;
        }
        throw new Error('Failed to load team');
      }

      const teamData = await teamResponse.json();
      const fetchedTeamId = teamData.team.id;
      const fetchedLeagueId = teamData.team.league_id;
      setTeamId(fetchedTeamId);
      setLeagueId(fetchedLeagueId);

      // Get power-up inventory
      const inventoryResponse = await fetch(
        `/api/fantasy/power-ups?team_id=${fetchedTeamId}&league_id=${fetchedLeagueId}`
      );

      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        setInventory(inventoryData.inventory);
      }

      // Get usage history
      const historyResponse = await fetch(
        `/api/fantasy/power-ups?team_id=${fetchedTeamId}&league_id=${fetchedLeagueId}&view=history`
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData.history || []);
      }

    } catch (err) {
      console.error('Error loading power-ups:', err);
      setError('Failed to load power-ups');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (powerUpType: PowerUpType) => {
    if (!teamId || !leagueId) return;

    try {
      setActivating(powerUpType);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/fantasy/power-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          league_id: leagueId,
          round_id: currentRound,
          power_up_type: powerUpType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate power-up');
      }

      setSuccess(`${getPowerUpInfo(powerUpType).name} activated successfully!`);
      
      // Reload data
      setTimeout(() => {
        loadData();
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error activating power-up:', err);
      setError(err instanceof Error ? err.message : 'Failed to activate power-up');
    } finally {
      setActivating(null);
    }
  };

  const getPowerUpInfo = (type: PowerUpType): PowerUpInfo => {
    return POWER_UPS.find(p => p.type === type)!;
  };

  const getRemaining = (type: PowerUpType): number => {
    if (!inventory) return 0;
    switch (type) {
      case 'triple_captain': return inventory.triple_captain_remaining;
      case 'bench_boost': return inventory.bench_boost_remaining;
      case 'free_hit': return inventory.free_hit_remaining;
      case 'wildcard': return inventory.wildcard_remaining;
    }
  };

  const getUsed = (type: PowerUpType): number => {
    const info = getPowerUpInfo(type);
    return info.maxUses - getRemaining(type);
  };

  const totalUsed = history.length;
  const totalAvailable = POWER_UPS.reduce((sum, p) => sum + getRemaining(p.type), 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !inventory) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ⚡ Power-Ups
        </h1>
        <p className="text-gray-600">
          Strategic chips to boost your team's performance
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-sm text-blue-100 mb-1">Available Power-Ups</div>
          <div className="text-3xl font-bold">{totalAvailable}</div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="text-sm text-purple-100 mb-1">Power-Ups Used</div>
          <div className="text-3xl font-bold">{totalUsed}</div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowHistory(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showHistory
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Available Power-Ups
        </button>
        <button
          onClick={() => setShowHistory(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showHistory
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Usage History
        </button>
      </div>

      {/* Power-Ups Grid */}
      {!showHistory ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {POWER_UPS.map((powerUp) => {
            const remaining = getRemaining(powerUp.type);
            const used = getUsed(powerUp.type);
            const isAvailable = remaining > 0;

            return (
              <div
                key={powerUp.type}
                className={`rounded-lg border-2 overflow-hidden ${
                  isAvailable
                    ? 'border-gray-200 hover:border-blue-300'
                    : 'border-gray-200 opacity-60'
                }`}
              >
                {/* Header with Gradient */}
                <div className={`bg-gradient-to-r ${powerUp.color} p-6 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{powerUp.emoji}</div>
                      <div>
                        <h3 className="text-xl font-bold">{powerUp.name}</h3>
                        <div className="text-sm opacity-90">{powerUp.effect}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 bg-white">
                  {/* Description */}
                  <p className="text-gray-700 mb-4">
                    {powerUp.description}
                  </p>

                  {/* Usage Stats */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Uses Remaining</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {remaining} / {powerUp.maxUses}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Times Used</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {used}
                      </div>
                    </div>
                  </div>

                  {/* Strategy Tip */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="text-xs font-semibold text-blue-900 mb-1">
                      💡 Strategy Tip
                    </div>
                    <div className="text-sm text-blue-800">
                      {powerUp.strategy}
                    </div>
                  </div>

                  {/* Activate Button */}
                  <button
                    onClick={() => handleActivate(powerUp.type)}
                    disabled={!isAvailable || activating !== null}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      isAvailable && activating === null
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {activating === powerUp.type ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Activating...
                      </span>
                    ) : isAvailable ? (
                      `⚡ Activate for Round ${currentRound.replace('round_', '')}`
                    ) : (
                      '🔒 No Uses Remaining'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Usage History */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Usage History</h2>
            <p className="text-sm text-gray-600 mt-1">
              All power-ups you've activated this season
            </p>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No power-ups used yet</p>
              <button
                onClick={() => setShowHistory(false)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View available power-ups
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {history.map((usage) => {
                const powerUp = getPowerUpInfo(usage.power_up_type);
                return (
                  <div
                    key={usage.usage_id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{powerUp.emoji}</div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {powerUp.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          Round {usage.round_id.replace('round_', '')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {new Date(usage.used_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Strategy Guide */}
      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📚 Power-Up Strategy Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When to Use</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Triple Captain: Easy fixtures or hot streak</li>
              <li>• Bench Boost: Strong bench with good fixtures</li>
              <li>• Free Hit: Difficult round or many injuries</li>
              <li>• Wildcard: Major squad overhaul needed</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Pro Tips</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Plan power-up usage at season start</li>
              <li>• Check fixture difficulty before activating</li>
              <li>• Don't waste on easy decisions</li>
              <li>• Save for crucial moments</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How Power-Ups Work</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Each power-up has limited uses per season</li>
          <li>• Activate before the round deadline</li>
          <li>• Effects apply automatically during points calculation</li>
          <li>• Cannot use the same power-up twice in one round</li>
          <li>• Use strategically for maximum impact</li>
        </ul>
      </div>
    </div>
  );
}
