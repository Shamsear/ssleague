'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  acquisition_value: number;
  position: string;
  contract_start_season: string;
  contract_end_season: string;
  season_id: string;
}

interface PlayerRelease {
  playerId: string;
  playerName: string;
  teamName: string;
  acquisitionValue: number;
  refundPercentage: number;
  refundAmount: number;
}

export default function BulkReleaseFootballPlayerForm() {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [playerRefunds, setPlayerRefunds] = useState<Map<string, number>>(new Map());
  const [releaseTiming, setReleaseTiming] = useState<'start' | 'mid'>('start');
  const [bulkRefundPercentage, setBulkRefundPercentage] = useState<number>(75);
  const [searchQuery, setSearchQuery] = useState('');

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

        const loadedPlayers: Player[] = result.data.players
          .filter((p: any) => p.team_id && p.acquisition_value)
          .map((p: any) => ({
            id: p.id || p.player_id,
            player_id: p.player_id,
            player_name: p.name || 'Unknown Player',
            team_id: p.team_id,
            team_name: p.team_name || 'Unknown Team',
            acquisition_value: p.acquisition_value || 0,
            position: p.position || p.position_group || 'N/A',
            contract_start_season: p.contract_start_season || 'N/A',
            contract_end_season: p.contract_end_season || 'N/A',
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

  // Filtered players based on search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players;
    const searchLower = searchQuery.toLowerCase();
    return players.filter(p =>
      p.player_name.toLowerCase().includes(searchLower) ||
      p.team_name?.toLowerCase().includes(searchLower) ||
      p.position.toLowerCase().includes(searchLower)
    );
  }, [players, searchQuery]);

  // Get refund percentage for a player
  const getPlayerRefund = (playerId: string) => {
    return playerRefunds.get(playerId) ?? bulkRefundPercentage;
  };

  // Set refund percentage for a player
  const setPlayerRefund = (playerId: string, percentage: number) => {
    const newRefunds = new Map(playerRefunds);
    newRefunds.set(playerId, percentage);
    setPlayerRefunds(newRefunds);
  };

  // Toggle player selection
  const togglePlayerSelection = (playerId: string) => {
    const newSelection = new Set(selectedPlayerIds);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayerIds(newSelection);
  };

  // Select/deselect all filtered players
  const toggleSelectAll = () => {
    const filteredIds = filteredPlayers.map(p => p.id);
    if (filteredIds.every(id => selectedPlayerIds.has(id))) {
      // Deselect all filtered
      const newSelection = new Set(selectedPlayerIds);
      filteredIds.forEach(id => newSelection.delete(id));
      setSelectedPlayerIds(newSelection);
    } else {
      // Select all filtered
      const newSelection = new Set(selectedPlayerIds);
      filteredIds.forEach(id => newSelection.add(id));
      setSelectedPlayerIds(newSelection);
    }
  };

  // Apply bulk refund percentage to all selected players
  const applyBulkRefund = () => {
    const newRefunds = new Map(playerRefunds);
    selectedPlayerIds.forEach(id => {
      newRefunds.set(id, bulkRefundPercentage);
    });
    setPlayerRefunds(newRefunds);
  };

  // Calculate total refund
  const totalRefund = useMemo(() => {
    return Array.from(selectedPlayerIds).reduce((sum, id) => {
      const player = players.find(p => p.id === id);
      if (!player) return sum;
      const refundPercentage = getPlayerRefund(id);
      return sum + Math.round(player.acquisition_value * (refundPercentage / 100));
    }, 0);
  }, [selectedPlayerIds, players, playerRefunds, bulkRefundPercentage]);

  // Generate WhatsApp message for bulk release
  const generateBulkWhatsAppMessage = (releasedPlayers: Player[], timing: 'start' | 'mid') => {
    const releaseSeasonNumber = userSeasonId?.replace(/\D/g, '') || '';
    const releaseSeason = timing === 'mid' ? `SSPSLS${releaseSeasonNumber}.5` : userSeasonId?.toUpperCase();

    // Group players by team
    const playersByTeam = releasedPlayers.reduce((acc, player) => {
      const teamName = player.team_name || 'Unknown Team';
      if (!acc[teamName]) {
        acc[teamName] = [];
      }
      acc[teamName].push(player);
      return acc;
    }, {} as Record<string, Player[]>);

    let message = `🗑️ *Bulk Player Release Notification*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Release Details:*\n`;
    message += `• Timing: ${timing === 'start' ? 'Season Start' : 'Mid-Season'}\n`;
    message += `• Contract End: ${releaseSeason}\n`;
    message += `• Total Players: ${releasedPlayers.length}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Add details for each team
    Object.entries(playersByTeam).forEach(([teamName, teamPlayers]) => {
      const teamTotalRefund = teamPlayers.reduce((sum, p) => {
        const refundPercentage = getPlayerRefund(p.id);
        return sum + Math.round(p.acquisition_value * (refundPercentage / 100));
      }, 0);

      message += `*${teamName}*\n`;
      message += `Players Released: ${teamPlayers.length}\n`;
      message += `Total Refund: *${teamTotalRefund} eCoin*\n\n`;

      teamPlayers.forEach(player => {
        const refundPercentage = getPlayerRefund(player.id);
        const refundAmount = Math.round(player.acquisition_value * (refundPercentage / 100));
        message += `  • ${player.player_name} (${player.position})\n`;
        message += `    Contract: ${player.contract_start_season} → ${player.contract_end_season}\n`;
        message += `    Value: ${player.acquisition_value} | Refund: ${refundPercentage}% = ${refundAmount} eCoin\n`;
      });
      message += `\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `✅ All players are now free agents\n`;
    message += `💰 Total refunds added to respective team budgets`;

    return message;
  };

  // Handle bulk release submission
  const handleBulkRelease = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPlayerIds.size === 0 || !user || !userSeasonId) return;

    const selectedPlayers = players.filter(p => selectedPlayerIds.has(p.id));
    
    const releaseList = selectedPlayers.map(p => {
      const refundPercentage = getPlayerRefund(p.id);
      const refundAmount = Math.round(p.acquisition_value * (refundPercentage / 100));
      return `• ${p.player_name} (${p.team_name}) - ${refundPercentage}% = ${refundAmount} eCoin`;
    }).join('\n');

    const confirmMessage = `Release ${selectedPlayerIds.size} player(s)?\n\n` +
      `Release Timing: ${releaseTiming === 'start' ? 'Season Start' : 'Mid-Season'}\n\n` +
      `${releaseList}\n\n` +
      `Total Refund: ${totalRefund} eCoin\n\n` +
      `Continue?`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      // Release players one by one
      for (const player of selectedPlayers) {
        try {
          const refundPercentage = getPlayerRefund(player.id);
          
          const response = await fetchWithTokenRefresh('/api/players/release-football-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: player.player_id,
              seasonId: userSeasonId,
              releaseTiming,
              refundPercentage,
              releasedBy: user.uid,
              releasedByName: user.username || user.email
            })
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Failed to release player');
          }

          successCount++;
        } catch (err: any) {
          failCount++;
          errors.push(`${player.player_name}: ${err.message}`);
          console.error(`Error releasing ${player.player_name}:`, err);
        }
      }

      // Show results
      if (successCount > 0 && failCount === 0) {
        setSuccess(`✅ Successfully released ${successCount} player(s)! Total refund: ${totalRefund} eCoin`);
        
        // Generate and copy WhatsApp message
        const whatsappMessage = generateBulkWhatsAppMessage(selectedPlayers, releaseTiming);
        try {
          await navigator.clipboard.writeText(whatsappMessage);
          setSuccess(`✅ Successfully released ${successCount} player(s)! Total refund: ${totalRefund} eCoin\n\n📋 WhatsApp message copied to clipboard!`);
        } catch (clipboardError) {
          console.error('Failed to copy to clipboard:', clipboardError);
        }
      } else if (successCount > 0 && failCount > 0) {
        setSuccess(`⚠️ Released ${successCount} player(s). ${failCount} failed.`);
        setError(errors.join('\n'));
      } else {
        setError(`❌ Failed to release all players:\n${errors.join('\n')}`);
      }

      // Reset form
      setSelectedPlayerIds(new Set());
      setPlayerRefunds(new Map());

      // Reload page after delay if any succeeded
      if (successCount > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to release players');
      console.error('Bulk release error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlayers || teamsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg whitespace-pre-line">
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

      <form onSubmit={handleBulkRelease} className="space-y-6">
        {/* Release Timing */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Release Timing
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setReleaseTiming('start')}
              className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                releaseTiming === 'start'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              🏁 Season Start
            </button>
            <button
              type="button"
              onClick={() => setReleaseTiming('mid')}
              className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                releaseTiming === 'mid'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ⏱️ Mid-Season
            </button>
          </div>
        </div>

        {/* Bulk Refund Percentage */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <label className="block text-sm font-semibold text-blue-900 mb-2">
            Default Refund Percentage: {bulkRefundPercentage}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={bulkRefundPercentage}
            onChange={(e) => setBulkRefundPercentage(parseInt(e.target.value))}
            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-blue-700 mt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          <button
            type="button"
            onClick={applyBulkRefund}
            disabled={selectedPlayerIds.size === 0}
            className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-semibold"
          >
            Apply {bulkRefundPercentage}% to All Selected Players
          </button>
        </div>

        {/* Search Bar */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Search Players
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by player name, team, or position..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Select All / Deselect All */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
          >
            {filteredPlayers.every(p => selectedPlayerIds.has(p.id))
              ? '☑️ Deselect All'
              : '☐ Select All'}
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {selectedPlayerIds.size} player(s) selected
          </span>
        </div>

        {/* Player List with Individual Refund Controls */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 max-h-[500px] overflow-y-auto">
          {filteredPlayers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No players found</p>
          ) : (
            <div className="space-y-3">
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayerIds.has(player.id);
                const refundPercentage = getPlayerRefund(player.id);
                const refundAmount = Math.round(player.acquisition_value * (refundPercentage / 100));

                return (
                  <div
                    key={player.id}
                    className={`rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <label className="flex items-start gap-3 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlayerSelection(player.id)}
                        className="w-5 h-5 text-red-600 rounded focus:ring-red-500 mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {player.player_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {player.team_name} • {player.position} • {player.acquisition_value} eCoin
                            </div>
                            <div className="text-xs text-gray-500">
                              Contract: {player.contract_start_season} → {player.contract_end_season}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="text-right">
                              <div className="text-sm font-semibold text-green-600">
                                {refundAmount} eCoin
                              </div>
                              <div className="text-xs text-gray-500">
                                {refundPercentage}% refund
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Individual Refund Slider */}
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-3">
                              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                                Refund: {refundPercentage}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={refundPercentage}
                                onChange={(e) => setPlayerRefund(player.id, parseInt(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Players Summary */}
        {selectedPlayerIds.size > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border-2 border-red-200">
            <h3 className="font-bold text-red-900 mb-4 text-lg">
              ⚠️ {selectedPlayerIds.size} Player(s) Will Be Released
            </h3>
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Total Refund Amount</span>
                <span className="text-2xl font-bold text-green-600">
                  {totalRefund} eCoin
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Across {selectedPlayerIds.size} player(s)
              </div>
            </div>
            <div className="text-sm text-red-800 space-y-1 max-h-32 overflow-y-auto">
              {players
                .filter(p => selectedPlayerIds.has(p.id))
                .map(p => {
                  const refundPercentage = getPlayerRefund(p.id);
                  const refundAmount = Math.round(p.acquisition_value * (refundPercentage / 100));
                  return (
                    <div key={p.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div>• {p.player_name} ({p.team_name})</div>
                        <div className="text-xs text-gray-600 ml-3">
                          Contract: {p.contract_start_season} → {p.contract_end_season}
                        </div>
                      </div>
                      <span className="font-semibold whitespace-nowrap ml-2">{refundPercentage}% = {refundAmount} eCoin</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={selectedPlayerIds.size === 0 || submitting}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {submitting
            ? 'Processing Releases...'
            : `🗑️ Release ${selectedPlayerIds.size} Player(s) - Total Refund: ${totalRefund} eCoin`}
        </button>
      </form>
    </div>
  );
}
