'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCachedTeams } from '@/hooks/useCachedData';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { calculateReleaseRefund } from '@/lib/player-transfers';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  auction_value: number;
  star_rating?: number;
  contract_start_season: string;
  contract_end_season: string;
  season_id: string;
  status?: string;
  type: 'real' | 'football';
}

type TabType = 'release' | 'transfer' | 'swap';

export default function PlayerTransfersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams();
  
  const [activeTab, setActiveTab] = useState<TabType>('release');
  const [playerType, setPlayerType] = useState<'real' | 'football'>('real');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Release form state
  const [selectedReleasePlayer, setSelectedReleasePlayer] = useState('');
  
  // Transfer form state
  const [selectedTransferPlayer, setSelectedTransferPlayer] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [newContractValue, setNewContractValue] = useState('');
  const [newContractDuration, setNewContractDuration] = useState<number>(1.5);
  
  // Swap form state
  const [selectedPlayerA, setSelectedPlayerA] = useState('');
  const [selectedPlayerB, setSelectedPlayerB] = useState('');
  const [swapFeeAmount, setSwapFeeAmount] = useState('0');
  const [swapFeeDirection, setSwapFeeDirection] = useState<'none' | 'a_to_b' | 'b_to_a'>('none');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  // Load players
  useEffect(() => {
    const loadPlayers = async () => {
      if (!userSeasonId) return;

      setLoadingPlayers(true);
      try {
        // Fetch from appropriate API based on player type
        const endpoint = playerType === 'real' 
          ? `/api/stats/players?seasonId=${userSeasonId}&limit=1000`
          : `/api/football-players?seasonId=${userSeasonId}&limit=1000`;
        
        const response = await fetchWithTokenRefresh(endpoint);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error('Failed to fetch players');
        }
        
        const loadedPlayers: Player[] = result.data
          .filter((p: any) => p.team_id && p.status !== 'free_agent') // Only show players with teams
          .map((p: any) => ({
            id: p.id || `${p.player_id}_${userSeasonId}`,
            player_id: p.player_id,
            player_name: p.player_name || p.name || 'Unknown',
            team_id: p.team_id,
            team_name: p.team || p.team_name,
            auction_value: p.auction_value || 0,
            star_rating: p.star_rating,
            contract_start_season: p.contract_start_season || userSeasonId,
            contract_end_season: p.contract_end_season || userSeasonId,
            season_id: userSeasonId,
            status: p.status || 'active',
            type: playerType
          }));

        // Add team names from cached data if needed
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

    if (isCommitteeAdmin && userSeasonId) {
      loadPlayers();
    }
  }, [isCommitteeAdmin, userSeasonId, cachedTeams, playerType]);

  const handleRelease = async () => {
    if (!selectedReleasePlayer || !user || !userSeasonId) return;

    const player = players.find(p => p.id === selectedReleasePlayer);
    if (!player) return;

    if (!confirm(`Release ${player.player_name} from ${player.team_name}?`)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.player_id,
          season_id: userSeasonId,
          player_type: playerType,
          released_by: user.uid,
          released_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to release player');
      }

      setSuccess(`${player.player_name} released successfully! Refund: $${result.refund_amount}`);
      setSelectedReleasePlayer('');
      
      // Reload players
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to release player');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTransferPlayer || !newTeamId || !newContractValue || !user || !userSeasonId) return;

    const player = players.find(p => p.id === selectedTransferPlayer);
    if (!player) return;

    const targetTeam = cachedTeams?.find(t => t.id === newTeamId);
    if (!targetTeam) return;

    if (!confirm(`Transfer ${player.player_name} to ${targetTeam.name} for $${newContractValue}?`)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.player_id,
          new_team_id: newTeamId,
          new_team_name: targetTeam.name,
          new_contract_value: parseInt(newContractValue),
          new_contract_duration: newContractDuration,
          season_id: userSeasonId,
          player_type: playerType,
          transferred_by: user.uid,
          transferred_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to transfer player');
      }

      setSuccess(`Transfer complete! ${player.team_name} refund: $${result.old_team_refund}, ${targetTeam.name} cost: $${result.new_team_cost}`);
      setSelectedTransferPlayer('');
      setNewTeamId('');
      setNewContractValue('');
      
      // Reload players
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer player');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedPlayerA || !selectedPlayerB || !user || !userSeasonId) return;

    const playerA = players.find(p => p.id === selectedPlayerA);
    const playerB = players.find(p => p.id === selectedPlayerB);
    if (!playerA || !playerB) return;

    const feeNum = swapFeeDirection === 'none' ? 0 
      : swapFeeDirection === 'a_to_b' ? parseInt(swapFeeAmount || '0')
      : -parseInt(swapFeeAmount || '0');

    const feeText = feeNum === 0 ? 'no fee'
      : feeNum > 0 ? `${playerA.team_name} pays $${Math.abs(feeNum)} to ${playerB.team_name}`
      : `${playerB.team_name} pays $${Math.abs(feeNum)} to ${playerA.team_name}`;

    if (!confirm(`Swap ${playerA.player_name} ↔ ${playerB.player_name} with ${feeText}?`)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/players/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_a_id: playerA.player_id,
          player_b_id: playerB.player_id,
          fee_amount: feeNum,
          season_id: userSeasonId,
          player_type: playerType,
          swapped_by: user.uid,
          swapped_by_name: user.username || user.email
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to swap players');
      }

      setSuccess(`Swap completed! ${result.message}`);
      setSelectedPlayerA('');
      setSelectedPlayerB('');
      setSwapFeeAmount('0');
      setSwapFeeDirection('none');
      
      // Reload players
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to swap players');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate preview data
  const releasePreview = selectedReleasePlayer && userSeasonId ? (() => {
    const player = players.find(p => p.id === selectedReleasePlayer);
    if (!player) return null;
    
    const refund = calculateReleaseRefund(
      player.auction_value,
      player.contract_start_season,
      player.contract_end_season,
      userSeasonId
    );
    
    return { player, refund };
  })() : null;

  const transferPreview = selectedTransferPlayer && newTeamId && newContractValue ? (() => {
    const player = players.find(p => p.id === selectedTransferPlayer);
    const targetTeam = cachedTeams?.find(t => t.id === newTeamId);
    if (!player || !targetTeam) return null;
    
    const refund = calculateReleaseRefund(
      player.auction_value,
      player.contract_start_season,
      player.contract_end_season,
      userSeasonId || ''
    );
    
    const currentSeasonNum = parseInt((userSeasonId || '').replace(/\D/g, ''));
    const seasonPrefix = (userSeasonId || '').replace(/\d+$/, '');
    const seasonsToAdd = Math.floor(newContractDuration + 0.5);
    const endSeason = `${seasonPrefix}${currentSeasonNum + seasonsToAdd - 1}`;
    
    return { player, targetTeam, refund, cost: parseInt(newContractValue), endSeason };
  })() : null;

  if (loading || loadingPlayers || teamsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Player Transfers</h1>
              <p className="text-gray-600">Release, transfer, or swap players between teams</p>
            </div>
            
            {/* Player Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPlayerType('real')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  playerType === 'real'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                👤 Real Players
              </button>
              <button
                onClick={() => setPlayerType('football')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  playerType === 'football'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ⚽ Football Players
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
            <p className="font-semibold">Success!</p>
            <p>{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('release')}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                  activeTab === 'release'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🔓 Release Player
              </button>
              <button
                onClick={() => setActiveTab('transfer')}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                  activeTab === 'transfer'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                ➡️ Transfer Player
              </button>
              <button
                onClick={() => setActiveTab('swap')}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                  activeTab === 'swap'
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🔄 Swap Players
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* RELEASE TAB */}
            {activeTab === 'release' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Player to Release
                  </label>
                  <select
                    value={selectedReleasePlayer}
                    onChange={(e) => setSelectedReleasePlayer(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose Player --</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.player_name} ({player.team_name}) - ${player.auction_value}
                      </option>
                    ))}
                  </select>
                </div>

                {releasePreview && (
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-4">💰 Financial Preview</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Player:</span>
                        <span className="font-semibold text-gray-900">{releasePreview.player.player_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Team:</span>
                        <span className="font-semibold text-gray-900">{releasePreview.player.team_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Original Value:</span>
                        <span className="font-semibold text-gray-900">${releasePreview.player.auction_value}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-200">
                        <span className="text-green-600 font-semibold">Team Refund (70%):</span>
                        <span className="font-bold text-green-600">${releasePreview.refund}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRelease}
                  disabled={!selectedReleasePlayer || submitting}
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {submitting ? 'Releasing...' : 'Release to Free Agency'}
                </button>
              </div>
            )}

            {/* TRANSFER TAB */}
            {activeTab === 'transfer' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Player to Transfer
                  </label>
                  <select
                    value={selectedTransferPlayer}
                    onChange={(e) => setSelectedTransferPlayer(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose Player --</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.player_name} ({player.team_name}) - ${player.auction_value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Team
                  </label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose Team --</option>
                    {cachedTeams?.filter(t => t.id !== players.find(p => p.id === selectedTransferPlayer)?.team_id).map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Contract Value ($)
                  </label>
                  <input
                    type="number"
                    value={newContractValue}
                    onChange={(e) => setNewContractValue(e.target.value)}
                    placeholder="Enter contract value"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Contract Duration
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[0.5, 1, 1.5, 2].map(duration => (
                      <button
                        key={duration}
                        onClick={() => setNewContractDuration(duration)}
                        className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                          newContractDuration === duration
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {duration} {duration === 1 ? 'Season' : 'Seasons'}
                      </button>
                    ))}
                  </div>
                </div>

                {transferPreview && (
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-4">💰 Financial Preview</h3>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Old Team ({transferPreview.player.team_name})</p>
                        <p className="text-lg font-bold text-green-600">+${transferPreview.refund} refund</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">New Team ({transferPreview.targetTeam.name})</p>
                        <p className="text-lg font-bold text-red-600">-${transferPreview.cost} cost</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Contract Details</p>
                        <p className="text-sm font-semibold text-gray-900">
                          Duration: {newContractDuration} seasons
                        </p>
                        <p className="text-sm text-gray-600">Ends: {transferPreview.endSeason}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleTransfer}
                  disabled={!selectedTransferPlayer || !newTeamId || !newContractValue || submitting}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {submitting ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            )}

            {/* SWAP TAB */}
            {activeTab === 'swap' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Player A
                  </label>
                  <select
                    value={selectedPlayerA}
                    onChange={(e) => setSelectedPlayerA(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose Player A --</option>
                    {players.filter(p => p.id !== selectedPlayerB).map(player => (
                      <option key={player.id} value={player.id}>
                        {player.player_name} ({player.team_name}) - ${player.auction_value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-center py-2">
                  <span className="text-3xl">⇅</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Player B
                  </label>
                  <select
                    value={selectedPlayerB}
                    onChange={(e) => setSelectedPlayerB(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose Player B --</option>
                    {players.filter(p => p.id !== selectedPlayerA && p.team_id !== players.find(pl => pl.id === selectedPlayerA)?.team_id).map(player => (
                      <option key={player.id} value={player.id}>
                        {player.player_name} ({player.team_name}) - ${player.auction_value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Adjustment Fee
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={swapFeeDirection === 'none'}
                        onChange={() => setSwapFeeDirection('none')}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">No fee (straight swap)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={swapFeeDirection === 'a_to_b'}
                        onChange={() => setSwapFeeDirection('a_to_b')}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">Team A pays Team B:</span>
                      <input
                        type="number"
                        value={swapFeeAmount}
                        onChange={(e) => setSwapFeeAmount(e.target.value)}
                        disabled={swapFeeDirection !== 'a_to_b'}
                        className="px-3 py-2 rounded-lg border border-gray-300 w-32 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={swapFeeDirection === 'b_to_a'}
                        onChange={() => setSwapFeeDirection('b_to_a')}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">Team B pays Team A:</span>
                      <input
                        type="number"
                        value={swapFeeAmount}
                        onChange={(e) => setSwapFeeAmount(e.target.value)}
                        disabled={swapFeeDirection !== 'b_to_a'}
                        className="px-3 py-2 rounded-lg border border-gray-300 w-32 disabled:opacity-50"
                      />
                    </label>
                  </div>
                </div>

                {selectedPlayerA && selectedPlayerB && (
                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                    <h3 className="font-semibold text-purple-900 mb-4">🔄 Swap Preview</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 font-semibold">
                          {players.find(p => p.id === selectedPlayerA)?.player_name}
                        </span>
                        <span className="text-purple-600">→</span>
                        <span className="text-gray-900 font-semibold">
                          {players.find(p => p.id === selectedPlayerB)?.team_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 font-semibold">
                          {players.find(p => p.id === selectedPlayerB)?.player_name}
                        </span>
                        <span className="text-purple-600">→</span>
                        <span className="text-gray-900 font-semibold">
                          {players.find(p => p.id === selectedPlayerA)?.team_name}
                        </span>
                      </div>
                      {swapFeeDirection !== 'none' && (
                        <div className="pt-3 border-t border-purple-200">
                          <p className="text-center font-semibold text-purple-900">
                            Fee: ${swapFeeAmount} {swapFeeDirection === 'a_to_b' ? '(A → B)' : '(B → A)'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSwap}
                  disabled={!selectedPlayerA || !selectedPlayerB || submitting}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {submitting ? 'Swapping...' : 'Execute Swap'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">ℹ️ Important Information</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Release:</strong> Team receives 70% refund of remaining contract value</li>
            <li>• <strong>Transfer:</strong> Choose contract duration (0.5, 1, 1.5, or 2 seasons)</li>
            <li>• <strong>Swap:</strong> Optional fee can balance unequal player values</li>
            <li>• All transactions automatically generate league news entries</li>
            <li>• Budget validation prevents overspending</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
