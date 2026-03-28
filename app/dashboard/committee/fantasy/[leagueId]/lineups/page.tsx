'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface LineupStats {
  total_teams: number;
  lineups_submitted: number;
  lineups_locked: number;
  lineups_unlocked: number;
  teams_without_lineup: number;
}

interface PreviewData {
  summary: {
    total_teams: number;
    lineups_submitted: number;
    completion_rate: number;
    already_locked: number;
    to_be_locked_complete: number;
    to_be_locked_incomplete: number;
    teams_without_lineups: number;
  };
  lock_impact: {
    teams_will_be_locked: number;
    teams_already_locked: number;
    teams_remain_unlocked: number;
  };
  lineup_details: Array<{
    team_name: string;
    owner_name: string;
    status: string;
    starting_players: number;
    bench_players: number;
    has_captain: boolean;
    has_vice_captain: boolean;
    is_complete: boolean;
    is_locked: boolean;
    issues: string[] | null;
    submitted_at: string;
  }>;
  teams_without_lineups: Array<{
    team_name: string;
    owner_name: string;
  }>;
  incomplete_lineups: Array<{
    team_name: string;
    owner_name: string;
    issues: string[];
  }>;
  warnings: Array<{
    type: string;
    severity: string;
    message: string;
    teams?: any[];
  }>;
  can_lock: boolean;
}

export default function WeeklyLineupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [selectedRound, setSelectedRound] = useState('current');
  const [stats, setStats] = useState<LineupStats | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (user && leagueId && selectedRound !== 'current') {
      loadLineupStats();
    }
  }, [user, leagueId, selectedRound]);

  const loadLineupStats = async () => {
    if (selectedRound === 'current') return;
    
    setIsLoading(true);
    try {
      const response = await fetchWithTokenRefresh(
        `/api/fantasy/lineups/auto-lock?league_id=${leagueId}&round_id=${selectedRound}`
      );
      const data = await response.json();
      
      if (data.success) {
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading lineup stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreview = async () => {
    if (selectedRound === 'current') {
      setError('Please select a specific round');
      return;
    }

    setIsLoadingPreview(true);
    setError(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/lineups/auto-lock/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          round_id: selectedRound
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load preview');
      }

      setPreviewData(data.preview);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAutoLock = async () => {
    if (!confirm('Are you sure you want to lock all lineups for this round? Teams will not be able to make changes after this.')) {
      return;
    }
    
    setIsLocking(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/lineups/auto-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          round_id: selectedRound
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to lock lineups');
      }

      setSuccess(`Successfully locked ${data.lineups_locked} lineups!`);
      setShowPreview(false);
      loadLineupStats();
    } catch (err: any) {
      setError(err.message || 'Failed to lock lineups');
    } finally {
      setIsLocking(false);
    }
  };

  if (loading) {
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

  const completionRate = stats ? Math.round((stats.lineups_submitted / stats.total_teams) * 100) : 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-300 text-red-800';
      case 'high': return 'bg-orange-50 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      default: return 'bg-blue-50 border-blue-300 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Locked': return 'bg-green-100 text-green-800';
      case 'Ready to Lock': return 'bg-blue-100 text-blue-800';
      case 'Incomplete': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Weekly Lineups</h1>
                <p className="text-gray-600">View and manage team lineups for current round</p>
              </div>
            </div>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="current">Current Round</option>
              <option value="round_1">Round 1</option>
              <option value="round_2">Round 2</option>
              <option value="round_3">Round 3</option>
            </select>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700 mb-1">Lineups Submitted</p>
                <p className="text-3xl font-bold text-green-900">{stats.lineups_submitted}/{stats.total_teams}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700 mb-1">Lineups Locked</p>
                <p className="text-3xl font-bold text-blue-900">{stats.lineups_locked}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-700 mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-900">{stats.teams_without_lineup}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-700 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-purple-900">{completionRate}%</p>
              </div>
            </div>
          )}

          {!stats && selectedRound === 'current' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700 mb-1">Lineups Submitted</p>
                <p className="text-3xl font-bold text-green-900">0/0</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700 mb-1">Lineups Locked</p>
                <p className="text-3xl font-bold text-blue-900">0</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-700 mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-900">0</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-700 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-purple-900">0%</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Success</h3>
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {!showPreview && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Lineup Requirements</h3>
                    <p className="text-sm text-blue-800">
                      Each team must select 5 starting players and 2 bench players from their squad. 
                      They must also designate a Captain (2x points) and Vice-Captain (1.5x points).
                    </p>
                  </div>
                </div>
              </div>

              {stats && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Important</h3>
                      <p className="text-sm text-amber-800">
                        Click "Preview Auto-Lock" to see which lineups will be locked before executing. 
                        This will show you completion status and any issues.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-6 text-center">
                {isLoading ? (
                  <div className="py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading lineup data...</p>
                  </div>
                ) : stats ? (
                  <button
                    onClick={loadPreview}
                    disabled={isLoadingPreview}
                    className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingPreview ? 'Loading Preview...' : '🔍 Preview Auto-Lock'}
                  </button>
                ) : (
                  <>
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedRound === 'current' ? 'No Lineups Yet' : 'Select a Round'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {selectedRound === 'current' 
                        ? 'Team lineups will appear here once they start submitting for the current round.'
                        : 'Select a specific round from the dropdown to view lineup statistics.'}
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          {showPreview && previewData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📊 Lineup Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                    <p className="text-2xl font-bold text-gray-900">{previewData.summary.total_teams}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Lineups Submitted</p>
                    <p className="text-2xl font-bold text-green-600">
                      {previewData.summary.lineups_submitted}/{previewData.summary.total_teams}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {previewData.summary.completion_rate}%
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Already Locked</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {previewData.summary.already_locked}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lock Impact */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">🔒 Lock Impact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Will Be Locked</p>
                    <p className="text-3xl font-bold text-green-600">{previewData.lock_impact.teams_will_be_locked}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Already Locked</p>
                    <p className="text-3xl font-bold text-blue-600">{previewData.lock_impact.teams_already_locked}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Remain Unlocked</p>
                    <p className="text-3xl font-bold text-gray-600">{previewData.lock_impact.teams_remain_unlocked}</p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {previewData.warnings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 text-lg">⚠️ Warnings</h3>
                  {previewData.warnings.map((warning, idx) => (
                    <div key={idx} className={`border rounded-lg p-4 ${getSeverityColor(warning.severity)}`}>
                      <p className="font-semibold mb-2">{warning.message}</p>
                      {warning.teams && warning.teams.length > 0 && (
                        <ul className="list-disc list-inside text-sm mt-2">
                          {warning.teams.map((team: any, i: number) => (
                            <li key={i}>{team.team_name} ({team.owner_name})</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Teams Without Lineups */}
              {previewData.teams_without_lineups.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3">❌ Teams Without Lineups</h4>
                  <div className="space-y-2">
                    {previewData.teams_without_lineups.map((team, idx) => (
                      <div key={idx} className="bg-white rounded p-3 text-sm">
                        <span className="font-medium text-gray-900">{team.team_name}</span>
                        <span className="text-gray-600"> - {team.owner_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incomplete Lineups */}
              {previewData.incomplete_lineups.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-3">⚠️ Incomplete Lineups</h4>
                  <div className="space-y-2">
                    {previewData.incomplete_lineups.map((team, idx) => (
                      <div key={idx} className="bg-white rounded p-3">
                        <div className="font-medium text-gray-900 mb-1">
                          {team.team_name} ({team.owner_name})
                        </div>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {team.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lineup Details */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📋 Team-by-Team Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Team</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Owner</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Starting</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Captain</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">VC</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.lineup_details.map((lineup, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{lineup.team_name}</td>
                          <td className="px-4 py-3 text-gray-700">{lineup.owner_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lineup.status)}`}>
                              {lineup.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{lineup.starting_players}/5</td>
                          <td className="px-4 py-3">
                            {lineup.has_captain ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600">✗</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lineup.has_vice_captain ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600">✗</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {lineup.submitted_at ? new Date(lineup.submitted_at).toLocaleString() : 'Not submitted'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAutoLock}
                  disabled={isLocking || !previewData.can_lock}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLocking ? 'Locking...' : '✅ Confirm & Lock All Lineups'}
                </button>
              </div>

              {!previewData.can_lock && (
                <p className="text-sm text-red-600 text-center">
                  ⚠️ Cannot lock due to critical warnings. Please resolve issues first.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
