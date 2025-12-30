'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RecalculationLog {
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export default function RecalculateFantasyPointsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { isCommitteeAdmin } = usePermissions();
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [logs, setLogs] = useState<RecalculationLog[]>([]);
    const [summary, setSummary] = useState<{
        leagues: number;
        fixtures: number;
        bonusPoints: number;
    } | null>(null);

    // Redirect if not authorized
    if (!loading && (!user || !isCommitteeAdmin)) {
        router.push('/dashboard');
        return null;
    }

    const addLog = (message: string, type: RecalculationLog['type'] = 'info') => {
        setLogs(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            message,
            type
        }]);
    };

    const handleRecalculate = async () => {
        setIsRecalculating(true);
        setLogs([]);
        setSummary(null);

        try {
            addLog('🔄 Starting passive points recalculation...', 'info');

            const response = await fetch('/api/fantasy/recalculate-passive-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to recalculate points');
            }

            // Add logs from the response
            if (data.logs && Array.isArray(data.logs)) {
                data.logs.forEach((log: string) => {
                    if (log.includes('✅')) {
                        addLog(log, 'success');
                    } else if (log.includes('❌') || log.includes('Error')) {
                        addLog(log, 'error');
                    } else if (log.includes('⚠️')) {
                        addLog(log, 'warning');
                    } else {
                        addLog(log, 'info');
                    }
                });
            }

            // Set summary
            if (data.summary) {
                setSummary(data.summary);
                addLog('✅ Recalculation completed successfully!', 'success');
            }

        } catch (error: any) {
            addLog(`❌ Error: ${error.message}`, 'error');
        } finally {
            setIsRecalculating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-6 px-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
            <div className="container mx-auto max-w-5xl">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                                🎯 Fantasy Points Recalculation
                            </h1>
                            <p className="text-gray-600">
                                Recalculate passive team bonus points for all fantasy leagues
                            </p>
                        </div>
                        <Link
                            href="/dashboard/committee"
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                        >
                            ← Back
                        </Link>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-blue-900">
                                <p className="font-semibold mb-1">What this does:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Resets all passive team bonus points to 0</li>
                                    <li>Deletes old bonus records</li>
                                    <li>Recalculates bonuses for all completed fixtures</li>
                                    <li>Applies all configured team scoring rules (wins, draws, clean sheets, etc.)</li>
                                    <li>Saves breakdown data for each matchday</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="text-center">
                        <button
                            onClick={handleRecalculate}
                            disabled={isRecalculating}
                            className={`px-8 py-4 rounded-xl font-bold text-white text-lg transition-all transform hover:scale-105 ${isRecalculating
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg'
                                }`}
                        >
                            {isRecalculating ? (
                                <span className="flex items-center justify-center gap-3">
                                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Recalculating...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Recalculate Passive Points
                                </span>
                            )}
                        </button>
                        {!isRecalculating && logs.length === 0 && (
                            <p className="text-sm text-gray-500 mt-3">
                                Click the button above to start the recalculation process
                            </p>
                        )}
                    </div>
                </div>

                {/* Summary */}
                {summary && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-sm border-2 border-green-200 p-6 mb-6">
                        <h2 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Recalculation Summary
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-4 border border-green-200">
                                <p className="text-sm text-gray-600 mb-1">Active Leagues</p>
                                <p className="text-3xl font-bold text-green-600">{summary.leagues}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-green-200">
                                <p className="text-sm text-gray-600 mb-1">Fixtures Processed</p>
                                <p className="text-3xl font-bold text-blue-600">{summary.fixtures}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-green-200">
                                <p className="text-sm text-gray-600 mb-1">Total Bonus Points</p>
                                <p className="text-3xl font-bold text-indigo-600">{summary.bonusPoints}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Process Logs
                        </h2>
                        <div className="bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-sm">
                            {logs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`py-1 ${log.type === 'success'
                                            ? 'text-green-400'
                                            : log.type === 'error'
                                                ? 'text-red-400'
                                                : log.type === 'warning'
                                                    ? 'text-yellow-400'
                                                    : 'text-gray-300'
                                        }`}
                                >
                                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Warning */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg mt-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm text-amber-900">
                            <p className="font-semibold mb-1">⚠️ Important Notes:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>This operation will reset ALL passive points and recalculate from scratch</li>
                                <li>The process may take a few moments depending on the number of fixtures</li>
                                <li>All fantasy team rankings will be updated automatically</li>
                                <li>Use this only when you need to fix point calculation issues</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
