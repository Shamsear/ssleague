'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayerCard } from '@/components/PlayerImage';

interface Player {
  id: number;
  name: string;
  position: string;
  position_group?: string;
  playing_style?: string;
  overall_rating: number;
  player_id?: string;
  nationality?: string;
  foot?: string;
  age?: number;
  nfl_team?: string;
  team?: {
    id: number;
    name: string;
  };
  acquisition_value?: number;
  acquired_at?: string;
  round_id?: number;
  
  // Stats
  speed?: number;
  acceleration?: number;
  ball_control?: number;
  dribbling?: number;
  tight_possession?: number;
  low_pass?: number;
  lofted_pass?: number;
  finishing?: number;
  heading?: number;
  kicking_power?: number;
  tackling?: number;
  defensive_awareness?: number;
  defensive_engagement?: number;
  offensive_awareness?: number;
  stamina?: number;
  physical_contact?: number;
  gk_awareness?: number;
  gk_reflexes?: number;
  gk_catching?: number;
  gk_parrying?: number;
  gk_reach?: number;
}

interface StatsBarProps {
  label: string;
  value: number;
}

const StatsBar: React.FC<StatsBarProps> = ({ label, value }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(value);
    }, 200);
    return () => clearTimeout(timer);
  }, [value]);

  const getBarColor = (val: number) => {
    if (val >= 85) return 'bg-green-400';
    if (val >= 75) return 'bg-blue-400';
    if (val >= 65) return 'bg-yellow-400';
    return 'bg-gray-400';
  };

  const getBadgeColor = (val: number) => {
    if (val >= 85) return 'bg-green-100 text-green-800';
    if (val >= 75) return 'bg-blue-100 text-blue-800';
    if (val >= 65) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white/50 rounded-xl p-3 hover:bg-white/60 transition-all duration-300">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getBadgeColor(value)}`}>
          {value}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 shadow-inner overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor(value)}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
    </div>
  );
};

interface PlayerAward {
  id: number;
  award_name: string;
  award_position?: string;
  award_value?: number;
  created_at: string;
}

export default function PlayerDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const playerId = params?.id as string;
  
  const [player, setPlayer] = useState<Player | null>(null);
  const [awards, setAwards] = useState<PlayerAward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlayerDetails = async () => {
      if (!user || !playerId) return;

      try {
        const response = await fetch(`/api/players/${playerId}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch player details');
        }

        const { success, data } = await response.json();

        if (success && data.player) {
          setPlayer(data.player);
        } else {
          setError('Player not found');
        }
      } catch (err) {
        console.error('Error fetching player:', err);
        setError('Failed to load player details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerDetails();
  }, [user, playerId]);

  // Fetch player awards
  useEffect(() => {
    const fetchAwards = async () => {
      if (!playerId) return;

      try {
        const response = await fetch(`/api/player-awards?player_id=${playerId}`);
        const { success, data } = await response.json();

        if (success && data) {
          setAwards(data);
        }
      } catch (err) {
        console.error('Error fetching awards:', err);
      }
    };

    fetchAwards();
  }, [playerId]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-blue-100 text-blue-800';
      case 'WR': return 'bg-green-100 text-green-800';
      case 'TE': return 'bg-purple-100 text-purple-800';
      case 'K': return 'bg-yellow-100 text-yellow-800';
      case 'DST': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingGradient = (rating: number) => {
    if (rating >= 85) return 'from-green-400 to-green-500';
    if (rating >= 75) return 'from-blue-400 to-blue-500';
    if (rating >= 65) return 'from-yellow-400 to-yellow-500';
    return 'from-gray-400 to-gray-500';
  };

  const getRatingBadge = (rating: number) => {
    if (rating >= 85) return { text: 'Elite', color: 'bg-green-100 text-green-800' };
    if (rating >= 75) return { text: 'Excellent', color: 'bg-blue-100 text-blue-800' };
    if (rating >= 65) return { text: 'Good', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Unrated', color: 'bg-gray-100 text-gray-800' };
  };

  const renderKeyStats = () => {
    if (!player) return null;

    const position = player.position;
    let stats: { label: string; value: number }[] = [];

    if (position === 'K' || position === 'GK') {
      stats = [
        { label: 'GK Awareness', value: player.gk_awareness || 0 },
        { label: 'GK Catching', value: player.gk_catching || 0 },
        { label: 'GK Parrying', value: player.gk_parrying || 0 },
        { label: 'GK Reflexes', value: player.gk_reflexes || 0 },
        { label: 'GK Reach', value: player.gk_reach || 0 },
        { label: 'Defensive Awareness', value: player.defensive_awareness || 0 },
      ];
    } else if (['CB', 'RB', 'LB'].includes(position)) {
      stats = [
        { label: 'Defensive Awareness', value: player.defensive_awareness || 0 },
        { label: 'Tackling', value: player.tackling || 0 },
        { label: 'Defensive Engagement', value: player.defensive_engagement || 0 },
        { label: 'Physical Contact', value: player.physical_contact || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Speed', value: player.speed || 0 },
      ];
    } else if (position === 'DMF') {
      stats = [
        { label: 'Defensive Awareness', value: player.defensive_awareness || 0 },
        { label: 'Tackling', value: player.tackling || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Low Pass', value: player.low_pass || 0 },
        { label: 'Stamina', value: player.stamina || 0 },
        { label: 'Physical Contact', value: player.physical_contact || 0 },
      ];
    } else if (position === 'CMF') {
      stats = [
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Low Pass', value: player.low_pass || 0 },
        { label: 'Lofted Pass', value: player.lofted_pass || 0 },
        { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
        { label: 'Dribbling', value: player.dribbling || 0 },
        { label: 'Stamina', value: player.stamina || 0 },
      ];
    } else if (['RMF', 'LMF'].includes(position)) {
      stats = [
        { label: 'Speed', value: player.speed || 0 },
        { label: 'Acceleration', value: player.acceleration || 0 },
        { label: 'Dribbling', value: player.dribbling || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Lofted Pass', value: player.lofted_pass || 0 },
        { label: 'Tight Possession', value: player.tight_possession || 0 },
      ];
    } else if (position === 'AMF') {
      stats = [
        { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Dribbling', value: player.dribbling || 0 },
        { label: 'Tight Possession', value: player.tight_possession || 0 },
        { label: 'Low Pass', value: player.low_pass || 0 },
        { label: 'Finishing', value: player.finishing || 0 },
      ];
    } else if (position === 'SS') {
      stats = [
        { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
        { label: 'Finishing', value: player.finishing || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Dribbling', value: player.dribbling || 0 },
        { label: 'Speed', value: player.speed || 0 },
        { label: 'Acceleration', value: player.acceleration || 0 },
      ];
    } else if (position === 'CF') {
      stats = [
        { label: 'Finishing', value: player.finishing || 0 },
        { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
        { label: 'Physical Contact', value: player.physical_contact || 0 },
        { label: 'Heading', value: player.heading || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Kicking Power', value: player.kicking_power || 0 },
      ];
    } else {
      // Default stats
      stats = [
        { label: 'Speed', value: player.speed || 0 },
        { label: 'Ball Control', value: player.ball_control || 0 },
        { label: 'Dribbling', value: player.dribbling || 0 },
        { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
        { label: 'Stamina', value: player.stamina || 0 },
        { label: 'Physical Contact', value: player.physical_contact || 0 },
      ];
    }

    return stats.map((stat, index) => (
      <StatsBar key={index} label={stat.label} value={stat.value} />
    ));
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'Player not found'}</p>
          <Link href="/dashboard/team/statistics" className="mt-4 inline-block text-[#0066FF] hover:underline">
            Back to Player Database
          </Link>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  const ratingBadge = getRatingBadge(player.overall_rating);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-5xl mx-auto hover:shadow-lg transition-all duration-300">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8 hidden sm:flex">
          <Link href="/dashboard/team/statistics" className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Player Database</span>
          </Link>
          
          <div className="flex items-center">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
              Player ID: {player.player_id || player.id}
            </span>
          </div>
        </div>

        {/* Player ID Display (mobile only) */}
        <div className="flex justify-end mb-8 sm:hidden">
          <div className="flex items-center">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
              Player ID: {player.player_id || player.id}
            </span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Player Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Player Card */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              {/* Player Image */}
              <div className="relative w-40 h-40 mx-auto mb-4">
                <PlayerCard
                  playerId={player.player_id || player.id.toString()}
                  playerName={player.name}
                  priority={true}
                />
                <div className="absolute bottom-0 right-0 bg-[#0066FF] text-white text-xs font-bold py-1 px-2 rounded-tl-lg shadow-lg">
                  {player.overall_rating || '--'}
                </div>
              </div>

              {/* Player Basic Info */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-1">{player.name}</h1>
                <div className="flex items-center justify-center mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getPositionColor(player.position)}`}>
                    {player.position}
                  </span>
                  {player.nfl_team && (
                    <span className="ml-2 text-xs text-gray-500">{player.nfl_team}</span>
                  )}
                </div>
              </div>

              {/* Player Details */}
              <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Nationality:</span>
                  <span className="font-medium text-gray-700">{player.nationality || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Playing Style:</span>
                  <span className="font-medium text-gray-700">{player.playing_style || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Preferred Foot:</span>
                  <span className="font-medium text-gray-700">{player.foot || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Age:</span>
                  <span className="font-medium text-gray-700">{player.age || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Acquisition Details */}
            <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60 hover:bg-white/70 transition-all duration-300 transform hover:scale-[1.01]">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Acquisition Details
              </h3>
              <div className="space-y-4">
                <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Team</p>
                  <p className="text-xl font-bold text-gray-800">
                    {player.team ? (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {player.team.name}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Free Agent
                      </span>
                    )}
                  </p>
                </div>

                <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cost</p>
                  <p className="text-xl font-bold text-gray-800">
                    {player.team && player.acquisition_value ? (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        £{player.acquisition_value.toLocaleString()}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Free Transfer
                      </span>
                    )}
                  </p>
                </div>

                {player.acquired_at && (
                  <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Acquired On</p>
                    <p className="text-xl font-bold text-gray-800">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(player.acquired_at).toLocaleDateString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </span>
                    </p>
                  </div>
                )}

                {player.round_id && !player.acquired_at && (
                  <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Acquired Via</p>
                    <p className="text-xl font-bold text-gray-800">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Round #{player.round_id} auction
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Player Awards */}
            <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60 hover:bg-white/70 transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Season Awards
              </h3>
              {awards.length > 0 ? (
                <div className="space-y-2">
                  {awards.map((award) => (
                    <div
                      key={award.id}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 hover:from-yellow-100 hover:to-amber-100 transition-all duration-200"
                    >
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-5 h-5 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{award.award_name}</p>
                          {award.award_position && (
                            <p className="text-xs text-gray-600">{award.award_position}</p>
                          )}
                        </div>
                      </div>
                      {award.award_value && (
                        <div className="flex-shrink-0 ml-3">
                          <span className="text-2xl font-bold text-yellow-600">{award.award_value}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  <p className="text-sm text-gray-500">No awards yet this season</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="lg:col-span-3 space-y-6">
            {/* Overall Rating */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Overall Rating
              </h3>
              <div className="flex items-center">
                <div className={`w-24 h-24 bg-gradient-to-br ${getRatingGradient(player.overall_rating)} rounded-full flex items-center justify-center shadow-lg`}>
                  <span className="text-4xl font-bold text-white">{player.overall_rating || '--'}</span>
                </div>
                <div className="ml-6">
                  <h4 className="text-lg font-semibold text-gray-800">{player.name}</h4>
                  <p className="text-gray-500">
                    {player.position} {player.nfl_team && ` - ${player.nfl_team}`}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${ratingBadge.color}`}>
                      {ratingBadge.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Attributes */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Key Attributes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderKeyStats()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
