'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface LeaderboardEntry {
  rank: number;
  fantasy_team_id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  last_round_points: number;
  team_logo?: string;
}

export default function FantasyLeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [myTeamId, setMyTeamId] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!user) return;

      try {
        // First get user's team to find league ID
        const myTeamResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (myTeamResponse.status === 404) {
          setIsLoading(false);
          return;
        }

        const myTeamData = await myTeamResponse.json();
        const leagueId = myTeamData.team.fantasy_league_id;
        setMyTeamId(myTeamData.team.id);

        // Get leaderboard
        const leaderboardResponse = await fetchWithTokenRefresh(`/api/fantasy/leaderboard/${leagueId}`);
        
        if (!leaderboardResponse.ok) {
          throw new Error('Failed to load leaderboard');
        }

        const leaderboardData = await leaderboardResponse.json();
        setLeagueName(leaderboardData.league.name);
        setLeaderboard(leaderboardData.leaderboard);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeaderboard();
    }
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (leaderboard.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Fantasy League Yet</h2>
          <p className="text-gray-600 mb-6">
            The fantasy league hasn't been created yet.
          </p>
          <Link
            href="/dashboard/team"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-gray-200 to-gray-400';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/team/fantasy/my-team"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Team
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🏆 {leagueName}</h1>
              <p className="text-gray-600 mt-1">Fantasy League Standings</p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-8 border-b-4 border-yellow-300">
              <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
                {/* 2nd Place */}
                <div className="text-center pt-8">
                  <div className={`w-16 h-16 mx-auto bg-gradient-to-br ${getRankColor(2)} rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3`}>
                    🥈
                  </div>
                  <p className={`font-bold text-gray-900 mb-1 ${leaderboard[1].fantasy_team_id === myTeamId ? 'text-indigo-600' : ''}`}>
                    {leaderboard[1].team_name}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{leaderboard[1].total_points}</p>
                  <p className="text-xs text-gray-600">pts</p>
                </div>

                {/* 1st Place */}
                <div className="text-center">
                  <div className={`w-20 h-20 mx-auto bg-gradient-to-br ${getRankColor(1)} rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-3`}>
                    🥇
                  </div>
                  <p className={`font-bold text-gray-900 mb-1 ${leaderboard[0].fantasy_team_id === myTeamId ? 'text-indigo-600' : ''}`}>
                    {leaderboard[0].team_name}
                  </p>
                  <p className="text-3xl font-bold text-yellow-600">{leaderboard[0].total_points}</p>
                  <p className="text-sm text-gray-600">pts</p>
                </div>

                {/* 3rd Place */}
                <div className="text-center pt-8">
                  <div className={`w-16 h-16 mx-auto bg-gradient-to-br ${getRankColor(3)} rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3`}>
                    🥉
                  </div>
                  <p className={`font-bold text-gray-900 mb-1 ${leaderboard[2].fantasy_team_id === myTeamId ? 'text-indigo-600' : ''}`}>
                    {leaderboard[2].team_name}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{leaderboard[2].total_points}</p>
                  <p className="text-xs text-gray-600">pts</p>
                </div>
              </div>
            </div>
          )}

          {/* Full Rankings */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Full Standings</h3>
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.fantasy_team_id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    entry.fantasy_team_id === myTeamId
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
                      entry.rank <= 3 ? `bg-gradient-to-br ${getRankColor(entry.rank)}` : 'bg-gray-400'
                    }`}>
                      {getRankIcon(entry.rank)}
                    </div>
                    {entry.team_logo ? (
                      <img 
                        src={entry.team_logo} 
                        alt={`${entry.team_name} logo`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {entry.team_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className={`font-bold text-gray-900 ${entry.fantasy_team_id === myTeamId ? 'text-indigo-600' : ''}`}>
                        {entry.team_name}
                        {entry.fantasy_team_id === myTeamId && <span className="ml-2 text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">You</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-gray-600">Total</p>
                      <p className="text-xl font-bold text-indigo-600">{entry.total_points}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Players</p>
                      <p className="text-xl font-bold text-gray-900">{entry.player_count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Last Round</p>
                      <p className={`text-xl font-bold ${entry.last_round_points > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {entry.last_round_points || 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
