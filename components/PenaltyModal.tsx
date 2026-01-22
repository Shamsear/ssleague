'use client';

import { useState } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PenaltyModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: {
        team_id: string;
        team_name: string;
    };
    tournamentId: string;
    seasonId: string;
    userId: string;
    userName: string;
    onSuccess: () => void;
}

export default function PenaltyModal({
    isOpen,
    onClose,
    team,
    tournamentId,
    seasonId,
    userId,
    userName,
    onSuccess,
}: PenaltyModalProps) {
    const [pointsDeducted, setPointsDeducted] = useState<number>(5);
    const [ecoinFine, setEcoinFine] = useState<number>(0);
    const [sscoinFine, setSscoinFine] = useState<number>(0);
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string>('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (pointsDeducted <= 0) {
            setError('Points must be greater than 0');
            return;
        }

        if (reason.length < 10) {
            setError('Reason must be at least 10 characters');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetchWithTokenRefresh(
                `/api/tournaments/${tournamentId}/penalties`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        season_id: seasonId,
                        team_id: team.team_id,
                        team_name: team.team_name,
                        points_deducted: pointsDeducted,
                        ecoin_fine: ecoinFine,
                        sscoin_fine: sscoinFine,
                        reason: reason.trim(),
                        applied_by_id: userId,
                        applied_by_name: userName,
                    }),
                }
            );

            const data = await response.json();

            if (data.success) {
                // Reset form
                setPointsDeducted(5);
                setReason('');
                onSuccess();
                onClose();
            } else {
                setError(data.error || 'Failed to apply penalty');
            }
        } catch (err) {
            console.error('Error applying penalty:', err);
            setError('Failed to apply penalty. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setPointsDeducted(5);
            setEcoinFine(0);
            setSscoinFine(0);
            setReason('');
            setError('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">⚠️</span>
                            <div>
                                <h2 className="text-xl font-bold">Apply Points Penalty</h2>
                                <p className="text-sm text-red-100">Deduct points from team</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Team Name */}
                    <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Team</p>
                        <p className="text-lg font-bold text-gray-900">{team.team_name}</p>
                    </div>

                    {/* Points to Deduct */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Points to Deduct <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={pointsDeducted}
                            onChange={(e) => setPointsDeducted(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-lg font-semibold"
                            required
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter number of points to deduct (1-50)</p>
                    </div>

                    {/* ECoin Fine */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            ECoin Fine (Optional)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="10000"
                            value={ecoinFine}
                            onChange={(e) => setEcoinFine(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-semibold"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter ECoin fine amount (0-10000)</p>
                    </div>

                    {/* SSCoin Fine */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            SSCoin Fine (Optional)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="10000"
                            value={sscoinFine}
                            onChange={(e) => setSscoinFine(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-lg font-semibold"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter SSCoin fine amount (0-10000)</p>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Reason for Penalty <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
                            rows={4}
                            placeholder="e.g., Late lineup submission (2 hours past deadline)"
                            required
                            disabled={isSubmitting}
                            minLength={10}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Minimum 10 characters ({reason.length}/10)
                        </p>
                    </div>

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

                    {/* Warning */}
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-sm text-yellow-800">
                                <p className="font-semibold mb-1">Warning</p>
                                <p>This will immediately apply the following penalties to {team.team_name}:</p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li><strong>{pointsDeducted} point{pointsDeducted !== 1 ? 's' : ''}</strong> deducted from standings</li>
                                    {ecoinFine > 0 && <li><strong>{ecoinFine} ECoin</strong> fine</li>}
                                    {sscoinFine > 0 && <li><strong>{sscoinFine} SSCoin</strong> fine</li>}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || pointsDeducted <= 0 || reason.length < 10}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Apply Penalty
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
