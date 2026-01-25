'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Head from 'next/head';

interface PollOption {
    id: string;
    text_en: string;
    text_ml: string;
    player_id?: string;
    team_id?: string;
    votes: number;
}che

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
    const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
    const [voterName, setVoterName] = useState<string>('');

    // Generate device fingerprint on mount
    useEffect(() => {
        const generateFingerprint = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('fingerprint', 2, 2);
            }
            const canvasData = canvas.toDataURL();

            const fingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${canvasData.slice(0, 50)}`;
            const hash = btoa(fingerprint).slice(0, 32);
            return hash;
        };

        setDeviceFingerprint(generateFingerprint());
    }, []);

    // Handle redirect result for mobile sign-in
    useEffect(() => {
        let mounted = true;

        const handleRedirectResult = async () => {
            try {
                const { getRedirectResult } = await import('firebase/auth');
                const { auth } = await import('@/lib/firebase/config');

                console.log('Checking for redirect result...');
                const result = await getRedirectResult(auth);

                if (result && mounted) {
                    console.log('✅ Redirect sign-in successful:', result.user.email);

                    // Set the token
                    const idToken = await result.user.getIdToken(true);
                    const tokenResponse = await fetch('/api/auth/set-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: idToken }),
                    });

                    if (tokenResponse.ok) {
                        console.log('✅ Token set successfully');

                        // Show success and reload after a delay with cache busting
                        setSuccess('Successfully signed in! Reloading...');

                        setTimeout(() => {
                            if (mounted) {
                                // Force hard reload with cache busting
                                window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
                            }
                        }, 1500);
                    } else {
                        console.error('Failed to set token:', tokenResponse.status);
                        setError('Authentication failed. Please try again.');
                    }
                } else if (!result) {
                    console.log('No redirect result found');
                }
            } catch (error: any) {
                if (error.code && error.code !== 'auth/popup-closed-by-user') {
                    console.error('Redirect result error:', error);
                    if (mounted) {
                        setError('Sign-in failed. Please try again.');
                    }
                }
            }
        };

        // Small delay to ensure Firebase is initialized
        const timer = setTimeout(() => {
            handleRedirectResult();
        }, 500);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, []);

    // Prevent page caching
    useEffect(() => {
        // Add cache control meta tags dynamically
        if (typeof window !== 'undefined') {
            // Prevent back/forward cache
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log('Page loaded from cache, forcing reload');
                    window.location.reload();
                }
            });
        }
    }, []);

    useEffect(() => {
        loadPoll();
    }, [pollId]);



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



    const handleVote = async () => {
        // Prevent multiple clicks
        if (voting) {
            console.log('Vote already in progress, ignoring click');
            return;
        }

        if (!voterName || voterName.trim().length < 3) {
            setError('Please enter your name (minimum 3 characters)');
            return;
        }

        if (!selectedOption) {
            setError('Please select an option');
            return;
        }

        if (!deviceFingerprint) {
            setError('Device fingerprint not ready. Please try again.');
            return;
        }

        setVoting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/polls/${pollId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_option_id: selectedOption,
                    voter_name: voterName.trim(),
                    device_fingerprint: deviceFingerprint,
                    user_agent: navigator.userAgent,
                    browser_info: {
                        platform: navigator.platform,
                        language: navigator.language,
                        screen: `${screen.width}x${screen.height}`,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('✅ Vote submitted successfully!');
                setHasVoted(true);
                loadPoll(); // Reload to get updated vote counts
                // Keep voting state true to prevent re-voting
            } else {
                setError(data.error || 'Failed to submit vote');
                // Only reset voting state on error so user can try again
                setVoting(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit vote');
            setVoting(false);
        }
        // Note: Don't set voting to false on success to prevent double voting
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

                    {/* Name Input for Voting */}
                    {canVote && (
                        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200">
                            <div className="text-center mb-4">
                                <div className="text-4xl mb-3">✍️</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    Enter Your Name to Vote
                                </h3>
                                <p className="text-gray-600 mb-6">
                                    Please enter your full name to cast your vote
                                </p>
                            </div>
                            <input
                                type="text"
                                value={voterName}
                                onChange={(e) => setVoterName(e.target.value)}
                                placeholder="Enter your full name"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg mb-4"
                                disabled={hasVoted || voting}
                            />
                        </div>
                    )}

                    {/* Vote Button */}
                    {canVote && (
                        <div className="p-6 bg-gray-50 border-t border-gray-200">
                            <button
                                onClick={handleVote}
                                disabled={!selectedOption || !voterName || voting}
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
