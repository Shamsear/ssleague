'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerRoundPoints {
    player_id: string;
    player_name: string;
    round: number;
    points: number;
    status: 'active' | 'released' | 'swapped';
    release_round?: number;
}

interface TeamBreakdown {
    team_id: string;
    team_name: string;
    owner_name: string;
    players: {
        player_id: string;
        player_name: string;
        rounds: {
            round: number;
            active_points: number;
            passive_points: number;
            total_points: number;
            status: string;
        }[];
        total_active: number;
        total_passive: number;
        total_points: number;
        release_round?: number;
    }[];
    round_totals: {
        round: number;
        active_points: number;
        passive_points: number;
        total_points: number;
    }[];
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

    const exportToExcel = async () => {
        try {
            const XLSX = await import('xlsx');

            const selectedTeams = selectedTeam === 'all'
                ? teams
                : teams.filter(t => t.team_id === selectedTeam);

            const workbook = XLSX.utils.book_new();

            selectedTeams.forEach(team => {
                const exportData: any[] = [];

                // Header row
                const headerRow = ['Player Name', 'Status'];
                for (let i = 1; i <= maxRounds; i++) {
                    headerRow.push(`R${i} Active`, `R${i} Passive`, `R${i} Total`);
                }
                headerRow.push('Total Active', 'Total Passive', 'Grand Total');
                exportData.push(headerRow);

                // Player rows
                team.players.forEach(player => {
                    const row = [
                        player.player_name,
                        player.release_round ? `Released R${player.release_round}` : 'Active'
                    ];

                    for (let i = 1; i <= maxRounds; i++) {
                        const roundData = player.rounds.find(r => r.round === i);
                        if (roundData) {
                            row.push(
                                roundData.active_points,
                                roundData.passive_points,
                                roundData.total_points
                            );
                        } else {
                            row.push('-', '-', '-');
                        }
                    }

                    row.push(player.total_active, player.total_passive, player.total_points);
                    exportData.push(row);
                });

                // Team totals row
                const totalRow = ['TEAM TOTAL', ''];
                for (let i = 1; i <= maxRounds; i++) {
                    const roundTotal = team.round_totals.find(r => r.round === i);
                    if (roundTotal) {
                        totalRow.push(
                            roundTotal.active_points,
                            roundTotal.passive_points,
                            roundTotal.total_points
                        );
                    } else {
                        totalRow.push(0, 0, 0);
                    }
                }
                totalRow.push(team.grand_total_active, team.grand_total_passive, team.grand_total);
                exportData.push(totalRow);

                const worksheet = XLSX.utils.aoa_to_sheet(exportData);

                // Set column widths
                const colWidths = [{ wch: 20 }, { wch: 15 }];
                for (let i = 0; i < maxRounds * 3; i++) {
                    colWidths.push({ wch: 10 });
                }
                colWidths.push({ wch: 12 }, { wch: 12 }, { wch: 12 });
                worksheet['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(workbook, worksheet, team.team_name.substring(0, 31));
            });

            const fileName = selectedTeam === 'all'
                ? `fantasy_points_all_teams_${new Date().toISOString().split('T')[0]}.xlsx`
                : `fantasy_points_${selectedTeams[0]?.team_name}_${new Date().toISOString().split('T')[0]}.xlsx`;

            XLSX.writeFile(workbook, fileName);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export to Excel');
        }
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
                    <p className="text-gray-600">Round-by-round points for all players including released/swapped players</p>
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

                        <button
                            onClick={exportToExcel}
                            disabled={filteredTeams.length === 0}
                            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Teams Breakdown */}
                {filteredTeams.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <p className="text-gray-500 text-lg">No fantasy teams found</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredTeams.map(team => (
                            <div key={team.team_id} className="bg-white rounded-xl shadow-xl overflow-hidden">
                                {/* Team Header */}
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sm:p-6">
                                    <h2 className="text-xl sm:text-2xl font-bold mb-1">{team.team_name}</h2>
                                    <p className="text-blue-100 text-sm">Owner: {team.owner_name}</p>
                                    <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-blue-200">Active Points</p>
                                            <p className="text-2xl font-bold">{team.grand_total_active}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-200">Passive Points</p>
                                            <p className="text-2xl font-bold">{team.grand_total_passive}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-200">Total Points</p>
                                            <p className="text-2xl font-bold">{team.grand_total}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Points Table */}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                                    Player
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                                {Array.from({ length: maxRounds }, (_, i) => i + 1).map(round => (
                                                    <th key={round} className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase" colSpan={3}>
                                                        R{round}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-blue-50" colSpan={3}>
                                                    Total
                                                </th>
                                            </tr>
                                            <tr className="bg-gray-100">
                                                <th className="sticky left-0 z-10 bg-gray-100"></th>
                                                <th></th>
                                                {Array.from({ length: maxRounds }, (_, i) => (
                                                    <React.Fragment key={i}>
                                                        <th className="px-1 py-2 text-xs text-gray-600">Act</th>
                                                        <th className="px-1 py-2 text-xs text-gray-600">Pas</th>
                                                        <th className="px-1 py-2 text-xs text-gray-600">Tot</th>
                                                    </React.Fragment>
                                                ))}
                                                <th className="px-1 py-2 text-xs text-gray-600 bg-blue-50">Act</th>
                                                <th className="px-1 py-2 text-xs text-gray-600 bg-blue-50">Pas</th>
                                                <th className="px-1 py-2 text-xs text-gray-600 bg-blue-50">Tot</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {team.players.map((player, idx) => (
                                                <tr key={player.player_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="sticky left-0 z-10 px-4 py-3 text-sm font-semibold text-gray-900 bg-inherit">
                                                        {player.player_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {player.release_round ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                                Released R{player.release_round}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    {Array.from({ length: maxRounds }, (_, i) => i + 1).map(round => {
                                                        const roundData = player.rounds.find(r => r.round === round);
                                                        const isInactive = player.release_round && round >= player.release_round;

                                                        return (
                                                            <React.Fragment key={round}>
                                                                <td className={`px-1 py-3 text-center text-xs ${isInactive ? 'bg-gray-100 text-gray-400' : ''}`}>
                                                                    {roundData ? roundData.active_points : '-'}
                                                                </td>
                                                                <td className={`px-1 py-3 text-center text-xs ${isInactive ? 'bg-gray-100 text-gray-400' : ''}`}>
                                                                    {roundData ? roundData.passive_points : '-'}
                                                                </td>
                                                                <td className={`px-1 py-3 text-center text-xs font-semibold ${isInactive ? 'bg-gray-100 text-gray-400' : ''}`}>
                                                                    {roundData ? roundData.total_points : '-'}
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <td className="px-1 py-3 text-center text-sm font-bold bg-blue-50">{player.total_active}</td>
                                                    <td className="px-1 py-3 text-center text-sm font-bold bg-blue-50">{player.total_passive}</td>
                                                    <td className="px-1 py-3 text-center text-sm font-bold bg-blue-100 text-blue-700">{player.total_points}</td>
                                                </tr>
                                            ))}

                                            {/* Team Total Row */}
                                            <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold">
                                                <td className="sticky left-0 z-10 px-4 py-3 text-sm text-blue-900 bg-inherit">TEAM TOTAL</td>
                                                <td></td>
                                                {Array.from({ length: maxRounds }, (_, i) => i + 1).map(round => {
                                                    const roundTotal = team.round_totals.find(r => r.round === round);
                                                    return (
                                                        <React.Fragment key={round}>
                                                            <td className="px-1 py-3 text-center text-xs text-blue-900">
                                                                {roundTotal?.active_points || 0}
                                                            </td>
                                                            <td className="px-1 py-3 text-center text-xs text-blue-900">
                                                                {roundTotal?.passive_points || 0}
                                                            </td>
                                                            <td className="px-1 py-3 text-center text-xs text-blue-900">
                                                                {roundTotal?.total_points || 0}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <td className="px-1 py-3 text-center text-sm bg-blue-200 text-blue-900">{team.grand_total_active}</td>
                                                <td className="px-1 py-3 text-center text-sm bg-blue-200 text-blue-900">{team.grand_total_passive}</td>
                                                <td className="px-1 py-3 text-center text-sm bg-blue-300 text-blue-900">{team.grand_total}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Legend */}
                <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
                    <h3 className="font-bold text-gray-900 mb-3">Legend:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">Act:</span>
                            <span className="text-gray-600">Active Points (player performance)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">Pas:</span>
                            <span className="text-gray-600">Passive Points (team bonuses)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">Tot:</span>
                            <span className="text-gray-600">Total Points (Act + Pas)</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        * Released/swapped players show grayed out cells for rounds after their release
                    </p>
                </div>
            </div>
        </div>
    );
}
