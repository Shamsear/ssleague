'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FixtureLineupStatus {
  fixture_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  home_lineup_submitted: boolean;
  away_lineup_submitted: boolean;
  home_lineup_count: number;
  away_lineup_count: number;
  home_total_players: number;
  away_total_players: number;
  status: string;
  leg: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  season_id: string;
}

export default function LineupStatusPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<FixtureLineupStatus[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return; // Wait for auth to complete
    
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

      try {
        const response = await fetchWithTokenRefresh('/api/tournaments');
        if (response.ok) {
          const data = await response.json();
          setTournaments(data.tournaments || []);
          if (data.tournaments && data.tournaments.length > 0) {
            setSelectedTournament(data.tournaments[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      }
    };

    fetchTournaments();
  }, [user]);

  // Fetch lineup status
  useEffect(() => {
    const fetchLineupStatus = async () => {
      if (!selectedTournament) return;

      setIsLoading(true);
      setError('');

      try {
        const response = await fetchWithTokenRefresh(
          `/api/tournaments/${selectedTournament}/lineup-status`
        );

        if (response.ok) {
          const data = await response.json();
          setFixtures(data.fixtures || []);
        } else {
          setError('Failed to load lineup status');
        }
      } catch (err) {
        console.error('Error fetching lineup status:', err);
        setError('Failed to load lineup status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLineupStatus();
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

  const submittedCount = fixtures.filter(
    f => f.home_lineup_submitted && f.away_lineup_submitted
  ).length;
  const partialCount = fixtures.filter(
    f => (f.home_lineup_submitted && !f.away_lineup_submitted) || 
         (!f.home_lineup_submitted && f.away_lineup_submitted)
  ).length;
  const pendingCount = fixtures.filter(
    f => !f.home_lineup_submitted && !f.away_lineup_submitted
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-dark mb-2">Lineup Submission Status</h1>
              <p className="text-gray-600">Track which teams have submitted their lineups</p>
            </div>
            <Link
              href="/dashboard/committee/team-management/tournament"
              className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>

          {/* Tournament Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Tournament:</label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{fixtures.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Fixtures</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{submittedCount}</div>
            <div className="text-sm text-gray-600 mt-1">Both Submitted</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{partialCount}</div>
            <div className="text-sm text-gray-600 mt-1">Partial</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{pendingCount}</div>
            <div className="text-sm text-gray-600 mt-1">Pending</div>
          </div>
        </div>

        {/* Fixtures List */}
        <div className="glass rounded-3xl p-6">
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Round
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Team
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Lineup
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Away Team
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Away Lineup
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/30">
                  {fixtures.map((fixture) => {
                    const bothSubmitted = fixture.home_lineup_submitted && fixture.away_lineup_submitted;
                    const noneSubmitted = !fixture.home_lineup_submitted && !fixture.away_lineup_submitted;
                    
                    return (
                      <tr key={fixture.fixture_id} className="hover:bg-white/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            R{fixture.round_number}
                          </div>
                          <div className="text-xs text-gray-500">{fixture.leg}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fixture.home_team_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {fixture.home_lineup_submitted ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Submitted
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                {fixture.home_lineup_count} selected
                              </span>
                              <span className="text-xs text-gray-400">
                                {fixture.home_total_players} total
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Pending
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                {fixture.home_total_players} total
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fixture.away_team_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {fixture.away_lineup_submitted ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Submitted
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                {fixture.away_lineup_count} selected
                              </span>
                              <span className="text-xs text-gray-400">
                                {fixture.away_total_players} total
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Pending
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                {fixture.away_total_players} total
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            bothSubmitted
                              ? 'bg-green-100 text-green-800'
                              : noneSubmitted
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {bothSubmitted ? 'Ready' : noneSubmitted ? 'Pending' : 'Partial'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
