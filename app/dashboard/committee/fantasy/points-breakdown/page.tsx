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
    tournament_id: string;
    tournament_name: string;
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
    tournament_id: string;
    tournament_name: string;
    round: number;
    total_passive: number;
    matches: PassiveMatch[];
}

interface RoundTotal {
    tournament_id: string;
    tournament_name: string;
    round: number;
    active_points: number;
    passive_points: number;
    total_points: number;
}

interface AdminBonus {
    type: 'player' | 'team';
    target_id: string;
    points: number;
    reason: string;
    awarded_at: string;
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
    admin_bonuses: AdminBonus[];
    grand_total_active: number;
    grand_total_passive: number;
    grand_total: number;
}

interface Tournament {
    tournament_id: string;
    tournament_name: string;
    max_round: number;
}

export default function FantasyPointsBreakdownPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { isCommitteeAdmin } = usePermissions();
    const [teams, setTeams] = useState<TeamBreakdown[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
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
                    setTournaments(data.tournaments || []);
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

    const toggleRound = (teamId: string, tournamentId: string, round: number) => {
        const key = `${teamId}-${tournamentId}-${round}`;
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

                                {/* Player & Team Summary */}
                                <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 border-b-2 border-blue-200">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Points Summary</h3>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Active Players Summary */}
                                        <div className="bg-white rounded-xl shadow-md p-4 border-2 border-green-200">
                                            <h4 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
                                                <span>⚽</span>
                                                <span>Active Players ({team.players.length})</span>
                                            </h4>
                                            <div className="space-y-2">
                                                {team.players
                                                    .sort((a, b) => b.total_points - a.total_points)
                                                    .map((player) => {
                                                        // Calculate bonus points from admin bonuses
                                                        const playerBonuses = team.admin_bonuses
                                                            .filter(b => b.type === 'player' && b.reason.includes(player.player_name))
                                                            .reduce((sum, b) => sum + b.points, 0);
                                                        
                                                        const basePoints = player.total_points - playerBonuses;
                                                        
                                                        return (
                                                            <div key={player.player_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
                                                                <div className="flex-1">
                                                                    <div className="font-semibold text-gray-900">{player.player_name}</div>
                                                                    {playerBonuses > 0 && (
                                                                        <div className="text-xs text-gray-600 mt-1">
                                                                            Base: {basePoints} + Bonus: {playerBonuses}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xl font-bold text-green-600">
                                                                        {player.total_points}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">points</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                <div className="pt-3 mt-3 border-t-2 border-green-300">
                                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border-2 border-green-400">
                                                        <span className="font-bold text-gray-900 text-lg">Total Active Points</span>
                                                        <span className="text-2xl font-bold text-green-700">{team.grand_total_active}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Passive Team Summary */}
                                        <div className="bg-white rounded-xl shadow-md p-4 border-2 border-blue-200">
                                            <h4 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">
                                                <span>🏆</span>
                                                <span>Passive Team(s)</span>
                                            </h4>
                                            <div className="space-y-2">
                                                {(() => {
                                                    // Group passive points by team name
                                                    const passiveTeamMap = new Map<string, number>();
                                                    
                                                    team.passive_breakdown.forEach(pb => {
                                                        pb.matches.forEach(match => {
                                                            const teamName = match.supported_team;
                                                            const currentPoints = passiveTeamMap.get(teamName) || 0;
                                                            passiveTeamMap.set(teamName, currentPoints + match.bonus_points);
                                                        });
                                                    });

                                                    const passiveTeams = Array.from(passiveTeamMap.entries())
                                                        .sort((a, b) => b[1] - a[1]); // Sort by points descending

                                                    if (passiveTeams.length === 0) {
                                                        return (
                                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
                                                                No passive team points earned yet
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <>
                                                            {passiveTeams.map(([teamName, points]) => (
                                                                <div key={teamName} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="font-semibold text-gray-900 text-lg">
                                                                            {teamName}
                                                                            {teamName === team.supported_team_name && (
                                                                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                                    Current
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xl font-bold text-blue-600">
                                                                            +{points}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Breakdown by tournament for this team */}
                                                                    <div className="space-y-1">
                                                                        {tournaments.map(tournament => {
                                                                            const tournamentPoints = team.passive_breakdown
                                                                                .filter(p => p.tournament_id === tournament.tournament_id)
                                                                                .reduce((sum, p) => {
                                                                                    return sum + p.matches
                                                                                        .filter(m => m.supported_team === teamName)
                                                                                        .reduce((mSum, m) => mSum + m.bonus_points, 0);
                                                                                }, 0);
                                                                            
                                                                            if (tournamentPoints === 0) return null;
                                                                            
                                                                            return (
                                                                                <div key={tournament.tournament_id} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                                                                                    <span className="text-sm text-gray-700">{tournament.tournament_name}</span>
                                                                                    <span className="text-sm font-bold text-blue-600">+{tournamentPoints}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Team award bonuses (TOD/TOW) */}
                                                            {(() => {
                                                                const teamBonuses = team.admin_bonuses
                                                                    .filter(b => b.type === 'team')
                                                                    .reduce((sum, b) => sum + b.points, 0);
                                                                
                                                                if (teamBonuses > 0) {
                                                                    return (
                                                                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-sm font-semibold text-gray-700">🏅 Team Award Bonuses (TOD/TOW)</span>
                                                                                <span className="text-lg font-bold text-purple-600">+{teamBonuses}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            
                                                            <div className="pt-3 mt-3 border-t-2 border-blue-300">
                                                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg border-2 border-blue-400">
                                                                    <span className="font-bold text-gray-900 text-lg">Total Passive Points</span>
                                                                    <span className="text-2xl font-bold text-blue-700">{team.grand_total_passive}</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grand Total */}
                                    <div className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-xl p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                                                    🎯
                                                </div>
                                                <div>
                                                    <p className="text-white/90 text-sm font-medium">Grand Total</p>
                                                    <p className="text-white text-4xl font-bold">{team.grand_total}</p>
                                                </div>
                                            </div>
                                            <div className="text-right text-white/90 text-sm">
                                                <div>Active: {team.grand_total_active}</div>
                                                <div>Passive: {team.grand_total_passive}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Round-by-Round Breakdown */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Round-by-Round Breakdown</h3>

                                    {/* Group by Tournament */}
                                    {tournaments.map((tournament) => {
                                        const tournamentRounds = team.round_totals.filter(
                                            rt => rt.tournament_id === tournament.tournament_id
                                        );

                                        if (tournamentRounds.length === 0) return null;

                                        return (
                                            <div key={tournament.tournament_id} className="mb-6">
                                                <h4 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
                                                    <span className="bg-indigo-100 px-3 py-1 rounded-lg">
                                                        🏆 {tournament.tournament_name}
                                                    </span>
                                                </h4>

                                                <div className="space-y-4">
                                                    {tournamentRounds.map((roundTotal) => {
                                                        const passiveData = team.passive_breakdown.find(p => 
                                                            p.round === roundTotal.round && p.tournament_id === tournament.tournament_id
                                                        );
                                                        const isExpanded = expandedRounds.has(`${team.team_id}-${tournament.tournament_id}-${roundTotal.round}`);

                                                        return (
                                                            <div key={`${tournament.tournament_id}-${roundTotal.round}`} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                                                {/* Round Header */}
                                                                <button
                                                                    onClick={() => toggleRound(team.team_id, tournament.tournament_id, roundTotal.round)}
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
                                                                                    .filter(player => player.rounds.some(r => 
                                                                                        r.round === roundTotal.round && r.tournament_id === tournament.tournament_id
                                                                                    ))
                                                                                    .map(player => {
                                                                                        const roundData = player.rounds.find(r => 
                                                                                            r.round === roundTotal.round && r.tournament_id === tournament.tournament_id
                                                                                        );
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
                                                                            {team.players.filter(p => p.rounds.some(r => 
                                                                                r.round === roundTotal.round && r.tournament_id === tournament.tournament_id && r.points > 0
                                                                            )).length === 0 && (
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
                                        );
                                    })}
                                </div>

                                {/* Admin Bonus Points Section */}
                                {team.admin_bonuses && team.admin_bonuses.length > 0 && (
                                    <div className="p-4 sm:p-6 border-t-4 border-purple-200 bg-gradient-to-br from-purple-50/50 via-pink-50/30 to-purple-50/50">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                            <h3 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 flex items-center gap-2">
                                                <span className="text-2xl sm:text-3xl">🏅</span>
                                                <span>Award Bonus Points</span>
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <span className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-purple-700 shadow-sm border border-purple-200">
                                                    {team.admin_bonuses.length} {team.admin_bonuses.length === 1 ? 'Award' : 'Awards'}
                                                </span>
                                                <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-bold shadow-lg">
                                                    +{team.admin_bonuses.reduce((sum, b) => sum + b.points, 0)} pts
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bonus Cards Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                            {team.admin_bonuses.map((bonus, idx) => {
                                                // Parse award type from reason (e.g., "TOD - Legends - Round 22")
                                                const reasonParts = bonus.reason.split(' - ');
                                                const awardType = reasonParts[0] || '';
                                                const awardTarget = reasonParts[1] || '';
                                                const awardRound = reasonParts[2] || '';
                                                
                                                // Determine award icon and color
                                                let awardIcon = '🏆';
                                                let gradientClass = 'from-purple-500 to-pink-500';
                                                let bgClass = 'from-purple-50 to-pink-50';
                                                
                                                if (awardType.includes('TOD')) {
                                                    awardIcon = '🏆';
                                                    gradientClass = 'from-blue-500 to-cyan-500';
                                                    bgClass = 'from-blue-50 to-cyan-50';
                                                } else if (awardType.includes('TOW')) {
                                                    awardIcon = '👑';
                                                    gradientClass = 'from-yellow-500 to-orange-500';
                                                    bgClass = 'from-yellow-50 to-orange-50';
                                                } else if (awardType.includes('POTD')) {
                                                    awardIcon = '⚽';
                                                    gradientClass = 'from-green-500 to-emerald-500';
                                                    bgClass = 'from-green-50 to-emerald-50';
                                                } else if (awardType.includes('POTW')) {
                                                    awardIcon = '⭐';
                                                    gradientClass = 'from-indigo-500 to-purple-500';
                                                    bgClass = 'from-indigo-50 to-purple-50';
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`relative bg-gradient-to-br ${bgClass} rounded-xl p-4 border-2 border-white/60 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden group`}
                                                    >
                                                        {/* Decorative background pattern */}
                                                        <div className="absolute inset-0 opacity-5">
                                                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white to-transparent rounded-full -mr-10 -mt-10"></div>
                                                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-white to-transparent rounded-full -ml-8 -mb-8"></div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="relative z-10">
                                                            {/* Header with icon and points */}
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-2xl shadow-lg transform group-hover:rotate-12 transition-transform duration-300`}>
                                                                    {awardIcon}
                                                                </div>
                                                                <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${gradientClass} text-white font-bold text-sm shadow-md`}>
                                                                    +{bonus.points}
                                                                </div>
                                                            </div>

                                                            {/* Award Type Badge */}
                                                            <div className="mb-2">
                                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${gradientClass} text-white shadow-sm`}>
                                                                    {awardType}
                                                                </span>
                                                            </div>

                                                            {/* Award Details */}
                                                            <div className="space-y-1.5">
                                                                {awardTarget && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium text-gray-500">
                                                                            {bonus.type === 'player' ? '⚽' : '🏆'}
                                                                        </span>
                                                                        <span className="text-sm font-bold text-gray-900 truncate">
                                                                            {awardTarget}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {awardRound && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium text-gray-500">📅</span>
                                                                        <span className="text-xs font-semibold text-gray-700">
                                                                            {awardRound}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2 pt-1">
                                                                    <span className="text-xs font-medium text-gray-500">🕐</span>
                                                                    <span className="text-xs text-gray-600">
                                                                        {new Date(bonus.awarded_at).toLocaleDateString('en-US', {
                                                                            month: 'short',
                                                                            day: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Hover effect overlay */}
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Summary Card */}
                                        <div className="mt-6 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl p-4 sm:p-6 shadow-xl">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl">
                                                        🎯
                                                    </div>
                                                    <div className="text-center sm:text-left">
                                                        <p className="text-white/90 text-xs sm:text-sm font-medium">Total Award Bonuses</p>
                                                        <p className="text-white text-2xl sm:text-3xl font-bold">
                                                            +{team.admin_bonuses.reduce((sum, b) => sum + b.points, 0)} pts
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                                                    {['TOD', 'TOW', 'POTD', 'POTW'].map(type => {
                                                        const count = team.admin_bonuses.filter(b => b.reason.includes(type)).length;
                                                        if (count === 0) return null;
                                                        return (
                                                            <div key={type} className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                                                                <span className="text-white text-xs font-bold">
                                                                    {type}: {count}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
