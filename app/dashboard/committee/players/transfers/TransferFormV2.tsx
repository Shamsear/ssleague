'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
import { calculateTransferDetails, TransferCalculation } from '@/lib/player-transfers-v2-utils';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import SearchablePlayerSelect from '@/components/ui/SearchablePlayerSelect';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  auction_value: number;
  star_rating: number;
  points: number;
  season_id: string;
  type: 'real' | 'football';
}

interface TransferFormV2Props {
  playerType: 'real' | 'football';
  onSuccess?: () => void;
}

export default function TransferFormV2({ playerType, onSuccess }: TransferFormV2Props) {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [searchPlayer, setSearchPlayer] = useState('');
  
  // Data state
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [transferLimits, setTransferLimits] = useState<Record<string, { used: number; remaining: number }>>({});
  const [teamBalances, setTeamBalances] = useState<Record<string, number>>({});
  
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Calculation preview
  const [calculation, setCalculation] = useState<TransferCalculation | null>(null);

  // Load players
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId) return;

      setLoadingPlayers(true);
      try {
        const endpoint = playerType === 'real' 
          ? `/api/stats/players?seasonId=${userSeasonId}&limit=1000`
          : `/api/football-players?seasonId=${userSeasonId}&limit=1000`;
        
        const response = await fetchWithTokenRefresh(endpoint);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error('Failed to fetch players');
        }
        
        const loadedPlayers: Player[] = result.data
          .filter((p: any) => p.team_id && p.status !== 'free_agent')
          .map((p: any) => ({
            id: p.id || `${p.player_id}_${userSeasonId}`,
            player_id: p.player_id,
            player_name: p.player_name || p.name || 'Unknown',
            team_id: p.team_id,
            team_name: p.team || p.team_name,
            auction_value: p.auction_value || 0,
            star_rating: p.star_rating || 5,
            points: p.points || 180,
            season_id: userSeasonId,
            type: playerType
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
  }, [userSeasonId, cachedTeams, playerType]);

  // Get filtered players based on search
  const filteredPlayers = useMemo(() => {
    if (!searchPlayer) return players;
    const searchLower = searchPlayer.toLowerCase();
    return players.filter(p => 
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower)
    );
  }, [players, searchPlayer]);

  // Get selected player
  const selectedPlayer = useMemo(() => {
    return players.find(p => p.id === selectedPlayerId);
  }, [players, selectedPlayerId]);

  // Get available teams (exclude current team)
  const availableTeams = useMemo(() => {
    if (!cachedTeams || !selectedPlayer) return [];
    return cachedTeams.filter(t => t.id !== selectedPlayer.team_id);
  }, [cachedTeams, selectedPlayer]);

  // Fetch transfer limit for selling team
  useEffect(() => {
    const fetchTransferLimit = async () => {
      if (!selectedPlayer || !userSeasonId) return;

      try {
        const response = await fetchWithTokenRefresh(
          `/api/players/transfer-limits?team_id=${selectedPlayer.team_id}&season_id=${userSeasonId}`
        );
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Transfer limits API not available or returned non-JSON response');
          return;
        }
        
        const result = await response.json();
        
        if (result.success) {
          setTransferLimits(prev => ({
            ...prev,
            [selectedPlayer.team_id]: {
              used: result.transfers_used || 0,
              remaining: result.transfers_remaining || 2
            }
          }));
        }
      } catch (error) {
        console.error('Error fetching transfer limit:', error);
        // Don't show error to user, just log it
      }
    };

    fetchTransferLimit();
  }, [selectedPlayer, userSeasonId]);

  // Fetch team balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!newTeamId || !userSeasonId) return;

      try {
        // Fetch buying team balance (pass player_type to get correct balance)
        const response = await fetchWithTokenRefresh(
          `/api/teams/${newTeamId}/balance?season_id=${userSeasonId}&player_type=${playerType}`
        );
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Team balance API not available or returned non-JSON response');
          return;
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setTeamBalances(prev => ({
            ...prev,
            [newTeamId]: result.data.balance
          }));
        }
      } catch (error) {
        console.error('Error fetching team balance:', error);
        // Don't show error to user, just log it
      }
    };

    fetchBalances();
  }, [newTeamId, userSeasonId]);

  // Calculate transfer details when player and team are selected
  useEffect(() => {
    if (!selectedPlayer || !newTeamId) {
      setCalculation(null);
      return;
    }

    try {
      const calc = calculateTransferDetails(
        selectedPlayer.auction_value,
        selectedPlayer.star_rating,
        selectedPlayer.points,
        selectedPlayer.type
      );
      setCalculation(calc);
    } catch (error) {
      console.error('Error calculating transfer:', error);
      setCalculation(null);
    }
  }, [selectedPlayer, newTeamId]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlayer || !newTeamId || !user || !userSeasonId) return;

    // Confirm transfer
    const buyingTeam = availableTeams.find(t => t.id === newTeamId);
    if (!buyingTeam) return;

    const confirmMessage = calculation 
      ? `Transfer ${selectedPlayer.player_name} to ${buyingTeam.name}?\n\n` +
        `New Value: $${calculation.newValue.toFixed(2)}\n` +
        `${buyingTeam.name} pays: $${calculation.buyingTeamPays.toFixed(2)}\n` +
        `${sellingTeamName} receives: $${calculation.sellingTeamReceives.toFixed(2)}\n` +
        `Committee fee: $${calculation.committeeFee.toFixed(2)}`
      : `Transfer ${selectedPlayer.player_name} to ${buyingTeam.name}?`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/transfer-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: selectedPlayer.player_id,
          player_type: playerType,
          new_team_id: newTeamId,
          season_id: userSeasonId,
          transferred_by: user.uid,
          transferred_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        // Handle specific error codes
        let errorMessage = result.error || 'Failed to transfer player';
        
        switch (result.errorCode) {
          case 'TRANSFER_LIMIT_EXCEEDED':
            errorMessage = `Transfer limit exceeded: ${result.error}`;
            break;
          case 'INSUFFICIENT_FUNDS':
            errorMessage = `Insufficient funds: ${result.error}`;
            break;
          case 'PLAYER_NOT_FOUND':
            errorMessage = 'Player not found or not available for transfer';
            break;
          case 'SAME_TEAM':
            errorMessage = 'Cannot transfer player to the same team';
            break;
          case 'SYSTEM_ERROR':
            errorMessage = `System error: ${result.error}. Please try again or contact support.`;
            break;
        }
        
        throw new Error(errorMessage);
      }

      // Build detailed success message
      const calc = result.calculation;
      let successMessage = `✅ ${selectedPlayer.player_name} successfully transferred to ${buyingTeam.name}!`;
      
      if (calc) {
        successMessage += `\n\nTransaction Details:`;
        successMessage += `\n• New Value: $${calc.newValue.toFixed(2)}`;
        successMessage += `\n• ${buyingTeam.name} paid: $${calc.buyingTeamPays.toFixed(2)}`;
        successMessage += `\n• ${sellingTeamName} received: $${calc.sellingTeamReceives.toFixed(2)}`;
        successMessage += `\n• Committee fee: $${calc.committeeFee.toFixed(2)}`;
        
        if (calc.newStarRating > selectedPlayer.star_rating) {
          successMessage += `\n• ⭐ Star rating upgraded: ${selectedPlayer.star_rating}⭐ → ${calc.newStarRating}⭐`;
        }
      }
      
      setSuccess(successMessage);
      
      // Reset form
      setSelectedPlayerId('');
      setNewTeamId('');
      setCalculation(null);
      setTransferLimits({});
      setTeamBalances({});
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Reload page after delay to show success message
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to transfer player');
      console.error('Transfer error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Get buying team balance
  const buyingTeamBalance = newTeamId ? teamBalances[newTeamId] : undefined;
  const hasInsufficientFunds = calculation && buyingTeamBalance !== undefined && buyingTeamBalance < calculation.buyingTeamPays;

  // Get selling team transfer limit
  const sellingTeamLimit = selectedPlayer ? transferLimits[selectedPlayer.team_id] : undefined;
  const sellingTeamName = selectedPlayer?.team_name || 'Team';
  const buyingTeamName = availableTeams.find(t => t.id === newTeamId)?.name || 'Team';

  if (loadingPlayers || teamsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <pre className="whitespace-pre-wrap text-sm mt-2 font-sans">{success}</pre>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Player Selection */}
        <SearchablePlayerSelect
          players={players}
          value={selectedPlayerId}
          onChange={(id) => {
            setSelectedPlayerId(id);
            setNewTeamId(''); // Reset team selection
          }}
          label="Select Player to Transfer"
          placeholder="Select player..."
          color="blue"
        />

        {/* Current Player Info (Read-only) */}
        {selectedPlayer && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Current Player Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Current Team:</span>
                <p className="font-semibold text-gray-900">{selectedPlayer.team_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Current Value:</span>
                <p className="font-semibold text-gray-900">${selectedPlayer.auction_value}</p>
              </div>
              <div>
                <span className="text-gray-600">Star Rating:</span>
                <p className="font-semibold text-gray-900">{selectedPlayer.star_rating}⭐</p>
              </div>
              <div>
                <span className="text-gray-600">Points:</span>
                <p className="font-semibold text-gray-900">{selectedPlayer.points}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Limit Display */}
        {selectedPlayer && sellingTeamLimit && (
          <div className={`p-4 rounded-xl border ${
            sellingTeamLimit.remaining > 0 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {sellingTeamName} Transfer Slots:
              </span>
              <span className={`text-lg font-bold ${
                sellingTeamLimit.remaining > 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {sellingTeamLimit.remaining} of 2 remaining
              </span>
            </div>
            {sellingTeamLimit.remaining === 0 && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ This team has used all transfer slots for this season
              </p>
            )}
          </div>
        )}

        {/* New Team Selection */}
        {selectedPlayer && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Team
            </label>
            <select
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              required
            >
              <option value="">-- Choose Team --</option>
              {availableTeams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.team_name || team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Real-time Calculation Preview */}
        {calculation && selectedPlayer && newTeamId && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-4 text-lg flex items-center gap-2">
              💰 Transfer Calculation Preview
            </h3>
            
            <div className="space-y-4">
              {/* Player Value Changes */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">Player Value</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Original Value:</span>
                    <span className="font-semibold text-gray-900">${calculation.originalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Star Multiplier:</span>
                    <span className="font-semibold text-blue-600">{(calculation.starMultiplier * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">New Value:</span>
                    <span className="font-bold text-green-600 text-lg">${calculation.newValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Committee Fee */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">Committee Fee (10%)</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fee Amount:</span>
                  <span className="font-bold text-purple-600 text-lg">${calculation.committeeFee.toFixed(2)}</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">Financial Summary</h4>
                <div className="space-y-3">
                  {/* Buying Team */}
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">{buyingTeamName} (Buying)</p>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Total Cost:</span>
                      <span className="font-bold text-red-600 text-lg">-${calculation.buyingTeamPays.toFixed(2)}</span>
                    </div>
                    {buyingTeamBalance !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Current Balance:</span>
                          <span className="font-semibold">${buyingTeamBalance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">After Transfer:</span>
                          <span className={`font-semibold ${
                            buyingTeamBalance - calculation.buyingTeamPays >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            ${(buyingTeamBalance - calculation.buyingTeamPays).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selling Team */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">{sellingTeamName} (Selling)</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">Receives:</span>
                      <span className="font-bold text-green-600 text-lg">+${calculation.sellingTeamReceives.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Star Rating Upgrade */}
              {calculation.newStarRating > selectedPlayer.star_rating && (
                <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2 text-sm flex items-center gap-2">
                    ⭐ Star Rating Upgrade!
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Star Rating:</span>
                      <span className="font-semibold text-gray-900">
                        {selectedPlayer.star_rating}⭐ → {calculation.newStarRating}⭐
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Points:</span>
                      <span className="font-semibold text-gray-900">
                        {selectedPlayer.points} → {selectedPlayer.points + calculation.pointsAdded}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-yellow-200">
                      <span className="text-xs text-gray-600">Points Added:</span>
                      <span className="text-sm font-bold text-green-600">
                        +{calculation.pointsAdded} points
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* New Salary */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">New Salary Per Match</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Salary:</span>
                  <span className="font-bold text-blue-600">${calculation.newSalary.toFixed(2)}</span>
                </div>
              </div>

              {/* Insufficient Funds Warning */}
              {hasInsufficientFunds && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Insufficient Funds
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    {buyingTeamName} needs ${calculation.buyingTeamPays.toFixed(2)} but only has ${buyingTeamBalance?.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedPlayerId || !newTeamId || submitting || hasInsufficientFunds || (sellingTeamLimit?.remaining === 0)}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {submitting ? 'Processing Transfer...' : 'Execute Transfer'}
        </button>
      </form>
    </div>
  );
}
