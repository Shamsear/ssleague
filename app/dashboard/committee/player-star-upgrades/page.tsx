'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import Link from 'next/link';

interface PlayerStats {
    id: string;
    player_id: string;
    player_name: string;
    season_id: string;
    team: string;
    points: number;
    base_points: number;
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
    salary_per_match?: number;
}

export default function PlayerStarUpgradesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'player_name' | 'base_star' | 'current_star' | 'upgrade'>('upgrade');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterUpgrade, setFilterUpgrade] = useState<'all' | 'upgraded' | 'downgraded' | 'same'>('all');
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (!authLoading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && (user.role === 'committee_admin' || user.role === 'super_admin')) {
            loadPlayers();
        }
    }, [user]);

    const loadPlayers = async () => {
        setLoading(true);
        try {
            const response = await fetchWithTokenRefresh('/api/committee/player-stats?season_id=SSPSLS16');
            if (response.ok) {
                const data = await response.json();
                setPlayers(data.players || []);
            }
        } catch (error) {
            console.error('Error loading players:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate star rating from points
    const calculateStarRating = (points: number): number => {
        if (points >= 350) return 10;
        if (points >= 300) return 9;
        if (points >= 250) return 8;
        if (points >= 210) return 7;
        if (points >= 175) return 6;
        if (points >= 145) return 5;
        if (points >= 120) return 4;
        return 3;
    };

    // Get star rating color
    const getStarColor = (stars: number): string => {
        if (stars >= 9) return 'from-yellow-400 to-orange-500';
        if (stars >= 7) return 'from-purple-400 to-pink-500';
        if (stars >= 5) return 'from-blue-400 to-indigo-500';
        return 'from-gray-400 to-gray-500';
    };

    // Get upgrade badge color
    const getUpgradeBadgeColor = (upgrade: number): string => {
        if (upgrade > 0) return 'bg-green-100 text-green-800 border-green-300';
        if (upgrade < 0) return 'bg-red-100 text-red-800 border-red-300';
        return 'bg-gray-100 text-gray-600 border-gray-300';
    };

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const filteredPlayers = players
        .filter(p => {
            // Search filter
            const matchesSearch = p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.team?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // Only show players with base_points set
            if (!p.base_points || p.base_points === 0) return false;

            // Upgrade filter
            const baseStar = calculateStarRating(p.base_points);
            const currentStar = calculateStarRating(p.points);
            const upgrade = currentStar - baseStar;

            if (filterUpgrade === 'upgraded' && upgrade <= 0) return false;
            if (filterUpgrade === 'downgraded' && upgrade >= 0) return false;
            if (filterUpgrade === 'same' && upgrade !== 0) return false;

            return true;
        })
        .sort((a, b) => {
            const aBaseStar = calculateStarRating(a.base_points);
            const aCurrentStar = calculateStarRating(a.points);
            const aUpgrade = aCurrentStar - aBaseStar;

            const bBaseStar = calculateStarRating(b.base_points);
            const bCurrentStar = calculateStarRating(b.points);
            const bUpgrade = bCurrentStar - bBaseStar;

            let comparison = 0;

            switch (sortBy) {
                case 'player_name':
                    comparison = a.player_name.localeCompare(b.player_name);
                    break;
                case 'base_star':
                    comparison = aBaseStar - bBaseStar;
                    break;
                case 'current_star':
                    comparison = aCurrentStar - bCurrentStar;
                    break;
                case 'upgrade':
                    comparison = aUpgrade - bUpgrade;
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

    // Calculate statistics
    const stats = {
        total: filteredPlayers.length,
        upgraded: filteredPlayers.filter(p => {
            const upgrade = calculateStarRating(p.points) - calculateStarRating(p.base_points);
            return upgrade > 0;
        }).length,
        downgraded: filteredPlayers.filter(p => {
            const upgrade = calculateStarRating(p.points) - calculateStarRating(p.base_points);
            return upgrade < 0;
        }).length,
        same: filteredPlayers.filter(p => {
            const upgrade = calculateStarRating(p.points) - calculateStarRating(p.base_points);
            return upgrade === 0;
        }).length,
    };

    // Copy upgraded players list
    const copyUpgradedPlayers = async () => {
        const upgradedPlayers = players.filter(p => {
            if (!p.base_points || p.base_points === 0) return false;
            const upgrade = calculateStarRating(p.points) - calculateStarRating(p.base_points);
            return upgrade > 0;
        });

        if (upgradedPlayers.length === 0) {
            setCopySuccess('No upgraded players to copy');
            setTimeout(() => setCopySuccess(null), 2000);
            return;
        }

        const text = upgradedPlayers
            .map((p, index) => {
                const baseStar = calculateStarRating(p.base_points);
                const currentStar = calculateStarRating(p.points);
                const upgrade = currentStar - baseStar;
                const pointsGained = p.points - p.base_points;
                return `${index + 1}. *${p.player_name}*\n   ${baseStar}⭐ ➜ ${currentStar}⭐ (+${upgrade})\n   Points: ${p.base_points} ➜ ${p.points} (+${pointsGained})`;
            })
            .join('\n\n');

        const header = `🌟 *UPGRADED PLAYERS* 🌟\nTotal: ${upgradedPlayers.length}\n${'─'.repeat(30)}\n\n`;
        const fullText = header + text;

        try {
            await navigator.clipboard.writeText(fullText);
            setCopySuccess('✅ Upgraded players copied to clipboard!');
            setTimeout(() => setCopySuccess(null), 3000);
        } catch (err) {
            setCopySuccess('❌ Failed to copy');
            setTimeout(() => setCopySuccess(null), 2000);
        }
    };

    // Copy downgraded players list
    const copyDowngradedPlayers = async () => {
        const downgradedPlayers = players.filter(p => {
            if (!p.base_points || p.base_points === 0) return false;
            const upgrade = calculateStarRating(p.points) - calculateStarRating(p.base_points);
            return upgrade < 0;
        });

        if (downgradedPlayers.length === 0) {
            setCopySuccess('No downgraded players to copy');
            setTimeout(() => setCopySuccess(null), 2000);
            return;
        }

        const text = downgradedPlayers
            .map((p, index) => {
                const baseStar = calculateStarRating(p.base_points);
                const currentStar = calculateStarRating(p.points);
                const upgrade = currentStar - baseStar;
                const pointsLost = p.points - p.base_points;
                return `${index + 1}. *${p.player_name}*\n   ${baseStar}⭐ ➜ ${currentStar}⭐ (${upgrade})\n   Points: ${p.base_points} ➜ ${p.points} (${pointsLost})`;
            })
            .join('\n\n');

        const header = `📉 *DOWNGRADED PLAYERS* 📉\nTotal: ${downgradedPlayers.length}\n${'─'.repeat(30)}\n\n`;
        const fullText = header + text;

        try {
            await navigator.clipboard.writeText(fullText);
            setCopySuccess('✅ Downgraded players copied to clipboard!');
            setTimeout(() => setCopySuccess(null), 3000);
        } catch (err) {
            setCopySuccess('❌ Failed to copy');
            setTimeout(() => setCopySuccess(null), 2000);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading player upgrades...</p>
                </div>
            </div>
        );
    }

    if (!user || (user.role !== 'committee_admin' && user.role !== 'super_admin')) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                ⭐ Player Star Upgrades
                            </h1>
                            <p className="text-gray-600 mt-2 flex items-center gap-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                    SSPSLS16
                                </span>
                                <span>Track player progression from base to current star rating</span>
                            </p>
                        </div>

                        <Link
                            href="/dashboard/committee"
                            className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            ← Back
                        </Link>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Total Players</p>
                                    <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Upgraded</p>
                                    <p className="text-3xl font-bold text-green-600">{stats.upgraded}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                            {stats.upgraded > 0 && (
                                <button
                                    onClick={copyUpgradedPlayers}
                                    className="w-full mt-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy List
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-red-500">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Downgraded</p>
                                    <p className="text-3xl font-bold text-red-600">{stats.downgraded}</p>
                                </div>
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                            </div>
                            {stats.downgraded > 0 && (
                                <button
                                    onClick={copyDowngradedPlayers}
                                    className="w-full mt-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy List
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-gray-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Unchanged</p>
                                    <p className="text-3xl font-bold text-gray-600">{stats.same}</p>
                                </div>
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Copy Success Notification */}
                    {copySuccess && (
                        <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg animate-fade-in">
                            <p className="text-blue-800 font-medium flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {copySuccess}
                            </p>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search Player or Team</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by player name or team..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-5 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                            <select
                                value={filterUpgrade}
                                onChange={(e) => setFilterUpgrade(e.target.value as any)}
                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="all">All Players</option>
                                <option value="upgraded">Upgraded Only</option>
                                <option value="downgraded">Downgraded Only</option>
                                <option value="same">Unchanged Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Players Table */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                                <tr>
                                    <th
                                        onClick={() => handleSort('player_name')}
                                        className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Player {sortBy === 'player_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                                        Team
                                    </th>
                                    <th
                                        onClick={() => handleSort('base_star')}
                                        className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Base Points {sortBy === 'base_star' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                                        Base Star
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                                        Current Points
                                    </th>
                                    <th
                                        onClick={() => handleSort('current_star')}
                                        className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Current Star {sortBy === 'current_star' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('upgrade')}
                                        className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors"
                                    >
                                        Upgrade {sortBy === 'upgrade' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                                        Progress
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPlayers.map((player, index) => {
                                    const baseStar = calculateStarRating(player.base_points);
                                    const currentStar = calculateStarRating(player.points);
                                    const upgrade = currentStar - baseStar;
                                    const pointsGained = player.points - player.base_points;

                                    return (
                                        <tr
                                            key={player.id}
                                            className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                        {player.player_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{player.player_name}</div>
                                                        <div className="text-xs text-gray-500">{player.matches_played} matches</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600">{player.team || '-'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700">
                                                    {player.base_points}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={`inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r ${getStarColor(baseStar)} text-white font-bold shadow-md`}>
                                                    {baseStar}⭐
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                                                        {player.points}
                                                    </span>
                                                    {pointsGained !== 0 && (
                                                        <span className={`text-xs font-medium mt-1 ${pointsGained > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {pointsGained > 0 ? '+' : ''}{pointsGained}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={`inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r ${getStarColor(currentStar)} text-white font-bold shadow-md`}>
                                                    {currentStar}⭐
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-bold border-2 ${getUpgradeBadgeColor(upgrade)}`}>
                                                    {upgrade > 0 && (
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                                        </svg>
                                                    )}
                                                    {upgrade < 0 && (
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                        </svg>
                                                    )}
                                                    {upgrade === 0 ? '=' : `${upgrade > 0 ? '+' : ''}${upgrade}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-2xl font-bold bg-gradient-to-r ${getStarColor(baseStar)} bg-clip-text text-transparent`}>
                                                        {baseStar}⭐
                                                    </div>
                                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                    </svg>
                                                    <div className={`text-2xl font-bold bg-gradient-to-r ${getStarColor(currentStar)} bg-clip-text text-transparent`}>
                                                        {currentStar}⭐
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredPlayers.length === 0 && (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="text-gray-500 font-medium">No players found with the current filters</p>
                            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter criteria</p>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-6 bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Star Rating Thresholds</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                            <span className="text-sm text-gray-600">&lt; 120 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">4</div>
                            <span className="text-sm text-gray-600">120-144 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">5</div>
                            <span className="text-sm text-gray-600">145-174 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">6</div>
                            <span className="text-sm text-gray-600">175-209 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">7</div>
                            <span className="text-sm text-gray-600">210-249 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">8</div>
                            <span className="text-sm text-gray-600">250-299 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">9</div>
                            <span className="text-sm text-gray-600">300-349 points</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">10</div>
                            <span className="text-sm text-gray-600">350+ points</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
