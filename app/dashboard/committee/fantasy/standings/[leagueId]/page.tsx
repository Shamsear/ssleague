'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import ShareableFantasyLeaderboard from '@/components/fantasy/ShareableFantasyLeaderboard';

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

export default function FantasyStandingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!leagueId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/leaderboard/${leagueId}`);
        if (!response.ok) throw new Error('Failed to load leaderboard');

        const data = await response.json();
        setLeague(data.league);
        setLeaderboard(data.leaderboard || []);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy standings',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeaderboard();
    }
  }, [user, leagueId]);

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

  if (!user || !league) return null;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-400', text: 'text-yellow-900', icon: '🥇' };
    if (rank === 2) return { bg: 'bg-gray-300', text: 'text-gray-700', icon: '🥈' };
    if (rank === 3) return { bg: 'bg-orange-400', text: 'text-orange-900', icon: '🥉' };
    return { bg: 'bg-gray-200', text: 'text-gray-600', icon: '#' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Fantasy Standings</h1>
                <p className="text-gray-600 mt-1">{league.name} - League Rankings</p>
              </div>
            </div>
            
            {leaderboard.length > 0 && (
              <ShareableFantasyLeaderboard
                teams={leaderboard}
                leagueName={league.name}
              />
            )}
          </div>
        </div>

        {/* Full Leaderboard Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
            <h2 className="text-xl font-bold text-gray-900">Complete Standings</h2>
            <p className="text-sm text-gray-600 mt-1">{leaderboard.length} teams competing</p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">No standings available yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Round</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaderboard.map((entry, index) => {
                    const badge = getRankBadge(entry.rank || index + 1);
                    return (
                      <tr 
                        key={entry.fantasy_team_id}
                        className={`hover:bg-indigo-50 transition-colors ${
                          index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${badge.bg} ${badge.text} font-bold text-sm`}>
                            {badge.icon === '#' ? entry.rank || index + 1 : badge.icon}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {entry.team_logo ? (
                              <img 
                                src={entry.team_logo} 
                                alt={`${entry.team_name} logo`}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                {entry.team_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <p className="font-semibold text-gray-900">{entry.team_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {entry.player_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-gray-900 font-medium">
                            {entry.last_round_points > 0 ? `+${entry.last_round_points}` : entry.last_round_points}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-2xl font-bold text-indigo-600">{entry.total_points}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        {leaderboard.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-600 mb-1">Highest Score</p>
              <p className="text-2xl font-bold text-green-600">{Math.max(...leaderboard.map(e => e.total_points))}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-600 mb-1">Average Score</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(leaderboard.reduce((sum, e) => sum + e.total_points, 0) / leaderboard.length)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-600 mb-1">Total Players</p>
              <p className="text-2xl font-bold text-purple-600">
                {leaderboard.reduce((sum, e) => sum + e.player_count, 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
