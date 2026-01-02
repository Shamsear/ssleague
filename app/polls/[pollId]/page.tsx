'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PollOption {
    id: string;
    text_en: string;
    text_ml: string;
    player_id?: string;
    team_id?: string;
    votes: number;
}

interface PlayerStats {
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_scored: number;
    goals_conceded: number;
    goal_difference: number;
    points_gained: number;
    potm_count: number;
    star_points: number;
}

interface TeamStats {
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_scored: number;
    goals_conceded: number;
    goal_difference: number;
    points: number;
}

interface Poll {
    poll_id: string;
    season_id: string;
    poll_type: string;
    title_en: string;
    title_ml: string;
    description_en?: string;
    description_ml?: string;
    options: PollOption[];
    closes_at: string;
    total_votes: number;
    status: string;
    created_at: string;
}

export default function PollPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const pollId = params.pollId as string;

    const [poll, setPoll] = useState<Poll | null>(null);
    const [stats, setStats] = useState<Record<string, PlayerStats | TeamStats>>({});
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string>('');
    const [hasVoted, setHasVoted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [language, setLanguage] = useState<'en' | 'ml'>('en');

    useEffect(() => {
        loadPoll();
    }, [pollId]);

    useEffect(() => {
        if (user) {
            checkIfVoted();
        }
    }, [pollId, user]);

    const loadPoll = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/polls/${pollId}`);
            const data = await response.json();

            if (data.success) {
                setPoll(data.poll);

                // Parse options if stored as string
                if (data.poll.options && typeof data.poll.options === 'string') {
                    data.poll.options = JSON.parse(data.poll.options);
                }
                setPoll(data.poll);

                // Fetch stats for candidates
                const statsResponse = await fetch(`/api/polls/${pollId}/stats`);
                const statsData = await statsResponse.json();
                if (statsData.success) {
                    setStats(statsData.stats);
                }
            } else {
                setError('Poll not found');
            }
        } catch (err) {
            console.error('Error loading poll:', err);
            setError('Failed to load poll');
        } finally {
            setLoading(false);
        }
    };

    const checkIfVoted = async () => {
        if (!user) return;

        try {
            const response = await fetchWithTokenRefresh(`/api/polls/${pollId}/vote`);
            const data = await response.json();

            if (data.has_voted) {
                setHasVoted(true);
            }
        } catch (err) {
            console.log('Could not check vote status');
        }
    };

    const handleVote = async () => {
        if (!user) {
            setError('Please sign in with Google to vote');
            return;
        }

        if (!selectedOption) {
            setError('Please select an option');
            return;
        }

        setVoting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetchWithTokenRefresh(`/api/polls/${pollId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_option_id: selectedOption,
                    voter_name: (user as any)?.displayName || (user as any)?.email || 'Anonymous',
                    voter_email: (user as any)?.email,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('✅ Vote submitted successfully!');
                setHasVoted(true);
                loadPoll(); // Reload to get updated vote counts
            } else {
                setError(data.error || 'Failed to submit vote');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit vote');
        } finally {
            setVoting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
            const { auth } = await import('@/lib/firebase/config');

            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            console.log('✅ Signed in successfully:', result.user.email);

            // Wait for auth context to update (it listens to onAuthStateChanged)
            // The AuthContext will automatically update the user state
            // Just wait a moment for it to propagate
            await new Promise(resolve => setTimeout(resolve, 1000));

            // After successful login, check vote status
            checkIfVoted();
        } catch (error: any) {
            console.error('Error signing in:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                setError('Sign-in cancelled');
            } else {
                setError('Failed to sign in with Google');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading poll...</p>
                </div>
            </div>
        );
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (error && !poll) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll Not Found</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    if (!poll) return null;

    const isPollClosed = poll.status === 'closed' || new Date(poll.closes_at) < new Date();
    const canVote = !isPollClosed && !hasVoted;

    // Calculate percentages
    const totalVotes = poll.total_votes || poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const optionsWithPercentage = poll.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? ((opt.votes || 0) / totalVotes * 100).toFixed(1) : '0.0'
    }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
            <div className="container mx-auto max-w-4xl">
                {/* Language Toggle */}
                <div className="flex justify-end mb-4">
                    <div className="bg-white rounded-lg shadow-md p-1 flex">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded-md transition-all ${language === 'en'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('ml')}
                            className={`px-4 py-2 rounded-md transition-all ${language === 'ml'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            മലയാളം
                        </button>
                    </div>
                </div>

                {/* Poll Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
                        <div className="flex items-center justify-between mb-4">
                            <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold">
                                🗳️ Poll
                            </span>
                            {isPollClosed ? (
                                <span className="bg-red-500 px-4 py-2 rounded-full text-sm font-semibold">
                                    Closed
                                </span>
                            ) : (
                                <span className="bg-green-500 px-4 py-2 rounded-full text-sm font-semibold">
                                    Active
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            {language === 'en' ? poll.title_en : poll.title_ml}
                        </h1>
                        {poll.description_en && (
                            <p className="text-blue-100 text-lg">
                                {language === 'en' ? poll.description_en : poll.description_ml}
                            </p>
                        )}
                    </div>

                    {/* Poll Info */}
                    <div className="bg-blue-50 border-b border-blue-200 p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-sm text-gray-600">Total Votes</p>
                                <p className="text-2xl font-bold text-blue-600">{totalVotes}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Closes At</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {new Date(poll.closes_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {new Date(poll.closes_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                                </p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <p className="text-sm text-gray-600">Status</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {hasVoted ? '✅ You voted' : canVote ? '⏳ Waiting for your vote' : '🔒 Closed'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="m-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                            <p className="text-red-800">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="m-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
                            <p className="text-green-800">{success}</p>
                        </div>
                    )}

                    {/* Options */}
                    <div className="p-6 space-y-4">
                        {optionsWithPercentage.map((option) => {
                            const isSelected = selectedOption === option.id;
                            const showResults = hasVoted || isPollClosed;

                            return (
                                <div
                                    key={option.id}
                                    onClick={() => canVote && setSelectedOption(option.id)}
                                    className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                        ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                                        } ${!canVote && 'cursor-default'}`}
                                >
                                    {/* Progress Bar Background */}
                                    {showResults && (
                                        <div
                                            className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 transition-all duration-500"
                                            style={{ width: `${option.percentage}%` }}
                                        />
                                    )}

                                    {/* Content */}
                                    <div className="relative p-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-4 flex-1">
                                                {canVote && (
                                                    <div
                                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                                                            ? 'border-blue-600 bg-blue-600'
                                                            : 'border-gray-300'
                                                            }`}
                                                    >
                                                        {isSelected && (
                                                            <div className="w-3 h-3 bg-white rounded-full"></div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {language === 'en' ? option.text_en : option.text_ml}
                                                    </p>
                                                    {showResults && (
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {option.votes || 0} votes
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {showResults && (
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-blue-600">
                                                        {option.percentage}%
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats Display */}
                                        {stats[option.id] && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                {'potm_count' in stats[option.id] ? (
                                                    // Player Stats
                                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Matches</p>
                                                            <p className="text-sm font-bold text-gray-900">{(stats[option.id] as PlayerStats).matches_played}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">W-D-L</p>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {(stats[option.id] as PlayerStats).wins}-{(stats[option.id] as PlayerStats).draws}-{(stats[option.id] as PlayerStats).losses}
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">GS-GC</p>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {(stats[option.id] as PlayerStats).goals_scored}-{(stats[option.id] as PlayerStats).goals_conceded}
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Pts</p>
                                                            <p className="text-sm font-bold text-green-600">{(stats[option.id] as PlayerStats).points_gained}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">POTM</p>
                                                            <p className="text-sm font-bold text-yellow-600">{(stats[option.id] as PlayerStats).potm_count}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Team Stats
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Matches</p>
                                                            <p className="text-sm font-bold text-gray-900">{(stats[option.id] as TeamStats).matches_played}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">W-D-L</p>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {(stats[option.id] as TeamStats).wins}-{(stats[option.id] as TeamStats).draws}-{(stats[option.id] as TeamStats).losses}
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">GS-GC (GD)</p>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {(stats[option.id] as TeamStats).goals_scored}-{(stats[option.id] as TeamStats).goals_conceded} ({(stats[option.id] as TeamStats).goal_difference > 0 ? '+' : ''}{(stats[option.id] as TeamStats).goal_difference})
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Points</p>
                                                            <p className="text-sm font-bold text-green-600">{(stats[option.id] as TeamStats).points}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Login Prompt for Non-Authenticated Users */}
                    {!user && canVote && (
                        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200">
                            <div className="text-center mb-4">
                                <div className="text-4xl mb-3">🔐</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    Sign in to Vote
                                </h3>
                                <p className="text-gray-600 mb-6">
                                    Please sign in with your Google account to cast your vote
                                </p>
                            </div>
                            <button
                                onClick={handleGoogleSignIn}
                                className="w-full bg-white border-2 border-gray-300 text-gray-700 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center space-x-3 shadow-md"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span>Sign in with Google</span>
                            </button>
                        </div>
                    )}

                    {/* Vote Button */}
                    {user && canVote && (
                        <div className="p-6 bg-gray-50 border-t border-gray-200">
                            <button
                                onClick={handleVote}
                                disabled={!selectedOption || voting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {voting ? (
                                    <span className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        Submitting...
                                    </span>
                                ) : (
                                    '🗳️ Submit Vote'
                                )}
                            </button>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="p-6 bg-gray-50 border-t border-gray-200 text-center">
                        <p className="text-sm text-gray-500">
                            Poll ID: {poll.poll_id}
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            ← Back to Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
