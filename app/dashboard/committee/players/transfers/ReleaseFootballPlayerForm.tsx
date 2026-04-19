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
  acquisition_value: number;
  star_rating: number; // For SearchablePlayerSelect compatibility
  position: string;
  contract_start_season: string;
  contract_end_season: string;
  season_id: string;
}

export default function ReleaseFootballPlayerForm() {
  const { user, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams(userSeasonId);

  // Form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [releaseTiming, setReleaseTiming] = useState<'start' | 'mid'>('start');
  const [refundPercentage, setRefundPercentage] = useState<number>(75);

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
          .filter((p: any) => p.team_id && p.acquisition_value) // Only players with teams and values
          .map((p: any) => {
            console.log('Release form player data:', { 
              name: p.name, 
              position: p.position, 
              acquisition_value: p.acquisition_value,
              contract_start_season: p.contract_start_season,
              contract_end_season: p.contract_end_season
            });
            return {
              id: p.id || p.player_id,
              player_id: p.player_id,
              player_name: p.name || 'Unknown Player',
              team_id: p.team_id,
              team_name: p.team_name || 'Unknown Team',
              acquisition_value: p.acquisition_value || 0,
              star_rating: p.overall_rating || 70, // For SearchablePlayerSelect compatibility
              position: p.position || p.position_group || 'N/A',
              contract_start_season: p.contract_start_season || 'N/A',
              contract_end_season: p.contract_end_season || 'N/A',
              season_id: userSeasonId
            };
          });

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

  // Get selected player
  const selectedPlayer = useMemo(() => {
    return players.find(p => p.id === selectedPlayerId);
  }, [players, selectedPlayerId]);

  // Calculate refund amount
  const refundAmount = useMemo(() => {
    if (!selectedPlayer) return 0;
    return Math.round(selectedPlayer.acquisition_value * (refundPercentage / 100));
  }, [selectedPlayer, refundPercentage]);

  // Calculate release season
  const releaseSeasonDisplay = useMemo(() => {
    if (!userSeasonId) return '';
    const seasonNumber = userSeasonId.replace(/\D/g, '');
    return releaseTiming === 'mid' ? `SSPSLS${seasonNumber}.5` : userSeasonId.toUpperCase();
  }, [userSeasonId, releaseTiming]);

  // Generate WhatsApp message
  const generateWhatsAppMessage = (
    playerName: string,
    teamName: string,
    acquisitionValue: number,
    refundPercentage: number,
    refundAmount: number,
    timing: 'start' | 'mid',
    releaseSeason: string,
    contractStart: string,
    contractEnd: string
  ) => {
    return `🔓 *Player Release Notification*

━━━━━━━━━━━━━━━━━━━━

*Player:* ${playerName}
*Team:* ${teamName}

*Release Details:*
• Timing: ${timing === 'start' ? 'Season Start' : 'Mid-Season'}
• Original Contract: ${contractStart} → ${contractEnd}
• New Contract End: ${releaseSeason}
• Original Value: ${acquisitionValue} eCoin

*Refund Calculation:*
• Refund %: ${refundPercentage}%
• Refund Amount: *${refundAmount} eCoin*

━━━━━━━━━━━━━━━━━━━━

✅ Player is now a free agent
💰 ${refundAmount} eCoin added to ${teamName}'s football budget`;
  };

  // Handle release submission
  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlayer || !user || !userSeasonId) return;

    const confirmMessage = `Release ${selectedPlayer.player_name} from ${selectedPlayer.team_name}?\n\n` +
      `Release Timing: ${releaseTiming === 'start' ? 'Season Start' : 'Mid-Season'}\n` +
      `Refund: ${refundPercentage}% of ${selectedPlayer.acquisition_value} eCoin = ${refundAmount} eCoin\n` +
      `Contract End: ${releaseSeasonDisplay}\n\n` +
      `The player will become a free agent and the refund will be added to the team's football budget.`;

    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/release-football-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.player_id,
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

      setSuccess(`✅ ${selectedPlayer.player_name} released successfully! Refund: ${refundAmount} eCoin`);

      // Generate WhatsApp message
      const whatsappMessage = generateWhatsAppMessage(
        selectedPlayer.player_name,
        selectedPlayer.team_name || 'Unknown Team',
        selectedPlayer.acquisition_value,
        refundPercentage,
        refundAmount,
        releaseTiming,
        releaseSeasonDisplay,
        selectedPlayer.contract_start_season,
        selectedPlayer.contract_end_season
      );

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(whatsappMessage);
        setSuccess(`✅ ${selectedPlayer.player_name} released successfully! Refund: ${refundAmount} eCoin\n\n📋 WhatsApp message copied to clipboard!`);
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
      }

      // Reset form
      setSelectedPlayerId('');
      setRefundPercentage(75);
      setReleaseTiming('start');

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
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
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={handleRelease} className="space-y-6">
        {/* Player Selection */}
        <SearchablePlayerSelect
          players={players}
          value={selectedPlayerId}
          onChange={setSelectedPlayerId}
          label="Select Football Player to Release"
          placeholder="Select player..."
          color="orange"
          playerType="football"
        />

        {/* Player Info */}
        {selectedPlayer && (
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h3 className="font-semibold text-orange-900 mb-2">{selectedPlayer.player_name}</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>Current Team: {selectedPlayer.team_name}</p>
              <p>Position: {selectedPlayer.position}</p>
              <p>Acquisition Value: {selectedPlayer.acquisition_value} eCoin</p>
              <p>Contract: {selectedPlayer.contract_start_season} → {selectedPlayer.contract_end_season}</p>
            </div>
          </div>
        )}

        {/* Release Timing */}
        {selectedPlayer && (
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
            <p className="text-xs text-gray-600 mt-2">
              Contract will end at: <span className="font-semibold">{releaseSeasonDisplay}</span>
            </p>
          </div>
        )}

        {/* Refund Percentage */}
        {selectedPlayer && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Refund Percentage: {refundPercentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={refundPercentage}
              onChange={(e) => setRefundPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Refund Preview */}
        {selectedPlayer && (
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200">
            <h3 className="font-bold text-green-900 mb-4 text-lg flex items-center gap-2">
              💰 Refund Preview
            </h3>

            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700">Acquisition Value</span>
                  <span className="text-lg font-bold text-gray-900">
                    {selectedPlayer.acquisition_value} eCoin
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700">Refund Percentage</span>
                  <span className="text-lg font-bold text-orange-600">
                    {refundPercentage}%
                  </span>
                </div>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-800">Refund Amount</span>
                  <span className="text-2xl font-bold text-green-600">
                    {refundAmount} eCoin
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-800">
                  💡 The refund will be added to {selectedPlayer.team_name}'s football budget
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedPlayerId || submitting}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {submitting ? 'Processing Release...' : '🔓 Release Player'}
        </button>
      </form>
    </div>
  );
}
