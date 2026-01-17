'use client';

import { useState, useEffect } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
    id: string;
    player_id: string;
    player_name: string;
    position?: number;
    category?: string;
    isStarting?: boolean;
    isSubstitute?: boolean;
}

interface Lineup {
    players: Player[];
    locked: boolean;
}

interface MatchupCreatorProps {
    fixtureId: string;
    seasonId: string;
    homeTeamId: string;
    homeTeamName: string;
    awayTeamId: string;
    awayTeamName: string;
    userId: string;
    userName: string;
    onSuccess: () => void;
    onCancel: () => void;
    initialTeamToEdit?: 'home' | 'away'; // NEW: Auto-open lineup setter for this team
}

export default function CommitteeMatchupCreator({
    fixtureId,
    seasonId,
    homeTeamId,
    homeTeamName,
    awayTeamId,
    awayTeamName,
    userId,
    userName,
    onSuccess,
    onCancel,
    initialTeamToEdit
}: MatchupCreatorProps) {
    const [homeLineup, setHomeLineup] = useState<Lineup | null>(null);
    const [awayLineup, setAwayLineup] = useState<Lineup | null>(null);
    const [homeNeedsLineup, setHomeNeedsLineup] = useState(false);
    const [awayNeedsLineup, setAwayNeedsLineup] = useState(false);

    // Lineup setting state
    const [showLineupSetter, setShowLineupSetter] = useState<'home' | 'away' | null>(null);
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [isSettingLineup, setIsSettingLineup] = useState(false);

    // Matchup state
    const [selectedMatchups, setSelectedMatchups] = useState<Array<{
        position: number;
        home_player_id: string;
        home_player_name: string;
        away_player_id: string;
        away_player_name: string;
        match_duration: number;
    }>>([]);
    const [usedHomePlayers, setUsedHomePlayers] = useState<Set<string>>(new Set());
    const [usedAwayPlayers, setUsedAwayPlayers] = useState<Set<string>>(new Set());
    const [selectedHomePlayer, setSelectedHomePlayer] = useState<Player | null>(null);
    const [selectedAwayPlayer, setSelectedAwayPlayer] = useState<Player | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLineups();
    }, []);

    // NEW: Auto-open lineup setter if initialTeamToEdit is provided
    useEffect(() => {
        if (initialTeamToEdit && !isLoading) {
            handleSetLineup(initialTeamToEdit);
        }
    }, [initialTeamToEdit, isLoading]);

    const fetchLineups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [homeRes, awayRes] = await Promise.all([
                fetchWithTokenRefresh(`/api/lineups?fixture_id=${fixtureId}&team_id=${homeTeamId}`),
                fetchWithTokenRefresh(`/api/lineups?fixture_id=${fixtureId}&team_id=${awayTeamId}`)
            ]);

            const homeData = await homeRes.json();
            const awayData = await awayRes.json();

            console.log('Home lineup data:', homeData);
            console.log('Away lineup data:', awayData);

            // API returns { success: true, lineups: {...} } for single team
            // lineups can be null if not found, or an object with starting_xi and substitutes
            if (homeData.lineups && homeData.lineups.starting_xi) {
                // starting_xi and substitutes are arrays of player IDs (strings)
                // We need to fetch the full player details to get names
                const startingIds = homeData.lineups.starting_xi || [];
                const subIds = homeData.lineups.substitutes || [];
                const playerIds = [...startingIds, ...subIds];

                // Fetch player details from player_seasons
                const playerDetails = await fetchWithTokenRefresh(`/api/player-seasons?team_id=${homeTeamId}&season_id=${seasonId}`)
                    .then(res => res.json())
                    .then(data => data.players || []);

                // Filter to only include players in the lineup and mark their type
                const players = playerDetails
                    .filter((p: any) => playerIds.includes(p.player_id))
                    .map((p: any) => ({
                        ...p,
                        isStarting: startingIds.includes(p.player_id),
                        isSubstitute: subIds.includes(p.player_id)
                    }));

                console.log('Home players constructed:', players);
                setHomeLineup({ ...homeData.lineups, players });
                setHomeNeedsLineup(false);
            } else {
                setHomeLineup(null);
                setHomeNeedsLineup(true);
            }

            if (awayData.lineups && awayData.lineups.starting_xi) {
                // starting_xi and substitutes are arrays of player IDs (strings)
                const startingIds = awayData.lineups.starting_xi || [];
                const subIds = awayData.lineups.substitutes || [];
                const playerIds = [...startingIds, ...subIds];

                // Fetch player details from player_seasons
                const playerDetails = await fetchWithTokenRefresh(`/api/player-seasons?team_id=${awayTeamId}&season_id=${seasonId}`)
                    .then(res => res.json())
                    .then(data => data.players || []);

                // Filter to only include players in the lineup and mark their type
                const players = playerDetails
                    .filter((p: any) => playerIds.includes(p.player_id))
                    .map((p: any) => ({
                        ...p,
                        isStarting: startingIds.includes(p.player_id),
                        isSubstitute: subIds.includes(p.player_id)
                    }));

                console.log('Away players constructed:', players);
                setAwayLineup({ ...awayData.lineups, players });
                setAwayNeedsLineup(false);
            } else {
                setAwayLineup(null);
                setAwayNeedsLineup(true);
            }
        } catch (err) {
            console.error('Error fetching lineups:', err);
            setError('Failed to load team lineups');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTeamPlayers = async (teamId: string) => {
        try {
            console.log('🔍 Fetching players for team:', { teamId, seasonId });
            const response = await fetchWithTokenRefresh(`/api/player-seasons?team_id=${teamId}&season_id=${seasonId}`);
            const data = await response.json();
            console.log('📊 Player-seasons API response:', data);
            return data.players || [];
        } catch (err) {
            console.error('Error fetching team players:', err);
            return [];
        }
    };

    const handleSetLineup = async (team: 'home' | 'away') => {
        const teamId = team === 'home' ? homeTeamId : awayTeamId;
        const existingLineup = team === 'home' ? homeLineup : awayLineup;

        console.log('🎯 Setting lineup for team:', { team, teamId, seasonId });
        setShowLineupSetter(team);
        setIsSettingLineup(true);

        const players = await fetchTeamPlayers(teamId);
        console.log('👥 Fetched players:', players);
        setAvailablePlayers(players);

        // If editing existing lineup, pre-select the current players
        if (existingLineup && existingLineup.players && existingLineup.players.length > 0) {
            const currentPlayerIds = existingLineup.players.map(p => p.player_id);
            const preSelectedPlayers = players.filter((p: Player) => currentPlayerIds.includes(p.player_id));
            console.log('✏️ Editing existing lineup, pre-selecting:', preSelectedPlayers);
            setSelectedPlayers(preSelectedPlayers);
        } else {
            setSelectedPlayers([]);
        }

        setIsSettingLineup(false);
    };

    const togglePlayerSelection = (player: Player) => {
        setSelectedPlayers(prev => {
            const isSelected = prev.some(p => p.player_id === player.player_id);
            if (isSelected) {
                return prev.filter(p => p.player_id !== player.player_id);
            } else {
                if (prev.length >= 7) {
                    setError('Maximum 7 players allowed in lineup');
                    return prev;
                }
                return [...prev, player];
            }
        });
    };

    const submitLineup = async () => {
        if (selectedPlayers.length < 5) {
            setError('Minimum 5 players required');
            return;
        }

        if (selectedPlayers.length > 7) {
            setError('Maximum 7 players allowed');
            return;
        }

        const teamId = showLineupSetter === 'home' ? homeTeamId : awayTeamId;

        // Send only player_id, not the full id field
        const starting_xi = selectedPlayers.slice(0, 5).map(p => p.player_id);
        const substitutes = selectedPlayers.slice(5).map(p => p.player_id);

        setIsSettingLineup(true);
        setError(null);

        try {
            const response = await fetchWithTokenRefresh(`/api/lineups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fixture_id: fixtureId,
                    team_id: teamId,
                    starting_xi,
                    substitutes,
                    submitted_by: userId,
                    submitted_by_name: userName,
                    bypass_deadline: true // Committee admin can bypass deadline
                })
            });

            if (response.ok) {
                setShowLineupSetter(null);
                setSelectedPlayers([]);
                setAvailablePlayers([]);
                await fetchLineups(); // Reload lineups
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to set lineup');
            }
        } catch (err) {
            console.error('Error setting lineup:', err);
            setError('Failed to set lineup. Please try again.');
        } finally {
            setIsSettingLineup(false);
        }
    };

    const addMatchup = (homePlayer: Player, awayPlayer: Player) => {
        const position = selectedMatchups.length + 1;

        setSelectedMatchups(prev => [...prev, {
            position,
            home_player_id: homePlayer.player_id,
            home_player_name: homePlayer.player_name,
            away_player_id: awayPlayer.player_id,
            away_player_name: awayPlayer.player_name,
            match_duration: 6
        }]);

        setUsedHomePlayers(prev => new Set([...prev, homePlayer.player_id]));
        setUsedAwayPlayers(prev => new Set([...prev, awayPlayer.player_id]));

        // Clear selections after creating matchup
        setSelectedHomePlayer(null);
        setSelectedAwayPlayer(null);
    };

    const handlePlayerClick = (player: Player, team: 'home' | 'away') => {
        if (team === 'home') {
            // If clicking the same home player, deselect
            if (selectedHomePlayer?.player_id === player.player_id) {
                setSelectedHomePlayer(null);
                return;
            }

            setSelectedHomePlayer(player);

            // If away player is already selected, create matchup
            if (selectedAwayPlayer) {
                addMatchup(player, selectedAwayPlayer);
            }
        } else {
            // If clicking the same away player, deselect
            if (selectedAwayPlayer?.player_id === player.player_id) {
                setSelectedAwayPlayer(null);
                return;
            }

            setSelectedAwayPlayer(player);

            // If home player is already selected, create matchup
            if (selectedHomePlayer) {
                addMatchup(selectedHomePlayer, player);
            }
        }
    };

    const removeMatchup = (position: number) => {
        const matchup = selectedMatchups.find(m => m.position === position);
        if (!matchup) return;

        setSelectedMatchups(prev => prev
            .filter(m => m.position !== position)
            .map((m, idx) => ({ ...m, position: idx + 1 }))
        );

        setUsedHomePlayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(matchup.home_player_id);
            return newSet;
        });

        setUsedAwayPlayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(matchup.away_player_id);
            return newSet;
        });
    };

    const updateMatchupDuration = (position: number, duration: number) => {
        setSelectedMatchups(prev => prev.map(m =>
            m.position === position ? { ...m, match_duration: duration } : m
        ));
    };

    const handleSubmit = async () => {
        if (selectedMatchups.length === 0) {
            setError('Please create at least one matchup');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchups: selectedMatchups,
                    created_by: userId,
                    allow_overwrite: false
                })
            });

            if (response.ok) {
                onSuccess();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to create matchups');
            }
        } catch (err) {
            console.error('Error creating matchups:', err);
            setError('Failed to create matchups. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const autoGenerate = () => {
        if (!homeLineup || !awayLineup) return;

        const homePlayers = homeLineup.players.filter(p => !usedHomePlayers.has(p.player_id));
        const awayPlayers = awayLineup.players.filter(p => !usedAwayPlayers.has(p.player_id));

        const count = Math.min(homePlayers.length, awayPlayers.length);

        for (let i = 0; i < count; i++) {
            addMatchup(homePlayers[i], awayPlayers[i]);
        }
    };

    // If showing lineup setter
    if (showLineupSetter) {
        const teamName = showLineupSetter === 'home' ? homeTeamName : awayTeamName;

        return (
            <div className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Lineup for {teamName}</h2>
                    <p className="text-gray-600">Select 5-7 players (first 5 will be starting XI, rest are substitutes)</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-900">
                        Selected: {selectedPlayers.length} / 7 players
                        {selectedPlayers.length >= 5 && (
                            <span className="ml-2 text-green-600">✓ Ready to submit</span>
                        )}
                    </p>
                </div>

                {isSettingLineup ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                        {availablePlayers.map((player) => {
                            const isSelected = selectedPlayers.some(p => p.player_id === player.player_id);
                            const position = selectedPlayers.findIndex(p => p.player_id === player.player_id) + 1;

                            return (
                                <button
                                    key={player.player_id}
                                    onClick={() => togglePlayerSelection(player)}
                                    className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 bg-white hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{player.player_name}</p>
                                            <p className="text-xs text-gray-500">{player.player_id}</p>
                                            {player.category && (
                                                <span className="text-xs px-2 py-1 bg-gray-100 rounded mt-1 inline-block">
                                                    {player.category}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div className="flex flex-col items-center">
                                                <span className="text-2xl">✓</span>
                                                <span className="text-xs font-bold text-purple-600">
                                                    {position <= 5 ? `P${position}` : `SUB${position - 5}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                    <button
                        onClick={() => {
                            setShowLineupSetter(null);
                            setSelectedPlayers([]);
                            setAvailablePlayers([]);
                            setError(null);
                        }}
                        disabled={isSettingLineup}
                        className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submitLineup}
                        disabled={isSettingLineup || selectedPlayers.length < 5 || selectedPlayers.length > 7}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium disabled:opacity-50"
                    >
                        {isSettingLineup ? 'Setting Lineup...' : `Set Lineup (${selectedPlayers.length} players)`}
                    </button>
                </div>
            </div>
        );
    }

    // Main matchup creator view
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading lineups...</p>
                </div>
            </div>
        );
    }

    // Show lineup setting options if needed
    if (homeNeedsLineup || awayNeedsLineup) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Lineups Required</h2>
                    <p className="text-gray-600">Both teams need to set their lineups before creating matchups</p>
                </div>

                <div className="space-y-4 mb-6">
                    {homeNeedsLineup && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-orange-900">{homeTeamName}</p>
                                    <p className="text-sm text-orange-700">Lineup not set</p>
                                </div>
                                <button
                                    onClick={() => handleSetLineup('home')}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                                >
                                    Set Lineup
                                </button>
                            </div>
                        </div>
                    )}

                    {awayNeedsLineup && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-orange-900">{awayTeamName}</p>
                                    <p className="text-sm text-orange-700">Lineup not set</p>
                                </div>
                                <button
                                    onClick={() => handleSetLineup('away')}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                                >
                                    Set Lineup
                                </button>
                            </div>
                        </div>
                    )}

                    {!homeNeedsLineup && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600 text-xl">✓</span>
                                    <div>
                                        <p className="font-semibold text-green-900">{homeTeamName}</p>
                                        <p className="text-sm text-green-700">Lineup set ({homeLineup?.players.length} players)</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSetLineup('home')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                                >
                                    ✏️ Edit Lineup
                                </button>
                            </div>
                        </div>
                    )}

                    {!awayNeedsLineup && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600 text-xl">✓</span>
                                    <div>
                                        <p className="font-semibold text-green-900">{awayTeamName}</p>
                                        <p className="text-sm text-green-700">Lineup set ({awayLineup?.players.length} players)</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSetLineup('away')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                                >
                                    ✏️ Edit Lineup
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={onCancel}
                    className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                    Close
                </button>
            </div>
        );
    }

    // Rest of the matchup creator code (same as before)
    const availableHomePlayers = homeLineup?.players.filter(p => !usedHomePlayers.has(p.player_id)) || [];
    const availableAwayPlayers = awayLineup?.players.filter(p => !usedAwayPlayers.has(p.player_id)) || [];

    return (
        <div className="p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Matchups</h2>
                <p className="text-gray-600">Select players from each team to create individual matchups</p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {/* Auto-Generate Button */}
            {selectedMatchups.length === 0 && availableHomePlayers.length > 0 && availableAwayPlayers.length > 0 && (
                <div className="mb-6">
                    <button
                        onClick={autoGenerate}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium flex items-center justify-center gap-2"
                    >
                        ⚡ Auto-Generate Matchups
                        <span className="text-sm opacity-90">(Pairs players in order)</span>
                    </button>
                </div>
            )}

            {/* Created Matchups */}
            {selectedMatchups.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-3">Created Matchups ({selectedMatchups.length})</h3>
                    <div className="space-y-2">
                        {selectedMatchups.map((matchup) => (
                            <div key={matchup.position} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <span className="text-lg font-bold text-purple-600">#{matchup.position}</span>
                                        <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                                            <div className="text-right">
                                                <p className="font-semibold text-gray-900">{matchup.home_player_name}</p>
                                                <p className="text-xs text-gray-500">{homeTeamName}</p>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-2xl">⚔️</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-gray-900">{matchup.away_player_name}</p>
                                                <p className="text-xs text-gray-500">{awayTeamName}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            value={matchup.match_duration}
                                            onChange={(e) => updateMatchupDuration(matchup.position, parseInt(e.target.value))}
                                            className="px-2 py-1 border rounded text-sm"
                                        >
                                            <option value={6}>6 min</option>
                                            <option value={7}>7 min</option>
                                            <option value={8}>8 min</option>
                                        </select>
                                        <button
                                            onClick={() => removeMatchup(matchup.position)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove matchup"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Available Players */}
            {(availableHomePlayers.length > 0 || availableAwayPlayers.length > 0) && (
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-3">
                        Available Players
                        {(selectedHomePlayer || selectedAwayPlayer) && (
                            <span className="ml-2 text-sm font-normal text-purple-600">
                                {selectedHomePlayer && !selectedAwayPlayer && '← Select away player'}
                                {!selectedHomePlayer && selectedAwayPlayer && '← Select home player'}
                            </span>
                        )}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Home Team */}
                        <div>
                            <h4 className="font-semibold text-purple-700 mb-2">{homeTeamName}</h4>
                            <div className="space-y-2">
                                {availableHomePlayers.map((player) => {
                                    const isSelected = selectedHomePlayer?.player_id === player.player_id;
                                    const isSubstitute = player.isSubstitute;
                                    const isDisabled = isSubstitute;

                                    return (
                                        <button
                                            key={player.player_id}
                                            onClick={() => !isDisabled && handlePlayerClick(player, 'home')}
                                            disabled={isDisabled}
                                            className={`w-full text-left border-2 rounded-lg p-3 transition-all ${isDisabled
                                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-purple-100 border-purple-500 shadow-md'
                                                    : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{player.player_name}</p>
                                                        {player.isStarting && (
                                                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                                                                XI
                                                            </span>
                                                        )}
                                                        {player.isSubstitute && (
                                                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-semibold">
                                                                SUB
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{player.player_id}</p>
                                                </div>
                                                {isSelected && !isDisabled && (
                                                    <span className="text-purple-600 text-xl">👈</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                {availableHomePlayers.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">All players assigned</p>
                                )}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div>
                            <h4 className="font-semibold text-blue-700 mb-2">{awayTeamName}</h4>
                            <div className="space-y-2">
                                {availableAwayPlayers.map((player) => {
                                    const isSelected = selectedAwayPlayer?.player_id === player.player_id;
                                    const isSubstitute = player.isSubstitute;
                                    const isDisabled = isSubstitute;

                                    return (
                                        <button
                                            key={player.player_id}
                                            onClick={() => !isDisabled && handlePlayerClick(player, 'away')}
                                            disabled={isDisabled}
                                            className={`w-full text-left border-2 rounded-lg p-3 transition-all ${isDisabled
                                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-blue-100 border-blue-500 shadow-md'
                                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{player.player_name}</p>
                                                        {player.isStarting && (
                                                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                                                                XI
                                                            </span>
                                                        )}
                                                        {player.isSubstitute && (
                                                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-semibold">
                                                                SUB
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{player.player_id}</p>
                                                </div>
                                                {isSelected && !isDisabled && (
                                                    <span className="text-blue-600 text-xl">👈</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                {availableAwayPlayers.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">All players assigned</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSaving || selectedMatchups.length === 0}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Creating...
                        </>
                    ) : (
                        <>
                            ⚔️ Create {selectedMatchups.length} Matchup{selectedMatchups.length !== 1 ? 's' : ''}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
