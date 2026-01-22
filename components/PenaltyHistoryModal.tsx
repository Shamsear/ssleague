'use client';

import { useState, useEffect } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Penalty {
    id: number;
    points_deducted: number;
    ecoin_fine?: number;
    sscoin_fine?: number;
    reason: string;
    applied_by_name: string;
    applied_at: string;
    is_active: boolean;
    removed_by_name?: string;
    removed_at?: string;
    removal_reason?: string;
}

interface PenaltyHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: {
        team_id: string;
        team_name: string;
    };
    tournamentId: string;
    userId: string;
    userName: string;
    onPenaltyRemoved: () => void;
}

export default function PenaltyHistoryModal({
    isOpen,
    onClose,
    team,
    tournamentId,
    userId,
    userName,
    onPenaltyRemoved,
}: PenaltyHistoryModalProps) {
    const [penalties, setPenalties] = useState<Penalty[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [removalReason, setRemovalReason] = useState('');
    const [showRemovalForm, setShowRemovalForm] = useState<number | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPenalties();
        }
    }, [isOpen, team.team_id]);

    const fetchPenalties = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${tournamentId}/penalties?team_id=${team.team_id}`
            );
            const data = await response.json();
            if (data.success) {
                setPenalties(data.penalties);
            } else {
                setError('Failed to load penalties');
            }
        } catch (err) {
            console.error('Error fetching penalties:', err);
            setError('Failed to load penalties');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemovePenalty = async (penaltyId: number) => {
        if (removalReason.length < 10) {
            setError('Removal reason must be at least 10 characters');
            return;
        }

        setRemovingId(penaltyId);
        setError('');

        try {
            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${tournamentId}/penalties/${penaltyId}`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        removal_reason: removalReason.trim(),
                        removed_by_id: userId,
                        removed_by_name: userName,
                    }),
                }
            );

            const data = await response.json();

            if (data.success) {
                setRemovalReason('');
                setShowRemovalForm(null);
                fetchPenalties();
                onPenaltyRemoved();
            } else {
                setError(data.error || 'Failed to remove penalty');
            }
        } catch (err) {
            console.error('Error removing penalty:', err);
            setError('Failed to remove penalty');
        } finally {
            setRemovingId(null);
        }
    };

    if (!isOpen) return null;

    const activePenalties = penalties.filter(p => p.is_active);
    const removedPenalties = penalties.filter(p => !p.is_active);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl sticky top-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📋</span>
                            <div>
                                <h2 className="text-xl font-bold">Penalty History</h2>
                                <p className="text-sm text-blue-100">{team.team_name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                    ) : penalties.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">No penalties found for this team</p>
                        </div>
                    ) : (
                        <>
                            {/* Active Penalties */}
                            {activePenalties.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <span className="text-red-600">⚠️</span>
                                        Active Penalties ({activePenalties.length})
                                    </h3>
                                    <div className="space-y-4">
                                        {activePenalties.map((penalty) => (
                                            <div
                                                key={penalty.id}
                                                className="bg-red-50 border-2 border-red-200 rounded-xl p-4"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="text-2xl font-bold text-red-600">
                                                            -{penalty.points_deducted} points
                                                        </p>
                                                        {(penalty.ecoin_fine > 0 || penalty.sscoin_fine > 0) && (
                                                            <div className="flex gap-3 mt-2">
                                                                {penalty.ecoin_fine > 0 && (
                                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                                                        {penalty.ecoin_fine} ECoin
                                                                    </span>
                                                                )}
                                                                {penalty.sscoin_fine > 0 && (
                                                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                                                        {penalty.sscoin_fine} SSCoin
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Applied {new Date(penalty.applied_at).toLocaleDateString()} by {penalty.applied_by_name}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 mb-3">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Reason:</p>
                                                    <p className="text-sm text-gray-900">{penalty.reason}</p>
                                                </div>

                                                {showRemovalForm === penalty.id ? (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                                Removal Reason <span className="text-red-600">*</span>
                                                            </label>
                                                            <textarea
                                                                value={removalReason}
                                                                onChange={(e) => setRemovalReason(e.target.value)}
                                                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                                                                rows={3}
                                                                placeholder="e.g., Appeal successful - evidence provided"
                                                                minLength={10}
                                                            />
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Minimum 10 characters ({removalReason.length}/10)
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setShowRemovalForm(null);
                                                                    setRemovalReason('');
                                                                    setError('');
                                                                }}
                                                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemovePenalty(penalty.id)}
                                                                disabled={removingId === penalty.id || removalReason.length < 10}
                                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                                            >
                                                                {removingId === penalty.id ? (
                                                                    <>
                                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                        </svg>
                                                                        Removing...
                                                                    </>
                                                                ) : (
                                                                    'Confirm Removal'
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowRemovalForm(penalty.id)}
                                                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                    >
                                                        Remove Penalty
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Removed Penalties */}
                            {removedPenalties.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <span className="text-gray-400">📜</span>
                                        Removed Penalties ({removedPenalties.length})
                                    </h3>
                                    <div className="space-y-4">
                                        {removedPenalties.map((penalty) => (
                                            <div
                                                key={penalty.id}
                                                className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 opacity-75"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="text-xl font-bold text-gray-600">
                                                            -{penalty.points_deducted} points <span className="text-sm font-normal">(REMOVED)</span>
                                                        </p>
                                                        {(penalty.ecoin_fine > 0 || penalty.sscoin_fine > 0) && (
                                                            <div className="flex gap-3 mt-2">
                                                                {penalty.ecoin_fine > 0 && (
                                                                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold">
                                                                        {penalty.ecoin_fine} ECoin
                                                                    </span>
                                                                )}
                                                                {penalty.sscoin_fine > 0 && (
                                                                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold">
                                                                        {penalty.sscoin_fine} SSCoin
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Applied {new Date(penalty.applied_at).toLocaleDateString()} by {penalty.applied_by_name}
                                                        </p>
                                                        {penalty.removed_at && (
                                                            <p className="text-sm text-green-600 font-medium mt-1">
                                                                Removed {new Date(penalty.removed_at).toLocaleDateString()} by {penalty.removed_by_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 mb-2">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Original Reason:</p>
                                                    <p className="text-sm text-gray-900">{penalty.reason}</p>
                                                </div>
                                                {penalty.removal_reason && (
                                                    <div className="bg-green-50 rounded-lg p-3">
                                                        <p className="text-sm font-semibold text-green-700 mb-1">Removal Reason:</p>
                                                        <p className="text-sm text-green-900">{penalty.removal_reason}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-800">
                                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 rounded-b-2xl border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
