'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import SupportedTeamWindowManager from '@/components/fantasy/admin/SupportedTeamWindowManager';
import Link from 'next/link';

export default function SupportedTeamWindowsPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [leagueId, setLeagueId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get league_id from URL query parameter
        const urlLeagueId = searchParams.get('league_id');

        if (urlLeagueId) {
            setLeagueId(urlLeagueId);
            setLoading(false);
        } else {
            // Try to fetch from localStorage or use a default
            const storedLeagueId = localStorage.getItem('current_fantasy_league_id');
            if (storedLeagueId) {
                setLeagueId(storedLeagueId);
            }
            setLoading(false);
        }
    }, [searchParams]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!leagueId) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">
                            No Active Fantasy League
                        </h2>
                        <p className="text-yellow-700">
                            Please create or activate a fantasy league first.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Supported Team Change Windows
                    </h1>
                    <p className="text-gray-600">
                        Create special windows where teams can change their supported team once for free.
                    </p>
                </div>

                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        ℹ️ About This Feature
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Teams can change their <strong>supported team</strong> (passive team) during active windows</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Each team can only change <strong>once per window</strong></span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>This change is <strong>free</strong> - no points are deducted</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>All changes are tracked and logged for transparency</span>
                        </li>
                    </ul>
                </div>

                {/* Manager Component */}
                <SupportedTeamWindowManager leagueId={leagueId} />

                {/* Help Section */}
                <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        💡 How to Use
                    </h3>
                    <div className="space-y-4 text-sm text-gray-700">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">1. Create a Window</h4>
                            <p>Click "Create Window" and set the window name and date range. The window will be active during this period.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">2. Teams Make Changes</h4>
                            <p>During the active window, team owners can go to their fantasy dashboard and change their supported team once.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">3. Monitor Progress</h4>
                            <p>View statistics showing how many teams have made changes and the participation rate.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">4. Close Window</h4>
                            <p>You can close the window early if needed, or it will automatically close at the end date.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
