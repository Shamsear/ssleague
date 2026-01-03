'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Window {
    window_id: string;
    window_name: string;
    opens_at: string;
    closes_at: string;
    is_active: boolean;
    changes_made: number;
    total_teams: number;
}

export default function SupportedTeamWindowManager({ leagueId }: { leagueId: string }) {
    const { user } = useAuth();
    const [windows, setWindows] = useState<Window[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({
        window_name: '',
        opens_at: '',
        closes_at: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchWindows();
    }, [leagueId]);

    const fetchWindows = async () => {
        try {
            const response = await fetch(`/api/fantasy/admin/supported-team-window?league_id=${leagueId}`);
            const data = await response.json();

            if (response.ok) {
                setWindows(data.windows || []);
            } else {
                setError(data.error || 'Failed to fetch windows');
            }
        } catch (err) {
            setError('Failed to fetch windows');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/fantasy/admin/supported-team-window', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_uid: user?.uid,
                    league_id: leagueId,
                    ...formData,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Window created successfully!');
                setFormData({ window_name: '', opens_at: '', closes_at: '' });
                setShowCreateForm(false);
                await fetchWindows();
            } else {
                setError(data.error || 'Failed to create window');
            }
        } catch (err) {
            setError('Failed to create window');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = async (windowId: string) => {
        if (!confirm('Are you sure you want to close this window? Teams will no longer be able to change their supported team.')) {
            return;
        }

        try {
            const response = await fetch('/api/fantasy/admin/supported-team-window', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_uid: user?.uid,
                    window_id: windowId,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Window closed successfully!');
                await fetchWindows();
            } else {
                setError(data.error || 'Failed to close window');
            }
        } catch (err) {
            setError('Failed to close window');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                    Supported Team Change Windows
                </h2>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                    {showCreateForm ? 'Cancel' : '+ Create Window'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">{success}</p>
                </div>
            )}

            {showCreateForm && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Create New Window
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label htmlFor="window_name" className="block text-sm font-medium text-gray-700 mb-2">
                                Window Name *
                            </label>
                            <input
                                type="text"
                                id="window_name"
                                value={formData.window_name}
                                onChange={(e) => setFormData({ ...formData, window_name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., Mid-Season Team Change"
                                required
                                disabled={submitting}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="opens_at" className="block text-sm font-medium text-gray-700 mb-2">
                                    Opens At *
                                </label>
                                <input
                                    type="datetime-local"
                                    id="opens_at"
                                    value={formData.opens_at}
                                    onChange={(e) => setFormData({ ...formData, opens_at: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div>
                                <label htmlFor="closes_at" className="block text-sm font-medium text-gray-700 mb-2">
                                    Closes At *
                                </label>
                                <input
                                    type="datetime-local"
                                    id="closes_at"
                                    value={formData.closes_at}
                                    onChange={(e) => setFormData({ ...formData, closes_at: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> This window will allow teams to change their supported team <strong>once</strong> for <strong>free</strong> (no points deducted).
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            {submitting ? 'Creating...' : 'Create Window'}
                        </button>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                {windows.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                        <p className="text-gray-600">No supported team change windows created yet.</p>
                    </div>
                ) : (
                    windows.map((window) => (
                        <div
                            key={window.window_id}
                            className={`border rounded-lg p-6 ${window.is_active
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        {window.window_name}
                                        {window.is_active && (
                                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                                                ACTIVE
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {new Date(window.opens_at).toLocaleString()} - {new Date(window.closes_at).toLocaleString()}
                                    </p>
                                </div>
                                {window.is_active && (
                                    <button
                                        onClick={() => handleClose(window.window_id)}
                                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Close Window
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-lg p-4">
                                    <p className="text-2xl font-bold text-gray-900">{window.changes_made}</p>
                                    <p className="text-sm text-gray-600">Changes Made</p>
                                </div>
                                <div className="bg-white rounded-lg p-4">
                                    <p className="text-2xl font-bold text-gray-900">{window.total_teams}</p>
                                    <p className="text-sm text-gray-600">Total Teams</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Participation Rate:</span>
                                    <span className="font-semibold text-gray-900">
                                        {window.total_teams > 0
                                            ? `${((window.changes_made / window.total_teams) * 100).toFixed(1)}%`
                                            : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
