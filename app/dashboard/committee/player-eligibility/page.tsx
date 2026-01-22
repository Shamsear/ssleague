'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import Link from 'next/link';

interface PlayerEligibility {
    id: string;
    player_id: string;
    player_name: string;
    team_id: string;
    team_name: string;
    season_id: string;
    matches_played: number;
    goals_scored: number;
    goals_conceded: number;
    goal_difference: number;
    wins: number;
    draws: number;
    losses: number;
    clean_sheets: number;
    points: number;
    star_rating?: number;
    category?: string;
}

export default function PlayerEligibilityPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState<PlayerEligibility[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<keyof PlayerEligibility>('team_name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterTeam, setFilterTeam] = useState<string>('all');
    const [filterEligibility, setFilterEligibility] = useState<'all' | 'eligible' | 'ineligible'>('all');

    // Round range selection
    const [fromRound, setFromRound] = useState<number>(1);
    const [toRound, setToRound] = useState<number>(10);
    const [maxRound, setMaxRound] = useState<number>(10);
    const [minGames, setMinGames] = useState<number>(5);

    const [initialLoad, setInitialLoad] = useState(true);
    const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (!authLoading && user && user.role !== 'committee_admin') {
            router.push('/dashboard');
            return;
        }
    }, [user, authLoading, router]);

    // Initial load
    useEffect(() => {
        if (user && user.role === 'committee_admin' && initialLoad) {
            loadPlayers();
        }
    }, [user]);

    // Debounced reload when parameters change
    useEffect(() => {
        if (!user || initialLoad) return;

        const timer = setTimeout(() => {
            loadPlayers();
        }, 500);

        return () => clearTimeout(timer);
    }, [fromRound, toRound]);

    const loadPlayers = async () => {
        setLoading(true);
        try {
            const response = await fetchWithTokenRefresh(
                `/api/committee/player-eligibility?season_id=SSPSLS16&from_round=${fromRound}&to_round=${toRound}`
            );
            if (response.ok) {
                const data = await response.json();
                setPlayers(data.players || []);
                if (data.maxRound) {
                    setMaxRound(data.maxRound);
                }

                // Extract unique teams
                const uniqueTeams = Array.from(
                    new Set(data.players.map((p: PlayerEligibility) => JSON.stringify({ id: p.team_id, name: p.team_name })))
                ).map(t => JSON.parse(t));
                setTeams(uniqueTeams);
            }
        } catch (error) {
            console.error('Error loading players:', error);
        } finally {
            setLoading(false);
            if (initialLoad) setInitialLoad(false);
        }
    };

    const handleSort = (column: keyof PlayerEligibility) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const filteredPlayers = players
        .filter(p => {
            const matchesSearch = p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.team_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTeam = filterTeam === 'all' || p.team_id === filterTeam;
            const matchesEligibility = filterEligibility === 'all' ||
                (filterEligibility === 'eligible' && p.matches_played >= minGames) ||
                (filterEligibility === 'ineligible' && p.matches_played < minGames);

            return matchesSearch && matchesTeam && matchesEligibility;
        })
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

    const eligibleCount = players.filter(p => p.matches_played >= minGames).length;
    const ineligibleCount = players.filter(p => p.matches_played < minGames).length;

    if (authLoading || (loading && initialLoad)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading player eligibility data...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'committee_admin') return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-3 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <Link
                        href="/dashboard/committee/team-management/tournament"
                        className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Tournament
                    </Link>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        Player Eligibility Checker
                    </h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Check if players have met minimum game requirements
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6 space-y-4">
                    {/* Round Range */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filter by Round Range
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
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
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Minimum Games Required
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={toRound - fromRound + 1}
                                    value={minGames}
                                    onChange={(e) => setMinGames(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                            {loading && !initialLoad ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                    <span>Updating stats...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Showing stats from Round {fromRound} to Round {toRound} • Min {minGames} games required
                                </>
                            )}
                        </div>
                    </div>

                    {/* Team and Eligibility Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Filter by Team
                            </label>
                            <select
                                value={filterTeam}
                                onChange={(e) => setFilterTeam(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                            >
                                <option value="all">All Teams</option>
                                {teams.map(team => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Filter by Eligibility
                            </label>
                            <select
                                value={filterEligibility}
                                onChange={(e) => setFilterEligibility(e.target.value as any)}
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                            >
                                <option value="all">All Players</option>
                                <option value="eligible">✅ Eligible Only</option>
                                <option value="ineligible">⚠️ Ineligible Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-4 md:mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search player or team..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 pl-10 sm:pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm sm:text-base"
                        />
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-3 sm:left-4 top-3 sm:top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Total Players</div>
                        <div className="text-3xl font-bold mt-2">{filteredPlayers.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">✅ Eligible</div>
                        <div className="text-3xl font-bold mt-2">{eligibleCount}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">⚠️ Ineligible</div>
                        <div className="text-3xl font-bold mt-2">{ineligibleCount}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90">Eligibility Rate</div>
                        <div className="text-3xl font-bold mt-2">
                            {players.length > 0 ? Math.round((eligibleCount / players.length) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Players Table */}
                <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 md:px-4 py-3 text-left text-xs font-bold uppercase tracking-tight">
                                        Status
                                    </th>
                                    <th
                                        onClick={() => handleSort('player_name')}
                                        className="px-3 md:px-4 py-3 text-left text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('team_name')}
                                        className="px-3 md:px-4 py-3 text-left text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        Team {sortBy === 'team_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('matches_played')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        Games {sortBy === 'matches_played' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('wins')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        W {sortBy === 'wins' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('draws')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        D {sortBy === 'draws' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('losses')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        L {sortBy === 'losses' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('goal_difference')}
                                        className="px-3 md:px-4 py-3 text-center text-xs font-bold uppercase tracking-tight cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                        GD {sortBy === 'goal_difference' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredPlayers.map((player, index) => {
                                    const isEligible = player.matches_played >= minGames;
                                    return (
                                        <tr key={player.id} className={`hover:bg-purple-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                            <td className="px-3 md:px-4 py-3">
                                                {isEligible ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                        ✅ Eligible
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                                        ⚠️ Ineligible
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 md:px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                        {player.player_name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-900">{player.player_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 md:px-4 py-3">
                                                <span className="text-sm text-gray-700">{player.team_name}</span>
                                            </td>
                                            <td className="px-3 md:px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${isEligible ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {player.matches_played} / {minGames}
                                                </span>
                                            </td>
                                            <td className="px-3 md:px-4 py-3 text-center">
                                                <span className="text-sm font-medium text-gray-700">{player.wins || 0}</span>
                                            </td>
                                            <td className="px-3 md:px-4 py-3 text-center">
                                                <span className="text-sm font-medium text-gray-700">{player.draws || 0}</span>
                                            </td>
                                            <td className="px-3 md:px-4 py-3 text-center">
                                                <span className="text-sm font-medium text-gray-700">{player.losses || 0}</span>
                                            </td>
                                            <td className="px-3 md:px-4 py-3 text-center">
                                                <span className={`text-sm font-bold ${player.goal_difference > 0 ? 'text-green-600' : player.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                                                    }`}>
                                                    {player.goal_difference > 0 ? '+' : ''}{player.goal_difference || 0}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
