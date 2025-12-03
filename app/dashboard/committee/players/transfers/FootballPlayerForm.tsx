'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
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
  season_id: string;
}

type OperationType = 'swap' | 'release';

export default function FootballPlayerForm() {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [operationType, setOperationType] = useState<OperationType>('swap');
  const [selectedPlayerAId, setSelectedPlayerAId] = useState('');
  const [selectedPlayerBId, setSelectedPlayerBId] = useState('');
  const [searchPlayerA, setSearchPlayerA] = useState('');
  const [searchPlayerB, setSearchPlayerB] = useState('');
  const [searchRelease, setSearchRelease] = useState('');
  
  // Data state
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [swapLimits, setSwapLimits] = useState<Record<string, any>>({});
  
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
          `/api/players/database?limit=1000`
        );
        const result = await response.json();
        
        if (!result.success) {
          throw new Error('Failed to fetch players');
        }
        
        const loadedPlayers: Player[] = result.data.players
          .filter((p: any) => p.team_id) // Only players with teams
          .map((p: any) => ({
            id: p.id || p.player_id,
            player_id: p.player_id,
            player_name: p.name || 'Unknown Player',
            team_id: p.team_id,
            team_name: p.team_name || 'Unknown Team',
            auction_value: p.acquisition_value || 0, // Use acquisition_value for football players
            star_rating: p.overall_rating || 70, // Show overall_rating instead of stars
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

  // Get selected players
  const selectedPlayerA = useMemo(() => {
    return players.find(p => p.id === selectedPlayerAId);
  }, [players, selectedPlayerAId]);

  const selectedPlayerB = useMemo(() => {
    return players.find(p => p.id === selectedPlayerBId);
  }, [players, selectedPlayerBId]);

  // Get filtered players for Player A based on search
  const filteredPlayersA = useMemo(() => {
    if (!searchPlayerA) return players;
    const searchLower = searchPlayerA.toLowerCase();
    return players.filter(p => 
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower)
    );
  }, [players, searchPlayerA]);

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

  // Get filtered players for Release based on search
  const filteredPlayersRelease = useMemo(() => {
    if (!searchRelease) return players;
    const searchLower = searchRelease.toLowerCase();
    return players.filter(p => 
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower)
    );
  }, [players, searchRelease]);

  // Fetch swap limits for both teams
  useEffect(() => {
    const fetchSwapLimits = async () => {
      if (!userSeasonId) return;
      
      const teamsToFetch = new Set<string>();
      if (selectedPlayerA) teamsToFetch.add(selectedPlayerA.team_id);
      if (selectedPlayerB) teamsToFetch.add(selectedPlayerB.team_id);
      
      for (const teamId of teamsToFetch) {
        if (swapLimits[teamId]) continue; // Already fetched
        
        try {
          const response = await fetchWithTokenRefresh(
            `/api/players/football-swap-limits?team_id=${teamId}&season_id=${userSeasonId}`
          );
          
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Swap limits API not available');
            continue;
          }
          
          const result = await response.json();
          
          if (result.success) {
            setSwapLimits(prev => ({
              ...prev,
              [teamId]: result.data
            }));
          }
        } catch (error) {
          console.error('Error fetching swap limits:', error);
        }
      }
    };

    fetchSwapLimits();
  }, [selectedPlayerA, selectedPlayerB, userSeasonId, swapLimits]);

  // Handle swap submission
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlayerA || !selectedPlayerB || !user || !userSeasonId) return;

    const teamAName = selectedPlayerA.team_name || 'Team A';
    const teamBName = selectedPlayerB.team_name || 'Team B';
    
    const teamALimit = swapLimits[selectedPlayerA.team_id];
    const teamBLimit = swapLimits[selectedPlayerB.team_id];
    
    const teamAFee = teamALimit?.next_swap_fee || 0;
    const teamBFee = teamBLimit?.next_swap_fee || 0;
    
    let confirmMessage = `Swap ${selectedPlayerA.player_name} (${teamAName}) ↔ ${selectedPlayerB.player_name} (${teamBName})?\n\n`;
    
    if (teamAFee > 0 || teamBFee > 0) {
      confirmMessage += `Fees:\n`;
      if (teamAFee > 0) confirmMessage += `• ${teamAName}: ${teamAFee} (Swap #${teamALimit.next_swap_number})\n`;
      if (teamBFee > 0) confirmMessage += `• ${teamBName}: ${teamBFee} (Swap #${teamBLimit.next_swap_number})\n`;
    } else {
      confirmMessage += `This swap is FREE for both teams!\n`;
    }
    
    confirmMessage += `\nOnly team assignments will change. No value or stat changes.`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/simple-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_a_id: selectedPlayerA.player_id,
          player_b_id: selectedPlayerB.player_id,
          season_id: userSeasonId,
          swapped_by: user.uid,
          swapped_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to swap players');
      }

      setSuccess(`✅ ${selectedPlayerA.player_name} and ${selectedPlayerB.player_name} swapped successfully!`);
      
      // Reset form
      setSelectedPlayerAId('');
      setSelectedPlayerBId('');
      
      // Reload page after delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to swap players');
      console.error('Swap error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle release submission
  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlayerA || !user || !userSeasonId) return;

    const confirmMessage = `Release ${selectedPlayerA.player_name} from ${selectedPlayerA.team_name}?\n\nThe player will become a free agent.`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: selectedPlayerA.player_id,
          player_type: 'football',
          season_id: userSeasonId,
          released_by: user.uid,
          released_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to release player');
      }

      setSuccess(`✅ ${selectedPlayerA.player_name} released successfully!`);
      
      // Reset form
      setSelectedPlayerAId('');
      
      // Reload page after delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to release player');
      console.error('Release error:', err);
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

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-2">⚽ Football Player Operations</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• <strong>Swap:</strong> Exchange team assignments between two players</li>
          <li>• <strong>Swap Fees:</strong> First 3 swaps FREE, 4th swap = 100, 5th swap = 125</li>
          <li>• <strong>Release:</strong> Free a player from their team (always free)</li>
          <li>• <strong>No value changes, no stat upgrades</strong></li>
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

      {/* Operation Type Selector */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setOperationType('swap');
            setSelectedPlayerAId('');
            setSelectedPlayerBId('');
            setSearchPlayerA('');
            setSearchPlayerB('');
            setSearchRelease('');
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            operationType === 'swap'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          🔄 Swap Players
        </button>
        <button
          onClick={() => {
            setOperationType('release');
            setSelectedPlayerAId('');
            setSelectedPlayerBId('');
            setSearchPlayerA('');
            setSearchPlayerB('');
            setSearchRelease('');
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            operationType === 'release'
              ? 'bg-orange-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          🆓 Release Player
        </button>
      </div>

      {/* SWAP FORM */}
      {operationType === 'swap' && (
        <form onSubmit={handleSwap} className="space-y-6">
          {/* Player A Selection */}
          <SearchablePlayerSelect
            players={players}
            value={selectedPlayerAId}
            onChange={(id) => {
              setSelectedPlayerAId(id);
              setSelectedPlayerBId('');
            }}
            label="Player A"
            placeholder="Select Player A..."
            color="blue"
          />

          {/* Player A Info */}
          {selectedPlayerA && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Player A: {selectedPlayerA.player_name}</h3>
              <p className="text-sm text-gray-700 mb-2">Team: {selectedPlayerA.team_name}</p>
              
              {swapLimits[selectedPlayerA.team_id] && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-700">Swap Status:</span>
                    <span className="text-xs font-bold text-blue-600">
                      {swapLimits[selectedPlayerA.team_id].swaps_used} / 5 used
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Next Swap Fee:</span>
                    <span className={`text-sm font-bold ${
                      swapLimits[selectedPlayerA.team_id].next_swap_fee === 0 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {swapLimits[selectedPlayerA.team_id].next_swap_fee === 0 
                        ? 'FREE' 
                        : `${swapLimits[selectedPlayerA.team_id].next_swap_fee}`}
                    </span>
                  </div>
                  {swapLimits[selectedPlayerA.team_id].next_swap_fee > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Budget: {swapLimits[selectedPlayerA.team_id].football_budget.toFixed(2)}
                    </div>
                  )}
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
              label={`Player B (from different team)`}
              placeholder="Select Player B..."
              color="purple"
            />
          )}

          {/* Player B Info */}
          {selectedPlayerB && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-2">Player B: {selectedPlayerB.player_name}</h3>
              <p className="text-sm text-gray-700 mb-2">Team: {selectedPlayerB.team_name}</p>
              
              {swapLimits[selectedPlayerB.team_id] && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-700">Swap Status:</span>
                    <span className="text-xs font-bold text-purple-600">
                      {swapLimits[selectedPlayerB.team_id].swaps_used} / 5 used
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Next Swap Fee:</span>
                    <span className={`text-sm font-bold ${
                      swapLimits[selectedPlayerB.team_id].next_swap_fee === 0 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {swapLimits[selectedPlayerB.team_id].next_swap_fee === 0 
                        ? 'FREE' 
                        : `${swapLimits[selectedPlayerB.team_id].next_swap_fee}`}
                    </span>
                  </div>
                  {swapLimits[selectedPlayerB.team_id].next_swap_fee > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Budget: {swapLimits[selectedPlayerB.team_id].football_budget.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fee Preview */}
          {selectedPlayerA && selectedPlayerB && swapLimits[selectedPlayerA.team_id] && swapLimits[selectedPlayerB.team_id] && (
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200">
              <h3 className="font-bold text-green-900 mb-4 text-lg flex items-center gap-2">
                💰 Swap Fee Preview
              </h3>
              
              <div className="space-y-3">
                {/* Team A Fee */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">{selectedPlayerA.team_name}</span>
                    <span className="text-xs text-gray-500">Swap #{swapLimits[selectedPlayerA.team_id].next_swap_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fee:</span>
                    <span className={`text-lg font-bold ${
                      swapLimits[selectedPlayerA.team_id].next_swap_fee === 0 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {swapLimits[selectedPlayerA.team_id].next_swap_fee === 0 
                        ? 'FREE ✨' 
                        : `${swapLimits[selectedPlayerA.team_id].next_swap_fee}`}
                    </span>
                  </div>
                </div>

                {/* Team B Fee */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">{selectedPlayerB.team_name}</span>
                    <span className="text-xs text-gray-500">Swap #{swapLimits[selectedPlayerB.team_id].next_swap_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fee:</span>
                    <span className={`text-lg font-bold ${
                      swapLimits[selectedPlayerB.team_id].next_swap_fee === 0 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {swapLimits[selectedPlayerB.team_id].next_swap_fee === 0 
                        ? 'FREE ✨' 
                        : `${swapLimits[selectedPlayerB.team_id].next_swap_fee}`}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-4 border-2 border-blue-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-800">Total Fees:</span>
                    <span className="text-xl font-bold text-blue-600">
                      {swapLimits[selectedPlayerA.team_id].next_swap_fee + swapLimits[selectedPlayerB.team_id].next_swap_fee}
                    </span>
                  </div>
                </div>

                {/* Insufficient funds warning */}
                {(!swapLimits[selectedPlayerA.team_id].can_afford_next_swap || !swapLimits[selectedPlayerB.team_id].can_afford_next_swap) && (
                  <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                    <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
                      ⚠️ Insufficient Funds
                    </p>
                    {!swapLimits[selectedPlayerA.team_id].can_afford_next_swap && (
                      <p className="text-red-700 text-xs mt-1">
                        {selectedPlayerA.team_name} needs {swapLimits[selectedPlayerA.team_id].next_swap_fee} but only has {swapLimits[selectedPlayerA.team_id].football_budget.toFixed(2)}
                      </p>
                    )}
                    {!swapLimits[selectedPlayerB.team_id].can_afford_next_swap && (
                      <p className="text-red-700 text-xs mt-1">
                        {selectedPlayerB.team_name} needs {swapLimits[selectedPlayerB.team_id].next_swap_fee} but only has {swapLimits[selectedPlayerB.team_id].football_budget.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              !selectedPlayerAId || 
              !selectedPlayerBId || 
              submitting ||
              (swapLimits[selectedPlayerA?.team_id] && !swapLimits[selectedPlayerA.team_id].can_afford_next_swap) ||
              (swapLimits[selectedPlayerB?.team_id] && !swapLimits[selectedPlayerB.team_id].can_afford_next_swap)
            }
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {submitting ? 'Processing Swap...' : '🔄 Swap Players'}
          </button>
        </form>
      )}

      {/* RELEASE FORM */}
      {operationType === 'release' && (
        <form onSubmit={handleRelease} className="space-y-6">
          {/* Player Selection */}
          <SearchablePlayerSelect
            players={players}
            value={selectedPlayerAId}
            onChange={setSelectedPlayerAId}
            label="Select Player to Release"
            placeholder="Select player..."
            color="orange"
          />

          {/* Player Info */}
          {selectedPlayerA && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <h3 className="font-semibold text-orange-900 mb-2">{selectedPlayerA.player_name}</h3>
              <p className="text-sm text-gray-700">Current Team: {selectedPlayerA.team_name}</p>
              <p className="text-sm text-orange-700 mt-2">⚠️ This player will become a free agent</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedPlayerAId || submitting}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {submitting ? 'Processing Release...' : '🆓 Release Player'}
          </button>
        </form>
      )}
    </div>
  );
}
