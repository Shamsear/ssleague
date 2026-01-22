'use client';

import { useState, useEffect } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
    player_id: string;
    player_name: string;
    position: number;
    is_substitute: boolean;
}

interface BlindLineupSubmissionProps {
    fixtureId: string;
    teamId: string;
    seasonId: string;
    isHomeTeam: boolean;
    onSubmitSuccess?: () => void;
}

export default function BlindLineupSubmission({
    fixtureId,
    teamId,
    seasonId,
    isHomeTeam,
    onSubmitSuccess
}: BlindLineupSubmissionProps) {
    const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lineupStatus, setLineupStatus] = useState<any>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, [fixtureId, teamId]);

    const loadData = async () => {
        try {
            setIsLoading(true);

            // Fetch available players from player_seasons table
            const playersRes = await fetchWithTokenRefresh(
                `/api/player-seasons?team_id=${teamId}&season_id=${seasonId}`
            );
            const playersData = await playersRes.json();

            console.log('🎮 Blind Lineup - Players fetched:', playersData);

            if (playersData.players && Array.isArray(playersData.players)) {
                setAvailablePlayers(playersData.players);
            } else {
                console.error('❌ No players found or invalid response:', playersData);
                setAvailablePlayers([]);
            }

            // Fetch lineup status
            const statusRes = await fetchWithTokenRefresh(
                `/api/fixtures/${fixtureId}/submit-lineup?team_id=${teamId}`
            );
            const statusData = await statusRes.json();

            if (statusData.success) {
                setLineupStatus(statusData);

                // If lineup already submitted, populate it
                if (statusData.my_lineup) {
                    setSelectedPlayers(statusData.my_lineup);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPlayer = (playerId: string) => {
        const player = availablePlayers.find(p => p.player_id === playerId);
        if (!player) return;

        const newPlayer: Player = {
            player_id: player.player_id,
            player_name: player.player_name,
            position: selectedPlayers.length + 1,
            is_substitute: selectedPlayers.filter(p => !p.is_substitute).length >= 5
        };

        setSelectedPlayers([...selectedPlayers, newPlayer]);
    };

    const handleRemovePlayer = (position: number) => {
        const newPlayers = selectedPlayers
            .filter(p => p.position !== position)
            .map((p, index) => ({
                ...p,
                position: index + 1,
                is_substitute: index >= 5
            }));
        setSelectedPlayers(newPlayers);
    };

    const handleToggleSubstitute = (position: number) => {
        const playingCount = selectedPlayers.filter(p => !p.is_substitute).length;
        const player = selectedPlayers.find(p => p.position === position);

        if (!player) return;

        // Can't make a player substitute if we only have 5 playing
        if (!player.is_substitute && playingCount <= 5) {
            alert('Must have at least 5 playing players');
            return;
        }

        // Can't make a player playing if we already have 5
        if (player.is_substitute && playingCount >= 5) {
            alert('Maximum 5 playing players allowed');
            return;
        }

        const newPlayers = selectedPlayers.map(p =>
            p.position === position ? { ...p, is_substitute: !p.is_substitute } : p
        );
        setSelectedPlayers(newPlayers);
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const newPlayers = [...selectedPlayers];
        const [draggedPlayer] = newPlayers.splice(draggedIndex, 1);
        newPlayers.splice(dropIndex, 0, draggedPlayer);

        // Reorder positions
        const reorderedPlayers = newPlayers.map((p, index) => ({
            ...p,
            position: index + 1,
            is_substitute: index >= 5
        }));

        setSelectedPlayers(reorderedPlayers);
        setDraggedIndex(null);
    };

    const handleSubmit = async () => {
        // Validation
        const playingPlayers = selectedPlayers.filter(p => !p.is_substitute);

        if (playingPlayers.length !== 5) {
            alert('Must have exactly 5 playing players');
            return;
        }

        if (selectedPlayers.length < 5 || selectedPlayers.length > 7) {
            alert('Must have 5-7 total players');
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/submit-lineup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team_id: teamId,
                    players: selectedPlayers
                })
            });

            const data = await res.json();

            if (data.success) {
                alert(data.message);
                await loadData(); // Reload status
                onSubmitSuccess?.();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error submitting lineup:', error);
            alert('Failed to submit lineup');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const canEdit = !lineupStatus?.lineups_locked;
    const playingPlayers = selectedPlayers.filter(p => !p.is_substitute);
    const substitutePlayers = selectedPlayers.filter(p => p.is_substitute);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h3 className="text-lg font-bold text-purple-900 mb-2">
                    🔒 Blind Lineup Mode
                </h3>
                <p className="text-sm text-purple-700">
                    Submit your player order (1-5). Your opponent won't see this until the home fixture phase ends.
                    Matchups will be auto-created: Your Player 1 vs Their Player 1, etc.
                </p>
            </div>

            {/* Status Bar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Your lineup:</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${lineupStatus?.my_lineup
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {lineupStatus?.my_lineup ? '✅ Submitted' : '⏳ Not submitted'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Opponent:</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${lineupStatus?.opponent_submitted
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                                }`}>
                                {lineupStatus?.opponent_submitted ? '✅ Submitted' : '⏳ Waiting...'}
                            </span>
                        </div>
                    </div>

                    {lineupStatus?.lineups_locked && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            🔒 Locked
                        </span>
                    )}
                </div>
            </div>

            {canEdit ? (
                <>
                    {/* Player Selection */}
                    {selectedPlayers.length < 7 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Add Player
                            </label>
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleAddPlayer(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a player...</option>
                                {availablePlayers
                                    .filter(p => !selectedPlayers.find(sp => sp.player_id === p.player_id))
                                    .map(player => (
                                        <option key={player.player_id} value={player.player_id}>
                                            {player.player_name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}

                    {/* Selected Players List */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                            Your Lineup Order ({selectedPlayers.length}/7)
                        </h4>

                        {selectedPlayers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">
                                No players selected. Add players above.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {selectedPlayers.map((player, index) => (
                                    <div
                                        key={player.position}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-move transition-all ${player.is_substitute
                                            ? 'border-gray-200 bg-gray-50'
                                            : 'border-blue-200 bg-blue-50'
                                            } ${draggedIndex === index ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-lg font-bold text-gray-700 w-8">
                                                {player.position}.
                                            </span>
                                            <span className="font-medium text-gray-900">
                                                {player.player_name}
                                            </span>
                                            <span className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${player.is_substitute
                                                ? 'bg-gray-200 text-gray-700'
                                                : 'bg-blue-200 text-blue-700'
                                                }`}>
                                                {player.is_substitute ? 'Substitute' : 'Playing'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {selectedPlayers.length > 5 && (
                                                <button
                                                    onClick={() => handleToggleSubstitute(player.position)}
                                                    className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded transition"
                                                >
                                                    Toggle
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRemovePlayer(player.position)}
                                                className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 rounded transition"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || playingPlayers.length !== 5}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Lineup'}
                        </button>
                    </div>

                    {playingPlayers.length !== 5 && (
                        <p className="text-sm text-red-600 text-center">
                            You must have exactly 5 playing players to submit
                        </p>
                    )}
                </>
            ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                    <p className="text-gray-700 font-medium mb-2">
                        Lineups are locked. Home fixture phase has ended.
                    </p>
                    <p className="text-sm text-gray-600">
                        Matchups have been created based on your submitted lineup order.
                    </p>
                </div>
            )}
        </div>
    );
}
