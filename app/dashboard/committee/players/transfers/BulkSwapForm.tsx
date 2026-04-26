'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import SearchablePlayerSelect from '@/components/ui/SearchablePlayerSelect';
import { X, Plus, ArrowLeftRight } from 'lucide-react';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  acquisition_value: number;
  star_rating: number;
  position: string;
  season_id: string;
}

interface SwapPair {
  id: string;
  player_a_id: string;
  player_b_id: string;
}

export default function BulkSwapForm() {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([
    { id: '1', player_a_id: '', player_b_id: '' }
  ]);

  // Data state
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load football players
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId) return;

      setLoadingPlayers(true);
      try {
        const response = await fetchWithTokenRefresh(
          `/api/players/database?limit=2000&assigned_only=true`
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error('Failed to fetch players');
        }

        const loadedPlayers: Player[] = result.data.players.map((p: any) => ({
          id: p.id || p.player_id,
          player_id: p.player_id,
          player_name: p.name || 'Unknown Player',
          team_id: p.team_id,
          team_name: p.team_name || 'Unknown Team',
          acquisition_value: p.acquisition_value || 0,
          star_rating: p.overall_rating || 70,
          position: p.position || p.position_group || 'N/A',
          season_id: userSeasonId
        }));

        // Add team names from cached data
        if (cachedTeams) {
          loadedPlayers.forEach(player => {
            if (!player.team_name) {
              const team = cachedTeams.find(t => t.id === player.team_id);
              player.team_name = team?.name || 'Unknown Team';
            }
          });
        }

        setPlayers(loadedPlayers);
      } catch (error) {
        console.error('Error loading players:', error);
        setError('Failed to load players');
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [userSeasonId, cachedTeams]);

  // Add new swap pair
  const addSwapPair = () => {
    const newId = (Math.max(...swapPairs.map(p => parseInt(p.id))) + 1).toString();
    setSwapPairs([...swapPairs, { id: newId, player_a_id: '', player_b_id: '' }]);
  };

  // Remove swap pair
  const removeSwapPair = (id: string) => {
    if (swapPairs.length === 1) return; // Keep at least one
    setSwapPairs(swapPairs.filter(p => p.id !== id));
  };

  // Update swap pair
  const updateSwapPair = (id: string, field: 'player_a_id' | 'player_b_id', value: string) => {
    setSwapPairs(swapPairs.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Get selected player IDs to exclude from other selections
  const selectedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    swapPairs.forEach(pair => {
      if (pair.player_a_id) ids.add(pair.player_a_id);
      if (pair.player_b_id) ids.add(pair.player_b_id);
    });
    return ids;
  }, [swapPairs]);

  // Get available players for a specific selection (excluding already selected)
  const getAvailablePlayers = (currentPairId: string, currentField: 'player_a_id' | 'player_b_id') => {
    const currentPair = swapPairs.find(p => p.id === currentPairId);
    const otherFieldValue = currentField === 'player_a_id' ? currentPair?.player_b_id : currentPair?.player_a_id;
    
    return players.filter(p => {
      // Exclude already selected players (except current selection)
      const currentValue = currentPair?.[currentField];
      if (selectedPlayerIds.has(p.id) && p.id !== currentValue) {
        return false;
      }
      
      // Exclude the other player in this pair
      if (otherFieldValue && p.id === otherFieldValue) {
        return false;
      }
      
      // If other player is selected, exclude same team
      if (otherFieldValue) {
        const otherPlayer = players.find(pl => pl.id === otherFieldValue);
        if (otherPlayer && p.team_id === otherPlayer.team_id) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Validate all swaps
  const validateSwaps = (): string | null => {
    for (let i = 0; i < swapPairs.length; i++) {
      const pair = swapPairs[i];
      
      if (!pair.player_a_id || !pair.player_b_id) {
        return `Swap ${i + 1}: Both players must be selected`;
      }

      const playerA = players.find(p => p.id === pair.player_a_id);
      const playerB = players.find(p => p.id === pair.player_b_id);

      if (!playerA || !playerB) {
        return `Swap ${i + 1}: Invalid player selection`;
      }

      if (playerA.team_id === playerB.team_id) {
        return `Swap ${i + 1}: Players must be from different teams`;
      }
    }

    // Check for duplicate players
    const allPlayerIds = swapPairs.flatMap(p => [p.player_a_id, p.player_b_id]);
    const uniqueIds = new Set(allPlayerIds);
    if (uniqueIds.size !== allPlayerIds.length) {
      return 'Each player can only be in one swap';
    }

    return null;
  };

  // Calculate total fees preview
  const calculateFeesPreview = () => {
    const teamSwapCounts = new Map<string, number>();
    const teamFees = new Map<string, number>();
    const swapBreakdown: Array<{
      index: number;
      playerA: Player;
      playerB: Player;
      teamAFee: number;
      teamBFee: number;
      teamASwapNum: number;
      teamBSwapNum: number;
    }> = [];

    const calculateFee = (swapNumber: number): number => {
      if (swapNumber <= 6) return 0;  // First 6 swaps are FREE
      if (swapNumber === 7) return 100;
      if (swapNumber === 8) return 125;
      return 150;
    };

    swapPairs.forEach((pair, index) => {
      const playerA = players.find(p => p.id === pair.player_a_id);
      const playerB = players.find(p => p.id === pair.player_b_id);

      if (playerA && playerB) {
        // Increment counts
        const teamACount = (teamSwapCounts.get(playerA.team_id) || 0) + 1;
        const teamBCount = (teamSwapCounts.get(playerB.team_id) || 0) + 1;
        
        teamSwapCounts.set(playerA.team_id, teamACount);
        teamSwapCounts.set(playerB.team_id, teamBCount);

        // Calculate fees
        const teamAFee = calculateFee(teamACount);
        const teamBFee = calculateFee(teamBCount);

        teamFees.set(playerA.team_id, (teamFees.get(playerA.team_id) || 0) + teamAFee);
        teamFees.set(playerB.team_id, (teamFees.get(playerB.team_id) || 0) + teamBFee);

        swapBreakdown.push({
          index: index + 1,
          playerA,
          playerB,
          teamAFee,
          teamBFee,
          teamASwapNum: teamACount,
          teamBSwapNum: teamBCount
        });
      }
    });

    return { teamFees, teamSwapCounts, swapBreakdown };
  };

  // Handle bulk swap submission
  const handleBulkSwap = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateSwaps();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user || !userSeasonId) return;

    const { teamFees, swapBreakdown } = calculateFeesPreview();
    const totalFee = Array.from(teamFees.values()).reduce((sum, fee) => sum + fee, 0);

    const swapSummary = swapPairs.map((pair, idx) => {
      const playerA = players.find(p => p.id === pair.player_a_id)!;
      const playerB = players.find(p => p.id === pair.player_b_id)!;
      return `${idx + 1}. ${playerA.player_name} (${playerA.team_name}, ${playerA.acquisition_value}) ↔ ${playerB.player_name} (${playerB.team_name}, ${playerB.acquisition_value})`;
    }).join('\n');

    const confirmMessage = `Perform ${swapPairs.length} swap(s)?\n\n${swapSummary}\n\nTotal fees: ${totalFee}\n\nAcquisition values will be swapped.`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/bulk-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swaps: swapPairs.map(pair => ({
            player_a_id: players.find(p => p.id === pair.player_a_id)!.player_id,
            player_b_id: players.find(p => p.id === pair.player_b_id)!.player_id
          })),
          season_id: userSeasonId,
          swapped_by: user.uid,
          swapped_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to perform bulk swap');
      }

      // Show detailed success message
      const successDetails = result.data.swap_details.map((swap: any) => 
        `✅ Swap ${swap.swap_number}: ${swap.player_a.name} (${swap.player_a.old_value}→${swap.player_a.new_value}) ↔ ${swap.player_b.name} (${swap.player_b.old_value}→${swap.player_b.new_value})`
      ).join('\n');

      setSuccess(`Successfully swapped ${swapPairs.length} player pair(s)!\n\n${successDetails}`);

      // Reset form
      setSwapPairs([{ id: '1', player_a_id: '', player_b_id: '' }]);

      // Reload page after delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to perform bulk swap');
      console.error('Bulk swap error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlayers || teamsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const { teamFees, swapBreakdown } = calculateFeesPreview();
  const totalFee = Array.from(teamFees.values()).reduce((sum, fee) => sum + fee, 0);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-lg">
        <h3 className="font-semibold text-purple-900 mb-2">🔄 Bulk Player Swap</h3>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Swap multiple players across multiple teams at once</li>
          <li>• First 6 swaps per team are FREE, then 100/125/150</li>
          <li>• Acquisition values are swapped between players</li>
          <li>• Each player can only be in one swap</li>
        </ul>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
          <p className="font-semibold">Success!</p>
          <p>{success}</p>
        </div>
      )}

      {/* Bulk Swap Form */}
      <form onSubmit={handleBulkSwap} className="space-y-6">
        {/* Swap Pairs */}
        <div className="space-y-4">
          {swapPairs.map((pair, index) => {
            const playerA = players.find(p => p.id === pair.player_a_id);
            const playerB = players.find(p => p.id === pair.player_b_id);

            return (
              <div key={pair.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Swap {index + 1}</h4>
                  {swapPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSwapPair(pair.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Player A */}
                  <div>
                    <SearchablePlayerSelect
                      players={getAvailablePlayers(pair.id, 'player_a_id')}
                      value={pair.player_a_id}
                      onChange={(id) => updateSwapPair(pair.id, 'player_a_id', id)}
                      label="Player A"
                      placeholder="Select Player A..."
                      color="blue"
                      playerType="football"
                    />
                    {playerA && (
                      <div className="mt-2 text-xs text-gray-600">
                        <div>Team: {playerA.team_name}</div>
                        <div>Value: {playerA.acquisition_value}</div>
                      </div>
                    )}
                  </div>

                  {/* Swap Icon */}
                  <div className="hidden md:flex items-center justify-center">
                    <ArrowLeftRight className="w-6 h-6 text-gray-400" />
                  </div>

                  {/* Player B */}
                  <div>
                    <SearchablePlayerSelect
                      players={getAvailablePlayers(pair.id, 'player_b_id')}
                      value={pair.player_b_id}
                      onChange={(id) => updateSwapPair(pair.id, 'player_b_id', id)}
                      label="Player B"
                      placeholder="Select Player B..."
                      color="purple"
                      playerType="football"
                    />
                    {playerB && (
                      <div className="mt-2 text-xs text-gray-600">
                        <div>Team: {playerB.team_name}</div>
                        <div>Value: {playerB.acquisition_value}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Swap Button */}
        <button
          type="button"
          onClick={addSwapPair}
          className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Another Swap
        </button>

        {/* Swap Details Preview */}
        {swapBreakdown.length > 0 && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
            <h3 className="font-bold text-purple-900 mb-4 text-lg">📋 Swap Details</h3>
            
            <div className="space-y-3 mb-4">
              {swapBreakdown.map((swap) => (
                <div key={swap.index} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900">Swap {swap.index}</span>
                    <span className="text-xs text-gray-500">
                      Total Fee: {swap.teamAFee + swap.teamBFee === 0 ? 'FREE ✨' : `${swap.teamAFee + swap.teamBFee}`}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {/* Player A */}
                    <div className="bg-blue-50 rounded p-3">
                      <div className="font-semibold text-blue-900 mb-1">{swap.playerA.player_name}</div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>From: {swap.playerA.team_name}</div>
                        <div>To: {swap.playerB.team_name}</div>
                        <div className="font-medium text-blue-700">
                          Value: {swap.playerA.acquisition_value} → {swap.playerB.acquisition_value}
                        </div>
                        <div className="text-xs">
                          Team Swap #{swap.teamASwapNum} 
                          {swap.teamAFee > 0 && <span className="text-orange-600"> (Fee: {swap.teamAFee})</span>}
                          {swap.teamAFee === 0 && <span className="text-green-600"> (FREE)</span>}
                        </div>
                      </div>
                    </div>

                    {/* Player B */}
                    <div className="bg-purple-50 rounded p-3">
                      <div className="font-semibold text-purple-900 mb-1">{swap.playerB.player_name}</div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>From: {swap.playerB.team_name}</div>
                        <div>To: {swap.playerA.team_name}</div>
                        <div className="font-medium text-purple-700">
                          Value: {swap.playerB.acquisition_value} → {swap.playerA.acquisition_value}
                        </div>
                        <div className="text-xs">
                          Team Swap #{swap.teamBSwapNum}
                          {swap.teamBFee > 0 && <span className="text-orange-600"> (Fee: {swap.teamBFee})</span>}
                          {swap.teamBFee === 0 && <span className="text-green-600"> (FREE)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Team Summary */}
            <div className="bg-white rounded-lg p-4 border-2 border-purple-300">
              <h4 className="font-semibold text-gray-900 mb-3">Team Summary</h4>
              <div className="space-y-2">
                {Array.from(teamFees.entries()).map(([teamId, fee]) => {
                  const team = cachedTeams?.find(t => t.id === teamId);
                  return (
                    <div key={teamId} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{team?.name || teamId}</span>
                      <span className={`text-lg font-bold ${fee === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {fee === 0 ? 'FREE ✨' : `${fee}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t-2 border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-800">Total Fees:</span>
                  <span className="text-2xl font-bold text-blue-600">{totalFee}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !swapPairs.every(p => p.player_a_id && p.player_b_id)}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {submitting ? 'Processing Bulk Swap...' : `🔄 Swap ${swapPairs.length} Player Pair(s)`}
        </button>
      </form>
    </div>
  );
}
