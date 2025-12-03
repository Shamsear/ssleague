'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
import { calculateSwapDetails, SwapCalculation, validateCashAmount } from '@/lib/player-transfers-v2-utils';
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

interface SwapFormV2Props {
  playerType: 'real' | 'football';
  onSuccess?: () => void;
}

export default function SwapFormV2({ playerType, onSuccess }: SwapFormV2Props) {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [selectedPlayerAId, setSelectedPlayerAId] = useState('');
  const [selectedPlayerBId, setSelectedPlayerBId] = useState('');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashDirection, setCashDirection] = useState<'A_to_B' | 'B_to_A' | 'none'>('none');
  const [searchPlayerA, setSearchPlayerA] = useState('');
  const [searchPlayerB, setSearchPlayerB] = useState('');
  
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
  const [calculation, setCalculation] = useState<SwapCalculation | null>(null);
  const [cashValidation, setCashValidation] = useState<{ valid: boolean; maxAllowed: number; message?: string } | null>(null);

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

  // Get filtered players for Player A based on search
  const filteredPlayersA = useMemo(() => {
    if (!searchPlayerA) return players;
    const searchLower = searchPlayerA.toLowerCase();
    return players.filter(p => 
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower)
    );
  }, [players, searchPlayerA]);

  // Get selected players
  const selectedPlayerA = useMemo(() => {
    return players.find(p => p.id === selectedPlayerAId);
  }, [players, selectedPlayerAId]);

  const selectedPlayerB = useMemo(() => {
    return players.find(p => p.id === selectedPlayerBId);
  }, [players, selectedPlayerBId]);

  // Get available players for Player B (exclude Player A's team)
  const availablePlayersForB = useMemo(() => {
    if (!selectedPlayerA) return players;
    return players.filter(p => p.team_id !== selectedPlayerA.team_id);
  }, [players, selectedPlayerA]);

  // Get filtered players for Player B based on search
  const filteredPlayersB = useMemo(() => {
    if (!searchPlayerB) return availablePlayersForB;
    const searchLower = searchPlayerB.toLowerCase();
    return availablePlayersForB.filter(p => 
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower)
    );
  }, [availablePlayersForB, searchPlayerB]);

  // Fetch transfer limits for both teams
  useEffect(() => {
    const fetchTransferLimits = async () => {
      if (!userSeasonId) return;
      
      const teamsToFetch = new Set<string>();
      if (selectedPlayerA) teamsToFetch.add(selectedPlayerA.team_id);
      if (selectedPlayerB) teamsToFetch.add(selectedPlayerB.team_id);
      
      for (const teamId of teamsToFetch) {
        if (transferLimits[teamId]) continue; // Already fetched
        
        try {
          const response = await fetchWithTokenRefresh(
            `/api/players/transfer-limits?team_id=${teamId}&season_id=${userSeasonId}`
          );
          
          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Transfer limits API not available or returned non-JSON response');
            continue;
          }
          
          const result = await response.json();
          
          if (result.success) {
            setTransferLimits(prev => ({
              ...prev,
              [teamId]: {
                used: result.transfers_used || 0,
                remaining: result.transfers_remaining || 2
              }
            }));
          }
        } catch (error) {
          console.error('Error fetching transfer limit:', error);
          // Don't show error to user, just log it
        }
      }
    };

    fetchTransferLimits();
  }, [selectedPlayerA, selectedPlayerB, userSeasonId, transferLimits]);

  // Fetch team balances for both teams
  useEffect(() => {
    const fetchBalances = async () => {
      if (!userSeasonId) return;
      
      const teamsToFetch = new Set<string>();
      if (selectedPlayerA) teamsToFetch.add(selectedPlayerA.team_id);
      if (selectedPlayerB) teamsToFetch.add(selectedPlayerB.team_id);
      
      for (const teamId of teamsToFetch) {
        if (teamBalances[teamId] !== undefined) continue; // Already fetched
        
        try {
          const response = await fetchWithTokenRefresh(
            `/api/teams/${teamId}/balance?season_id=${userSeasonId}&player_type=${playerType}`
          );
          
          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Team balance API not available or returned non-JSON response');
            continue;
          }
          
          const result = await response.json();
          
          if (result.success && result.data) {
            setTeamBalances(prev => ({
              ...prev,
              [teamId]: result.data.balance
            }));
          }
        } catch (error) {
          console.error('Error fetching team balance:', error);
          // Don't show error to user, just log it
        }
      }
    };

    fetchBalances();
  }, [selectedPlayerA, selectedPlayerB, userSeasonId, teamBalances]);

  // Validate cash amount when it changes
  useEffect(() => {
    if (cashAmount > 0 && selectedPlayerA && selectedPlayerB) {
      const maxPlayerValue = Math.max(selectedPlayerA.auction_value, selectedPlayerB.auction_value);
      const validation = validateCashAmount(cashAmount, maxPlayerValue);
      setCashValidation(validation);
    } else {
      setCashValidation(null);
    }
  }, [cashAmount, selectedPlayerA, selectedPlayerB]);

  // Calculate swap details when both players are selected
  useEffect(() => {
    if (!selectedPlayerA || !selectedPlayerB) {
      setCalculation(null);
      return;
    }

    // Validate players are from different teams
    if (selectedPlayerA.team_id === selectedPlayerB.team_id) {
      setError('Cannot swap players from the same team');
      setCalculation(null);
      return;
    }

    try {
      const calc = calculateSwapDetails(
        {
          value: selectedPlayerA.auction_value,
          starRating: selectedPlayerA.star_rating,
          points: selectedPlayerA.points,
          type: selectedPlayerA.type
        },
        {
          value: selectedPlayerB.auction_value,
          starRating: selectedPlayerB.star_rating,
          points: selectedPlayerB.points,
          type: selectedPlayerB.type
        },
        cashAmount,
        cashDirection
      );
      setCalculation(calc);
      setError(null);
    } catch (error: any) {
      console.error('Error calculating swap:', error);
      setError(error.message || 'Failed to calculate swap');
      setCalculation(null);
    }
  }, [selectedPlayerA, selectedPlayerB, cashAmount, cashDirection]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlayerA || !selectedPlayerB || !user || !userSeasonId || !calculation) return;

    // Validate same team
    if (selectedPlayerA.team_id === selectedPlayerB.team_id) {
      setError('Cannot swap players from the same team');
      return;
    }

    // Validate cash amount
    if (cashAmount > 0 && cashValidation && !cashValidation.valid) {
      setError(cashValidation.message || 'Invalid cash amount');
      return;
    }

    // Confirm swap
    const teamAName = selectedPlayerA.team_name || 'Team A';
    const teamBName = selectedPlayerB.team_name || 'Team B';
    
    let confirmMessage = `Swap ${selectedPlayerA.player_name} (${teamAName}) ↔ ${selectedPlayerB.player_name} (${teamBName})?\n\n`;
    
    if (calculation) {
      confirmMessage += `${teamAName} pays: $${calculation.teamAPays.toFixed(2)}\n`;
      confirmMessage += `${teamBName} pays: $${calculation.teamBPays.toFixed(2)}\n`;
      confirmMessage += `Total committee fees: $${calculation.totalCommitteeFees.toFixed(2)}`;
      
      if (cashAmount > 0) {
        const cashFrom = cashDirection === 'A_to_B' ? teamAName : teamBName;
        const cashTo = cashDirection === 'A_to_B' ? teamBName : teamAName;
        confirmMessage += `\nCash: $${cashAmount.toFixed(2)} from ${cashFrom} to ${cashTo}`;
      }
    }

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/swap-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_a_id: selectedPlayerA.player_id,
          player_a_type: playerType,
          player_b_id: selectedPlayerB.player_id,
          player_b_type: playerType,
          cash_amount: cashAmount,
          cash_direction: cashDirection,
          season_id: userSeasonId,
          swapped_by: user.uid,
          swapped_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        // Handle specific error codes
        let errorMessage = result.error || 'Failed to swap players';
        
        switch (result.errorCode) {
          case 'TRANSFER_LIMIT_EXCEEDED':
            errorMessage = `Transfer limit exceeded: ${result.error}`;
            break;
          case 'INSUFFICIENT_FUNDS':
            errorMessage = `Insufficient funds: ${result.error}`;
            break;
          case 'INVALID_CASH_AMOUNT':
            errorMessage = `Invalid cash amount: ${result.error}`;
            break;
          case 'SAME_TEAM_SWAP':
            errorMessage = 'Cannot swap players from the same team';
            break;
          case 'PLAYER_NOT_FOUND':
            errorMessage = 'One or both players not found';
            break;
          case 'SYSTEM_ERROR':
            errorMessage = `System error: ${result.error}. Please try again or contact support.`;
            break;
        }
        
        throw new Error(errorMessage);
      }

      // Build detailed success message
      const calc = result.calculation;
      let successMessage = `✅ Player swap completed successfully!\n\n`;
      successMessage += `${selectedPlayerA.player_name} → ${teamBName}\n`;
      successMessage += `${selectedPlayerB.player_name} → ${teamAName}\n`;
      
      if (calc) {
        successMessage += `\nFinancial Summary:`;
        successMessage += `\n• ${teamAName} paid: $${calc.teamAPays.toFixed(2)}`;
        successMessage += `\n• ${teamBName} paid: $${calc.teamBPays.toFixed(2)}`;
        successMessage += `\n• Committee fees: $${calc.totalCommitteeFees.toFixed(2)}`;
        
        if (cashAmount > 0) {
          successMessage += `\n• Cash transfer: $${cashAmount.toFixed(2)}`;
        }
        
        // Show star upgrades
        if (calc.playerA.newStarRating > selectedPlayerA.star_rating) {
          successMessage += `\n• ⭐ ${selectedPlayerA.player_name}: ${selectedPlayerA.star_rating}⭐ → ${calc.playerA.newStarRating}⭐`;
        }
        if (calc.playerB.newStarRating > selectedPlayerB.star_rating) {
          successMessage += `\n• ⭐ ${selectedPlayerB.player_name}: ${selectedPlayerB.star_rating}⭐ → ${calc.playerB.newStarRating}⭐`;
        }
      }
      
      setSuccess(successMessage);
      
      // Reset form
      setSelectedPlayerAId('');
      setSelectedPlayerBId('');
      setCashAmount(0);
      setCashDirection('none');
      setCalculation(null);
      setTransferLimits({});
      setTeamBalances({});
      setCashValidation(null);
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Reload page after delay to show success message
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to swap players');
      console.error('Swap error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Get team names
  const teamAName = selectedPlayerA?.team_name || 'Team A';
  const teamBName = selectedPlayerB?.team_name || 'Team B';

  // Get team balances
  const teamABalance = selectedPlayerA ? teamBalances[selectedPlayerA.team_id] : undefined;
  const teamBBalance = selectedPlayerB ? teamBalances[selectedPlayerB.team_id] : undefined;

  // Get transfer limits
  const teamALimit = selectedPlayerA ? transferLimits[selectedPlayerA.team_id] : undefined;
  const teamBLimit = selectedPlayerB ? transferLimits[selectedPlayerB.team_id] : undefined;

  // Check for insufficient funds
  const teamAHasInsufficientFunds = calculation && teamABalance !== undefined && teamABalance < calculation.teamAPays;
  const teamBHasInsufficientFunds = calculation && teamBBalance !== undefined && teamBBalance < calculation.teamBPays;
  const hasInsufficientFunds = teamAHasInsufficientFunds || teamBHasInsufficientFunds;

  // Check for transfer limit exceeded
  const teamALimitExceeded = teamALimit && teamALimit.remaining === 0;
  const teamBLimitExceeded = teamBLimit && teamBLimit.remaining === 0;
  const limitExceeded = teamALimitExceeded || teamBLimitExceeded;

  // Calculate max cash allowed
  const maxCashAllowed = useMemo(() => {
    if (!selectedPlayerA || !selectedPlayerB) return 0;
    const maxPlayerValue = Math.max(selectedPlayerA.auction_value, selectedPlayerB.auction_value);
    return Math.round(maxPlayerValue * 0.30 * 100) / 100;
  }, [selectedPlayerA, selectedPlayerB]);

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
        {/* Player A Selection */}
        <SearchablePlayerSelect
          players={players}
          value={selectedPlayerAId}
          onChange={(id) => {
            setSelectedPlayerAId(id);
            setSelectedPlayerBId(''); // Reset Player B selection
          }}
          label="Team A Player"
          placeholder="Select Player A..."
          color="blue"
        />

        {/* Team A Info */}
        {selectedPlayerA && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">Team A: {teamAName}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Player:</span>
                <p className="font-semibold text-gray-900">{selectedPlayerA.player_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Value:</span>
                <p className="font-semibold text-gray-900">${selectedPlayerA.auction_value}</p>
              </div>
              <div>
                <span className="text-gray-600">Star Rating:</span>
                <p className="font-semibold text-gray-900">{selectedPlayerA.star_rating}⭐</p>
              </div>
              <div>
                <span className="text-gray-600">Current Balance:</span>
                <p className="font-semibold text-gray-900">
                  {teamABalance !== undefined ? `$${teamABalance.toFixed(2)}` : 'Loading...'}
                </p>
              </div>
            </div>
            {teamALimit && (
              <div className={`mt-3 p-2 rounded-lg ${
                teamALimit.remaining > 0 ? 'bg-blue-100' : 'bg-red-100'
              }`}>
                <span className="text-sm font-semibold">
                  Transfer Slots: {teamALimit.remaining} of 2 remaining
                </span>
              </div>
            )}
          </div>
        )}

        {/* Player B Selection */}
        {selectedPlayerA && (
          <SearchablePlayerSelect
            players={availablePlayersForB}
            value={selectedPlayerBId}
            onChange={setSelectedPlayerBId}
            label="Team B Player (from different team)"
            placeholder="Select Player B..."
            color="purple"
          />
        )}

        {/* Team B Info */}
        {selectedPlayerB && (
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-3">Team B: {teamBName}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Player:</span>
                <p className="font-semibold text-gray-900">{selectedPlayerB.player_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Value:</span>
                <p className="font-semibold text-gray-900">${selectedPlayerB.auction_value}</p>
              </div>
              <div>
                <span className="text-gray-600">Star Rating:</span>
                <p className="font-semibold text-gray-900">{selectedPlayerB.star_rating}⭐</p>
              </div>
              <div>
                <span className="text-gray-600">Current Balance:</span>
                <p className="font-semibold text-gray-900">
                  {teamBBalance !== undefined ? `$${teamBBalance.toFixed(2)}` : 'Loading...'}
                </p>
              </div>
            </div>
            {teamBLimit && (
              <div className={`mt-3 p-2 rounded-lg ${
                teamBLimit.remaining > 0 ? 'bg-purple-100' : 'bg-red-100'
              }`}>
                <span className="text-sm font-semibold">
                  Transfer Slots: {teamBLimit.remaining} of 2 remaining
                </span>
              </div>
            )}
          </div>
        )}

        {/* Cash Addition (Optional) */}
        {selectedPlayerA && selectedPlayerB && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Optional Cash Addition</h3>
            <p className="text-sm text-gray-600 mb-3">
              Maximum allowed: ${maxCashAllowed.toFixed(2)} (30% of higher player value)
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cash Amount
                </label>
                <input
                  type="number"
                  min="0"
                  max={maxCashAllowed}
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {cashAmount > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cash Direction
                  </label>
                  <select
                    value={cashDirection}
                    onChange={(e) => setCashDirection(e.target.value as 'A_to_B' | 'B_to_A' | 'none')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="none">No cash transfer</option>
                    <option value="A_to_B">{teamAName} pays {teamBName}</option>
                    <option value="B_to_A">{teamBName} pays {teamAName}</option>
                  </select>
                </div>
              )}

              {cashValidation && !cashValidation.valid && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-800 text-sm font-semibold">⚠️ {cashValidation.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Real-time Calculation Preview */}
        {calculation && selectedPlayerA && selectedPlayerB && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <h3 className="font-bold text-purple-900 mb-4 text-lg flex items-center gap-2">
              💱 Swap Calculation Preview
            </h3>
            
            <div className="space-y-4">
              {/* Player A Details */}
              <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  👤 {selectedPlayerA.player_name} ({teamAName})
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Current Value:</span>
                    <span className="font-semibold text-gray-900">${calculation.playerA.originalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Star Multiplier:</span>
                    <span className="font-semibold text-blue-600">{(calculation.playerA.starMultiplier * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Value:</span>
                    <span className="font-bold text-green-600">${calculation.playerA.newValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Star Rating:</span>
                    <span className={`font-bold ${
                      calculation.playerA.newStarRating > selectedPlayerA.star_rating 
                        ? 'text-yellow-600' 
                        : 'text-gray-900'
                    }`}>
                      {selectedPlayerA.star_rating}⭐ → {calculation.playerA.newStarRating}⭐
                      {calculation.playerA.newStarRating > selectedPlayerA.star_rating && ' ⬆️'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Points:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPlayerA.points} → {selectedPlayerA.points + calculation.playerA.pointsAdded}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Salary:</span>
                    <span className="font-semibold text-gray-900">${calculation.playerA.newSalary.toFixed(2)}/match</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Committee Fee:</span>
                    <span className="font-bold text-purple-600">${calculation.playerA.committeeFee.toFixed(2)}</span>
                  </div>
                  {calculation.playerA.pointsAdded > 0 && (
                    <div className="bg-yellow-50 rounded p-2 mt-2">
                      <span className="text-xs text-yellow-800 font-semibold">+{calculation.playerA.pointsAdded} points added</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Player B Details */}
              <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  👤 {selectedPlayerB.player_name} ({teamBName})
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Current Value:</span>
                    <span className="font-semibold text-gray-900">${calculation.playerB.originalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Star Multiplier:</span>
                    <span className="font-semibold text-purple-600">{(calculation.playerB.starMultiplier * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Value:</span>
                    <span className="font-bold text-green-600">${calculation.playerB.newValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Star Rating:</span>
                    <span className={`font-bold ${
                      calculation.playerB.newStarRating > selectedPlayerB.star_rating 
                        ? 'text-yellow-600' 
                        : 'text-gray-900'
                    }`}>
                      {selectedPlayerB.star_rating}⭐ → {calculation.playerB.newStarRating}⭐
                      {calculation.playerB.newStarRating > selectedPlayerB.star_rating && ' ⬆️'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Points:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPlayerB.points} → {selectedPlayerB.points + calculation.playerB.pointsAdded}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Salary:</span>
                    <span className="font-semibold text-gray-900">${calculation.playerB.newSalary.toFixed(2)}/match</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Committee Fee:</span>
                    <span className="font-bold text-purple-600">${calculation.playerB.committeeFee.toFixed(2)}</span>
                  </div>
                  {calculation.playerB.pointsAdded > 0 && (
                    <div className="bg-yellow-50 rounded p-2 mt-2">
                      <span className="text-xs text-yellow-800 font-semibold">+{calculation.playerB.pointsAdded} points added</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cash Addition Display */}
              {cashAmount > 0 && cashDirection !== 'none' && (
                <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 text-sm flex items-center gap-2">
                    💵 Cash Addition
                  </h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">
                      {cashDirection === 'A_to_B' 
                        ? `${teamAName} → ${teamBName}` 
                        : `${teamBName} → ${teamAName}`}
                    </span>
                    <span className="font-bold text-green-600 text-lg">${cashAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">Financial Summary</h4>
                <div className="space-y-3">
                  {/* Team A Payment */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">{teamAName}</p>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Total Pays:</span>
                      <span className="font-bold text-red-600 text-lg">-${calculation.teamAPays.toFixed(2)}</span>
                    </div>
                    {teamABalance !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Current Balance:</span>
                          <span className="font-semibold">${teamABalance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">After Swap:</span>
                          <span className={`font-semibold ${
                            teamABalance - calculation.teamAPays >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            ${(teamABalance - calculation.teamAPays).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      (Fee: ${calculation.playerB.committeeFee.toFixed(2)}
                      {cashAmount > 0 && cashDirection === 'A_to_B' && ` + Cash: $${cashAmount.toFixed(2)}`})
                    </div>
                  </div>

                  {/* Team B Payment */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">{teamBName}</p>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Total Pays:</span>
                      <span className="font-bold text-red-600 text-lg">-${calculation.teamBPays.toFixed(2)}</span>
                    </div>
                    {teamBBalance !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Current Balance:</span>
                          <span className="font-semibold">${teamBBalance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">After Swap:</span>
                          <span className={`font-semibold ${
                            teamBBalance - calculation.teamBPays >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            ${(teamBBalance - calculation.teamBPays).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      (Fee: ${calculation.playerA.committeeFee.toFixed(2)}
                      {cashAmount > 0 && cashDirection === 'B_to_A' && ` + Cash: $${cashAmount.toFixed(2)}`})
                    </div>
                  </div>

                  {/* Committee Fees Total */}
                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 border border-purple-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-purple-900">Committee Collects:</span>
                      <span className="font-bold text-purple-700 text-lg">${calculation.totalCommitteeFees.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Star Rating Upgrades Summary */}
              {(calculation.playerA.newStarRating > selectedPlayerA.star_rating || 
                calculation.playerB.newStarRating > selectedPlayerB.star_rating) && (
                <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-3 text-sm flex items-center gap-2">
                    ⭐ Star Rating Upgrades!
                  </h4>
                  <div className="space-y-3">
                    {calculation.playerA.newStarRating > selectedPlayerA.star_rating && (
                      <div className="bg-white rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs text-gray-600 mb-2 font-semibold">{selectedPlayerA.player_name}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Star Rating:</span>
                            <span className="font-semibold text-gray-900">
                              {selectedPlayerA.star_rating}⭐ → {calculation.playerA.newStarRating}⭐
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Points:</span>
                            <span className="font-semibold text-gray-900">
                              {selectedPlayerA.points} → {selectedPlayerA.points + calculation.playerA.pointsAdded}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-yellow-100">
                            <span className="text-xs text-gray-500">Points Added:</span>
                            <span className="text-sm font-bold text-green-600">
                              +{calculation.playerA.pointsAdded}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {calculation.playerB.newStarRating > selectedPlayerB.star_rating && (
                      <div className="bg-white rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs text-gray-600 mb-2 font-semibold">{selectedPlayerB.player_name}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Star Rating:</span>
                            <span className="font-semibold text-gray-900">
                              {selectedPlayerB.star_rating}⭐ → {calculation.playerB.newStarRating}⭐
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Points:</span>
                            <span className="font-semibold text-gray-900">
                              {selectedPlayerB.points} → {selectedPlayerB.points + calculation.playerB.pointsAdded}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-yellow-100">
                            <span className="text-xs text-gray-500">Points Added:</span>
                            <span className="text-sm font-bold text-green-600">
                              +{calculation.playerB.pointsAdded}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {teamAHasInsufficientFunds && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Insufficient Funds - {teamAName}
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    {teamAName} needs ${calculation.teamAPays.toFixed(2)} but only has ${teamABalance?.toFixed(2)}
                  </p>
                </div>
              )}

              {teamBHasInsufficientFunds && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Insufficient Funds - {teamBName}
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    {teamBName} needs ${calculation.teamBPays.toFixed(2)} but only has ${teamBBalance?.toFixed(2)}
                  </p>
                </div>
              )}

              {cashValidation && !cashValidation.valid && (
                <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-4">
                  <p className="text-orange-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Cash Limit Exceeded
                  </p>
                  <p className="text-orange-700 text-xs mt-1">
                    {cashValidation.message}
                  </p>
                </div>
              )}

              {teamALimitExceeded && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Transfer Limit Exceeded - {teamAName}
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    {teamAName} has used all 2 transfer slots for this season
                  </p>
                </div>
              )}

              {teamBLimitExceeded && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                    ⚠️ Transfer Limit Exceeded - {teamBName}
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    {teamBName} has used all 2 transfer slots for this season
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedPlayerAId || !selectedPlayerBId || submitting || hasInsufficientFunds || limitExceeded || (cashValidation && !cashValidation.valid)}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {submitting ? 'Processing Swap...' : 'Execute Swap'}
        </button>
      </form>
    </div>
  );
}
