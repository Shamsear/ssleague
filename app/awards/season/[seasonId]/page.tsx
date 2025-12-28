'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import InstagramEmbed from '@/components/InstagramEmbed';

interface Award {
    id: string;
    award_type: string;
    player_name?: string;
    team_name?: string;
    round_number?: number;
    week_number?: number;
    performance_stats?: any;
    selected_at?: string;
    season_id?: string;
    instagram_link?: string;
    instagram_post_url?: string;
    notes?: string;
}

interface PlayerAward {
    id: string;
    award_type: string;
    player_name: string;
    team_name?: string;
    award_position?: string;
    award_category?: string;
    player_category?: string;
    season_id?: string;
    instagram_link?: string;
    instagram_post_url?: string;
}

interface Trophy {
    id: string;
    trophy_name: string;
    team_name: string;
    trophy_type: string;
    trophy_position?: string;
    position?: number;
    season_id?: string;
    instagram_link?: string;
    instagram_post_url?: string;
}

export default function SeasonAwardsPage() {
    const params = useParams();
    const seasonId = params.seasonId as string;

    const [awards, setAwards] = useState<Award[]>([]);
    const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);
    const [trophies, setTrophies] = useState<Trophy[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'awards' | 'trophies'>('awards');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all awards for this season
                const [awardsRes, playerAwardsRes, trophiesRes] = await Promise.all([
                    fetch(`/api/awards?season_id=${seasonId}`),
                    fetch(`/api/player-awards?season_id=${seasonId}`),
                    fetch(`/api/trophies?season_id=${seasonId}`)
                ]);

                const [awardsData, playerAwardsData, trophiesData] = await Promise.all([
                    awardsRes.json(),
                    playerAwardsRes.json(),
                    trophiesRes.json()
                ]);

                if (awardsData.success) setAwards(awardsData.data || []);
                if (playerAwardsData.success) setPlayerAwards(playerAwardsData.awards || []);
                if (trophiesData.success) setTrophies(trophiesData.trophies || []);
            } catch (error) {
                console.error('Error fetching season awards:', error);
            } finally {
                setLoading(false);
            }
        };

        if (seasonId) {
            fetchData();
        }
    }, [seasonId]);

    // Clean player awards (same logic as public awards page)
    const cleanedPlayerAwards = Array.isArray(playerAwards) ? playerAwards.filter(award => {
        const type = award.award_type?.trim();
        if (!award.player_name && !award.team_name) return false;
        if (!type || type === 'Category') return false;

        const excludedTypes = ['POTD', 'TOD', 'POTW', 'TOTW', 'MOTM', 'Man of the Match', 'Player of the Day', 'Team of the Day'];
        if (excludedTypes.some(t => {
            const upperType = type.toUpperCase();
            return upperType === t || upperType.includes('PLAYER OF THE DAY');
        })) return false;

        return true;
    }) : [];

    const getAwardIcon = (awardType: string) => {
        const type = awardType?.toLowerCase() || '';
        if (type.includes('potd') || type.includes('player of the day')) return '⭐';
        if (type.includes('potw') || type.includes('player of the week')) return '🌟';
        if (type.includes('tod') || type.includes('team of the day')) return '🏅';
        if (type.includes('tow') || type.includes('team of the week')) return '🏆';
        if (type.includes('pots') || type.includes('player of the season')) return '👑';
        if (type.includes('tots') || type.includes('team of the season')) return '🏆';
        if (type.includes('motm') || type.includes('man of the match')) return '💎';
        return '🎖️';
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    const renderStats = (rawStats: any) => {
        if (!rawStats) return null;
        let stats;
        try {
            stats = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
        } catch (e) { return null; }
        if (!stats || typeof stats !== 'object') return null;

        const allowedStats = [
            'wins', 'draws', 'losses', 'goals_for', 'goals',
            'goals_against', 'goal_difference', 'clean_sheet',
            'motm', 'assists', 'matchup', 'avg_goals', 'total_goals'
        ];

        return (
            <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 bg-gray-50/50 rounded-lg p-2.5 sm:p-3">
                <div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Performance</div>
                <div className="flex flex-wrap gap-2">
                    {(stats.clean_sheet === true || stats.clean_sheet === 'true' || stats.clean_sheets > 0) && (
                        <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded border border-teal-200 text-xs font-bold flex items-center shadow-sm">
                            🛡️ Clean Sheet
                        </span>
                    )}

                    {stats.matchup && (
                        <div className="w-full text-xs font-medium text-gray-600 italic mb-1 border-l-2 border-blue-300 pl-2">
                            {stats.matchup}
                        </div>
                    )}

                    {Object.entries(stats).map(([originalKey, value]: [string, any]) => {
                        const key = originalKey.toLowerCase();
                        if (!allowedStats.includes(key)) return null;
                        if (value === null || value === '' || value === undefined) return null;
                        if (key === 'clean_sheet' || key === 'matchup') return null;
                        if (key.includes('played') && !key.includes('matches')) return null;

                        let label = key.replace(/_/g, ' ');
                        let colorClass = 'bg-white text-gray-700 border-gray-200';

                        if (key === 'wins') { label = 'W'; colorClass = 'bg-green-100 text-green-800 border-green-200'; }
                        else if (key === 'losses') { label = 'L'; colorClass = 'bg-red-50 text-red-800 border-red-200'; }
                        else if (key === 'draws') { label = 'D'; colorClass = 'bg-gray-100 text-gray-800 border-gray-200'; }
                        else if (key.includes('goals') && !key.includes('against')) { label = key.replace('goals', 'G').replace('total', 'Tot').replace('avg', 'Avg'); colorClass = 'bg-blue-50 text-blue-800 border-blue-200'; }
                        else if (key === 'motm') { label = 'MOTM'; colorClass = 'bg-yellow-50 text-yellow-800 border-yellow-200'; }

                        return (
                            <div key={originalKey} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-semibold shadow-sm ${colorClass}`}>
                                <span className="capitalize">{label}:</span>
                                <span className="font-bold">{String(value)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const totalAwards = (Array.isArray(awards) ? awards.length : 0) + cleanedPlayerAwards.length;
    const totalTrophies = Array.isArray(trophies) ? trophies.length : 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-4 sm:py-8 px-3 sm:px-4 lg:px-6">
                <div className="container mx-auto max-w-[1600px]">
                    <div className="animate-pulse">
                        <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
                        <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="bg-white/70 rounded-xl p-6 h-64"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-4 sm:py-8 px-3 sm:px-4 lg:px-6">
            <div className="container mx-auto max-w-[1600px]">
                {/* Header */}
                <header className="mb-6 sm:mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <Link
                            href="/awards"
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text text-transparent leading-tight">
                            Season Awards & Trophies
                        </h1>
                    </div>
                    <p className="text-base sm:text-lg lg:text-xl text-gray-700 font-medium mb-2">
                        {seasonId}
                    </p>
                    <p className="text-sm sm:text-base text-gray-600">
                        All awards and trophies given during this season
                    </p>

                    <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 justify-center lg:justify-start">
                        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                            <span className="text-lg sm:text-xl">⭐</span>
                            <span className="text-xs sm:text-sm font-semibold text-gray-900">{totalAwards} Awards</span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                            <span className="text-lg sm:text-xl">🏆</span>
                            <span className="text-xs sm:text-sm font-semibold text-gray-900">{totalTrophies} Trophies</span>
                        </div>
                    </div>
                </header>

                {/* Tabs */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex gap-2 sm:gap-4 justify-center lg:justify-start">
                        <button
                            onClick={() => setActiveTab('awards')}
                            className={`flex-1 sm:flex-initial sm:px-8 lg:px-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base lg:text-lg font-bold transition-all whitespace-nowrap ${activeTab === 'awards'
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                                : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-sm'
                                }`}
                            suppressHydrationWarning
                        >
                            ⭐ Awards ({totalAwards})
                        </button>
                        <button
                            onClick={() => setActiveTab('trophies')}
                            className={`flex-1 sm:flex-initial sm:px-8 lg:px-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base lg:text-lg font-bold transition-all whitespace-nowrap ${activeTab === 'trophies'
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                                : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-sm'
                                }`}
                            suppressHydrationWarning
                        >
                            🏆 Trophies ({totalTrophies})
                        </button>
                    </div>
                </div>

                {/* Content Grid */}
                {totalAwards === 0 && totalTrophies === 0 ? (
                    <div className="bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center shadow-lg">
                        <div className="text-5xl sm:text-6xl mb-4 animate-bounce">🏆</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Awards Yet</h3>
                        <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
                            Awards will appear here once they are given for this season.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-8 sm:mb-12">
                        {/* Team Awards */}
                        {activeTab === 'awards' && Array.isArray(awards) && awards.map((award, index) => {
                            if (!award.player_name && !award.team_name) return null;

                            const Wrapper = award.instagram_post_url ? 'a' : 'div';

                            return (
                                <Wrapper
                                    {...(award.instagram_post_url ? { href: award.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    key={`award-${award.id}-${index}`}
                                    className="group bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-yellow-300"
                                >
                                    {award.instagram_link && (
                                        <div className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                                            <InstagramEmbed
                                                postUrl={award.instagram_link}
                                                instagramPostUrl={award.instagram_post_url ? '' : undefined}
                                                className=""
                                            />
                                        </div>
                                    )}

                                    <div className="p-4 sm:p-6">
                                        <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <div className="text-3xl sm:text-4xl flex-shrink-0">{getAwardIcon(award.award_type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1 truncate">
                                                    {award.award_type}
                                                </h3>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {award.round_number && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-medium">
                                                            Round {award.round_number}
                                                        </span>
                                                    )}
                                                    {award.week_number && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] sm:text-xs font-medium">
                                                            Week {award.week_number}
                                                        </span>
                                                    )}
                                                    {!award.round_number && !award.week_number && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] sm:text-xs font-medium">
                                                            Season Award
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border border-yellow-200/50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow">
                                            <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-1 break-words">
                                                {award.player_name || award.team_name}
                                            </div>
                                            {award.team_name && award.player_name && (
                                                <div className="text-xs sm:text-sm text-gray-600 font-medium">{award.team_name}</div>
                                            )}
                                        </div>

                                        {renderStats(award.performance_stats)}

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-200">
                                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {formatDate(award.selected_at)}
                                            </div>
                                        </div>

                                        {award.notes && (
                                            <div className="mt-3 p-2.5 sm:p-3 bg-blue-50/50 border-l-2 border-blue-400 rounded text-[10px] sm:text-xs text-gray-700">
                                                <span className="font-semibold">Note:</span> {award.notes}
                                            </div>
                                        )}
                                    </div>
                                </Wrapper>
                            );
                        })}

                        {/* Player Awards - Reusing same component structure from public awards page */}
                        {activeTab === 'awards' && cleanedPlayerAwards.map((award, index) => {
                            const isWinner = award.award_position?.toLowerCase().includes('winner');
                            const isRunnerUp = award.award_position?.toLowerCase().includes('runner');
                            const isThird = award.award_position?.toLowerCase().includes('third');
                            const Wrapper = award.instagram_post_url ? 'a' : 'div';

                            return (
                                <Wrapper
                                    {...(award.instagram_post_url ? { href: award.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    key={`player-${award.id}-${index}`}
                                    className={`group bg-white/70 backdrop-blur-xl border-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${isWinner ? 'border-yellow-400 hover:border-yellow-500 bg-gradient-to-br from-yellow-50/30 to-white/70' :
                                        isRunnerUp ? 'border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50/30 to-white/70' :
                                            isThird ? 'border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/30 to-white/70' :
                                                'border-white/40 hover:border-blue-300'
                                        }`}
                                >
                                    {award.instagram_link && (
                                        <div className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                                            <InstagramEmbed
                                                postUrl={award.instagram_link}
                                                instagramPostUrl={award.instagram_post_url ? '' : undefined}
                                                className=""
                                            />
                                        </div>
                                    )}

                                    <div className="p-4 sm:p-6">
                                        <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <div className="relative">
                                                <div className="text-3xl sm:text-4xl flex-shrink-0">⭐</div>
                                                {isWinner && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1">
                                                    {award.award_type}
                                                </h3>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium ${award.award_category === 'individual'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-indigo-100 text-indigo-700'
                                                        }`}>
                                                        {award.award_category === 'individual' ? 'Individual' : 'Category'}
                                                    </span>
                                                    {award.award_position && (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold ${isWinner ? 'bg-yellow-100 text-yellow-800' :
                                                            isRunnerUp ? 'bg-gray-200 text-gray-700' :
                                                                isThird ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {award.award_position}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`border rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow ${isWinner ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-yellow-200/50' :
                                            isRunnerUp ? 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-50 border-gray-200/50' :
                                                isThird ? 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200/50' :
                                                    'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50'
                                            }`}>
                                            <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-1 break-words">
                                                {award.player_name}
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {award.team_name && (
                                                    <div className="text-xs sm:text-sm text-gray-600 font-medium">
                                                        {award.team_name}
                                                    </div>
                                                )}
                                                {award.player_category && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/60 text-[10px] sm:text-xs text-blue-700 font-semibold">
                                                        {award.player_category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        })}

                        {/* Trophies */}
                        {activeTab === 'trophies' && Array.isArray(trophies) && trophies.map((trophy, index) => {
                            const isChampion = trophy.position === 1 || trophy.trophy_position?.toLowerCase().includes('champion') || trophy.trophy_position?.toLowerCase().includes('1st');
                            const isRunnerUp = trophy.position === 2 || trophy.trophy_position?.toLowerCase().includes('runner') || trophy.trophy_position?.toLowerCase().includes('2nd');
                            const isThird = trophy.position === 3 || trophy.trophy_position?.toLowerCase().includes('third') || trophy.trophy_position?.toLowerCase().includes('3rd');
                            const Wrapper = trophy.instagram_post_url ? 'a' : 'div';

                            return (
                                <Wrapper
                                    {...(trophy.instagram_post_url ? { href: trophy.instagram_post_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    key={`trophy-${trophy.id}-${index}`}
                                    className={`group bg-white/70 backdrop-blur-xl border-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${isChampion ? 'border-yellow-400 hover:border-yellow-500 bg-gradient-to-br from-yellow-50/40 to-white/70' :
                                        isRunnerUp ? 'border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50/40 to-white/70' :
                                            isThird ? 'border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/30 to-white/70' :
                                                'border-blue-300 hover:border-blue-400'
                                        }`}
                                >
                                    {trophy.instagram_link && (
                                        <div className="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                                            <InstagramEmbed
                                                postUrl={trophy.instagram_link}
                                                instagramPostUrl={trophy.instagram_post_url ? '' : undefined}
                                                className=""
                                            />
                                        </div>
                                    )}

                                    <div className="p-4 sm:p-6">
                                        <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <div className="relative">
                                                <div className="text-3xl sm:text-4xl flex-shrink-0">🏆</div>
                                                {isChampion && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg leading-tight mb-1">
                                                    {trophy.trophy_name}
                                                </h3>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium capitalize ${trophy.trophy_type === 'league' ? 'bg-yellow-100 text-yellow-800' :
                                                    trophy.trophy_type === 'runner_up' ? 'bg-gray-200 text-gray-700' :
                                                        trophy.trophy_type === 'cup' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {trophy.trophy_type.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`border rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 group-hover:shadow-md transition-shadow ${isChampion ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-yellow-200/60' :
                                            isRunnerUp ? 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 border-gray-200/60' :
                                                isThird ? 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200/60' :
                                                    'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-blue-200/60'
                                            }`}>
                                            <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 mb-2 break-words">
                                                {trophy.team_name}
                                            </div>
                                            <div className="space-y-1.5">
                                                {trophy.trophy_position && (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/70 border border-orange-200">
                                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                        <span className="text-xs sm:text-sm font-bold text-orange-700">
                                                            {trophy.trophy_position}
                                                        </span>
                                                    </div>
                                                )}
                                                {trophy.position && (
                                                    <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                        <span className="font-semibold">League Position: #{trophy.position}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
