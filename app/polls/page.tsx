'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Poll {
    poll_id: string;
    season_id: string;
    poll_type: string;
    title_en: string;
    title_ml: string;
    closes_at: string;
    total_votes: number;
    status: string;
    created_at: string;
}

export default function PollsListPage() {
    const router = useRouter();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active');

    useEffect(() => {
        loadPolls();
    }, [filter]);

    const loadPolls = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filter !== 'all') {
                params.append('status', filter);
            }

            const response = await fetch(`/api/polls/public?${params}`);
            const data = await response.json();

            if (data.success) {
                setPolls(data.data || []);
            }
        } catch (err) {
            console.error('Error loading polls:', err);
        } finally {
            setLoading(false);
        }
    };

    const isPollClosed = (poll: Poll) => {
        return poll.status === 'closed' || new Date(poll.closes_at) < new Date();
    };

    const getTimeRemaining = (closesAt: string) => {
        const now = new Date();
        const closes = new Date(closesAt);
        const diff = closes.getTime() - now.getTime();

        if (diff < 0) return 'Closed';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours}h left`;
        return 'Closing soon';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
            <div className="container mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        🗳️ Fan Polls
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Vote for your favorite players and teams
                    </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { id: 'active' as const, label: 'Active Polls', icon: '🟢' },
                        { id: 'closed' as const, label: 'Closed Polls', icon: '🔒' },
                        { id: 'all' as const, label: 'All Polls', icon: '📊' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all ${filter === tab.id
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading polls...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && polls.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                        <div className="text-6xl mb-4">🗳️</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Polls Available</h3>
                        <p className="text-gray-600">
                            {filter === 'active' ? 'No active polls at the moment' : 'No polls found'}
                        </p>
                    </div>
                )}

                {/* Polls Grid */}
                {!loading && polls.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {polls.map((poll) => {
                            const closed = isPollClosed(poll);
                            return (
                                <Link
                                    key={poll.poll_id}
                                    href={`/polls/${poll.poll_id}`}
                                    className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className={`p-6 ${closed
                                        ? 'bg-gradient-to-r from-gray-100 to-gray-200'
                                        : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${closed
                                                ? 'bg-gray-500 text-white'
                                                : 'bg-green-500 text-white'
                                                }`}>
                                                {closed ? 'Closed' : 'Active'}
                                            </span>
                                            <span className="text-white text-sm font-semibold">
                                                {getTimeRemaining(poll.closes_at)}
                                            </span>
                                        </div>
                                        <h3 className={`text-xl font-bold ${closed ? 'text-gray-800' : 'text-white'
                                            } line-clamp-2`}>
                                            {poll.title_en}
                                        </h3>
                                    </div>

                                    {/* Body */}
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Total Votes</p>
                                                <p className="text-2xl font-bold text-blue-600">
                                                    {poll.total_votes || 0}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500">Type</p>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {poll.poll_type.replace('award_', '').toUpperCase()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-200">
                                            <p className="text-sm text-gray-500 mb-1">Closes on</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {new Date(poll.closes_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} at{' '}
                                                {new Date(poll.closes_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                                            </p>
                                        </div>

                                        {/* CTA */}
                                        <div className="mt-4">
                                            <div className={`w-full py-3 rounded-lg font-semibold text-center transition-all ${closed
                                                ? 'bg-gray-100 text-gray-600'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white group-hover:shadow-lg'
                                                }`}>
                                                {closed ? 'View Results' : 'Vote Now →'}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => router.push('/')}
                        className="text-blue-600 hover:text-blue-700 font-semibold"
                    >
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
