'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface TeamData {
  id: string;
  name: string;
  balance: number;
  logo_url?: string;
}

interface Round {
  id: number;
  season_id: string;
  round_number: number;
  position?: string;
  status: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
}

interface Player {
  id: number;
  name: string;
  position: string;
  nfl_team: string;
  overall_rating: number;
  acquisition_value?: number;
}

interface Tiebreaker {
  id: number;
  player_id: number;
  original_amount: number;
  teams_involved: string[];
  status: string;
}

interface BulkRound {
  id: number;
  season_id: string;
  base_price: number;
  status: string;
  end_time?: string;
}

interface DashboardData {
  team: TeamData;
  activeRounds: Round[];
  activeBids: any[];
  players: Player[];
  tiebreakers: Tiebreaker[];
  activeBulkRounds: BulkRound[];
  stats: {
    playerCount: number;
    balance: number;
    totalSpent: number;
    avgRating: number;
    activeBidsCount: number;
    positionBreakdown: { [key: string]: number };
  };
}

interface Props {
  seasonStatus: {
    hasActiveSeason: boolean;
    isRegistered: boolean;
    seasonName?: string;
    seasonId?: string;
  };
  user: any;
}

export default function RegisteredTeamDashboard({ seasonStatus, user }: Props) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>({
    team: {
      id: user?.uid || '',
      name: user?.teamName || 'My Team',
      balance: 15000,
    },
    activeRounds: [],
    activeBids: [],
    players: [],
    tiebreakers: [],
    activeBulkRounds: [],
    stats: {
      playerCount: 0,
      balance: 15000,
      totalSpent: 0,
      avgRating: 0,
      activeBidsCount: 0,
      positionBreakdown: {},
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: number]: number }>({});
  const [bulkTimeRemaining, setBulkTimeRemaining] = useState<{ [key: number]: number }>({});
  const timerRefs = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const bulkTimerRefs = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const previousDataRef = useRef<string>('');

  useEffect(() => {
    const fetchDashboard = async (showLoader = true) => {
      if (!seasonStatus?.seasonId) return;
      if (showLoader) setIsLoading(true);

      try {
        const params = new URLSearchParams({ season_id: seasonStatus.seasonId });
        const response = await fetch(`/api/team/dashboard?${params}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const { success, data } = await response.json();

        if (success) {
          const dataString = JSON.stringify(data);
          if (dataString !== previousDataRef.current) {
            previousDataRef.current = dataString;
            setDashboardData(data);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        // Set minimal dashboard data to show something
        setDashboardData({
          team: {
            id: user?.uid || '',
            name: user?.teamName || 'My Team',
            balance: 15000,
          },
          activeRounds: [],
          activeBids: [],
          players: [],
          tiebreakers: [],
          activeBulkRounds: [],
          stats: {
            playerCount: 0,
            balance: 15000,
            totalSpent: 0,
            avgRating: 0,
            activeBidsCount: 0,
            positionBreakdown: {},
          },
        });
      } finally {
        if (showLoader) setIsLoading(false);
      }
    };

    fetchDashboard(true);

    let interval: NodeJS.Timeout;
    const startPolling = () => {
      const hasActiveContent = 
        (dashboardData?.activeRounds?.length || 0) > 0 ||
        (dashboardData?.activeBulkRounds?.length || 0) > 0 ||
        (dashboardData?.tiebreakers?.length || 0) > 0;
      
      const pollInterval = hasActiveContent ? 3000 : 10000;
      clearInterval(interval);
      interval = setInterval(() => fetchDashboard(false), pollInterval);
    };

    startPolling();
    const restartTimer = setTimeout(startPolling, 100);

    return () => {
      clearInterval(interval);
      clearTimeout(restartTimer);
    };
  }, [seasonStatus?.seasonId, dashboardData?.activeRounds?.length, dashboardData?.activeBulkRounds?.length, dashboardData?.tiebreakers?.length]);

  useEffect(() => {
    if (!dashboardData?.activeRounds) return;

    dashboardData.activeRounds.forEach(round => {
      if (round.end_time && !timerRefs.current[round.id]) {
        timerRefs.current[round.id] = setInterval(() => {
          const now = new Date().getTime();
          const end = new Date(round.end_time!).getTime();
          const remaining = Math.max(0, Math.floor((end - now) / 1000));
          setTimeRemaining(prev => ({ ...prev, [round.id]: remaining }));

          if (remaining <= 0) {
            clearInterval(timerRefs.current[round.id]);
            delete timerRefs.current[round.id];
          }
        }, 1000);
      }
    });

    Object.keys(timerRefs.current).forEach(id => {
      const roundId = parseInt(id);
      if (!dashboardData.activeRounds.find(r => r.id === roundId)) {
        clearInterval(timerRefs.current[roundId]);
        delete timerRefs.current[roundId];
      }
    });

    return () => {
      Object.values(timerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [dashboardData?.activeRounds]);

  useEffect(() => {
    if (!dashboardData?.activeBulkRounds) return;

    dashboardData.activeBulkRounds.forEach(bulkRound => {
      if (bulkRound.end_time && !bulkTimerRefs.current[bulkRound.id]) {
        bulkTimerRefs.current[bulkRound.id] = setInterval(() => {
          const now = new Date().getTime();
          const end = new Date(bulkRound.end_time!).getTime();
          const remaining = Math.max(0, Math.floor((end - now) / 1000));
          setBulkTimeRemaining(prev => ({ ...prev, [bulkRound.id]: remaining }));

          if (remaining <= 0) {
            clearInterval(bulkTimerRefs.current[bulkRound.id]);
            delete bulkTimerRefs.current[bulkRound.id];
          }
        }, 1000);
      }
    });

    Object.keys(bulkTimerRefs.current).forEach(id => {
      const bulkId = parseInt(id);
      if (!dashboardData.activeBulkRounds.find(br => br.id === bulkId)) {
        clearInterval(bulkTimerRefs.current[bulkId]);
        delete bulkTimerRefs.current[bulkId];
      }
    });

    return () => {
      Object.values(bulkTimerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, [dashboardData?.activeBulkRounds]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't show error - we always set default data in catch block
  if (!dashboardData) {
    return null;
  }

  const { team, activeRounds, players, tiebreakers, activeBulkRounds, stats } = dashboardData;

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        <div className="glass rounded-3xl p-4 sm:p-6 mb-6 backdrop-blur-md border border-white/20 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#0066FF] mb-1">{seasonStatus.seasonName}</h2>
              <div className="text-sm text-gray-600">
                Status: <span className="font-medium text-[#0066FF]">Active & Registered</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                {activeRounds.length} Active Round{activeRounds.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          <Link href="/dashboard/team/matches" className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-sm font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Matches
          </Link>
          <Link href="/dashboard/team/team-leaderboard" className="inline-flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Leaderboard
          </Link>
        </div>

        {tiebreakers.length > 0 && (
          <div className="glass rounded-3xl p-4 sm:p-6 mb-6 border-2 border-yellow-400 shadow-lg animate-pulse">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div className="flex items-center">
                <div className="bg-yellow-100 p-2 rounded-full mr-3">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-600">URGENT: Active Tiebreakers</h2>
                  <p className="text-sm text-red-500">Action required: Resolve tie bids immediately</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-red-100 text-red-800 text-sm font-medium">
                {tiebreakers.length} pending
              </span>
            </div>
          </div>
        )}

        {activeBulkRounds.map(bulkRound => (
          <div key={bulkRound.id} className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-6 sm:p-8 mb-6 shadow-2xl">
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></div>
                  LIVE NOW
                </div>
                <div className="flex items-center bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-mono font-bold">{formatTime(bulkTimeRemaining[bulkRound.id] || 0)}</span>
                </div>
              </div>
            </div>
            <div className="relative z-10 text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">BULK BIDDING ROUND</h2>
              <p className="text-purple-100 text-lg font-medium">
                Fixed Price: <span className="text-yellow-300 text-xl font-bold">£{bulkRound.base_price.toLocaleString()}</span> per player
              </p>
            </div>
            <div className="text-center">
              <Link href={`/dashboard/team/bulk-round/${bulkRound.id}`} className="inline-flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold px-8 py-4 rounded-2xl shadow-xl transform hover:scale-105 transition-all">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Enter Bulk Round
              </Link>
            </div>
          </div>
        ))}

        <div className="glass rounded-3xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <div className="flex items-center">
              <div className="mr-3">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={`${team.name} logo`} className="w-12 h-12 rounded-lg object-contain border-2 border-[#0066FF]/20 shadow-md" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/30 rounded-lg flex items-center justify-center border-2 border-[#0066FF]/20 shadow-md">
                    <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">{team.name}</h2>
                <span className="text-sm text-gray-500">Team Overview</span>
              </div>
            </div>
            <span className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] font-medium shadow-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Balance: £{stats.balance.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="glass-card p-4 sm:p-5 rounded-2xl">
              <h3 className="text-md font-medium text-dark mb-3">Team Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/30 p-2 sm:p-3 rounded-xl">
                  <p className="text-xs text-gray-600">Players</p>
                  <p className="text-lg font-medium text-dark">{stats.playerCount}</p>
                </div>
                <div className="bg-white/30 p-2 sm:p-3 rounded-xl">
                  <p className="text-xs text-gray-600">Avg. Rating</p>
                  <p className="text-lg font-medium text-dark">{stats.avgRating || '-'}</p>
                </div>
                <div className="bg-white/30 p-2 sm:p-3 rounded-xl">
                  <p className="text-xs text-gray-600">Active Bids</p>
                  <p className="text-lg font-medium text-dark">{stats.activeBidsCount}</p>
                </div>
                <div className="bg-white/30 p-2 sm:p-3 rounded-xl">
                  <p className="text-xs text-gray-600">Total Spent</p>
                  <p className="text-lg font-medium text-dark">£{stats.totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl">
              <h3 className="text-md font-medium text-dark mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/dashboard/team/players" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors text-sm text-gray-700">
                  View My Players
                </Link>
                <Link href="/dashboard/team/bids" className="flex items-center px-3 py-2 rounded-xl hover:bg-white/40 transition-colors text-sm text-gray-700">
                  Bidding History
                </Link>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl">
              <h3 className="text-md font-medium text-dark mb-3">Position Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(stats.positionBreakdown).map(([position, count]) => (
                  <div key={position} className="bg-white/30 p-2 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{position}</span>
                      <span className="text-sm font-medium text-dark">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {activeRounds.map(round => (
          <div key={round.id} className="glass rounded-3xl p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <div className="flex items-center">
                <div className="bg-[#0066FF]/10 p-2 rounded-full mr-3">
                  <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-dark">Active Round: {round.position}</h2>
                  <p className="text-sm text-gray-500">Place bids on available players</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/dashboard/team/round/${round.id}`} className="px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] text-sm font-medium flex items-center">
                  View Full Round
                </Link>
                <div className="text-sm font-medium bg-gray-100 px-4 py-2 rounded-full flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono font-medium">{formatTime(timeRemaining[round.id] || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="glass rounded-3xl p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold gradient-text flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Your Team
            </h2>
            <span className="text-sm text-gray-500">{players.length} players</span>
          </div>

          {players.length === 0 ? (
            <div className="text-center py-8 bg-white/30 rounded-xl">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-500">No players in your team yet</h3>
              <p className="text-gray-500 text-sm">Players will appear here when you win auction rounds</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map(player => (
                <div key={player.id} className="glass rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#0066FF]/10 p-2 rounded-full">
                      <span className="text-lg font-bold text-[#0066FF]">{player.position}</span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium text-dark">{player.name}</h3>
                      <p className="text-xs text-gray-500">{player.nfl_team}</p>
                      <p className="text-sm font-medium text-[#0066FF] mt-1">
                        £{player.acquisition_value?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}