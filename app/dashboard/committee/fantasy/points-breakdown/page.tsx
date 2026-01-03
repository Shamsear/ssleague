'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerRound {
    round: number;
    points: number;
    status: string;
}

interface Player {
    player_id: string;
    player_name: string;
    is_active: boolean;
    rounds: PlayerRound[];
    total_points: number;
}

interface PassiveMatch {
    fixture_id: string;
    supported_team: string;
    opponent: string;
    score: string;
    home_away: string;
    bonus_points: number;
    breakdown: Record<string, number>;
}

interface PassiveRound {
    round: number;
    total_passive: number;
    matches: PassiveMatch[];
}

interface RoundTotal {
    round: number;
    active_points: number;
    passive_points: number;
    total_points: number;
}

interface TeamBreakdown {
    team_id: string;
    team_name: string;
    owner_name: string;
    supported_team_id: string;
    supported_team_name: string;
    players: Player[];
    passive_breakdown: PassiveRound[];
    round_totals: RoundTotal[];
    grand_total_active: number;
    grand_total_passive: number;
    grand_total: number;
}

export default function FantasyPointsBreakdownPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { isCommitteeAdmin } = usePermissions();
    const [teams, setTeams] = useState<TeamBreakdown[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [maxRounds, setMaxRounds] = useState(0);
    const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!loading && (!user || !isCommitteeAdmin)) {
            router.push('/dashboard');
            return;
        }
    }, [user, loading, isCommitteeAdmin, router]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !isCommitteeAdmin) return;

            setIsLoading(true);
            try {
                const response = await fetchWithTokenRefresh('/api/fantasy/points-breakdown');
                const data = await response.json();

                if (data.success) {
                    setTeams(data.teams || []);
                    setMaxRounds(data.maxRounds || 0);
                }
            } catch (error) {
                console.error('Error fetching fantasy points breakdown:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, isCommitteeAdmin]);

    const toggleRound = (teamId: string, round: number) => {
        const key = `${teamId}-${round}`;
        setExpandedRounds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 font-medium">Loading fantasy points breakdown...</p>
                </div>
            </div>
        );
    }

    const filteredTeams = selectedTeam === 'all'
        ? teams
        : teams.filter(t => t.team_id === selectedTeam);

    return (
        <div className="min-h-screen py-6 px-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
            <div className="container mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/dashboard/committee"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors mb-4"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>

                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        🎯 Fantasy Points Breakdown
                    </h1>
                    <p className="text-gray-600">Detailed round-by-round breakdown of active (player) and passive (team) points</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex-1 w-full sm:w-auto">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Team</label>
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Teams</option>
                                {teams.map(team => (
                                    <option key={team.team_id} value={team.team_id}>
                                        {team.team_name} ({team.owner_name})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Teams Breakdown */}
                {filteredTeams.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <p className="text-gray-500 text-lg">No fantasy teams found</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredTeams.map(team => (
                            <div key={team.team_id} className="bg-white rounded-xl shadow-xl overflow-hidden">
                                {/* Team Header */}
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                                    <h2 className="text-2xl font-bold mb-1">{team.team_name}</h2>
                                    <p className="text-blue-100 text-sm mb-3">Owner: {team.owner_name}</p>
                                    {team.supported_team_name && (
                                        <p className="text-blue-100 text-sm mb-3">
                                            🏆 Supporting: <span className="font-semibold">{team.supported_team_name}</span>
                                        </p>
                                    )}
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-blue-200">Active Points</p>
                                            <p className="text-2xl font-bold">{team.grand_total_active}</p>
                                            <p className="text-xs text-blue-200">Player Performance</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-200">Passive Points</p>
                                            <p className="text-2xl font-bold">{team.grand_total_passive}</p>
                                            <p className="text-xs text-blue-200">Team Bonuses</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-200">Total Points</p>
                                            <p className="text-3xl font-bold">{team.grand_total}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Round-by-Round Breakdown */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Round-by-Round Breakdown</h3>

                                    <div className="space-y-4">
                                        {team.round_totals.map((roundTotal) => {
                                            const passiveData = team.passive_breakdown.find(p => p.round === roundTotal.round);
                                            const isExpanded = expandedRounds.has(`${team.team_id}-${roundTotal.round}`);

                                            return (
                                                <div key={roundTotal.round} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                                    {/* Round Header */}
                                                    <button
                                                        onClick={() => toggleRound(team.team_id, roundTotal.round)}
                                                        className="w-full bg-gray-50 hover:bg-gray-100 transition-colors p-4 flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-lg font-bold text-gray-900">Round {roundTotal.round}</span>
                                                            <div className="flex gap-6 text-sm">
                                                                <span className="text-green-600 font-semibold">
                                                                    Active: {roundTotal.active_points}
                                                                </span>
                                                                <span className="text-blue-600 font-semibold">
                                                                    Passive: {roundTotal.passive_points}
                                                                </span>
                                                                <span className="text-purple-600 font-bold">
                                                                    Total: {roundTotal.total_points}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <svg
                                                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>

                                                    {/* Round Details */}
                                                    {isExpanded && (
                                                        <div className="p-4 bg-white border-t border-gray-200">
                                                            {/* Passive Points Details */}
                                                            {passiveData && passiveData.matches.length > 0 && (
                                                                <div className="mb-4">
                                                                    <h4 className="font-semibold text-gray-900 mb-3">
                                                                        🏆 Passive Points (Team Bonuses)
                                                                    </h4>
                                                                    <div className="space-y-2">
                                                                        {passiveData.matches.map((match, idx) => (
                                                                            <div key={idx} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-semibold text-gray-900">
                                                                                            {match.supported_team}
                                                                                        </span>
                                                                                        <span className="text-gray-500">vs</span>
                                                                                        <span className="text-gray-700">{match.opponent}</span>
                                                                                        <span className="px-2 py-1 bg-white rounded text-sm font-mono">
                                                                                            {match.score}
                                                                                        </span>
                                                                                        <span className="text-xs text-gray-500">({match.home_away})</span>
                                                                                    </div>
                                                                                    <span className="text-lg font-bold text-blue-600">
                                                                                        +{match.bonus_points} pts
                                                                                    </span>
                                                                                </div>
                                                                                {Object.keys(match.breakdown).length > 0 && (
                                                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                                                        {Object.entries(match.breakdown).map(([rule, points]) => (
                                                                                            <span
                                                                                                key={rule}
                                                                                                className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-700 border border-blue-300"
                                                                                            >
                                                                                                {rule.replace(/_/g, ' ')}: {points > 0 ? '+' : ''}{points}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Active Points (Player Performance) */}
                                                            <div>
                                                                <h4 className="font-semibold text-gray-900 mb-3">
                                                                    ⚽ Active Points (Player Performance)
                                                                </h4>
                                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                    {team.players
                                                                        .filter(player => player.rounds.some(r => r.round === roundTotal.round))
                                                                        .map(player => {
                                                                            const roundData = player.rounds.find(r => r.round === roundTotal.round);
                                                                            if (!roundData || roundData.points === 0) return null;

                                                                            return (
                                                                                <div
                                                                                    key={player.player_id}
                                                                                    className="bg-green-50 rounded px-3 py-2 border border-green-200"
                                                                                >
                                                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                                                        {player.player_name}
                                                                                    </div>
                                                                                    <div className="text-lg font-bold text-green-600">
                                                                                        {roundData.points} pts
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                                {team.players.filter(p => p.rounds.some(r => r.round === roundTotal.round && r.points > 0)).length === 0 && (
                                                                    <p className="text-gray-500 text-sm italic">No player points this round</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Legend */}
                <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
                    <h3 className="font-bold text-gray-900 mb-3">Legend:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">Active Points:</span>
                            <span className="text-gray-600">Points earned by players based on their match performance</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-600">Passive Points:</span>
                            <span className="text-gray-600">Bonus points earned when the supported team wins/performs well</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        * Click on any round to expand and see detailed breakdown of points
                    </p>
                </div>
            </div>
        </div>
    );
}
