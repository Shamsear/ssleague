'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PreviewData {
  round_summary: {
    round_id: string;
    total_teams: number;
    lineups_submitted: number;
    lineups_locked: number;
    teams_without_lineups: number;
  };
  points_distribution: {
    total_points_to_award: number;
    average_points: number;
    highest_scoring_team: { team_name: string; points: number } | null;
    lowest_scoring_team: { team_name: string; points: number } | null;
  };
  team_breakdown: Array<{
    team_name: string;
    lineup_points: number;
    captain_bonus: number;
    vc_bonus: number;
    power_up: string;
    power_up_bonus: number;
    total_points: number;
    player_breakdown: Array<{
      player_name: string;
      position: string;
      base_points: number;
      multiplier: number;
      bonus_type: string;
      final_points: number;
    }>;
    is_locked: boolean;
  }>;
  power_ups_active: Array<{
    team_name: string;
    power_up: string;
  }>;
  warnings: Array<{
    type: string;
    severity: string;
    message: string;
    teams?: string[];
  }>;
  can_calculate: boolean;
}

export default function CalculatePointsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [selectedRound, setSelectedRound] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const loadPreview = async () => {
    if (!selectedRound) {
      setError('Please select a round');
      return;
    }

    setIsLoadingPreview(true);
    setError(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/lineups/calculate-points/preview', {
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

  const handleCalculate = async () => {
    if (!confirm('Are you sure you want to calculate points for this round? This action cannot be undone.')) {
      return;
    }
    
    setIsCalculating(true);
    setError(null);
    setSuccess(null);
    setResults(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/lineups/calculate-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          round_id: selectedRound
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to calculate points');
      }

      setSuccess(`Successfully calculated points for ${data.lineups_processed} lineups!`);
      setResults(data);
      setShowPreview(false);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate points');
    } finally {
      setIsCalculating(false);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-300 text-red-800';
      case 'high': return 'bg-orange-50 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      default: return 'bg-blue-50 border-blue-300 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
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
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Calculate Points</h1>
              <p className="text-gray-600">Calculate lineup points after round completes</p>
            </div>
          </div>

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

          {!showPreview && !results && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Important</h3>
                    <p className="text-sm text-amber-800">
                      Click "Preview Calculation" to see estimated points before executing. 
                      This will show you team-by-team breakdown and any issues.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Round
                  </label>
                  <select
                    value={selectedRound}
                    onChange={(e) => setSelectedRound(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Choose a round...</option>
                    <option value="round_1">Round 1</option>
                    <option value="round_2">Round 2</option>
                    <option value="round_3">Round 3</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">How Points Calculation Works</h3>
                      <p className="text-sm text-blue-800">
                        Points are calculated based on player performance in matches. Starting players earn points, 
                        Captain gets 2x multiplier, Vice-Captain gets 1.5x. Bench players earn 0 points unless Bench Boost is active.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={loadPreview}
                  disabled={isLoadingPreview || !selectedRound}
                  className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingPreview ? 'Loading Preview...' : '🔍 Preview Calculation'}
                </button>
              </div>
            </>
          )}

          {showPreview && previewData && (
            <div className="space-y-6">
              {/* Round Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📊 Round Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Teams</p>
                    <p className="text-2xl font-bold text-gray-900">{previewData.round_summary.total_teams}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Lineups Submitted</p>
                    <p className="text-2xl font-bold text-green-600">
                      {previewData.round_summary.lineups_submitted}/{previewData.round_summary.total_teams}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Points</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {previewData.points_distribution.total_points_to_award}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Average Points</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {previewData.points_distribution.average_points}
                    </p>
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
                          {warning.teams.map((team, i) => (
                            <li key={i}>{team}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Top/Bottom Performers */}
              {(previewData.points_distribution.highest_scoring_team || previewData.points_distribution.lowest_scoring_team) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previewData.points_distribution.highest_scoring_team && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">🏆 Highest Scoring Team</h4>
                      <p className="text-2xl font-bold text-green-700">
                        {previewData.points_distribution.highest_scoring_team.team_name}
                      </p>
                      <p className="text-3xl font-bold text-green-900 mt-2">
                        {previewData.points_distribution.highest_scoring_team.points} pts
                      </p>
                    </div>
                  )}
                  {previewData.points_distribution.lowest_scoring_team && (
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-6 border border-orange-200">
                      <h4 className="font-semibold text-orange-900 mb-2">📉 Lowest Scoring Team</h4>
                      <p className="text-2xl font-bold text-orange-700">
                        {previewData.points_distribution.lowest_scoring_team.team_name}
                      </p>
                      <p className="text-3xl font-bold text-orange-900 mt-2">
                        {previewData.points_distribution.lowest_scoring_team.points} pts
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Power-Ups Active */}
              {previewData.power_ups_active.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3">⚡ Power-Ups Active This Round</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewData.power_ups_active.map((pu, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                        {pu.team_name}: {pu.power_up.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Team-by-Team Breakdown */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📋 Team-by-Team Breakdown</h3>
                <div className="space-y-3">
                  {previewData.team_breakdown.map((team, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedTeam(expandedTeam === team.team_name ? null : team.team_name)}
                        className="w-full p-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-bold text-indigo-600">{team.team_name}</span>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                            {team.total_points} pts
                          </span>
                          {team.power_up !== 'None' && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              ⚡ {team.power_up.replace('_', ' ')}
                            </span>
                          )}
                          {!team.is_locked && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                              🔓 Unlocked
                            </span>
                          )}
                        </div>
                        <svg 
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedTeam === team.team_name ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {expandedTeam === team.team_name && (
                        <div className="p-4 bg-white border-t border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-xs text-gray-600">Base Points</p>
                              <p className="text-lg font-bold text-gray-900">{team.lineup_points}</p>
                            </div>
                            <div className="bg-green-50 rounded p-3">
                              <p className="text-xs text-green-700">Captain Bonus</p>
                              <p className="text-lg font-bold text-green-900">+{team.captain_bonus}</p>
                            </div>
                            <div className="bg-blue-50 rounded p-3">
                              <p className="text-xs text-blue-700">VC Bonus</p>
                              <p className="text-lg font-bold text-blue-900">+{team.vc_bonus}</p>
                            </div>
                            {team.power_up_bonus > 0 && (
                              <div className="bg-purple-50 rounded p-3">
                                <p className="text-xs text-purple-700">Power-Up</p>
                                <p className="text-lg font-bold text-purple-900">+{team.power_up_bonus}</p>
                              </div>
                            )}
                          </div>

                          <h5 className="font-semibold text-gray-900 mb-2">Player Breakdown</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Player</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Position</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Base</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Multiplier</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Final</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {team.player_breakdown.map((player, pidx) => (
                                  <tr key={pidx} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-900">{player.player_name}</td>
                                    <td className="px-3 py-2 text-gray-600">{player.position}</td>
                                    <td className="px-3 py-2 text-gray-700">{player.base_points}</td>
                                    <td className="px-3 py-2">
                                      {player.bonus_type ? (
                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
                                          {player.bonus_type}
                                        </span>
                                      ) : (
                                        <span className="text-gray-500">1x</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-green-600">{player.final_points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                  onClick={handleCalculate}
                  disabled={isCalculating || !previewData.can_calculate}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCalculating ? 'Calculating...' : '✅ Confirm & Calculate Points'}
                </button>
              </div>

              {!previewData.can_calculate && (
                <p className="text-sm text-red-600 text-center">
                  ⚠️ Cannot calculate due to critical warnings. Please resolve issues first.
                </p>
              )}
            </div>
          )}

          {results && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Calculation Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <span className="text-gray-700">Lineups Processed</span>
                  <span className="font-bold text-gray-900">{results.lineups_processed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <span className="text-gray-700">Total Points Awarded</span>
                  <span className="font-bold text-gray-900">{results.total_points_awarded}</span>
                </div>
                {results.highest_scoring_team && (
                  <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-700 mb-1">Highest Scoring Team</p>
                    <p className="text-lg font-bold text-amber-900">
                      {results.highest_scoring_team.points} points
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">How Points Calculation Works</h3>
                <p className="text-sm text-blue-800">
                  Points are calculated based on player performance in matches. Starting players earn points, 
                  Captain gets 2x multiplier, Vice-Captain gets 1.5x. Bench players earn 0 points unless Bench Boost is active.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Round
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Choose a round...</option>
                <option value="round_1">Round 1</option>
                <option value="round_2">Round 2</option>
                <option value="round_3">Round 3</option>
              </select>
            </div>

            {results && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Calculation Results</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-700">Lineups Processed</span>
                    <span className="font-bold text-gray-900">{results.lineups_processed}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-700">Total Points Awarded</span>
                    <span className="font-bold text-gray-900">{results.total_points_awarded}</span>
                  </div>
                  {results.highest_scoring_team && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-700 mb-1">Highest Scoring Team</p>
                      <p className="text-lg font-bold text-amber-900">
                        {results.highest_scoring_team.points} points
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Calculation Steps</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Fetch player performances</p>
                    <p className="text-sm text-gray-600">Get goals, assists, clean sheets from matches</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Calculate base points</p>
                    <p className="text-sm text-gray-600">Apply scoring rules to each player</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Apply multipliers</p>
                    <p className="text-sm text-gray-600">Captain (2x), Vice-Captain (1.5x), Form bonuses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Handle power-ups</p>
                    <p className="text-sm text-gray-600">Triple Captain, Bench Boost, etc.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
                    5
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Update standings</p>
                    <p className="text-sm text-gray-600">Add round points to team totals</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCalculate}
              disabled={isCalculating || !selectedRound}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Points'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
