'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerStats {
    id: string;
    player_id: string;
    player_name: string;
    season_id: string;
    team: string;
    points: number;
    matches_played: number;
    goals_scored: number;
    goals_conceded: number;
    goal_difference: number;
    wins: number;
    draws: number;
    losses: number;
    clean_sheets: number;
    auction_value?: number;
    star_rating?: number;
}

interface MatchdayStats {
    matchday: number;
    fixture_id: string;
    player_side: 'home' | 'away';
    home_team_name: string;
    away_team_name: string;
    home_player_name: string;
    away_player_name: string;
    goals_scored: number;
    goals_conceded: number;
    goal_difference: number;
    points: number;
    was_substitute: boolean;
}

export default function MyPlayerStatsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<keyof PlayerStats>('points');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
    const [matchdayStats, setMatchdayStats] = useState<Map<string, MatchdayStats[]>>(new Map());
    const [loadingMatchday, setLoadingMatchday] = useState<string | null>(null);
    const [playerTotalPoints, setPlayerTotalPoints] = useState<Map<string, number>>(new Map());

    // Round range selection
    const [fromRound, setFromRound] = useState<number>(1);
    const [toRound, setToRound] = useState<number>(10);
    const [maxRound, setMaxRound] = useState<number>(10);

    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
    }, [user, authLoading, router]);

    // Initial load only
    useEffect(() => {
        if (user && initialLoad) {
            loadPlayers();
        }
    }, [user]);

    // Debounced reload when round range changes
    useEffect(() => {
        if (!user || initialLoad) return;

        const timer = setTimeout(() => {
            loadPlayers();
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timer);
    }, [fromRound, toRound]);

    const loadPlayers = async () => {
        setLoading(true);
        try {
            const response = await fetchWithTokenRefresh(
                `/api/team/player-stats?season_id=SSPSLS16&from_round=${fromRound}&to_round=${toRound}`
            );
            if (response.ok) {
                const data = await response.json();
                setPlayers(data.players || []);
                if (data.maxRound) {
                    setMaxRound(data.maxRound);
                }

                // Load total points for all players
                loadAllPlayerTotalPoints(data.players || []);
            }
        } catch (error) {
            console.error('Error loading players:', error);
        } finally {
            setLoading(false);
            if (initialLoad) setInitialLoad(false);
        }
    };

    const loadAllPlayerTotalPoints = async (playersList: PlayerStats[]) => {
        const newPlayerTotalPoints = new Map<string, number>();

        const promises = playersList.map(async (player) => {
            try {
                const response = await fetchWithTokenRefresh(
                    `/api/team/player-matchday-stats?player_id=${player.id}&season_id=SSPSLS16&from_round=${fromRound}&to_round=${toRound}`
                );
                if (response.ok) {
                    const data = await response.json();
                    newPlayerTotalPoints.set(player.id, data.totalPoints || 0);
                }
            } catch (error) {
                console.error(`Error loading total points for ${player.player_name}:`, error);
            }
        });

        await Promise.all(promises);
        setPlayerTotalPoints(newPlayerTotalPoints);
    };

    const loadMatchdayStats = async (playerId: string) => {
        if (matchdayStats.has(playerId)) {
            setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
            return;
        }

        setLoadingMatchday(playerId);
        try {
            const response = await fetchWithTokenRefresh(
                `/api/team/player-matchday-stats?player_id=${playerId}&season_id=SSPSLS16&from_round=${fromRound}&to_round=${toRound}`
            );
            if (response.ok) {
                const data = await response.json();
                const newMatchdayStats = new Map(matchdayStats);
                newMatchdayStats.set(playerId, data.matchdayStats || []);
                setMatchdayStats(newMatchdayStats);

                const newPlayerTotalPoints = new Map(playerTotalPoints);
                newPlayerTotalPoints.set(playerId, data.totalPoints || 0);
                setPlayerTotalPoints(newPlayerTotalPoints);

                setExpandedPlayer(playerId);
            }
        } catch (error) {
            console.error('Error loading matchday stats:', error);
        } finally {
            setLoadingMatchday(null);
        }
    };

    const handleSort = (column: keyof PlayerStats) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const filteredPlayers = players
        .filter(p =>
            p.player_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const aVal = a[sortBy] ?? 0;
            const bVal = b[sortBy] ?? 0;

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortOrder === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });

    if (authLoading || (loading && initialLoad)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading your player statistics...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-3 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        My Player Statistics
                    </h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Track your players' performance across rounds
                    </p>
                </div>

                {/* Round Range Selection */}
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filter by Round Range
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                From Round
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={toRound}
                                value={fromRound}
                                onChange={(e) => setFromRound(Math.max(1, Math.min(parseInt(e.target.value) || 1, toRound)))}
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                To Round
                            </label>
                            <input
                                type="number"
                                min={fromRound}
                                max={maxRound}
                                value={toRound}
                                onChange={(e) => setToRound(Math.max(fromRound, Math.min(parseInt(e.target.value) || maxRound, maxRound)))}
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                        {loading && !initialLoad ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span>Updating stats...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Showing stats from Round {fromRound} to Round {toRound}
                            </>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="mb-4 md:mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search player..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 pl-10 sm:pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm sm:text-base"
                        />
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-3 sm:left-4 top-3 sm:top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Players Table */}
                <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 md:px-4 py-3 text-left text-xs font-bold uppercase tracking-tight">
                                        <span className="sr-only">Expand</span>
                                        <span>+</span>
                                    </th>
                                    <th
                                        onClick={() => handleSort('player_name')}
                                        className="px-3 md:px-4 py-3 text-left text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('points')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Points {sortBy === 'points' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>

                                    <th
                                        onClick={() => handleSort('matches_played')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        MP {sortBy === 'matches_played' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('goals_scored')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        GS {sortBy === 'goals_scored' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('goal_difference')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        GD {sortBy === 'goal_difference' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredPlayers.map((player, index) => {
                                    return (
                                        <React.Fragment key={player.id}>
                                            <tr className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                <td className="px-3 md:px-4 py-3">
                                                    <button
                                                        onClick={() => loadMatchdayStats(player.id)}
                                                        disabled={loadingMatchday === player.id}
                                                        className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {loadingMatchday === player.id ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                        ) : expandedPlayer === player.id ? (
                                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-3 md:px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                            {player.player_name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-900">{player.player_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 md:px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                                                        {player.points || 0}
                                                    </span>
                                                </td>
                                                <td className="px-3 md:px-4 py-3 text-center">
                                                    <span className="text-sm font-medium text-gray-700">{player.matches_played || 0}</span>
                                                </td>
                                                <td className="px-3 md:px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                        ⚽ {player.goals_scored || 0}
                                                    </span>
                                                </td>
                                                <td className="px-3 md:px-4 py-3 text-center">
                                                    <span className={`text-sm font-bold ${player.goal_difference > 0 ? 'text-green-600' : player.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                                                        }`}>
                                                        {player.goal_difference > 0 ? '+' : ''}{player.goal_difference || 0}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedPlayer === player.id && matchdayStats.has(player.id) && (
                                                <tr key={`${player.id}-matchday`} className="bg-gradient-to-r from-blue-50 to-purple-50">
                                                    <td colSpan={6} className="px-4 md:px-6 py-4 md:py-6">
                                                        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
                                                            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4">
                                                                Matchday Breakdown - {player.player_name}
                                                            </h3>

                                                            {matchdayStats.get(player.id)!.length === 0 ? (
                                                                <div className="text-center py-8 text-gray-500">
                                                                    <p className="text-sm md:text-base font-medium">No completed matches in this range</p>
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-x-auto">
                                                                    <table className="min-w-full divide-y divide-gray-200">
                                                                        <thead className="bg-gray-100">
                                                                            <tr>
                                                                                <th className="px-3 md:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Round</th>
                                                                                <th className="px-3 md:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Matchup</th>
                                                                                <th className="px-3 md:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Score</th>
                                                                                <th className="px-3 md:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">GD</th>
                                                                                <th className="px-3 md:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Points</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-200 bg-white">
                                                                            {matchdayStats.get(player.id)!.map((match, idx) => (
                                                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                                                    <td className="px-3 md:px-4 py-3">
                                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                                                                            R{match.matchday}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-3 md:px-4 py-3">
                                                                                        <div className="text-xs md:text-sm">
                                                                                            {match.player_side === 'home' ? (
                                                                                                <>
                                                                                                    <span className="font-bold text-blue-600">{match.home_player_name}</span>
                                                                                                    <span className="text-gray-500 mx-1">vs</span>
                                                                                                    <span className="text-gray-700">{match.away_player_name}</span>
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <span className="text-gray-700">{match.home_player_name}</span>
                                                                                                    <span className="text-gray-500 mx-1">vs</span>
                                                                                                    <span className="font-bold text-blue-600">{match.away_player_name}</span>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-3 md:px-4 py-3 text-center">
                                                                                        <span className="text-sm font-bold">
                                                                                            {match.goals_scored}-{match.goals_conceded}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-3 md:px-4 py-3 text-center">
                                                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${match.goal_difference > 0 ? 'bg-green-100 text-green-700' :
                                                                                            match.goal_difference < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                                                            }`}>
                                                                                            {match.goal_difference > 0 ? '+' : ''}{match.goal_difference}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-3 md:px-4 py-3 text-center">
                                                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${match.points > 0 ? 'bg-green-100 text-green-700' :
                                                                                            match.points < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                                                            }`}>
                                                                                            {match.points > 0 ? '+' : ''}{match.points}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                        <tfoot className="bg-gradient-to-r from-blue-100 to-purple-100">
                                                                            <tr>
                                                                                <td colSpan={4} className="px-3 md:px-4 py-3 text-right text-sm font-bold text-gray-800">
                                                                                    Total:
                                                                                </td>
                                                                                <td className="px-3 md:px-4 py-3 text-center">
                                                                                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-bold ${matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) > 0 ? 'bg-green-200 text-green-800' :
                                                                                        matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) < 0 ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-700'
                                                                                        }`}>
                                                                                        {matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0) > 0 ? '+' : ''}
                                                                                        {matchdayStats.get(player.id)!.reduce((sum, m) => sum + m.points, 0)}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        </tfoot>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Total Players</div>
                        <div className="text-3xl font-bold mt-2">{filteredPlayers.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Total Goals</div>
                        <div className="text-3xl font-bold mt-2">
                            {filteredPlayers.reduce((sum, p) => sum + (p.goals_scored || 0), 0)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Total Matches</div>
                        <div className="text-3xl font-bold mt-2">
                            {filteredPlayers.reduce((sum, p) => sum + (p.matches_played || 0), 0)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Clean Sheets</div>
                        <div className="text-3xl font-bold mt-2">
                            {filteredPlayers.reduce((sum, p) => sum + (p.clean_sheets || 0), 0)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
