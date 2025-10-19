'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getTeamById } from '@/lib/firebase/teams';
import { TeamData } from '@/types/team';

export default function TeamDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
    if (!loading && user && user.role === 'super_admin') {
      loadTeamData();
    }
  }, [user, loading, router]);

  const loadTeamData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      
      const teamData = await getTeamById(teamId);
      if (!teamData) {
        setError('Team not found');
        return;
      }
      
      setTeam(teamData);
      
    } catch (err) {
      console.error('Error loading team data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load team data';
      setError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Team</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadTeamData()}
              className="px-4 py-2 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0066FF]/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard/superadmin/teams')}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Teams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  // Extract seasons from performance_history
  const historicalSeasons = team.performance_history 
    ? Object.entries(team.performance_history).map(([seasonId, stats]) => ({
        seasonId,
        ...stats
      }))
    : [];

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex items-start gap-3 mb-4">
            <button
              onClick={() => router.push('/dashboard/superadmin/teams')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors flex-shrink-0 mt-1"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center flex-shrink-0">
                  {team.logo ? (
                    <img 
                      src={team.logo} 
                      alt={`${team.team_name} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#0066FF] font-bold text-lg sm:text-2xl">{team.team_code}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">{team.team_name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">{team.team_code}</span>
                    <span className="text-gray-400">•</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      team.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Owner Information */}
        {team.owner_name && (
          <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
            <h2 className="text-xl font-bold gradient-text mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Owner Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-blue-50 mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Owner Name</p>
                  <p className="text-sm font-semibold text-gray-900">{team.owner_name}</p>
                </div>
              </div>
              {team.owner_email && (
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-green-50 mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-semibold text-gray-900">{team.owner_email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Historical Performance */}
        <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00 2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Historical Performance Across Seasons
          </h2>

          {historicalSeasons.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Season</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Played</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Won</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Drawn</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Lost</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Points</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Goals F</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Goals A</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">GD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/30">
                  {historicalSeasons.map((season, index) => (
                    <tr key={season.seasonId} className="hover:bg-white/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                          {season.seasonId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">{season.players_count || 0}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">{season.season_stats?.matches_played || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">{season.season_stats?.matches_won || 0}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">{season.season_stats?.matches_drawn || 0}</td>
                      <td className="px-6 py-4 text-center text-sm text-red-600">{season.season_stats?.matches_lost || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-[#0066FF]">{season.season_stats?.total_points || 0}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">{season.season_stats?.total_goals || 0}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">{season.season_stats?.total_conceded || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{season.season_stats?.goal_difference || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00 2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Historical Data</h3>
              <p className="text-gray-500">This team doesn't have historical performance data across seasons yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
