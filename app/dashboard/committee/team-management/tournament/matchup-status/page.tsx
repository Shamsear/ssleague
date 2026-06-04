'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FixtureMatchupStatus {
  fixture_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  status: string;
  leg: string;
  matchup_mode: string;
  matchups_created_by: string | null;
  matchups_created_at: string | null;
  matchup_count: number;
  created_by_team_name: string | null;
  home_lineup_submitted: boolean;
  away_lineup_submitted: boolean;
}

interface TournamentInfo {
  id: string;
  tournament_name: string;
  season_id: string;
}

export default function MatchupStatusPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<FixtureMatchupStatus[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [error, setError] = useState('');

  // Helper function to format submission time
  const formatSubmissionTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Not created';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!user) return;

      setIsLoadingTournaments(true);
      try {
        const response = await fetchWithTokenRefresh('/api/tournaments');
        if (response.ok) {
          const data = await response.json();
          setTournaments(data.tournaments || []);
          if (data.tournaments && data.tournaments.length > 0) {
            setSelectedTournament(data.tournaments[0].id);
          }
        } else {
          setError('Failed to load tournaments');
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError('Failed to load tournaments');
      } finally {
        setIsLoadingTournaments(false);
      }
    };

    fetchTournaments();
  }, [user]);

  // Fetch matchup status
  useEffect(() => {
    const fetchMatchupStatus = async () => {
      if (!selectedTournament) return;

      setIsLoading(true);
      setError('');

      try {
        const response = await fetchWithTokenRefresh(
          `/api/tournaments/${selectedTournament}/matchup-status`
        );

        if (response.ok) {
          const data = await response.json();
          setFixtures(data.fixtures || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to load matchup status:', errorData);
          setError('Failed to load matchup status');
        }
      } catch (err) {
        console.error('Error fetching matchup status:', err);
        setError('Failed to load matchup status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatchupStatus();
  }, [selectedTournament]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  const matchupsCreated = fixtures.filter(f => f.matchup_count > 0).length;
  const pendingMatchups = fixtures.filter(
    f => f.matchup_count === 0 && f.home_lineup_submitted && f.away_lineup_submitted
  ).length;
  const waitingForLineups = fixtures.filter(
    f => f.matchup_count === 0 && (!f.home_lineup_submitted || !f.away_lineup_submitted)
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-2xl md:rounded-3xl p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-3xl font-bold text-dark mb-1 md:mb-2 truncate">Matchup Submission Status</h1>
              <p className="text-sm md:text-base text-gray-600">Track which teams have created matchups</p>
            </div>
            <Link
              href="/dashboard/committee/team-management/tournament"
              className="px-3 md:px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-xs md:text-sm font-medium flex items-center justify-center shadow-sm flex-shrink-0"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>

          {/* Tournament Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs md:text-sm font-medium text-gray-700 flex-shrink-0">Tournament:</label>
            {isLoadingTournaments ? (
              <div className="flex items-center gap-2 px-3 md:px-4 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0066FF]"></div>
                <span className="text-xs md:text-sm text-gray-600">Loading tournaments...</span>
              </div>
            ) : tournaments.length === 0 ? (
              <div className="px-3 md:px-4 py-2 text-xs md:text-sm text-red-600 bg-red-50 rounded-xl">
                No tournaments found
              </div>
            ) : (
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="flex-1 sm:flex-initial px-3 md:px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-xs md:text-sm min-w-0"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.tournament_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="glass rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-gray-800">{fixtures.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Fixtures</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{matchupsCreated}</div>
            <div className="text-sm text-gray-600 mt-1">Matchups Created</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingMatchups}</div>
            <div className="text-sm text-gray-600 mt-1">Ready (Lineups Done)</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{waitingForLineups}</div>
            <div className="text-sm text-gray-600 mt-1">Waiting for Lineups</div>
          </div>
        </div>

        {/* Fixtures List */}
        <div className="glass rounded-3xl p-4 md:p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading fixtures...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600">No fixtures found for this tournament</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Round
                        </th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Matchup
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lineups
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Matchups
                        </th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created By
                        </th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created At
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white/30">
                      {fixtures.map((fixture) => {
                        const bothLineupsSubmitted = fixture.home_lineup_submitted && fixture.away_lineup_submitted;
                        const hasMatchups = fixture.matchup_count > 0;

                        let statusColor = 'bg-red-100 text-red-800';
                        let statusText = 'Waiting';
                        
                        if (hasMatchups) {
                          statusColor = 'bg-green-100 text-green-800';
                          statusText = 'Complete';
                        } else if (bothLineupsSubmitted) {
                          statusColor = 'bg-yellow-100 text-yellow-800';
                          statusText = 'Ready';
                        }

                        return (
                          <tr key={fixture.fixture_id} className="hover:bg-white/50 transition-colors">
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                R{fixture.round_number}
                              </div>
                              <div className="text-xs text-gray-500">{fixture.leg}</div>
                            </td>
                            <td className="px-3 md:px-6 py-4">
                              <div className="text-sm text-gray-900">
                                <div className="font-medium">{fixture.home_team_name}</div>
                                <div className="text-xs text-gray-500">vs</div>
                                <div className="font-medium">{fixture.away_team_name}</div>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center gap-1">
                                {fixture.home_lineup_submitted ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    H✓
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    H✗
                                  </span>
                                )}
                                {fixture.away_lineup_submitted ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    A✓
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    A✗
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              {hasMatchups ? (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ {fixture.matchup_count}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  0
                                </span>
                              )}
                            </td>
                            <td className="px-3 md:px-6 py-4">
                              {fixture.created_by_team_name ? (
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {fixture.created_by_team_name}
                                  </div>
                                  {fixture.matchup_mode && (
                                    <div className="text-xs text-gray-500 capitalize">
                                      {fixture.matchup_mode.replace('_', ' ')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 md:px-6 py-4">
                              {fixture.matchups_created_at ? (
                                <div className="text-sm">
                                  <div className="text-gray-900 font-medium">
                                    {formatSubmissionTime(fixture.matchups_created_at)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(fixture.matchups_created_at).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
