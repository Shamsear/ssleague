'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
    id: string;
    player_id: string;
    player_name: string;
    team_id: string;
    team: string;
    auction_value: number;
    contract_start_season: string;
    contract_end_season: string;
    star_rating?: number;
    points?: number;
}

interface ReleasePreview {
    totalHalfSeasons: number;
    elapsedHalfSeasons: number;
    remainingHalfSeasons: number;
    refundPercentage: number;
    refundAmount: number;
    releaseSeasonId: string;
}

export default function ReleaseRealPlayerForm() {
    const { userSeasonId, user } = usePermissions();

    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [releaseTiming, setReleaseTiming] = useState<'start' | 'mid'>('start');
    const [refundPercentage, setRefundPercentage] = useState<number>(75); // Manual percentage
    const [preview, setPreview] = useState<ReleasePreview | null>(null);

    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch players with contracts
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!userSeasonId) return;

            try {
                setLoading(true);
                setError(null);

                // Fetch all contracted players for the current season
                const response = await fetchWithTokenRefresh(
                    `/api/players/contracted?seasonId=${userSeasonId}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch players');
                }

                // Filter players with valid contracts and teams
                const contractedPlayers = (data.players || []).filter(
                    (p: any) => p.team_id && p.auction_value && p.contract_start_season && p.contract_end_season
                ).map((p: any) => ({
                    id: p.id,
                    player_id: p.player_id,
                    player_name: p.player_name,
                    team_id: p.team_id,
                    team: p.team || 'Unknown Team',
                    auction_value: p.auction_value,
                    contract_start_season: p.contract_start_season,
                    contract_end_season: p.contract_end_season,
                    star_rating: p.star_rating,
                    points: p.points
                }));

                setPlayers(contractedPlayers);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch players');
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, [userSeasonId]);

    // Calculate preview when player, timing, or percentage changes
    useEffect(() => {
        if (!selectedPlayerId || !userSeasonId) {
            setPreview(null);
            return;
        }

        const player = players.find(p => p.player_id === selectedPlayerId);
        if (!player) {
            setPreview(null);
            return;
        }

        try {
            // Calculate release season (uppercase)
            const releaseSeasonNumber = userSeasonId.replace(/\D/g, '');
            const releaseSeasonId = releaseTiming === 'mid'
                ? `SSPSLS${releaseSeasonNumber}.5`
                : userSeasonId.toUpperCase();

            // Extract season numbers for display
            const startSeasonNum = parseFloat(
                player.contract_start_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2')
            );
            const endSeasonNum = parseFloat(
                player.contract_end_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2')
            );
            const releaseSeasonNum = parseFloat(
                releaseSeasonNumber + (releaseTiming === 'mid' ? '.5' : '.0')
            );

            // Calculate half-seasons for display only
            const totalHalfSeasons = (endSeasonNum - startSeasonNum) * 2;
            const elapsedHalfSeasons = (releaseSeasonNum - startSeasonNum) * 2;
            const remainingHalfSeasons = totalHalfSeasons - elapsedHalfSeasons;

            // Use manual refund percentage
            const refundAmount = Math.round(player.auction_value * (refundPercentage / 100));

            setPreview({
                totalHalfSeasons,
                elapsedHalfSeasons,
                remainingHalfSeasons,
                refundPercentage: refundPercentage / 100, // Convert to decimal for display
                refundAmount,
                releaseSeasonId
            });
        } catch (err) {
            console.error('Error calculating preview:', err);
            setPreview(null);
        }
    }, [selectedPlayerId, releaseTiming, refundPercentage, players, userSeasonId]);

    const handleRelease = async () => {
        if (!selectedPlayerId || !userSeasonId || !user) {
            setError('Missing required information');
            return;
        }

        const player = players.find(p => p.player_id === selectedPlayerId);
        if (!player) {
            setError('Player not found');
            return;
        }

        const confirmMsg = `Are you sure you want to release ${player.player_name}?\n\n` +
            `Release Point: ${preview?.releaseSeasonId}\n` +
            `Refund: $${preview?.refundAmount} (${(preview?.refundPercentage || 0) * 100}%)\n\n` +
            `This action cannot be undone.`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            setProcessing(true);
            setError(null);
            setSuccess(null);

            const response = await fetchWithTokenRefresh('/api/players/release-real-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: selectedPlayerId,
                    seasonId: userSeasonId,
                    releaseTiming,
                    refundPercentage, // Send manual percentage
                    releasedBy: user.uid,
                    releasedByName: (user as any).displayName || user.email || 'Unknown'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to release player');
            }

            setSuccess(data.message || 'Player released successfully!');

            // Reset form
            setSelectedPlayerId('');
            setReleaseTiming('start');
            setPreview(null);

            // Refresh players list
            const refreshResponse = await fetchWithTokenRefresh(
                `/api/players/contracted?seasonId=${userSeasonId}`
            );
            const refreshData = await refreshResponse.json();
            if (refreshResponse.ok) {
                const contractedPlayers = (refreshData.players || []).filter(
                    (p: any) => p.team_id && p.auction_value && p.contract_start_season && p.contract_end_season
                ).map((p: any) => ({
                    id: p.id,
                    player_id: p.player_id,
                    player_name: p.player_name,
                    team_id: p.team_id,
                    team: p.team || 'Unknown Team',
                    auction_value: p.auction_value,
                    contract_start_season: p.contract_start_season,
                    contract_end_season: p.contract_end_season,
                    star_rating: p.star_rating,
                    points: p.points
                }));
                setPlayers(contractedPlayers);
            }

        } catch (err: any) {
            setError(err.message || 'Failed to release player');
        } finally {
            setProcessing(false);
        }
    };

    const selectedPlayer = players.find(p => p.player_id === selectedPlayerId);

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                <h3 className="font-semibold text-amber-900 mb-2">🔓 Player Release System</h3>
                <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Release players at season start or mid-season (X.5)</li>
                    <li>• <strong>Manual refund percentage selection</strong> (0-100%)</li>
                    <li>• Refund added to team's dollar balance</li>
                    <li>• Player becomes a free agent immediately</li>
                </ul>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-semibold">{success}</p>
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Player Selection */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Player to Release
                    </label>
                    <select
                        value={selectedPlayerId}
                        onChange={(e) => setSelectedPlayerId(e.target.value)}
                        disabled={loading || processing}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                        <option value="">-- Select a player --</option>
                        {players.map((player) => (
                            <option key={player.player_id} value={player.player_id}>
                                {player.player_name} ({player.team}) - ${player.auction_value} - Contract: {player.contract_start_season} to {player.contract_end_season}
                            </option>
                        ))}
                    </select>
                    {loading && (
                        <p className="text-sm text-gray-500 mt-2">Loading players...</p>
                    )}
                    {!loading && players.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">No players with active contracts found</p>
                    )}
                </div>

                {/* Release Timing */}
                {selectedPlayerId && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Release Timing
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setReleaseTiming('start')}
                                disabled={processing}
                                className={`px-6 py-4 rounded-xl font-semibold transition-all ${releaseTiming === 'start'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="text-center">
                                    <div className="text-lg">🏁 Season Start</div>
                                    <div className="text-xs mt-1 opacity-80">
                                        {userSeasonId}
                                    </div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReleaseTiming('mid')}
                                disabled={processing}
                                className={`px-6 py-4 rounded-xl font-semibold transition-all ${releaseTiming === 'mid'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="text-center">
                                    <div className="text-lg">⏱️ Mid-Season</div>
                                    <div className="text-xs mt-1 opacity-80">
                                        {userSeasonId?.replace(/\D/g, '')}.5
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Refund Percentage */}
                {selectedPlayerId && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Refund Percentage
                        </label>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                            {[100, 75, 50, 25, 0].map((percent) => (
                                <button
                                    key={percent}
                                    type="button"
                                    onClick={() => setRefundPercentage(percent)}
                                    disabled={processing}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${refundPercentage === percent
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {percent}%
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Custom:</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={refundPercentage}
                                onChange={(e) => setRefundPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                disabled={processing}
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-600">%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Card */}
            {preview && selectedPlayer && (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Release Preview</h3>

                    {/* Player Info */}
                    <div className="bg-white rounded-xl p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Player Information</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-gray-600">Name</p>
                                <p className="font-semibold">{selectedPlayer.player_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Current Team</p>
                                <p className="font-semibold">{selectedPlayer.team}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Auction Value</p>
                                <p className="font-semibold text-green-600">${selectedPlayer.auction_value}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Star Rating</p>
                                <p className="font-semibold">{'⭐'.repeat(selectedPlayer.star_rating || 0)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contract Info */}
                    <div className="bg-white rounded-xl p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Contract Details</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-gray-600">Original Start</p>
                                <p className="font-semibold">{selectedPlayer.contract_start_season}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Original End</p>
                                <p className="font-semibold">{selectedPlayer.contract_end_season}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Release Point</p>
                                <p className="font-semibold text-amber-600">{preview.releaseSeasonId}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Total Duration</p>
                                <p className="font-semibold">{preview.totalHalfSeasons} half-seasons</p>
                            </div>
                        </div>
                    </div>

                    {/* Refund Calculation */}
                    <div className="bg-white rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">💰 Refund Calculation</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-gray-600">Elapsed Half-Seasons</span>
                                <span className="font-semibold">{preview.elapsedHalfSeasons}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-gray-600">Remaining Half-Seasons</span>
                                <span className="font-semibold text-blue-600">{preview.remainingHalfSeasons}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-gray-600">Refund Percentage</span>
                                <span className="font-semibold text-purple-600">
                                    {(preview.refundPercentage * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 bg-green-50 -mx-4 px-4 py-3 rounded-lg">
                                <span className="font-semibold text-gray-900">Team Refund Amount</span>
                                <span className="text-2xl font-bold text-green-600">
                                    ${preview.refundAmount}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleRelease}
                    disabled={!selectedPlayerId || !preview || processing}
                    className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold rounded-xl hover:from-red-600 hover:to-orange-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {processing ? 'Releasing Player...' : '🔓 Release Player'}
                </button>
            </div>
        </div>
    );
}
