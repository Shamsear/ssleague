'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAutoLockLineups } from '@/hooks/useAutoLockLineups';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface LineupStatus {
  fixture_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  scheduled_date?: string;
  home_lineup_submitted: boolean;
  home_lineup_locked: boolean;
  home_warning_given: boolean;
  away_lineup_submitted: boolean;
  away_lineup_locked: boolean;
  away_warning_given: boolean;
}

export default function CommitteeLineupMonitoringPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [seasonId, setSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<any[]>([]);
  const [rounds, setRounds] = useState<number[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [lineupStatuses, setLineupStatuses] = useState<LineupStatus[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'committee') {
      fetchSeasons();
    }
  }, [user]);

  useEffect(() => {
    if (seasonId) {
      fetchRounds();
    }
  }, [seasonId]);

  useEffect(() => {
    if (seasonId && selectedRound) {
      fetchLineupStatuses();
    }
  }, [seasonId, selectedRound]);

  const fetchSeasons = async () => {
    try {
      const response = await fetchWithTokenRefresh('/api/seasons?status=active');
      const data = await response.json();
      if (data.success && data.seasons.length > 0) {
        setSeasons(data.seasons);
        setSeasonId(data.seasons[0].id);
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchRounds = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/rounds?season_id=${seasonId}`);
      const data = await response.json();
      if (data.success && data.rounds) {
        const roundNumbers = [...new Set(data.rounds.map((r: any) => r.round_number))].sort((a, b) => a - b);
        setRounds(roundNumbers);
        if (roundNumbers.length > 0 && !selectedRound) {
          setSelectedRound(roundNumbers[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching rounds:', err);
    }
  };

  const fetchLineupStatuses = async () => {
    try {
      setLoadingData(true);
      setError(null);

      const response = await fetchWithTokenRefresh(`/api/lineups/missing?round_number=${selectedRound}&season_id=${seasonId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch lineup statuses');
      }

      // Transform the data to include all fixtures with their lineup status
      const statuses: LineupStatus[] = [];
      
      // Get all fixtures for this round
      const fixturesRes = await fetchWithTokenRefresh(`/api/fixtures?season_id=${seasonId}&round_number=${selectedRound}`);
      const fixturesData = await fixturesRes.json();

      if (fixturesData.success && fixturesData.fixtures) {
        for (const fixture of fixturesData.fixtures) {
          // Check if home team has lineup
          const homeLineupRes = await fetchWithTokenRefresh(`/api/lineups?fixture_id=${fixture.id}&team_id=${fixture.home_team_id}`);
          const homeLineupData = await homeLineupRes.json();
          const homeLineup = homeLineupData.success && homeLineupData.lineups ? homeLineupData.lineups : null;

          // Check if away team has lineup
          const awayLineupRes = await fetchWithTokenRefresh(`/api/lineups?fixture_id=${fixture.id}&team_id=${fixture.away_team_id}`);
          const awayLineupData = await awayLineupRes.json();
          const awayLineup = awayLineupData.success && awayLineupData.lineups ? awayLineupData.lineups : null;

          statuses.push({
            fixture_id: fixture.id,
            round_number: fixture.round_number,
            match_number: fixture.match_number,
            home_team_id: fixture.home_team_id,
            home_team_name: fixture.home_team_name,
            away_team_id: fixture.away_team_id,
            away_team_name: fixture.away_team_name,
            scheduled_date: fixture.scheduled_date,
            home_lineup_submitted: !!homeLineup,
            home_lineup_locked: homeLineup?.is_locked || false,
            home_warning_given: homeLineup?.warning_given || false,
            away_lineup_submitted: !!awayLineup,
            away_lineup_locked: awayLineup?.is_locked || false,
            away_warning_given: awayLineup?.warning_given || false,
          });
        }
      }

      setLineupStatuses(statuses);
    } catch (err: any) {
      console.error('Error fetching lineup statuses:', err);
      setError(err.message || 'Failed to load lineup statuses');
    } finally {
      setLoadingData(false);
    }
  };

  const handleLockLineup = async (fixtureId: string, teamId: string, teamName: string) => {
    if (!confirm(`Manually lock lineup for ${teamName}?`)) return;

    try {
      const lineupId = `lineup_${fixtureId}_${teamId}`;
      const response = await fetchWithTokenRefresh(`/api/lineups/${lineupId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locked_by: user?.uid,
          locked_by_name: user?.display_name || user?.email
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Lineup locked successfully');
        fetchLineupStatuses();
      } else {
        alert(`Failed to lock lineup: ${data.error}`);
      }
    } catch (err) {
      console.error('Error locking lineup:', err);
      alert('Failed to lock lineup');
    }
  };

  const handleProcessDeadlines = async () => {
    if (!confirm('Process all due lineup deadlines and auto-lock them for this round?')) return;

    try {
      setProcessing(true);
      const response = await fetchWithTokenRefresh('/api/lineups/process-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          round_number: selectedRound
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully processed ${data.processed} lineup locks`);
        fetchLineupStatuses();
      } else {
        alert(`Failed to process locks: ${data.error}`);
      }
    } catch (err) {
      console.error('Error processing locks:', err);
      alert('Failed to process deadline locks');
    } finally {
      setProcessing(false);
    }
  };

  const totalFixtures = lineupStatuses.length;
  const totalLineups = totalFixtures * 2;
  const submittedLineups = lineupStatuses.reduce((count, status) => {
    return count + (status.home_lineup_submitted ? 1 : 0) + (status.away_lineup_submitted ? 1 : 0);
  }, 0);
  const missingLineups = totalLineups - submittedLineups;
  const completionRate = totalLineups > 0 ? ((submittedLineups / totalLineups) * 100).toFixed(0) : 0;

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 hover:text-blue-600 font-medium transition-all rounded-lg shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Title */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Lineup Monitoring
              </h1>
              <p className="text-gray-600 mt-1">Track lineup submissions for all teams</p>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
              <select
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Round</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {rounds.map(round => (
                  <option key={round} value={round}>
                    Round {round}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Process Deadlines</label>
              <button
                onClick={handleProcessDeadlines}
                disabled={processing}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Auto-Lock Due Deadlines
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-gray-200/50">
            <div className="text-3xl font-bold text-gray-900">{totalFixtures}</div>
            <div className="text-sm text-gray-600">Total Fixtures</div>
          </div>
          <div className="glass rounded-xl p-4 border border-green-200/50 bg-green-50/30">
            <div className="text-3xl font-bold text-green-600">{submittedLineups}</div>
            <div className="text-sm text-green-700 font-medium">Submitted</div>
          </div>
          <div className="glass rounded-xl p-4 border border-red-200/50 bg-red-50/30">
            <div className="text-3xl font-bold text-red-600">{missingLineups}</div>
            <div className="text-sm text-red-700 font-medium">Missing</div>
          </div>
          <div className="glass rounded-xl p-4 border border-blue-200/50 bg-blue-50/30">
            <div className="text-3xl font-bold text-blue-600">{completionRate}%</div>
            <div className="text-sm text-blue-700 font-medium">Complete</div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Lineup Status Table */}
        <div className="glass rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Match</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Home Team</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Home Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Away Team</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Away Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white/50">
                {lineupStatuses.map((status, idx) => (
                  <tr key={status.fixture_id} className={idx % 2 === 0 ? 'bg-white/30' : 'bg-white/50'}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        Match #{status.match_number}
                      </div>
                      {status.scheduled_date && (
                        <div className="text-xs text-gray-500">
                          {new Date(status.scheduled_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{status.home_team_name}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {status.home_lineup_locked ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-400 text-white">
                          🔒 Locked
                        </span>
                      ) : status.home_lineup_submitted ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                          ✓ Submitted
                        </span>
                      ) : status.home_warning_given ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                          ⚠️ Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                          ❌ Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{status.away_team_name}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {status.away_lineup_locked ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-400 text-white">
                          🔒 Locked
                        </span>
                      ) : status.away_lineup_submitted ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                          ✓ Submitted
                        </span>
                      ) : status.away_warning_given ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                          ⚠️ Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                          ❌ Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {status.home_lineup_submitted && !status.home_lineup_locked && (
                          <button
                            onClick={() => handleLockLineup(status.fixture_id, status.home_team_id, status.home_team_name)}
                            className="px-3 py-1 text-xs rounded-md bg-gray-600 text-white hover:bg-gray-700 transition-all"
                          >
                            Lock Home
                          </button>
                        )}
                        {status.away_lineup_submitted && !status.away_lineup_locked && (
                          <button
                            onClick={() => handleLockLineup(status.fixture_id, status.away_team_id, status.away_team_name)}
                            className="px-3 py-1 text-xs rounded-md bg-gray-600 text-white hover:bg-gray-700 transition-all"
                          >
                            Lock Away
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
