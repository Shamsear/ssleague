'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SupportedTeam {
    id: string;
    name: string;
}

interface ChangeStatus {
    can_change: boolean;
    current_supported_team: SupportedTeam;
    active_window: {
        window_id: string;
        window_name: string;
        closes_at: string;
    } | null;
    has_changed: boolean;
    previous_change: {
        old_team: string;
        new_team: string;
        changed_at: string;
    } | null;
}

interface RealTeam {
    team_id: string;
    team_name: string;
}

export default function SupportedTeamChanger() {
    const { user } = useAuth();
    const [status, setStatus] = useState<ChangeStatus | null>(null);
    const [realTeams, setRealTeams] = useState<RealTeam[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (user?.uid) {
            fetchStatus();
            fetchRealTeams();
        }
    }, [user]);

    const fetchStatus = async () => {
        try {
            const response = await fetch(`/api/fantasy/supported-team/change?user_id=${user?.uid}`);
            const data = await response.json();

            if (response.ok) {
                setStatus(data);
            } else {
                setError(data.error || 'Failed to fetch status');
            }
        } catch (err) {
            setError('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    const fetchRealTeams = async () => {
        try {
            // First get the user's fantasy team to find the league
            const teamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user?.uid}`);
            if (!teamResponse.ok) {
                console.error('Failed to fetch fantasy team');
                return;
            }

            const teamData = await teamResponse.json();
            const leagueId = teamData.team?.fantasy_league_id;

            if (!leagueId) {
                console.error('No league ID found');
                return;
            }

            // Get the league settings to find its season
            const settingsResponse = await fetch(`/api/fantasy/draft/settings?league_id=${leagueId}`);
            if (!settingsResponse.ok) {
                console.error('Failed to fetch league settings');
                return;
            }

            const settingsData = await settingsResponse.json();
            const seasonId = settingsData.settings?.season_id;

            if (!seasonId) {
                console.error('No season ID found');
                return;
            }

            // Fetch registered teams from that specific season
            const teamsResponse = await fetch(`/api/teams/registered?season_id=${seasonId}`);
            if (!teamsResponse.ok) {
                console.error('Failed to fetch season teams');
                return;
            }

            const teamsData = await teamsResponse.json();
            setRealTeams(teamsData.teams || []);
        } catch (err) {
            console.error('Failed to fetch teams:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTeam) {
            setError('Please select a team');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const selectedTeamData = realTeams.find(t => t.team_id === selectedTeam);

            const response = await fetch('/api/fantasy/supported-team/change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.uid,
                    new_supported_team_id: selectedTeam,
                    new_supported_team_name: selectedTeamData?.team_name,
                    reason,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully changed supported team to ${data.change.new_team}!`);
                setSelectedTeam('');
                setReason('');
                // Refresh status
                await fetchStatus();
            } else {
                setError(data.error || 'Failed to change supported team');
            }
        } catch (err) {
            setError('Failed to change supported team');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!status?.active_window) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    No Active Window
                </h3>
                <p className="text-yellow-700">
                    There is currently no active window for changing your supported team.
                    Please check back later or contact the league administrator.
                </p>
                {status?.current_supported_team && (
                    <div className="mt-4 pt-4 border-t border-yellow-200">
                        <p className="text-sm text-yellow-700">
                            <strong>Current Supported Team:</strong> {status.current_supported_team.name || 'None'}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    if (status.has_changed) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                    ✅ Supported Team Changed
                </h3>
                <p className="text-green-700 mb-4">
                    You have already changed your supported team during this window.
                </p>
                {status.previous_change && (
                    <div className="bg-white rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Previous Team:</span>
                            <span className="font-medium">{status.previous_change.old_team}</span>
                        </div>
                        <div className="flex items-center justify-center text-gray-400">
                            ↓
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">New Team:</span>
                            <span className="font-medium text-green-600">{status.previous_change.new_team}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                            <span className="text-xs text-gray-500">
                                Changed on {new Date(status.previous_change.changed_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Change Supported Team
                </h3>
                <p className="text-sm text-gray-600">
                    Window: <strong>{status.active_window.window_name}</strong>
                </p>
                <p className="text-sm text-gray-600">
                    Closes: <strong>{new Date(status.active_window.closes_at).toLocaleString()}</strong>
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    <strong>Current Supported Team:</strong> {status.current_supported_team.name || 'None'}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                    This change is <strong>FREE</strong> and can only be done <strong>once</strong> during this window.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800">{success}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="team" className="block text-sm font-medium text-gray-700 mb-2">
                        Select New Supported Team *
                    </label>
                    <select
                        id="team"
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        disabled={submitting}
                    >
                        <option value="">-- Select a team --</option>
                        {realTeams.map((team) => (
                            <option
                                key={team.team_id}
                                value={team.team_id}
                                disabled={team.team_id === status.current_supported_team.id}
                            >
                                {team.team_name}
                                {team.team_id === status.current_supported_team.id ? ' (Current)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                        Reason (Optional)
                    </label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Why are you changing your supported team?"
                        disabled={submitting}
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting || !selectedTeam}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                    {submitting ? 'Changing...' : 'Change Supported Team'}
                </button>
            </form>
        </div>
    );
}
