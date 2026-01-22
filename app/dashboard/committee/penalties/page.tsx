'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TeamStats {
    team_id: string;
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    points_deducted: number;
}

interface Tournament {
    id: string;
    tournament_name: string;
    season_id: string;
    status: string;
}

interface Penalty {
    id: number;
    team_id: string;
    tournament_id: string;
    points_deducted: number;
    ecoin_fine: number;
    sscoin_fine: number;
    reason: string;
    applied_by: string;
    applied_at: string;
    removed_at: string | null;
    removed_by: string | null;
}

export default function TournamentPenaltiesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<string>('');
    const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Penalty form state
    const [penaltyPoints, setPenaltyPoints] = useState(1);
    const [ecoinFine, setEcoinFine] = useState(0);
    const [sscoinFine, setSscoinFine] = useState(0);
    const [penaltyReason, setPenaltyReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Penalty history
    const [penalties, setPenalties] = useState<Penalty[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Calculator state
    const [calculatorPercentage, setCalculatorPercentage] = useState(20);
    const [selectedTeamForCalc, setSelectedTeamForCalc] = useState<{ ecoin: number; sscoin: number } | null>(null);

    // WhatsApp message state
    const [whatsappMessage, setWhatsappMessage] = useState<string>('');

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchTournaments();
        }
    }, [user]);

    useEffect(() => {
        if (selectedTournament) {
            fetchTeamStats();
        }
    }, [selectedTournament]);

    const fetchTournaments = async () => {
        try {
            const response = await fetchWithTokenRefresh('/api/tournaments?status=active');
            const data = await response.json();
            if (data.success && data.tournaments.length > 0) {
                setTournaments(data.tournaments);
                setSelectedTournament(data.tournaments[0].id);
            }
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            setError('Failed to load tournaments');
        }
    };

    const fetchTeamStats = async () => {
        if (!selectedTournament) return;

        setIsLoading(true);
        setError('');
        try {
            const response = await fetchWithTokenRefresh(
                `/api/teamstats?tournament_id=${selectedTournament}`
            );
            const data = await response.json();
            if (data.success) {
                const sorted = data.teamStats.sort((a: TeamStats, b: TeamStats) => {
                    const aAdjusted = a.points - (a.points_deducted || 0);
                    const bAdjusted = b.points - (b.points_deducted || 0);
                    if (bAdjusted !== aAdjusted) return bAdjusted - aAdjusted;
                    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
                    return b.goals_for - a.goals_for;
                });
                setTeamStats(sorted);
            } else {
                setError('Failed to load team stats');
            }
        } catch (error) {
            console.error('Error fetching team stats:', error);
            setError('Failed to load team stats');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPenaltyHistory = async (teamId: string) => {
        setLoadingHistory(true);
        try {
            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${selectedTournament}/penalties?team_id=${teamId}`
            );
            const data = await response.json();
            if (data.success) {
                setPenalties(data.penalties || []);
            }
        } catch (error) {
            console.error('Error fetching penalty history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const togglePenaltyForm = (teamId: string) => {
        if (expandedTeam === teamId) {
            setExpandedTeam(null);
            resetForm();
        } else {
            setExpandedTeam(teamId);
            setShowHistory(false);
            resetForm();
        }
    };

    const toggleHistory = (teamId: string) => {
        if (expandedTeam === teamId && showHistory) {
            setExpandedTeam(null);
            setShowHistory(false);
        } else {
            setExpandedTeam(teamId);
            setShowHistory(true);
            fetchPenaltyHistory(teamId);
        }
    };

    const resetForm = () => {
        setPenaltyPoints(1);
        setEcoinFine(0);
        setSscoinFine(0);
        setPenaltyReason('');
        setSuccess('');
        setWhatsappMessage('');
    };

    const handleSubmitPenalty = async (team: TeamStats) => {
        if (!user || !selectedTournament) return;

        if (penaltyReason.trim().length < 10) {
            setError('Reason must be at least 10 characters');
            return;
        }

        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const selectedTournamentData = tournaments.find(t => t.id === selectedTournament);

            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${selectedTournament}/penalties`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        team_id: team.team_id,
                        team_name: team.team_name,
                        season_id: selectedTournamentData?.season_id,
                        points_deducted: penaltyPoints,
                        ecoin_fine: ecoinFine,
                        sscoin_fine: sscoinFine,
                        reason: penaltyReason,
                        applied_by_id: user.uid,
                        applied_by_name: user.email || 'Admin',
                    }),
                }
            );

            const data = await response.json();
            if (data.success) {
                setSuccess(`✅ Penalty applied to ${team.team_name}`);
                setWhatsappMessage(data.whatsapp_message || '');
                fetchTeamStats();
                // Don't auto-close so user can copy the WhatsApp message
                // setTimeout(() => {
                //     setExpandedTeam(null);
                //     resetForm();
                // }, 2000);
            } else {
                setError(data.error || 'Failed to apply penalty');
            }
        } catch (error) {
            console.error('Error applying penalty:', error);
            setError('Failed to apply penalty');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemovePenalty = async (penaltyId: number, teamId: string) => {
        if (!user || !confirm('Remove this penalty?')) return;

        try {
            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${selectedTournament}/penalties/${penaltyId}`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        removed_by: user.uid,
                    }),
                }
            );

            const data = await response.json();
            if (data.success) {
                setSuccess('✅ Penalty removed');
                fetchTeamStats();
                fetchPenaltyHistory(teamId);
            } else {
                setError(data.error || 'Failed to remove penalty');
            }
        } catch (error) {
            console.error('Error removing penalty:', error);
            setError('Failed to remove penalty');
        }
    };

    const selectedTournamentData = tournaments.find(t => t.id === selectedTournament);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                                <span className="text-4xl">⚠️</span>
                                Tournament Penalties Management
                            </h1>
                            <p className="text-gray-600">Apply and manage point deductions for teams</p>
                        </div>
                        <div className="bg-gradient-to-r from-red-100 to-orange-100 rounded-xl p-4 border-2 border-red-200">
                            <p className="text-sm text-red-800 font-semibold">Committee Admin Only</p>
                        </div>
                    </div>
                </div>

                {/* Tournament Selector */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Select Tournament
                    </label>
                    <select
                        value={selectedTournament}
                        onChange={(e) => setSelectedTournament(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium"
                    >
                        {tournaments.map((tournament) => (
                            <option key={tournament.id} value={tournament.id}>
                                {tournament.tournament_name} ({tournament.status})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Messages */}
                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-2 text-red-800">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{error}</span>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-2 text-green-800">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{success}</span>
                        </div>
                    </div>
                )}

                {/* WhatsApp Message */}
                {whatsappMessage && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                                📱 WhatsApp Message
                            </h3>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(whatsappMessage);
                                    alert('WhatsApp message copied to clipboard!');
                                }}
                                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                📋 Copy Message
                            </button>
                        </div>
                        <div className="bg-white border-2 border-green-200 rounded-lg p-4">
                            <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800">
                                {whatsappMessage}
                            </pre>
                        </div>
                        <p className="text-xs text-green-700 mt-3">
                            💡 Copy this message and send it to the team owner via WhatsApp
                        </p>
                    </div>
                )}

                {/* Standings Table */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Tournament Standings & Penalties
                        </h2>
                        {selectedTournamentData && (
                            <p className="text-sm text-blue-100 mt-1">
                                {selectedTournamentData.tournament_name}
                            </p>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                    ) : teamStats.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-lg">No teams found for this tournament</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Pos</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Team</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">P</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">W</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">D</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">L</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">GF</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">GA</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">GD</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Pts</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-red-700 uppercase tracking-wider">Penalties</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Adj Pts</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {teamStats.map((team, index) => {
                                        const adjustedPoints = team.points - (team.points_deducted || 0);
                                        const isExpanded = expandedTeam === team.team_id;

                                        return (
                                            <React.Fragment key={team.team_id}>
                                                <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-sm">
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-gray-900">{team.team_name}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">{team.played}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-semibold">{team.won}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{team.drawn}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600 font-semibold">{team.lost}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">{team.goals_for}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">{team.goals_against}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold">
                                                        <span className={team.goal_difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            {team.goal_difference >= 0 ? '+' : ''}{team.goal_difference}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                                                            {team.points}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {team.points_deducted > 0 ? (
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800 border border-red-300">
                                                                -{team.points_deducted}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
                                                            {adjustedPoints}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => togglePenaltyForm(team.team_id)}
                                                                disabled={authLoading || !user}
                                                                className={`px-4 py-2 text-white text-xs rounded-lg hover:shadow-lg transition-all font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${isExpanded && !showHistory
                                                                    ? 'bg-gradient-to-r from-gray-600 to-gray-700'
                                                                    : 'bg-gradient-to-r from-red-600 to-orange-600'
                                                                    }`}
                                                            >
                                                                <span>{isExpanded && !showHistory ? '✕' : '⚠️'}</span>
                                                                {isExpanded && !showHistory ? 'Cancel' : 'Penalty'}
                                                            </button>
                                                            {team.points_deducted > 0 && (
                                                                <button
                                                                    onClick={() => toggleHistory(team.team_id)}
                                                                    className={`px-4 py-2 text-white text-xs rounded-lg hover:shadow-lg transition-all font-semibold inline-flex items-center gap-1.5 ${isExpanded && showHistory
                                                                        ? 'bg-gradient-to-r from-gray-600 to-gray-700'
                                                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                                                                        }`}
                                                                >
                                                                    <span>{isExpanded && showHistory ? '✕' : '📋'}</span>
                                                                    {isExpanded && showHistory ? 'Close' : 'History'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Penalty Form or History */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={13} className="px-0 py-0">
                                                            <div className="bg-gradient-to-br from-gray-50 to-blue-50 border-t-4 border-blue-500 p-8">
                                                                {!showHistory ? (
                                                                    /* Apply Penalty Form */
                                                                    <div className="max-w-4xl mx-auto">
                                                                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                                                            <span className="text-3xl">⚠️</span>
                                                                            Apply Penalty to {team.team_name}
                                                                        </h3>

                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                                                            <div>
                                                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                                    Points to Deduct *
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    max="50"
                                                                                    value={penaltyPoints}
                                                                                    onChange={(e) => setPenaltyPoints(parseInt(e.target.value) || 1)}
                                                                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-lg font-semibold"
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                                    ECoin Fine (Optional)
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="10000"
                                                                                    step="0.01"
                                                                                    value={ecoinFine}
                                                                                    onChange={(e) => setEcoinFine(parseFloat(e.target.value) || 0)}
                                                                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                                                                                    placeholder="0.00"
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                                    SSCoin Fine (Optional)
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="10000"
                                                                                    step="0.01"
                                                                                    value={sscoinFine}
                                                                                    onChange={(e) => setSscoinFine(parseFloat(e.target.value) || 0)}
                                                                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-lg"
                                                                                    placeholder="0.00"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="mb-6">
                                                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                                Reason * (min 10 characters)
                                                                            </label>
                                                                            <textarea
                                                                                value={penaltyReason}
                                                                                onChange={(e) => setPenaltyReason(e.target.value)}
                                                                                rows={4}
                                                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
                                                                                placeholder="Enter reason for penalty (e.g., Late lineup submission, Misconduct, etc.)"
                                                                            />
                                                                            <p className="text-sm text-gray-500 mt-1">
                                                                                {penaltyReason.length}/10 characters minimum
                                                                            </p>
                                                                        </div>

                                                                        {/* Percentage Calculator */}
                                                                        <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6">
                                                                            <h4 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                                                                🧮 Fine Calculator
                                                                            </h4>

                                                                            <div className="mb-4">
                                                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                                    Percentage of Total Balance
                                                                                </label>
                                                                                <div className="flex items-center gap-4">
                                                                                    <input
                                                                                        type="range"
                                                                                        min="1"
                                                                                        max="100"
                                                                                        value={calculatorPercentage}
                                                                                        onChange={(e) => setCalculatorPercentage(parseInt(e.target.value))}
                                                                                        className="flex-1 h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                                                        style={{
                                                                                            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${calculatorPercentage}%, #e0e7ff ${calculatorPercentage}%, #e0e7ff 100%)`
                                                                                        }}
                                                                                    />
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            max="100"
                                                                                            value={calculatorPercentage}
                                                                                            onChange={(e) => setCalculatorPercentage(parseInt(e.target.value) || 1)}
                                                                                            className="w-20 px-3 py-2 border-2 border-indigo-300 rounded-lg text-center font-bold text-indigo-900"
                                                                                        />
                                                                                        <span className="text-indigo-900 font-bold">%</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        const response = await fetchWithTokenRefresh(
                                                                                            `/api/teams/${team.team_id}/balance?season_id=${tournaments.find(t => t.id === selectedTournament)?.season_id}`
                                                                                        );
                                                                                        const data = await response.json();
                                                                                        if (data.success && data.data) {
                                                                                            const ecoin = data.data.football_budget || 0;
                                                                                            const sscoin = data.data.real_player_budget || 0;
                                                                                            setSelectedTeamForCalc({ ecoin, sscoin });
                                                                                        }
                                                                                    } catch (error) {
                                                                                        console.error('Error fetching balance:', error);
                                                                                    }
                                                                                }}
                                                                                className="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all mb-4"
                                                                            >
                                                                                📊 Fetch {team.team_name} Balance
                                                                            </button>

                                                                            {selectedTeamForCalc && (
                                                                                <div className="space-y-4">
                                                                                    <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
                                                                                        <h5 className="text-sm font-semibold text-gray-700 mb-3">Current Balance:</h5>
                                                                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                                                                            <div>
                                                                                                <p className="text-xs text-gray-600">ECoin</p>
                                                                                                <p className="text-lg font-bold text-blue-600">{selectedTeamForCalc.ecoin.toLocaleString()}</p>
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-xs text-gray-600">SSCoin</p>
                                                                                                <p className="text-lg font-bold text-purple-600">{selectedTeamForCalc.sscoin.toLocaleString()}</p>
                                                                                            </div>
                                                                                        </div>

                                                                                        <h5 className="text-sm font-semibold text-gray-700 mb-3">
                                                                                            {calculatorPercentage}% Fine:
                                                                                        </h5>
                                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                            <div className="bg-blue-50 rounded-lg p-3">
                                                                                                <p className="text-xs text-blue-700 mb-1">ECoin Fine</p>
                                                                                                <p className="text-xl font-bold text-blue-900">
                                                                                                    {((selectedTeamForCalc.ecoin * calculatorPercentage) / 100).toFixed(2)}
                                                                                                </p>
                                                                                                <button
                                                                                                    onClick={() => setEcoinFine(parseFloat(((selectedTeamForCalc.ecoin * calculatorPercentage) / 100).toFixed(2)))}
                                                                                                    className="mt-2 w-full px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                                                                                >
                                                                                                    Use This Amount
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="bg-purple-50 rounded-lg p-3">
                                                                                                <p className="text-xs text-purple-700 mb-1">SSCoin Fine</p>
                                                                                                <p className="text-xl font-bold text-purple-900">
                                                                                                    {((selectedTeamForCalc.sscoin * calculatorPercentage) / 100).toFixed(2)}
                                                                                                </p>
                                                                                                <button
                                                                                                    onClick={() => setSscoinFine(parseFloat(((selectedTeamForCalc.sscoin * calculatorPercentage) / 100).toFixed(2)))}
                                                                                                    className="mt-2 w-full px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                                                                                >
                                                                                                    Use This Amount
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {(penaltyPoints > 0 || ecoinFine > 0 || sscoinFine > 0) && penaltyReason.length >= 10 && (
                                                                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mb-6">
                                                                                <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Warning: This will apply the following penalties:</p>
                                                                                <ul className="text-sm text-yellow-800 space-y-1">
                                                                                    <li>• <strong>{penaltyPoints}</strong> points deducted from standings</li>
                                                                                    {ecoinFine > 0 && <li>• <strong>{ecoinFine}</strong> ECoin fine</li>}
                                                                                    {sscoinFine > 0 && <li>• <strong>{sscoinFine}</strong> SSCoin fine</li>}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex gap-4">
                                                                            <button
                                                                                onClick={() => handleSubmitPenalty(team)}
                                                                                disabled={isSubmitting || penaltyReason.length < 10}
                                                                                className="flex-1 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white text-lg font-bold rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            >
                                                                                {isSubmitting ? 'Applying...' : '⚠️ Apply Penalty'}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => togglePenaltyForm(team.team_id)}
                                                                                disabled={isSubmitting}
                                                                                className="px-6 py-4 bg-gray-200 text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-300 transition-all disabled:opacity-50"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* Penalty History */
                                                                    <div className="max-w-4xl mx-auto">
                                                                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                                                            <span className="text-3xl">📋</span>
                                                                            Penalty History for {team.team_name}
                                                                        </h3>

                                                                        {loadingHistory ? (
                                                                            <div className="text-center py-8">
                                                                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                                                                            </div>
                                                                        ) : penalties.length === 0 ? (
                                                                            <div className="text-center py-8 text-gray-500">
                                                                                <p className="text-lg">No penalties found for this team</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-4">
                                                                                {/* Active Penalties */}
                                                                                {penalties.filter(p => !p.removed_at).length > 0 && (
                                                                                    <div>
                                                                                        <h4 className="text-lg font-bold text-red-700 mb-3">Active Penalties</h4>
                                                                                        <div className="space-y-3">
                                                                                            {penalties.filter(p => !p.removed_at).map((penalty) => (
                                                                                                <div key={penalty.id} className="bg-white border-2 border-red-200 rounded-xl p-4">
                                                                                                    <div className="flex items-start justify-between">
                                                                                                        <div className="flex-1">
                                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800">
                                                                                                                    -{penalty.points_deducted} points
                                                                                                                </span>
                                                                                                                {penalty.ecoin_fine > 0 && (
                                                                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                                                                                                                        {penalty.ecoin_fine} ECoin
                                                                                                                    </span>
                                                                                                                )}
                                                                                                                {penalty.sscoin_fine > 0 && (
                                                                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                                                                                                                        {penalty.sscoin_fine} SSCoin
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <p className="text-sm text-gray-700 mb-1"><strong>Reason:</strong> {penalty.reason}</p>
                                                                                                            <p className="text-xs text-gray-500">
                                                                                                                Applied on {new Date(penalty.applied_at).toLocaleDateString()} by {penalty.applied_by}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                        <button
                                                                                                            onClick={() => handleRemovePenalty(penalty.id, team.team_id)}
                                                                                                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-all"
                                                                                                        >
                                                                                                            Remove
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Removed Penalties */}
                                                                                {penalties.filter(p => p.removed_at).length > 0 && (
                                                                                    <div>
                                                                                        <h4 className="text-lg font-bold text-gray-700 mb-3">Removed Penalties</h4>
                                                                                        <div className="space-y-3">
                                                                                            {penalties.filter(p => p.removed_at).map((penalty) => (
                                                                                                <div key={penalty.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 opacity-60">
                                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-600">
                                                                                                            -{penalty.points_deducted} points
                                                                                                        </span>
                                                                                                        {penalty.ecoin_fine > 0 && (
                                                                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-50 text-blue-600">
                                                                                                                {penalty.ecoin_fine} ECoin
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {penalty.sscoin_fine > 0 && (
                                                                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-50 text-purple-600">
                                                                                                                {penalty.sscoin_fine} SSCoin
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <p className="text-sm text-gray-600 mb-1"><strong>Reason:</strong> {penalty.reason}</p>
                                                                                                    <p className="text-xs text-gray-500">
                                                                                                        Removed on {new Date(penalty.removed_at!).toLocaleDateString()} by {penalty.removed_by}
                                                                                                    </p>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
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
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="text-sm font-bold text-blue-900 mb-2">How Penalties Work</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• <strong>Apply Penalty:</strong> Click the "Penalty" button to expand the form inline</li>
                                <li>• <strong>Adjusted Points:</strong> Teams are ranked by their adjusted points (Points - Penalties)</li>
                                <li>• <strong>View History:</strong> Click "History" to see all penalties applied to a team</li>
                                <li>• <strong>Remove Penalty:</strong> Reverse a penalty if an appeal is successful</li>
                                <li>• <strong>Audit Trail:</strong> All actions are logged with who applied/removed and when</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
