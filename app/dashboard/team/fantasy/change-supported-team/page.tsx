'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SupportedTeamChanger from '@/components/fantasy/SupportedTeamChanger';
import Link from 'next/link';

export default function ChangeSupportedTeamPage() {
    const { user } = useAuth();
    const [hasFantasyTeam, setHasFantasyTeam] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid) {
            checkFantasyTeam();
        }
    }, [user]);

    const checkFantasyTeam = async () => {
        try {
            const response = await fetch(`/api/fantasy/teams/my-team?user_id=${user?.uid}`);
            const data = await response.json();

            if (response.ok && data.team) {
                setHasFantasyTeam(true);
            } else {
                setHasFantasyTeam(false);
            }
        } catch (error) {
            console.error('Failed to check fantasy team:', error);
            setHasFantasyTeam(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!hasFantasyTeam) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-yellow-800 mb-2">
                            No Fantasy Team Found
                        </h2>
                        <p className="text-yellow-700 mb-4">
                            You need to have a fantasy team to change your supported team.
                        </p>
                        <Link
                            href="/dashboard/team/fantasy/claim"
                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            Claim Your Fantasy Team
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/dashboard/team/fantasy/my-team"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-flex items-center"
                    >
                        ← Back to My Team
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 mt-4">
                        Change Supported Team
                    </h1>
                    <p className="text-gray-600">
                        Change your passive team during an active window.
                    </p>
                </div>

                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        ℹ️ What is a Supported Team?
                    </h3>
                    <div className="space-y-2 text-sm text-blue-800">
                        <p>
                            Your <strong>supported team</strong> (also called passive team) is the real team you get bonus points from based on their performance.
                        </p>
                        <p className="mt-3">
                            <strong>How it works:</strong>
                        </p>
                        <ul className="space-y-1 ml-4">
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>When your supported team wins, you get bonus points</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>Clean sheets, high-scoring games, and winning streaks earn extra bonuses</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>These points are added to your total fantasy points</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Changer Component */}
                <SupportedTeamChanger />

                {/* FAQ Section */}
                <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        ❓ Frequently Asked Questions
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Can I change multiple times?</h4>
                            <p className="text-sm text-gray-700">
                                No, you can only change your supported team <strong>once per window</strong>. Choose wisely!
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Will I lose points?</h4>
                            <p className="text-sm text-gray-700">
                                No! This change is <strong>completely free</strong>. No points will be deducted from your total.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">What happens to my previous bonus points?</h4>
                            <p className="text-sm text-gray-700">
                                You keep all the bonus points you've already earned from your previous supported team. Only future bonuses will come from your new supported team.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">When can I change?</h4>
                            <p className="text-sm text-gray-700">
                                You can only change during an <strong>active window</strong> created by the league administrator. Check above to see if a window is currently open.
                            </p>
                        </div>
                    </div>
                </div>

                {/* View Passive Points Link */}
                <div className="mt-6 text-center">
                    <Link
                        href="/dashboard/team/fantasy/passive-breakdown"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                        View My Passive Points Breakdown →
                    </Link>
                </div>
            </div>
        </div>
    );
}
